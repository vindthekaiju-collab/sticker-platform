'use strict';
/**
 * Telifsiz kaynak tarayıcı — havuza aday toplamanın ilk adımı.
 *
 * Yalnız kamu malı / CC0 kabul eder; lisans her kaydın kendi meta verisinden
 * okunur, tahmin edilmez. Dört kaynak:
 *   commons   Wikimedia Commons (arama ya da kategori) — extmetadata lisansı
 *   met       Met Museum Open Access — isPublicDomain
 *   aic       Art Institute of Chicago — is_public_domain (CC0)
 *   openverse Openverse — license=cc0,pdm süzgeci
 *
 * Kullanım:
 *   node arac/kaynak-tara.js <parti-adı> <kaynak> "<sorgu|Category:...>" [adet]
 *
 * Çıktı: veri/tarama/<parti>/ altına
 *   adaylar.json  — her aday: kaynak, başlık, sanatçı, lisans, lisansUrl,
 *                   sayfaUrl, medyaUrl (tam boy), kucukUrl
 *   NN.jpg        — 360px küçük kopya (kontak sayfası için)
 *   kontak-K.jpg  — 20'lik kontak sayfaları, numaralı
 *
 * Aynı partiye ikinci kez koşulunca üstüne ekler (medyaUrl tekil).
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getir } = require('../lib/indir');

const KOK = path.join(__dirname, '..');
const TARAMA = path.join(KOK, 'veri', 'tarama');
const UA = 'stickky/0.1 (sticker pack research; contact via stickky.xyz)';

const PD_DESEN = /public domain|cc0|pdm|no known copyright|no restrictions/i;
/* --cc-by: CC BY (atıf şartlı, ticari serbest) de kabul edilir. NC ve ND
   asla; SA da alınmaz (paket "paylaş-eşit" olur, satış hukuken olur ama
   alıcıya yeniden dağıtım hakkı verir). Kayıtta lisans adı durur;
   listeleme kiti CC BY olanlara atıf satırı basar. Gerçek meme
   fotoğraflarının (Flickr kökenli) çoğu CC BY 2.0 — 2026-09-21 kullanıcı
   isteği: "bizim üretmediğimiz, derlediğimiz setler". */
const CC_BY_DESEN = /^cc[- ]by(?:[- ]\d(?:\.\d)?)?$/i;
const ccByKabul = process.argv.includes('--cc-by');
const lisansUygun = l => PD_DESEN.test(l) || (ccByKabul && CC_BY_DESEN.test(String(l).trim()));

const bekle = ms => new Promise(r => setTimeout(r, ms));

// Commons 429 veriyor: istekler arası 1.2 sn boşluk, 429'da üstel bekleme.
let sonIstek = 0;
async function json(url) {
  for (let deneme = 0; deneme < 5; deneme++) {
    const ara = 1200 - (Date.now() - sonIstek);
    if (ara > 0) await bekle(ara);
    sonIstek = Date.now();
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
    if (r.status === 429 || r.status >= 500) { await bekle(3000 * (deneme + 1)); continue; }
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
    return r.json();
  }
  throw new Error('kaynak yanıt vermedi (429/5xx üst üste): ' + url);
}

