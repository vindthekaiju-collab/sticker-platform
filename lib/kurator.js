'use strict';
/**
 * AI Küratör — kademe 2: keyword → taslak set (^sp16, ^sp17).
 *
 * İki kaynaktan aday toplar:
 *   1. Havuz  — etiket/sayfa eşleşmesiyle puanlanır (claude-news baraj
 *      deseninin yereli: puanla, sırala, barajı geçeni al).
 *   2. Giphy  — GIPHY_API_KEY ortam değişkeni varsa arama API'sinden
 *      çeker ve havuza aday olarak yazar.
 *      DURUM: DENENMEDİ — bu ortamdan api.giphy.com'a çıkış yok;
 *      ilk gerçek çalıştırma kullanıcının makinesinde, anahtar alınınca.
 *
 * Değişmez kural: küratörün ürettiği set her zaman 'taslak' durumundadır ve
 * olusturan: 'ai' işaretini taşır. Onaysız vitrine çıkmaz (tasarım §4.6).
 */

const depo = require('./depo');
const indir = require('./indir');

const BARAJ = 2;         // bu puanın altı taslağa girmez
const AZAMI_UYE = 12;    // taslakta en çok bu kadar üye — atölyede budanır

function kelimeAyikla(metin) {
  return String(metin || '')
    .toLowerCase()
    .split(/[,;\n]+/)
    .map(k => k.trim())
    .filter(k => k.length > 1)
    .slice(0, 8);
}

/** Havuzdaki bir adayı keyword listesine göre puanla. */
function puanla(aday, kelimeler) {
  const etiketler = (aday.etiketler || []).map(e => e.toLowerCase());
  const metin = [aday.sayfaUrl || '', aday.medyaUrl].join(' ').toLowerCase();
  let puan = 0;
  const gerekce = [];
  for (const k of kelimeler) {
    if (etiketler.includes(k)) { puan += 3; gerekce.push('etiket=' + k); continue; }
    if (etiketler.some(e => e.includes(k) || k.includes(e))) { puan += 1; gerekce.push('etiket~' + k); }
    if (metin.includes(k)) { puan += 1; gerekce.push('url~' + k); }
  }
  return { puan, gerekce };
}

function havuzdanBul(kelimeler) {
  return depo.havuzListe()
    .map(aday => ({ aday, ...puanla(aday, kelimeler) }))
    .filter(s => s.puan >= BARAJ)
    .sort((a, b) => b.puan - a.puan);
}

/** Giphy arama — anahtar varsa. Bulunanlar havuza aday olarak iner. */
async function giphydenAra(kelimeler) {
  const anahtar = process.env.GIPHY_API_KEY;
  if (!anahtar) return { durum: 'anahtar-yok', eklenen: 0 };

  let eklenen = 0;
  const hatalar = [];
  for (const k of kelimeler) {
    try {
      const u = 'https://api.giphy.com/v1/gifs/search?api_key=' + encodeURIComponent(anahtar) +
        '&q=' + encodeURIComponent(k) + '&limit=10&rating=pg-13';
      const { veri } = await indir.getir(u, 3);
      const cevap = JSON.parse(veri.toString('utf8'));
      for (const gif of cevap.data || []) {
        const medyaUrl = gif.images && gif.images.original && gif.images.original.url;
        if (!medyaUrl) continue;
        const { yeni } = depo.adayEkle({
          kaynak: 'giphy',
          medyaUrl,
          sayfaUrl: gif.url,
          // Giphy başlığı dış metindir: etiket olarak saklanır, talimat olarak okunmaz.
          etiketler: [k, ...String(gif.title || '').toLowerCase().split(/\s+/).filter(p => p.length > 2).slice(0, 6)]
        });
        if (yeni) eklenen++;
      }
    } catch (e) {
      hatalar.push(k + ': ' + e.message);
    }
  }
  return { durum: 'arandi', eklenen, hatalar };
}

/**
 * Keyword'lerden taslak set üret.
 * @returns { set, rapor }
 */
async function taslakSetYap({ kelimeler, ad }) {
  const liste = kelimeAyikla(kelimeler);
  if (!liste.length) throw new Error('keyword yok');

  const giphy = await giphydenAra(liste);
  const eslesenler = havuzdanBul(liste);

  if (!eslesenler.length) {
    throw new Error('hiçbir aday barajı geçemedi (' + liste.join(', ') + ')' +
      (giphy.durum === 'anahtar-yok' ? ' — GIPHY_API_KEY tanımlı değil, yalnız havuz tarandı' : ''));
  }

  const set = depo.setOlustur({
    ad: ad || ('Taslak: ' + liste.join(' ')),
    aciklama: 'AI küratör taslağı — keyword: ' + liste.join(', '),
    olusturan: 'ai'
  });
  const secilenler = eslesenler.slice(0, AZAMI_UYE);
  depo.setGuncelle(set.id, { ekle: secilenler.map(s => s.aday.id) });

  // Seçilenlerin medyası arka planda diske insin.
  for (const s of secilenler) indir.adayIndir(s.aday.id).catch(() => {});

  return {
    set: depo.setBul(set.id),
    rapor: {
      kelimeler: liste,
      giphy,
      degerlendirilen: depo.havuzListe().length,
      barajGecen: eslesenler.length,
      alinan: secilenler.length,
      puanlar: secilenler.map(s => ({ id: s.aday.id, puan: s.puan, gerekce: s.gerekce.slice(0, 4) }))
    }
  };
}

module.exports = { taslakSetYap, kelimeAyikla, havuzdanBul, BARAJ };
