/**
 * stickky-kasa — alıcı ödedi mi, ödediyse paketi ver.
 *
 * Uçlar:
 *   POST /webhook/paddle         Paddle imzasını doğrular, transaction.completed
 *                                olayını KV'ye yazar (txn:<id> → {slug, musteri}).
 *   GET  /indir?txn=txn_…        İşlemi doğrular (önce KV, yoksa Paddle API),
 *                                süreli imzalı indirme bağlantıları döner.
 *   GET  /dosya/<slug>.<bicim>   İmza + süre doğru ise paketi KV'den akıtır.
 *   GET  /saglik                 Canlılık.
 *
 * Ödeme kanıtı sayfa değil, Paddle'ın kendisidir: teşekkür sayfası yalnız
 * işlem kimliğini taşır; kimlik KV'de ya da Paddle API'de "paid/completed"
 * görünmeden hiçbir bağlantı üretilmez. Bağlantılar HMAC imzalı ve süreli;
 * süre dolunca aynı işlem kimliğiyle yeniden alınabilir (alıcı sayfayı
 * kaybederse Paddle makbuzundaki kimlik yeter).
 */

const JSON_BASLIK = { 'content-type': 'application/json; charset=utf-8' };
const TXN = /^txn_[a-z\d]{26}$/;
const DOSYA = /^([a-z0-9-]{1,64})\.(wastickers|zip)$/;

const kodla = s => new TextEncoder().encode(s);
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function hmacHex(sir, metin) {
  const anahtar = await crypto.subtle.importKey('raw', kodla(sir), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', anahtar, kodla(metin)));
}

function esitZaman(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i++) fark |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return fark === 0;
}

/** Paddle-Signature: ts=…;h1=…  → HMAC-SHA256(sir, ts + ':' + hamGövde). lib/satis.js ile aynı. */
export async function paddleImzaDogrula(hamGovde, imzaBasligi, sir) {
  const parcalar = {};
  for (const p of String(imzaBasligi || '').split(';')) {
    const [k, v] = p.split('=');
    if (k && v) parcalar[k.trim()] = v.trim();
  }
  if (!parcalar.ts || !parcalar.h1 || !sir) return false;
  const beklenen = await hmacHex(sir, parcalar.ts + ':' + hamGovde);
  return esitZaman(beklenen, parcalar.h1);
}

export async function baglantiImzala(sir, ad, exp) {
  return hmacHex(sir, `${ad}:${exp}`);
}