function temizle(html) {
  return String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

/* ---------------------------------------------------------------- commons */
async function commons(sorgu, adet) {
  const uc = 'https://commons.wikimedia.org/w/api.php';
  const ortak = `&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=360&format=json&formatversion=2`;
  const sonuc = [];
  let devam = '';
  while (sonuc.length < adet) {
    let url;
    if (/^Category:/i.test(sorgu)) {
      url = `${uc}?action=query&generator=categorymembers&gcmtitle=${encodeURIComponent(sorgu)}&gcmtype=file&gcmlimit=50${ortak}${devam}`;
    } else {
      url = `${uc}?action=query&generator=search&gsrsearch=${encodeURIComponent(sorgu)}&gsrnamespace=6&gsrlimit=50${ortak}${devam}`;
    }
    const v = await json(url);
    const sayfalar = (v.query && v.query.pages) || [];
    for (const s of sayfalar) {
      const ii = s.imageinfo && s.imageinfo[0];
      if (!ii || !/^image\/(jpeg|png)/.test(ii.mime)) continue;
      const m = ii.extmetadata || {};
      const lisans = (m.LicenseShortName && m.LicenseShortName.value) || (m.License && m.License.value) || '';
      if (!lisansUygun(lisans)) continue;
      if (ii.width < 500 || ii.height < 500) continue;
      sonuc.push({
        kaynak: 'commons',
        baslik: temizle((m.ObjectName && m.ObjectName.value) || s.title.replace(/^File:/, '')),
        sanatci: temizle(m.Artist && m.Artist.value),
        lisans, lisansUrl: (m.LicenseUrl && m.LicenseUrl.value) || 'https://commons.wikimedia.org/wiki/Commons:Licensing',
        sayfaUrl: ii.descriptionurl, medyaUrl: ii.url, kucukUrl: ii.thumburl || ii.url,
        aciklama: temizle(m.ImageDescription && m.ImageDescription.value),
        boyut: ii.width + 'x' + ii.height
      });
      if (sonuc.length >= adet) break;
    }
    if (!v.continue) break;
    devam = '&' + Object.entries(v.continue).map(([k, x]) => `${k}=${encodeURIComponent(x)}`).join('&');
  }
  return sonuc;
}

/* -------------------------------------------------------------------- met */
async function met(sorgu, adet) {
  const ara = await json(`https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(sorgu)}&hasImages=true&isPublicDomain=true`);
  const sonuc = [];
  for (const id of (ara.objectIDs || []).slice(0, adet * 2)) {
    if (sonuc.length >= adet) break;
    let o;
    try { o = await json('https://collectionapi.metmuseum.org/public/collection/v1/objects/' + id); } catch { continue; }
    if (!o.isPublicDomain || !o.primaryImage) continue;
    sonuc.push({
      kaynak: 'met', baslik: temizle(o.title), sanatci: temizle(o.artistDisplayName || o.culture),
      lisans: 'CC0 (Met Open Access)', lisansUrl: 'https://www.metmuseum.org/about-the-met/policies-and-documents/open-access',
      sayfaUrl: o.objectURL, medyaUrl: o.primaryImage, kucukUrl: o.primaryImageSmall || o.primaryImage,
      aciklama: temizle([o.objectDate, o.medium].filter(Boolean).join(' · ')), boyut: ''
    });
  }
  return sonuc;
}

/* -------------------------------------------------------------------- aic */
async function aic(sorgu, adet) {
  const sonuc = [];
  for (let sayfa = 1; sonuc.length < adet && sayfa <= 6; sayfa++) {
    const v = await json(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(sorgu)}&limit=50&page=${sayfa}&fields=id,title,image_id,is_public_domain,artist_display,date_display,medium_display&query[term][is_public_domain]=true`);
    for (const o of v.data || []) {
      if (!o.is_public_domain || !o.image_id) continue;
      const iiif = `https://www.artic.edu/iiif/2/${o.image_id}/full/`;
      sonuc.push({
        kaynak: 'aic', baslik: temizle(o.title), sanatci: temizle(o.artist_display),
        lisans: 'CC0 (AIC Open Access)', lisansUrl: 'https://www.artic.edu/open-access/open-access-images',
        sayfaUrl: 'https://www.artic.edu/artworks/' + o.id,
        medyaUrl: iiif + '1686,/0/default.jpg', kucukUrl: iiif + '400,/0/default.jpg',
        aciklama: temizle([o.date_display, o.medium_display].filter(Boolean).join(' · ')), boyut: ''
      });
      if (sonuc.length >= adet) break;
    }
    if (!v.pagination || sayfa >= v.pagination.total_pages) break;
  }
  return sonuc;
}

