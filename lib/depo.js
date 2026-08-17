'use strict';
/**
 * JSON depolama — beyindeki videos.json geleneğinin devamı: veritabanı yok,
 * dosya var. Yazımlar atomiktir (geçici dosya + yeniden adlandırma).
 *
 * veri/havuz.json  → aday görseller
 * veri/setler.json → sticker setleri
 *
 * Aday: { id, kaynak: 'giphy'|'pinterest'|'elle', medyaUrl, sayfaUrl,
 *         etiketler: [], eklenme, dosya: 'veri/medya/<id>.<uz>'|null,
 *         durum: 'yeni'|'indirildi'|'hata', hata: null|str }
 *
 * Set:  { id, ad, aciklama, uyeler: [adayId], tepsi: adayId|null,
 *         durum: 'taslak'|'onayli'|'yayinda', olusturan: 'elle'|'ai',
 *         olusturulma, ciktilar: { telegram|wastickers|zip: {...} } }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// KOK kaynak kökü — şablonlar, arayüz, eklenti hep burada, taşınmaz.
// VERI ve CIKTI ise TAŞINABİLİR: ortam değişkeni verilirse oraya yazılır.
// Sebebi duman testi — eskiden gerçek veri/ klasörüne yazıyor ve her koşuda
// havuza sahte aday, set listesine sahte set bırakıyordu.
const KOK = path.join(__dirname, '..');
const VERI = process.env.STICKKY_VERI || path.join(KOK, 'veri');
const CIKTI = process.env.STICKKY_CIKTI || path.join(KOK, 'cikti');

/**
 * Depoda saklanan görece yolu ('veri/medya/x.gif', '/cikti/<id>/a.html')
 * gerçek konumuna çevirir. VERI/CIKTI taşınmışsa doğru yeri bulur; eski
 * kayıtlar aynı biçimde durduğu için göç gerekmez.
 */
function coz(gorece) {
  const parca = String(gorece).replace(/^[\\/]+/, '').split(/[\\/]+/);
  if (parca[0] === 'veri') return path.join(VERI, ...parca.slice(1));
  if (parca[0] === 'cikti') return path.join(CIKTI, ...parca.slice(1));
  return path.join(KOK, gorece);
}

const DOSYALAR = {
  havuz: path.join(VERI, 'havuz.json'),
  setler: path.join(VERI, 'setler.json')
};

function kimlik() {
  return crypto.randomBytes(4).toString('hex');
}

