'use strict';
/**
 * Satış → teslimat köprüsü (^sp19'un yerelde test edilebilir yarısı).
 *
 * İki giriş:
 *  1. Elle satış linki: atölyeden "satış linki üret" → /t/<token>.
 *     Gumroad'dan önce de iş görür (ör. DM ile satış).
 *  2. Gumroad webhook'u: POST /api/webhook/gumroad. Ürün → set eşlemesi
 *     veri/urunler.json'dadır: { "<product_permalink>": "<setId>" }.
 *     DURUM: Gumroad'un gönderdiği alan adları hesap açılmadan
 *     DOĞRULANAMAZ — alan okuma toleranslı yazıldı, ilk gerçek satış
 *     webhook kaydıyla sınanacak.
 *
 * Token koruması F1'de erişim sayacıdır, kasa kilidi değil: dosyalar
 * localhost'ta zaten açık. Gerçek koruma (imzalı URL / süre sınırı)
 * internete çıkarken gelir — bilinçli erteleme.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const depo = require('./depo');
const teslimat = require('./teslimat');

const DOSYA = path.join(depo.VERI, 'teslimatlar.json');
const URUNLER = path.join(depo.VERI, 'urunler.json');

function liste() {
  try { return JSON.parse(fs.readFileSync(DOSYA, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}

function yaz(veri) {
  fs.mkdirSync(depo.VERI, { recursive: true });
  const gecici = DOSYA + '.tmp';
  fs.writeFileSync(gecici, JSON.stringify(veri, null, 2));
  fs.renameSync(gecici, DOSYA);
}

function tokenUret(setId, kaynak, not) {
  const set = depo.setBul(setId);
  if (!set) throw new Error('set yok: ' + setId);
  const kayitlar = liste();
  const kayit = {
    token: crypto.randomBytes(12).toString('hex'),
    setId,
    kaynak: kaynak || 'elle',
    not: not || null,
    olusturulma: new Date().toISOString(),
    acilis: 0,
    sonAcilis: null
  };
  kayitlar.push(kayit);
  yaz(kayitlar);
  return kayit;
}

/** /t/<token> — teslimat sayfasını token üzerinden sun. */
function tokenAc(token) {
  const kayitlar = liste();
  const kayit = kayitlar.find(k => k.token === token);
  if (!kayit) return null;
  kayit.acilis++;
  kayit.sonAcilis = new Date().toISOString();
  yaz(kayitlar);

  // Sayfa HER açılışta yeniden üretilir: teslimat sayfası paketin canlı
  // hali — trend setinde içerik değiştiyse alıcı yeni açılışta yenisini
  // görür. Göreli linkler /cikti/<set>/ altına baktığı için <base> enjekte
  // edilir — sayfa /t/ altından da doğru çalışır.
  const dosya = path.join(depo.KOK, 'cikti', kayit.setId, 'teslimat.html');
  teslimat.sayfaUret(kayit.setId);
  const govde = fs.readFileSync(dosya, 'utf8')
    .replace('<head>', '<head>\n<base href="/cikti/' + kayit.setId + '/">');
  return { kayit, govde };
}

/**
 * Gumroad webhook gövdesi (form-encoded çözülmüş nesne) → teslimat token'ı.
 * Alan adları toleranslı okunur; ürün eşlemesi yoksa kayıt düşülür ama
 * hata dönülmez (Gumroad 200 bekler, yoksa tekrar dener).
 */
function gumroadIsle(govde) {
  const urunAnahtari = govde.product_permalink || govde.permalink ||
    govde.product_id || govde.short_url || '';
  let eslesme = {};
  try { eslesme = JSON.parse(fs.readFileSync(URUNLER, 'utf8')); } catch {}
  const setId = eslesme[urunAnahtari];
  if (!setId || !depo.setBul(setId)) {
    return { ok: true, eslesme: false, urunAnahtari };
  }
  const kayit = tokenUret(setId, 'gumroad',
    (govde.email ? 'alıcı: ' + govde.email : null));
  return { ok: true, eslesme: true, token: kayit.token, url: '/t/' + kayit.token };
}

/* ---------- Paddle (seçilen sağlayıcı, 2026-08-14) ----------
 * Paddle Billing webhook'u: JSON gövde + "Paddle-Signature: ts=..;h1=.."
 * başlığı. İmza = HMAC-SHA256(sir, ts + ":" + hamGövde).
 * PADDLE_WEBHOOK_SECRET tanımlıysa imza ZORUNLU doğrulanır; tanımlı değilse
 * yerel geliştirme kipi sayılır ve sonuçta imza:'sir-yok' işaretlenir.
 * DURUM: Gerçek Paddle kaydıyla DENENMEDİ (hesap yok); imza matematiği
 * duman testinde kendi ürettiğimiz imzayla sınanıyor. Ürün eşlemesi
 * urunler.json'da Paddle product_id anahtarıyla: { "pro_xxx": "<setId>" }.
 */

function paddleImzaDogrula(hamGovde, imzaBasligi, sir) {
  const parcalar = {};
  for (const p of String(imzaBasligi || '').split(';')) {
    const [k, v] = p.split('=');
    if (k && v) parcalar[k.trim()] = v.trim();
  }
  if (!parcalar.ts || !parcalar.h1) return false;
  const beklenen = crypto.createHmac('sha256', sir)
    .update(parcalar.ts + ':' + hamGovde).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(beklenen), Buffer.from(parcalar.h1));
  } catch {
    return false;
  }
}

function paddleIsle(hamGovde, imzaBasligi) {
  const sir = process.env.PADDLE_WEBHOOK_SECRET;
  let imza = 'sir-yok';
  if (sir) {
    if (!paddleImzaDogrula(hamGovde, imzaBasligi, sir)) {
      throw new Error('Paddle imzası doğrulanamadı');
    }
    imza = 'dogrulandi';
  }

  const olay = JSON.parse(hamGovde);

  // Abonelik yaşam döngüsü (Trend Paket) → abone kayıtlarına.
  if (String(olay.event_type || '').startsWith('subscription.')) {
    const abone = require('./abone');
    const kayit = abone.paddleOlayi(olay);
    return kayit
      ? { ok: true, abonelik: kayit.id, durum: kayit.durum, imza }
      : { ok: true, atlandi: olay.event_type, imza };
  }

  if (olay.event_type !== 'transaction.completed') {
    return { ok: true, atlandi: olay.event_type || 'bilinmeyen', imza };
  }

  let eslesme = {};
  try { eslesme = JSON.parse(fs.readFileSync(URUNLER, 'utf8')); } catch {}

  const urunIdleri = ((olay.data && olay.data.items) || [])
    .map(u => u.price && u.price.product_id).filter(Boolean);
  const setId = urunIdleri.map(id => eslesme[id]).find(s => s && depo.setBul(s));
  if (!setId) return { ok: true, eslesme: false, urunIdleri, imza };

  const kayit = tokenUret(setId, 'paddle',
    olay.data.id ? 'işlem: ' + olay.data.id : null);
  return { ok: true, eslesme: true, token: kayit.token, url: '/t/' + kayit.token, imza };
}

module.exports = { tokenUret, tokenAc, gumroadIsle, paddleIsle, paddleImzaDogrula, liste };