/* -------------------------------------------------------------- openverse */
async function openverse(sorgu, adet) {
  const sonuc = [];
  for (let sayfa = 1; sonuc.length < adet && sayfa <= 5; sayfa++) {
    const v = await json(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(sorgu)}&license=cc0,pdm&page_size=50&page=${sayfa}&mature=false`);
    for (const o of v.results || []) {
      if (o.width && o.width < 500) continue;
      sonuc.push({
        kaynak: 'openverse:' + (o.source || o.provider), baslik: temizle(o.title), sanatci: temizle(o.creator),
        lisans: (o.license || '').toUpperCase() + (o.license_version ? ' ' + o.license_version : ''),
        lisansUrl: o.license_url || '', sayfaUrl: o.foreign_landing_url,
        medyaUrl: o.url, kucukUrl: o.thumbnail || o.url, aciklama: '', boyut: (o.width || '') + 'x' + (o.height || '')
      });
      if (sonuc.length >= adet) break;
    }
    if (!v.page_count || sayfa >= v.page_count) break;
  }
  return sonuc;
}

const KAYNAKLAR = { commons, met, aic, openverse };

/* ---------------------------------------------------------- kontak sayfası */
async function kontakYap(klasor, adaylar) {
  const SUTUN = 5, BOY = 240, SATIR_SAY = 4, ADET = SUTUN * SATIR_SAY;
  const sayfalar = Math.ceil(adaylar.length / ADET);
  for (let k = 0; k < sayfalar; k++) {
    const katman = [];
    const dilim = adaylar.slice(k * ADET, (k + 1) * ADET);
    for (const [i, a] of dilim.entries()) {
      const yol = path.join(klasor, a.dosya);
      if (!fs.existsSync(yol)) continue;
      const x = (i % SUTUN) * BOY, y = Math.floor(i / SUTUN) * BOY;
      let kare;
      try {
        kare = await sharp(yol).resize(BOY - 6, BOY - 6, { fit: 'inside' }).png().toBuffer();
      } catch { continue; }
      const m = await sharp(kare).metadata();
      katman.push({ input: kare, left: x + 3 + Math.floor((BOY - 6 - m.width) / 2), top: y + 3 + Math.floor((BOY - 6 - m.height) / 2) });
      const etiket = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="30"><rect width="60" height="30" fill="#000" opacity=".75"/><text x="30" y="22" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="20" fill="#fff">${a.no}</text></svg>`);
      katman.push({ input: etiket, left: x, top: y });
    }
    await sharp({ create: { width: SUTUN * BOY, height: SATIR_SAY * BOY, channels: 3, background: '#444' } })
      .composite(katman).jpeg({ quality: 80 }).toFile(path.join(klasor, `kontak-${k + 1}.jpg`));
  }
  return sayfalar;
}

/* --------------------------------------------------------------------- ana */
async function ana() {
  const [parti, kaynak, sorgu, adetStr] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!parti || !KAYNAKLAR[kaynak] || !sorgu) {
    console.error('kullanım: node arac/kaynak-tara.js <parti> <commons|met|aic|openverse> "<sorgu>" [adet]');
    process.exit(2);
  }
  const adet = Number(adetStr) || 40;
  const klasor = path.join(TARAMA, parti);
  fs.mkdirSync(klasor, { recursive: true });
  const dosya = path.join(klasor, 'adaylar.json');
  const mevcut = fs.existsSync(dosya) ? JSON.parse(fs.readFileSync(dosya, 'utf8')) : [];
  const bilinen = new Set(mevcut.map(a => a.medyaUrl));

  const bulunan = await KAYNAKLAR[kaynak](sorgu, adet);
  let eklendi = 0, no = mevcut.length;
  for (const a of bulunan) {
    if (bilinen.has(a.medyaUrl)) continue;
    no++;
    a.no = no; a.sorgu = sorgu; a.dosya = String(no).padStart(2, '0') + '.jpg';
    try {
      const { veri } = await getir(a.kucukUrl, 5);
      await sharp(veri).resize(360, 360, { fit: 'inside' }).jpeg({ quality: 82 }).toFile(path.join(klasor, a.dosya));
    } catch (e) { a.hata = e.message; }
    mevcut.push(a); bilinen.add(a.medyaUrl); eklendi++;
  }
  fs.writeFileSync(dosya, JSON.stringify(mevcut, null, 2));
  const sayfa = await kontakYap(klasor, mevcut);
  console.log(`${parti} ← ${kaynak} "${sorgu}": ${bulunan.length} bulundu, ${eklendi} eklendi, toplam ${mevcut.length}, kontak ${sayfa} sayfa`);
}

if (require.main === module) ana().catch(e => { console.error(e); process.exit(1); });
module.exports = { KAYNAKLAR, kontakYap };
