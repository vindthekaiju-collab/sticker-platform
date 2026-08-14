'use strict';
/**
 * Otonom küratör — kademe 3 (^sp18).
 *
 * İzleme listesindeki keyword'leri periyodik tarar (kaynaklar: havuz +
 * GIPHY_API_KEY varsa Giphy) ve yeterli aday bulursa TASLAK set üretir.
 *
 * Değişmez kural burada da geçerli: otonom üretilen set 'taslak' doğar,
 * atölyede onaylanmadan ne yayına ne trend setine gider. Ayrıca aynı
 * keyword'ün onay bekleyen taslağı dururken yenisi üretilmez — kütüphane
 * kalabalıkla değil onay bekleyen işle dolmasın.
 *
 * İzleme listesi: veri/izleme.json
 *   [{ kelime, eklenme, sonTarama, sonSetId, sonSonuc }]
 */

const fs = require('fs');
const path = require('path');
const depo = require('./depo');
const kurator = require('./kurator');

const DOSYA = path.join(depo.VERI, 'izleme.json');
const RAPOR = path.join(depo.VERI, 'otonom-rapor.json');

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

function ekle(kelime) {
  kelime = String(kelime || '').trim().toLowerCase();
  if (!kelime || kelime.length < 2) throw new Error('geçersiz keyword');
  const kayitlar = liste();
  if (kayitlar.some(k => k.kelime === kelime)) return kayitlar.find(k => k.kelime === kelime);
  const kayit = { kelime, eklenme: new Date().toISOString(), sonTarama: null, sonSetId: null, sonSonuc: null };
  kayitlar.push(kayit);
  yaz(kayitlar);
  return kayit;
}

function sil(kelime) {
  const kayitlar = liste();
  const kalan = kayitlar.filter(k => k.kelime !== kelime);
  if (kalan.length === kayitlar.length) return false;
  yaz(kalan);
  return true;
}

function bekleyenTaslak(kelime) {
  return depo.setListe().find(s =>
    s.olusturan === 'ai' && s.durum === 'taslak' &&
    (s.aciklama || '').toLowerCase().includes(kelime));
}

let calisiyor = false;

async function calistir() {
  if (calisiyor) return { atlandi: 'zaten çalışıyor' };
  calisiyor = true;
  try {
    const kayitlar = liste();
    const rapor = { zaman: new Date().toISOString(), sonuclar: [] };

    for (const kayit of kayitlar) {
      kayit.sonTarama = new Date().toISOString();
      const bekleyen = bekleyenTaslak(kayit.kelime);
      if (bekleyen) {
        kayit.sonSonuc = 'taslak onay bekliyor: ' + bekleyen.id;
        rapor.sonuclar.push({ kelime: kayit.kelime, atlandi: 'onay bekleyen taslak var', setId: bekleyen.id });
        continue;
      }
      try {
        const { set, rapor: kr } = await kurator.taslakSetYap({
          kelimeler: kayit.kelime,
          ad: 'Trend taslağı: ' + kayit.kelime
        });
        kayit.sonSetId = set.id;
        kayit.sonSonuc = set.uyeler.length + ' üyeli taslak';
        rapor.sonuclar.push({
          kelime: kayit.kelime, setId: set.id, uye: set.uyeler.length,
          giphy: kr.giphy.durum, barajGecen: kr.barajGecen
        });
      } catch (e) {
        kayit.sonSonuc = e.message;
        rapor.sonuclar.push({ kelime: kayit.kelime, sonuc: e.message });
      }
    }

    yaz(kayitlar);
    fs.writeFileSync(RAPOR, JSON.stringify(rapor, null, 2));
    return rapor;
  } finally {
    calisiyor = false;
  }
}

function sonRapor() {
  try { return JSON.parse(fs.readFileSync(RAPOR, 'utf8')); }
  catch { return null; }
}

module.exports = { liste, ekle, sil, calistir, sonRapor };
