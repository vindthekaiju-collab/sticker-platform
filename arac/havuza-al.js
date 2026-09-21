'use strict';
/**
 * Seçilen adayları havuza alır, kırpar, altyazı basar, sete koyar.
 *
 * Girdi: bir seçim dosyası (JSON dizi). Her kayıt:
 *   {
 *     "parti": "wain", "no": 7,              → veri/tarama/<parti>/adaylar.json
 *     "kirp": [0.10, 0.05, 0.6, 0.6] | null,  → x,y,w,h — tam boyun oranı; null = ortadan kare
 *     "metin": "noted. ignored.",             → altyazı ("" = yazısız)
 *     "emoji": "📝",
 *     "set": "Wain Cats"                      → set adı; yoksa açılır
 *   }
 * Set açıklaması için ayrı bir "setler" nesnesi: { "Wain Cats": "..." }
 *
 * Kullanım: node arac/havuza-al.js secimler/wain.json
 *
 * Her sticker için:
 *   1. depo.adayEkle (kaynak = tarama kaydının kaynağı, etiketler = altyazı +
 *      sanatçı + lisans)  → lib/indir tam boyu veri/medya'ya alır
 *   2. kırpma + 512×512 + altyazı → veri/medya/<id>-hazir.png; aday.dosya oraya
 *      çevrilir (üretim hattı bu dosyadan çalışır)
 *   3. kaynak kaydı veri/kaynaklar.json'a yazılır (lisans kanıtı: sayfa,
 *      lisans adı, lisans URL'si, sanatçı) — satışta "nereden geldi" sorusunun
 *      cevabı burada
 *   4. set üyeliği
 *
 * Altyazı stili: Impact, beyaz, siyah kontur, altta ortalı; uzun cümle iki
 * satıra bölünür. arac/altyazi.py'nin statik görsel için sharp karşılığı
 * (o araç ffmpeg + GIF içindi; burada ffmpeg yok, kaynak da durağan).
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const depo = require('../lib/depo');
const indir = require('../lib/indir');

const KOK = path.join(__dirname, '..');
const KENAR = 512;
const KAYNAKLAR_DOSYA = path.join(depo.VERI, 'kaynaklar.json');

function kaynaklariOku() {
  try { return JSON.parse(fs.readFileSync(KAYNAKLAR_DOSYA, 'utf8')); } catch { return {}; }
}
function kaynaklariYaz(k) {
  fs.mkdirSync(depo.VERI, { recursive: true });
  fs.writeFileSync(KAYNAKLAR_DOSYA, JSON.stringify(k, null, 2));
}

const bekle = ms => new Promise(r => setTimeout(r, ms));

/* upload.wikimedia.org orijinaller için 429 veriyor ve orijinal 20 MB'ı
   aşabiliyor. Sticker 512 px; 1200 px'lik Commons küçüğü fazlasıyla yeter.
   Küçük URL'sindeki "360px-" öneki genişlikle değiştirilir; orijinal zaten
   küçükse orijinal alınır. Kaynak kaydında (kaynaklar.json) orijinal URL kalır. */
