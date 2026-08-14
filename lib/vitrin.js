'use strict';
/**
 * Vitrin görseli üretici — pazarlama tarafının ilk tuğlası.
 * Setin üretilmiş telegram statiklerinden 1200×630 (OG boyutu) bir montaj
 * kurar: Gumroad kapağı, Instagram postu, link önizlemesi hepsi bu oran.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const depo = require('./depo');

const GENISLIK = 1200;
const YUKSEKLIK = 630;

async function vitrinUret(setId) {
  const set = depo.setBul(setId);
  if (!set) throw new Error('set yok: ' + setId);

  /* Özel kapak seçilmişse (havuzdan görsel ya da yüklenen dosya) montaj
     yerine o kullanılır. set.kapak biçimi:
       { tur: 'aday', adayId }  — havuzdan seçilen görsel
       { tur: 'dosya', dosya }  — bilgisayardan yüklenen (veri/medya/kapak-*)
       yok/null                 — otomatik montaj (varsayılan)
     'AI ile üret' seçeneği bilinçli olarak stub: görsel üretim API'si paralı,
     ofis'teki gorsel-uret.js emsalinde karar "para harcanmayacak"tı. Kullanıcı
     isterse oradaki araç buraya bağlanır. */
  if (set.kapak && set.kapak.tur) {
    let kaynakDosya = null;
    if (set.kapak.tur === 'aday') {
      const aday = depo.adayBul(set.kapak.adayId);
      if (aday && aday.dosya) kaynakDosya = path.join(depo.KOK, aday.dosya);
    } else if (set.kapak.tur === 'dosya') {
      kaynakDosya = path.join(depo.KOK, set.kapak.dosya);
    }
    if (!kaynakDosya || !fs.existsSync(kaynakDosya)) {
      throw new Error('kapak kaynağı bulunamadı — kapağı sıfırlayıp otomatiğe dönebilirsin');
    }
    const cikti = path.join(depo.KOK, 'cikti', setId, 'vitrin.png');
    fs.mkdirSync(path.dirname(cikti), { recursive: true });
    await sharp(kaynakDosya, { animated: false })
      .resize(GENISLIK, YUKSEKLIK, { fit: 'cover' })
      .png().toFile(cikti);
    depo.setGuncelle(setId, { ciktilar: { vitrin: '/cikti/' + setId + '/vitrin.png' } });
    return { dosya: '/cikti/' + setId + '/vitrin.png', kaynak: set.kapak.tur };
  }

  const kaynakKlasor = path.join(depo.KOK, 'cikti', setId, 'telegram');
  if (!fs.existsSync(kaynakKlasor)) {
    throw new Error('önce Telegram paketi üret — vitrin oradan besleniyor');
  }
  const dosyalar = fs.readdirSync(kaynakKlasor)
    .filter(d => d.endsWith('.webp')).sort().slice(0, 6);
  if (!dosyalar.length) throw new Error('üretilmiş statik sticker yok');

  const hucre = 170;
  const bosluk = 18;
  const izgaraGenislik = 3 * hucre + 2 * bosluk;
  const izgaraX = GENISLIK - izgaraGenislik - 80;

  const katmanlar = [];
  for (const [i, dosya] of dosyalar.entries()) {
    const kucuk = await sharp(path.join(kaynakKlasor, dosya))
      .resize(hucre, hucre, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    katmanlar.push({
      input: kucuk,
      left: izgaraX + (i % 3) * (hucre + bosluk),
      top: 120 + Math.floor(i / 3) * (hucre + bosluk)
    });
  }

  const kacar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const arka = `<svg xmlns="http://www.w3.org/2000/svg" width="${GENISLIK}" height="${YUKSEKLIK}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#12141a"/>
        <stop offset="1" stop-color="#1e2433"/>
      </linearGradient>
    </defs>
    <rect width="${GENISLIK}" height="${YUKSEKLIK}" fill="url(#g)"/>
    <circle cx="90" cy="560" r="240" fill="#33c6b5" opacity="0.08"/>
    <text x="80" y="265" font-family="DejaVu Sans, Arial, sans-serif" font-size="44"
          font-weight="bold" fill="#e8eaf0">${kacar(set.ad).slice(0, 19)}</text>
    <text x="80" y="320" font-family="DejaVu Sans, Arial, sans-serif" font-size="24"
          fill="#8a91a5">${dosyalar.length}+ sticker · tek tıkla klavyende</text>
    <text x="80" y="380" font-family="DejaVu Sans, Arial, sans-serif" font-size="22"
          fill="#33c6b5">Telegram · WhatsApp · her yer</text>
  </svg>`;

  const cikti = path.join(depo.KOK, 'cikti', setId, 'vitrin.png');
  await sharp(Buffer.from(arka)).composite(katmanlar).png().toFile(cikti);
  depo.setGuncelle(setId, { ciktilar: { vitrin: '/cikti/' + setId + '/vitrin.png' } });
  return { dosya: '/cikti/' + setId + '/vitrin.png', sticker: dosyalar.length };
}

module.exports = { vitrinUret };