function oku(ad) {
  try {
    return JSON.parse(fs.readFileSync(DOSYALAR[ad], 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

function yaz(ad, veri) {
  fs.mkdirSync(VERI, { recursive: true });
  const gecici = DOSYALAR[ad] + '.tmp';
  fs.writeFileSync(gecici, JSON.stringify(veri, null, 2));
  fs.renameSync(gecici, DOSYALAR[ad]);
}

/* ---------- Havuz ---------- */

function havuzListe() {
  return oku('havuz');
}

function adayBul(id) {
  return havuzListe().find(a => a.id === id) || null;
}

function adayEkle({ kaynak, medyaUrl, sayfaUrl, etiketler }) {
  if (!medyaUrl || typeof medyaUrl !== 'string') {
    throw new Error('medyaUrl zorunlu');
  }
  const havuz = havuzListe();
  // Aynı medya URL'si ikinci kez gelirse kopya açma — mevcut kaydı döndür.
  const varOlan = havuz.find(a => a.medyaUrl === medyaUrl);
  if (varOlan) return { aday: varOlan, yeni: false };

  const aday = {
    id: kimlik(),
    kaynak: kaynak || 'elle',
    medyaUrl,
    sayfaUrl: sayfaUrl || null,
    etiketler: Array.isArray(etiketler) ? etiketler.filter(Boolean).slice(0, 20) : [],
    emoji: '🙂', // platformlar sticker'ı emojiyle arar; atölyeden değiştirilir
    eklenme: new Date().toISOString(),
    dosya: null,
    durum: 'yeni',
    hata: null
  };
  havuz.push(aday);
  yaz('havuz', havuz);
  return { aday, yeni: true };
}

function adayGuncelle(id, degisim) {
  const havuz = havuzListe();
  const aday = havuz.find(a => a.id === id);
  if (!aday) throw new Error('aday yok: ' + id);
  Object.assign(aday, degisim);
  yaz('havuz', havuz);
  return aday;
}

function adaySil(id) {
  const havuz = havuzListe();
  const kalan = havuz.filter(a => a.id !== id);
  if (kalan.length === havuz.length) return false;
  yaz('havuz', kalan);
  // Setlerden de düşür — sette hayalet üye kalmasın.
  const setler = oku('setler');
  let dokunuldu = false;
  for (const s of setler) {
    const once = s.uyeler.length;
    s.uyeler = s.uyeler.filter(u => u !== id);
    if (s.tepsi === id) s.tepsi = null;
    if (s.uyeler.length !== once) dokunuldu = true;
  }
  if (dokunuldu) yaz('setler', setler);
  return true;
}

/* ---------- Setler ---------- */

function setListe() {
  return oku('setler');
}

function setBul(id) {
  return setListe().find(s => s.id === id) || null;
}

function setOlustur({ ad, aciklama, olusturan }) {
  if (!ad || typeof ad !== 'string') throw new Error('ad zorunlu');
  const setler = setListe();
  const set = {
    id: kimlik(),
    ad: ad.trim(),
    aciklama: aciklama || '',
    uyeler: [],
    tepsi: null,
    durum: 'taslak',
    olusturan: olusturan === 'ai' ? 'ai' : 'elle',
    olusturulma: new Date().toISOString(),
    ciktilar: {}
  };
  setler.push(set);
  yaz('setler', setler);
  return set;
}

/* Bilinen alanlar. Beyaz liste bilinçli: keyfi alan enjeksiyonunu engelliyor.
   AMA sessizce yutuyordu — 2026-08-17'de setGuncelle(id,{telegramUrl}) hatasız
   döndü, alan kayboldu ve vitrinde Telegram düğmesi çıkmadı. Bilinmeyen alan
   artık hata veriyor: yazım hatası ya da eksik alan anında görünür. */
const SET_ALANLARI = new Set([
  'ad', 'aciklama', 'durum', 'tepsi', 'kapak',
  'satisUrl', 'telegramUrl', 'ekle', 'cikar', 'ciktilar'
]);

function setGuncelle(id, degisim) {
  const setler = setListe();
  const set = setler.find(s => s.id === id);
  if (!set) throw new Error('set yok: ' + id);

  const bilinmeyen = Object.keys(degisim).filter(k => !SET_ALANLARI.has(k));
  if (bilinmeyen.length) {
    throw new Error('setGuncelle: bilinmeyen alan(lar): ' + bilinmeyen.join(', ') +
      ' — bilinenler: ' + [...SET_ALANLARI].join(', '));
  }

  if (degisim.ad !== undefined) set.ad = String(degisim.ad).trim();
  if (degisim.aciklama !== undefined) set.aciklama = String(degisim.aciklama);
  if (degisim.durum !== undefined) {
    if (!['taslak', 'onayli', 'yayinda'].includes(degisim.durum)) {
      throw new Error('geçersiz durum: ' + degisim.durum);
    }
    set.durum = degisim.durum;
  }
  if (degisim.tepsi !== undefined) set.tepsi = degisim.tepsi;
  if (degisim.kapak !== undefined) set.kapak = degisim.kapak;
  if (degisim.satisUrl !== undefined) set.satisUrl = degisim.satisUrl;
  if (degisim.telegramUrl !== undefined) set.telegramUrl = degisim.telegramUrl;
  if (degisim.ekle) {
    for (const adayId of [].concat(degisim.ekle)) {
      if (!adayBul(adayId)) throw new Error('aday yok: ' + adayId);
      if (!set.uyeler.includes(adayId)) set.uyeler.push(adayId);
    }
  }
  if (degisim.cikar) {
    const cikanlar = [].concat(degisim.cikar);
    set.uyeler = set.uyeler.filter(u => !cikanlar.includes(u));
    if (cikanlar.includes(set.tepsi)) set.tepsi = null;
  }
  if (degisim.ciktilar) Object.assign(set.ciktilar, degisim.ciktilar);

  yaz('setler', setler);
  return set;
}

function setSil(id) {
  const setler = setListe();
  const kalan = setler.filter(s => s.id !== id);
  if (kalan.length === setler.length) return false;
  yaz('setler', kalan);
  return true;
}

module.exports = {
  kimlik,
  havuzListe, adayBul, adayEkle, adayGuncelle, adaySil,
  setListe, setBul, setOlustur, setGuncelle, setSil,
  coz, VERI, CIKTI, KOK
};
