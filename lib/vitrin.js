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
const donustur = require('./donustur');

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
      if (aday && aday.dosya) kaynakDosya = depo.coz(aday.dosya);
    } else if (set.kapak.tur === 'dosya') {
      kaynakDosya = depo.coz(set.kapak.dosya);
    }
    if (!kaynakDosya || !fs.existsSync(kaynakDosya)) {
      throw new Error('kapak kaynağı bulunamadı — kapağı sıfırlayıp otomatiğe dönebilirsin');
    }
    const cikti = path.join(depo.CIKTI, setId, 'vitrin.png');
    fs.mkdirSync(path.dirname(cikti), { recursive: true });
    await sharp(kaynakDosya, { animated: false })
      .resize(GENISLIK, YUKSEKLIK, { fit: 'cover' })
      .png().toFile(cikti);
    depo.setGuncelle(setId, { ciktilar: { vitrin: '/cikti/' + setId + '/vitrin.png' } });
    return { dosya: '/cikti/' + setId + '/vitrin.png', kaynak: set.kapak.tur };
  }

  // Izgara kaynakları: önce üretilmiş statik sticker'lar (zaten 512'ye
  // normalize edilmiş), yetmezse üyelerin kaynak medyasının İLK KARESİ.
  //
  // Eskiden yalnız telegram klasöründeki .webp'lere bakılıyordu. Tamamı
  // animasyonlu bir set üretildiğinde o klasörde sadece .webm oluyor ve
  // vitrin "üretilmiş statik sticker yok" diye düşüyordu — 2026-08-16'da
  // "Ofis Hayatı" setinde tam olarak bu oldu (15/15 animasyon).
  const kaynakKlasor = path.join(depo.CIKTI, setId, 'telegram');
  const kaynaklar = [];
  if (fs.existsSync(kaynakKlasor)) {
    for (const d of fs.readdirSync(kaynakKlasor).filter(d => d.endsWith('.webp')).sort()) {
      kaynaklar.push({ yol: path.join(kaynakKlasor, d) });
      if (kaynaklar.length >= 6) break;
    }
  }
  for (const uyeId of set.uyeler) {
    if (kaynaklar.length >= 6) break;
    const aday = depo.adayBul(uyeId);
    if (!aday || !aday.dosya) continue;
    const tam = depo.coz(aday.dosya);
    if (fs.existsSync(tam)) kaynaklar.push({ yol: tam });
  }
  if (!kaynaklar.length) {
    throw new Error('vitrin için görsel yok — sette üye yok ya da medya inmemiş');
  }

  const hucre = 170;
  const bosluk = 18;
  const izgaraGenislik = 3 * hucre + 2 * bosluk;
  const izgaraX = GENISLIK - izgaraGenislik - 80;

  const katmanlar = [];
  for (const [i, kaynak] of kaynaklar.entries()) {
    // İlk kare değil TEMSİLİ kare: animasyonlularda kare 0 sık sık boş.
    const sayfa = await donustur.temsiliKare(kaynak.yol);
    const ic = hucre - 16;
    const gorsel = await sharp(kaynak.yol, { page: sayfa })
      .resize(ic, ic, { fit: 'cover' })
      .png().toBuffer();
    // Sitedeki "pul" görünümü: beyaz çerçeve + mürekkep kontur + sert gölge.
    const cerceve = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${hucre + 6}" height="${hucre + 7}">
      <rect x="5" y="6" width="${hucre}" height="${hucre}" rx="${hucre * 0.22}" fill="#12111A"/>
      <rect x="1" y="1" width="${hucre}" height="${hucre}" rx="${hucre * 0.22}" fill="#fff" stroke="#12111A" stroke-width="2.5"/>
    </svg>`);
    const maske = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ic}" height="${ic}"><rect width="${ic}" height="${ic}" rx="${ic * 0.18}" fill="#fff"/></svg>`);
    const yuvarlak = await sharp(gorsel).composite([{ input: maske, blend: 'dest-in' }]).png().toBuffer();
    const kucuk = await sharp(cerceve).composite([{ input: yuvarlak, left: 9, top: 9 }]).png().toBuffer();
    // Hafif rastgele eğim: dizilmiş değil yapıştırılmış dursun.
    const egim = [-4, 3, -2, 4, -3, 2][i % 6];
    const donmus = await sharp(kucuk).rotate(egim, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    katmanlar.push({
      input: donmus,
      left: izgaraX + (i % 3) * (hucre + bosluk) - 8,
      top: 100 + Math.floor(i / 3) * (hucre + bosluk) - 8
    });
  }

  const kacar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  /* Görünüm sitenin 2. sürümüyle aynı dil (2026-09-21): kağıt zemin +
     noktalı ızgara, mürekkep kontur, pembe vurgu, Impact başlık; metin
     İngilizce (pazar dolar). Başlık uzunsa punto iner, iki satıra bölünmez —
     kapak tek bakışta okunmalı. */
  const ad = kacar(set.ad).toLowerCase();
  const punto = ad.length <= 12 ? 76 : ad.length <= 18 ? 60 : 48;
  // Açıklama sol sütuna (≈460 px) sığmalı: 40 karakterde kır, en fazla iki
  // satır; taşan kısım "…" olur. Izgaraya girip okunmaz olmasın.
  const kelimeler = (set.aciklama || '').split(/\s+/).filter(Boolean);
  const satirlar = [''];
  for (const k of kelimeler) {
    const son = satirlar[satirlar.length - 1];
    if ((son + ' ' + k).trim().length <= 40) satirlar[satirlar.length - 1] = (son + ' ' + k).trim();
    else if (satirlar.length < 2) satirlar.push(k);
    else { satirlar[1] = satirlar[1].slice(0, 37) + '…'; break; }
  }
  const aciklama = satirlar.map((s, i) =>
    `<text x="80" y="${348 + i * 26}" font-family="Arial" font-size="21" fill="#5B5A6B">${kacar(s)}</text>`).join('');
  const arka = `<svg xmlns="http://www.w3.org/2000/svg" width="${GENISLIK}" height="${YUKSEKLIK}">
    <defs>
      <pattern id="nokta" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.2" fill="#12111A" opacity="0.09"/>
      </pattern>
    </defs>
    <rect width="${GENISLIK}" height="${YUKSEKLIK}" fill="#FFFBF3"/>
    <rect width="${GENISLIK}" height="${YUKSEKLIK}" fill="url(#nokta)"/>
    <g transform="translate(80,70) rotate(-3)">
      <rect x="3" y="3" width="150" height="46" rx="8" fill="#FF2D87"/>
      <rect width="150" height="46" rx="8" fill="#12111A" stroke="#12111A" stroke-width="2.5"/>
      <circle cx="16" cy="23" r="4" fill="#FFFBF3"/>
      <text x="90" y="34" text-anchor="middle" font-family="Impact" font-size="28" fill="#fff">stick<tspan fill="#FF2D87">ky</tspan></text>
    </g>
    <text x="80" y="${punto <= 48 ? 300 : 305}" font-family="Impact" font-size="${punto}" fill="#12111A">${ad}</text>
    ${aciklama}
    <rect x="80" y="404" width="${(String(set.uyeler.length).length + 9) * 15 + 30}" height="40" rx="20" fill="#12111A"/>
    <text x="${80 + ((String(set.uyeler.length).length + 9) * 15 + 30) / 2}" y="431" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="18" fill="#fff" letter-spacing="1">${set.uyeler.length} STICKERS</text>
    <text x="80" y="492" font-family="Arial" font-weight="bold" font-size="22" fill="#FF2D87">Telegram · WhatsApp · everywhere</text>
    <text x="80" y="524" font-family="Arial" font-size="18" fill="#5B5A6B">one tap away · stickky.xyz</text>
  </svg>`;

  const cikti = path.join(depo.CIKTI, setId, 'vitrin.png');
  await sharp(Buffer.from(arka)).composite(katmanlar).png().toFile(cikti);
  depo.setGuncelle(setId, { ciktilar: { vitrin: '/cikti/' + setId + '/vitrin.png' } });
  return { dosya: '/cikti/' + setId + '/vitrin.png', sticker: set.uyeler.length };
}

module.exports = { vitrinUret };