function cors(env, istek) {
  const koken = istek.headers.get('origin') || '';
  const izinli = String(env.IZINLI_KOKENLER || '').split(',').map(s => s.trim()).filter(Boolean);
  const basliklar = { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' };
  if (izinli.includes(koken)) basliklar['access-control-allow-origin'] = koken;
  return basliklar;
}

const json = (govde, durum, ek) => new Response(JSON.stringify(govde), { status: durum || 200, headers: { ...JSON_BASLIK, ...(ek || {}) } });

/** Paddle olay gövdesinden işlem kaydı: {slug, musteri, durum}. */
function islemKaydi(data) {
  const ozel = (data && data.custom_data) || {};
  return { slug: typeof ozel.slug === 'string' ? ozel.slug : null, musteri: data.customer_id || null, durum: data.status || null, kayit: new Date().toISOString() };
}

async function islemiBul(env, txn) {
  const kv = await env.PAKET.get(`txn:${txn}`, 'json');
  if (kv && kv.slug && ['paid', 'completed'].includes(kv.durum || 'completed')) return kv;
  if (!env.PADDLE_API_KEY) return null;
  const cevap = await fetch(`${env.PADDLE_API_BASE || 'https://api.paddle.com'}/transactions/${txn}`, {
    headers: { authorization: `Bearer ${env.PADDLE_API_KEY}` },
  });
  if (!cevap.ok) return null;
  const { data } = await cevap.json();
  if (!data || !['paid', 'completed'].includes(data.status)) return null;
  const kayit = islemKaydi(data);
  if (!kayit.slug) return null;
  await env.PAKET.put(`txn:${txn}`, JSON.stringify(kayit));
  return kayit;
}

export default {
  async fetch(istek, env) {
    const url = new URL(istek.url);
    const ek = cors(env, istek);
    if (istek.method === 'OPTIONS') return new Response(null, { status: 204, headers: ek });

    if (url.pathname === '/saglik') return json({ ok: true, kasa: 'stickky' }, 200, ek);

    if (url.pathname === '/webhook/paddle' && istek.method === 'POST') {
      if (!env.PADDLE_WEBHOOK_SECRET) return json({ hata: 'webhook sırrı tanımlı değil' }, 503);
      const ham = await istek.text();
      if (!(await paddleImzaDogrula(ham, istek.headers.get('paddle-signature'), env.PADDLE_WEBHOOK_SECRET))) {
        return json({ hata: 'imza doğrulanamadı' }, 401);
      }
      let olay;
      try { olay = JSON.parse(ham); } catch { return json({ hata: 'gövde JSON değil' }, 400); }
      if (!['transaction.completed', 'transaction.paid'].includes(olay.event_type)) return json({ atlandi: olay.event_type });
      const data = olay.data || {};
      if (!TXN.test(data.id || '')) return json({ hata: 'işlem kimliği yok' }, 400);
      const kayit = islemKaydi(data);
      kayit.durum = kayit.durum || 'completed';
      await env.PAKET.put(`txn:${data.id}`, JSON.stringify(kayit));
      return json({ ok: true, slug: kayit.slug });
    }

    if (url.pathname === '/indir' && istek.method === 'GET') {
      const txn = url.searchParams.get('txn') || '';
      if (!TXN.test(txn)) return json({ hata: 'işlem kimliği biçimi' }, 400, ek);
      if (!env.IMZA_SIRRI) return json({ hata: 'kasa kurulmamış' }, 503, ek);
      const kayit = await islemiBul(env, txn);
      if (!kayit) return json({ hata: 'ödeme bulunamadı ya da henüz tamamlanmadı', txn }, 404, ek);
      const meta = await env.PAKET.get(`meta:${kayit.slug}`, 'json');
      if (!meta) return json({ hata: 'paket kasada yok', slug: kayit.slug }, 404, ek);
      const exp = Math.floor(Date.now() / 1000) + Number(env.BAGLANTI_OMRU_SN || 86400);
      const baglanti = async bicim => {
        const ad = `${kayit.slug}.${bicim}`;
        return `${url.origin}/dosya/${ad}?exp=${exp}&sig=${await baglantiImzala(env.IMZA_SIRRI, ad, exp)}`;
      };
      // telegram: t.me/addstickers bağlantısı (yayınlandıysa) — gerçek tek tık.
      return json({ ad: meta.ad, slug: kayit.slug, sticker: meta.sticker, exp, telegram: meta.telegram || null, wastickers: await baglanti('wastickers'), zip: await baglanti('zip') }, 200, ek);
    }

    const dosya = url.pathname.startsWith('/dosya/') && url.pathname.slice(7).match(DOSYA);
    if (dosya && istek.method === 'GET') {
      if (!env.IMZA_SIRRI) return json({ hata: 'kasa kurulmamış' }, 503);
      const ad = dosya[0], exp = Number(url.searchParams.get('exp') || 0), sig = url.searchParams.get('sig') || '';
      if (!exp || exp < Math.floor(Date.now() / 1000)) return json({ hata: 'bağlantının süresi doldu' }, 410);
      if (!esitZaman(await baglantiImzala(env.IMZA_SIRRI, ad, exp), sig)) return json({ hata: 'imza doğrulanamadı' }, 403);
      const govde = await env.PAKET.get(`paket:${ad}`, 'stream');
      if (!govde) return json({ hata: 'dosya kasada yok' }, 404);
      return new Response(govde, {
        headers: {
          'content-type': 'application/octet-stream',
          'content-disposition': `attachment; filename="${ad}"`,
          'cache-control': 'private, no-store',
        },
      });
    }

    return json({ hata: 'yol yok' }, 404, ek);
  },
};
