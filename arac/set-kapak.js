'use strict';
/**
 * Yeni setler için 1200×630 vitrin kapağı (Gumroad/OG oranı).
 * Görünüm dili sitenin 2. sürümüyle aynı: kağıt zemin + noktalı ızgara,
 * mürekkep kontur, pembe vurgu, Impact başlık, İngilizce metin.
 * `lib/vitrin.js` depo modeline bağlı olduğu için burada bağımsız yazıldı.
 *   node arac/set-kapak.js [--setler cikti/setler]
 * Çıktı: <set>/kapak.png · <setler>/kapaklar.html
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

sharp.cache(false);
const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const setDiz = path.resolve(sec('--setler', path.join(KOK, 'cikti', 'setler')));
const setler = JSON.parse(fs.readFileSync(path.join(setDiz, 'setler.json'), 'utf8'));
const G = 1200, Y = 630;
const kacar = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Kapakta kullanılacak kare: ilk kare boş olabiliyor, ortadakini al. */
async function pul(dosya, kenar) {
  const veri = fs.readFileSync(dosya);
  const m = await sharp(veri, { animated: true }).metadata();
  const orta = Math.floor((m.pages || 1) / 2);
  return sharp(veri, { page: orta, pages: 1 })
    .resize(kenar, kenar, { fit: 'contain', background: { r: 255, g: 251, b: 243, alpha: 1 } })
    .png().toBuffer();
}

(async () => {
  for (const s of setler) {
    const d = path.join(setDiz, s.slug);
    const hucre = 150, bosluk = 14, izgaraX = 640;
    const katmanlar = [];
    const secili = s.dosyalar.filter((_, i) => i % Math.max(1, Math.floor(s.dosyalar.length / 9)) === 0).slice(0, 9);
    for (const [i, f] of secili.entries()) {
      const kare = await pul(path.join(d, f.dosya), hucre - 16);
      const aci = [-6, 4, -3, 5, -5, 3, -4, 6, -2][i % 9];
      const pulPng = await sharp({ create: { width: hucre, height: hucre, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
        .composite([{ input: kare, left: 8, top: 8 }])
        .png().toBuffer();
      const donmus = await sharp(pulPng).rotate(aci, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      katmanlar.push({ input: donmus, left: izgaraX + (i % 3) * (hucre + bosluk) - 8, top: 100 + Math.floor(i / 3) * (hucre + bosluk) - 8 });
    }
    const ad = kacar(s.ad).toLowerCase();
    const punto = ad.length <= 12 ? 76 : ad.length <= 18 ? 60 : ad.length <= 22 ? 48 : 38;
    const kelimeler = String(s.desc || '').split(/\s+/).filter(Boolean);
    const satirlar = [''];
    for (const k of kelimeler) {
      const son = satirlar[satirlar.length - 1];
      if ((son + ' ' + k).trim().length <= 40) satirlar[satirlar.length - 1] = (son + ' ' + k).trim();
      else if (satirlar.length < 2) satirlar.push(k);
      else break;
    }
    const aciklama = satirlar.map((x, i) => `<text x="80" y="${348 + i * 26}" font-family="Arial" font-size="21" fill="#5B5A6B">${kacar(x)}</text>`).join('');
    const rozetG = (String(s.adet).length + 9) * 15 + 30;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${G}" height="${Y}">
  <defs><pattern id="nokta" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.2" fill="#12111A" opacity="0.09"/></pattern></defs>
  <rect width="${G}" height="${Y}" fill="#FFFBF3"/><rect width="${G}" height="${Y}" fill="url(#nokta)"/>
  <g transform="translate(80,70) rotate(-3)">
    <rect x="3" y="3" width="150" height="46" rx="8" fill="#FF2D87"/>
    <rect width="150" height="46" rx="8" fill="#12111A" stroke="#12111A" stroke-width="2.5"/>
    <circle cx="16" cy="23" r="4" fill="#FFFBF3"/>
    <text x="90" y="34" text-anchor="middle" font-family="Impact" font-size="28" fill="#fff">stick<tspan fill="#FF2D87">ky</tspan></text>
  </g>
  <text x="80" y="${punto <= 48 ? 300 : 305}" font-family="Impact" font-size="${punto}" fill="#12111A">${ad}</text>
  ${aciklama}
  <rect x="80" y="404" width="${rozetG}" height="40" rx="20" fill="#12111A"/>
  <text x="${80 + rozetG / 2}" y="431" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="18" fill="#fff" letter-spacing="1">${s.adet} STICKERS</text>
  <text x="80" y="492" font-family="Arial" font-weight="bold" font-size="22" fill="#FF2D87">WhatsApp · Telegram · everywhere</text>
  <text x="80" y="524" font-family="Arial" font-size="18" fill="#5B5A6B">animated · one tap away · stickky.xyz</text>
</svg>`;
    await sharp(Buffer.from(svg)).composite(katmanlar).png().toFile(path.join(d, 'kapak.png'));
  }
  fs.writeFileSync(path.join(setDiz, 'kapaklar.html'), `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>stickky · ${setler.length} kapak</title>
<style>body{margin:0;background:#141414;color:#eee;font:14px system-ui,sans-serif}h1{padding:14px 16px;margin:0;font-size:18px;border-bottom:1px solid #333}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px;padding:14px}img{width:100%;border-radius:10px;display:block}</style></head><body>
<h1>stickky · ${setler.length} set kapağı</h1><div class="g">${setler.map(s => `<a href="${s.slug}/kapak.png"><img src="${s.slug}/kapak.png" loading="lazy" alt=""></a>`).join('')}</div></body></html>`);
  console.log(`${setler.length} kapak → ${setDiz}/<set>/kapak.png`);
})();
