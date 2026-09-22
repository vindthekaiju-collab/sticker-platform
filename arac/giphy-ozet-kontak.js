'use strict';
/** Birden çok kanalın ilk N karesini tek sayfada gösterir (hızlı triyaj).
 *   node arac/giphy-ozet-kontak.js <k1> <k2> ... [--adet 12] [--cikti veri/giphy/kesif/ozet-1.jpg] */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const KOK = path.join(__dirname, '..', 'veri', 'giphy');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const ADET = Number(sec('--adet', 12));
const cikti = path.resolve(sec('--cikti', path.join(KOK, 'kesif', 'ozet.jpg')));
const kanallar = argv.filter((a, i) => !a.startsWith('--') && !['--adet', '--cikti'].includes(argv[i - 1]));
const BOY = 110, SUTUN = ADET;
(async () => {
  const katman = [];
  for (const [r, k] of kanallar.entries()) {
    const klasor = path.join(KOK, k);
    const dosyalar = fs.existsSync(klasor) ? fs.readdirSync(klasor).filter(f => /^\d{4}\.jpg$/.test(f)).sort() : [];
    // eşit aralıkla ADET kare seç (başı değil, bütünü örnekle)
    const adim = Math.max(1, Math.floor(dosyalar.length / ADET));
    const secili = dosyalar.filter((_, i) => i % adim === 0).slice(0, ADET);
    const y = r * BOY;
    katman.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SUTUN * BOY}" height="18"><rect width="${SUTUN * BOY}" height="18" fill="#000" opacity=".75"/><text x="4" y="13" font-family="Arial" font-weight="bold" font-size="12" fill="#ff2d87">${k} (${dosyalar.length})</text></svg>`), left: 0, top: y });
    for (const [i, f] of secili.entries()) {
      const kare = await sharp(path.join(klasor, f)).resize(BOY - 4, BOY - 22, { fit: 'inside' }).png().toBuffer();
      const m = await sharp(kare).metadata();
      katman.push({ input: kare, left: i * BOY + 2 + Math.floor((BOY - 4 - m.width) / 2), top: y + 20 + Math.floor((BOY - 22 - m.height) / 2) });
    }
  }
  await sharp({ create: { width: SUTUN * BOY, height: kanallar.length * BOY, channels: 3, background: '#2a2a2a' } }).composite(katman).jpeg({ quality: 80 }).toFile(cikti);
  console.log(cikti, kanallar.length, 'kanal');
})();