function indirilecekUrl(aday) {
  if (aday.kaynak !== 'commons' || !/\/thumb\//.test(aday.kucukUrl || '')) return aday.medyaUrl;
  const genislik = parseInt(String(aday.boyut || '').split('x')[0], 10) || 0;
  if (genislik && genislik <= 1200) return aday.medyaUrl;
  return aday.kucukUrl.replace(/\/360px-/, '/1200px-');
}

/* Ham indirme diskte veri/medya/<id>.<uzantı> olarak durur; hazır sticker
   <id>-hazir.png. Kaynak HEP ham dosya: aday.dosya ikinci koşuda hazır
   PNG'yi gösterdiği için altyazı altyazının üstüne biniyordu (2026-09-21,
   Wain setinde ölçüldü). Kayıttaki alana değil diske bakılır. */
function hamDosya(aday) {
  const klasor = depo.coz('veri/medya');
  for (const uz of ['.jpg', '.png', '.webp', '.gif', '.bin']) {
    const y = path.join(klasor, aday.id + uz);
    if (fs.existsSync(y)) return y;
  }
  return depo.coz(aday.dosya);
}

async function tekrarla(fn, deneme = 4) {
  let hata;
  for (let i = 0; i < deneme; i++) {
    try { return await fn(); } catch (e) {
      hata = e;
      if (!/HTTP 429|zaman aşımı|ECONNRESET/.test(e.message)) throw e;
      await bekle(6000 * (i + 1));
    }
  }
  throw hata;
}

function kacar(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Satır kırma: en fazla iki satır; punto uzunluğa göre iner. */
function satirla(metin) {
  const kelimeler = metin.trim().split(/\s+/);
  if (kelimeler.length <= 2 || metin.length <= 14) return [metin.trim()];
  let enIyi = null;
  for (let i = 1; i < kelimeler.length; i++) {
    const a = kelimeler.slice(0, i).join(' '), b = kelimeler.slice(i).join(' ');
    const fark = Math.abs(a.length - b.length);
    if (!enIyi || fark < enIyi.fark) enIyi = { fark, satirlar: [a, b] };
  }
  return enIyi.satirlar;
}

function altyaziSvg(metin) {
  const satirlar = satirla(metin);
  const enUzun = Math.max(...satirlar.map(s => s.length));
  // Impact geniş harfli: ~0.5em/karakter. 470px'e sığacak punto, 30-58 arası.
  const punto = Math.max(30, Math.min(58, Math.floor(470 / (enUzun * 0.5))));
  const satirYuk = punto * 1.08;
  const taban = KENAR - 22;
  const yazi = satirlar.map((s, i) => {
    const y = taban - (satirlar.length - 1 - i) * satirYuk;
    return `<text x="${KENAR / 2}" y="${y.toFixed(1)}" text-anchor="middle" font-family="Impact" font-size="${punto}" fill="#fff" stroke="#000" stroke-width="${(punto * 0.12).toFixed(1)}" stroke-linejoin="round" paint-order="stroke" letter-spacing="1">${kacar(s)}</text>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${KENAR}" height="${KENAR}">${yazi}</svg>`);
}

/* Kırpma: oranlar tam boy üzerinden; kare değilse verilen kutunun merkezini
   koruyan en büyük kare alınır. */
async function kareKirp(dosya, kirp) {
  const meta = await sharp(dosya).metadata();
  const W = meta.width, H = meta.height;
  let x, y, w, h;
  if (kirp) {
    x = Math.round(kirp[0] * W); y = Math.round(kirp[1] * H);
    w = Math.round(kirp[2] * W); h = Math.round(kirp[3] * H);
    const k = Math.max(w, h);
    // Kutunun merkezini koru, kareye büyüt, sınıra sığdır.
    let kx = Math.round(x + w / 2 - k / 2), ky = Math.round(y + h / 2 - k / 2);
    const kk = Math.min(k, W, H);
    kx = Math.max(0, Math.min(kx, W - kk)); ky = Math.max(0, Math.min(ky, H - kk));
    x = kx; y = ky; w = kk; h = kk;
  } else {
    const kk = Math.min(W, H);
    x = Math.round((W - kk) / 2); y = Math.round((H - kk) / 2); w = kk; h = kk;
  }
  return sharp(dosya).extract({ left: x, top: y, width: w, height: h })
    .resize(KENAR, KENAR).png().toBuffer();
}

async function stickerYap(kaynakDosya, kirp, metin, hedef) {
  const kare = await kareKirp(kaynakDosya, kirp);
  let s = sharp(kare);
  if (metin) s = s.composite([{ input: altyaziSvg(metin), left: 0, top: 0 }]);
  await s.png().toFile(hedef);
}

async function ana() {
  const secimDosya = process.argv[2];
  if (!secimDosya) { console.error('kullanım: node arac/havuza-al.js <secim.json>'); process.exit(2); }
  const secim = JSON.parse(fs.readFileSync(secimDosya, 'utf8'));
  const kayitlar = Array.isArray(secim) ? secim : secim.stickerlar;
  const setAciklamalari = (Array.isArray(secim) ? {} : secim.setler) || {};

  const partiler = {};
  const kaynaklar = kaynaklariOku();
  const setler = {};
  const tekrar = {};
  let n = 0;

  for (const k of kayitlar) {
    if (!partiler[k.parti]) {
      partiler[k.parti] = JSON.parse(fs.readFileSync(path.join(KOK, 'veri', 'tarama', k.parti, 'adaylar.json'), 'utf8'));
    }
    const aday = partiler[k.parti].find(a => a.no === k.no);
    if (!aday) { console.error(`× ${k.parti}#${k.no} taramada yok`); continue; }

    const etiketler = [k.metin || '(no caption)', aday.sanatci, aday.lisans, aday.kaynak].filter(Boolean);
    // Aynı kaynaktan ikinci kırpma: depo medyaUrl'ye göre tekilleştiriyor,
    // ikinci sticker birincinin üstüne yazılıyordu (Wain #24 iki kedi).
    // URL'ye parça (#2) eklemek isteği değiştirmez ama kaydı ayırır.
    const anahtar = k.parti + '#' + k.no;
    tekrar[anahtar] = (tekrar[anahtar] || 0) + 1;
    const medyaUrl = indirilecekUrl(aday) + (tekrar[anahtar] > 1 ? '#' + tekrar[anahtar] : '');
    const { aday: kayit } = depo.adayEkle({
      kaynak: aday.kaynak, medyaUrl, sayfaUrl: aday.sayfaUrl, etiketler
    });
    try {
      await bekle(1500);
      const guncel = await tekrarla(() => indir.adayIndir(kayit.id));
      // İkinci koşuda aday.dosya artık hazır PNG'yi gösteriyor; kaynak hep
      // ham indirme olmalı, yoksa altyazı altyazının üstüne biner (ölçüldü).
      const ham = hamDosya(guncel);
      const hazirGorece = `veri/medya/${kayit.id}-hazir.png`;
      await stickerYap(ham, k.kirp || null, k.metin || '', depo.coz(hazirGorece));
      depo.adayGuncelle(kayit.id, { dosya: hazirGorece, emoji: k.emoji || '🙂', etiketler, ham: path.relative(depo.KOK, ham).split(path.sep).join('/'), kirp: k.kirp || null });
    } catch (e) {
      console.error(`× ${k.parti}#${k.no}: ${e.message}`);
      continue;
    }
    kaynaklar[kayit.id] = {
      kaynak: aday.kaynak, baslik: aday.baslik, sanatci: aday.sanatci,
      lisans: aday.lisans, lisansUrl: aday.lisansUrl, sayfaUrl: aday.sayfaUrl, medyaUrl: aday.medyaUrl,
      altyazi: k.metin || '', alinma: new Date().toISOString()
    };

    if (k.set) {
      if (!setler[k.set]) {
        setler[k.set] = depo.setListe().find(s => s.ad === k.set)
          || depo.setOlustur({ ad: k.set, aciklama: setAciklamalari[k.set] || '', olusturan: 'elle' });
      }
      depo.setGuncelle(setler[k.set].id, { ekle: kayit.id });
      if (setAciklamalari[k.set] && setler[k.set].aciklama !== setAciklamalari[k.set]) {
        depo.setGuncelle(setler[k.set].id, { aciklama: setAciklamalari[k.set] });
      }
    }
    n++;
    console.log(`✓ ${k.parti}#${k.no} → ${kayit.id} "${k.metin || ''}" [${k.set || '-'}]`);
  }
  kaynaklariYaz(kaynaklar);
  console.log(`${n} sticker havuza alındı · setler: ${Object.keys(setler).map(a => `${a} (${depo.setBul(setler[a].id).uyeler.length})`).join(', ') || '-'}`);
}

if (require.main === module) ana().catch(e => { console.error(e); process.exit(1); });
module.exports = { stickerYap, altyaziSvg, satirla };
