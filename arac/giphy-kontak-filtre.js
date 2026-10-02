'use strict';
/**
 * Başlık/etikete göre süzülmüş kontak sayfası (numaralar orijinal).
 *   node arac/giphy-kontak-filtre.js <kanal> <regex> [--dosya ...]  → veri/giphy/<kanal>/filtre-K.jpg
 * Still'ler daha önce giphy-kontak.js ile inmiş olmalı.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const KOK = path.join(__dirname, '..', 'veri', 'giphy');
const argv = process.argv.slice(2);
const di = argv.indexOf('--dosya');
const dosya = di >= 0 ? path.resolve(argv[di + 1]) : path.join(KOK, 'kanallar-2.json');
const [kanal, desen] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dosya');
const k = JSON.parse(fs.readFileSync(dosya, 'utf8'))[kanal];
const re = new RegExp(desen, 'i');
const secili = k.gifler.filter(g => re.test(g.title + ' ' + g.tags.join(' ')));
const BOY = 220, SUTUN = 6, SATIR = 5, ADET = SUTUN * SATIR;
(async () => {
  const klasor = path.join(KOK, kanal);
  const sayfa = Math.ceil(secili.length / ADET);
  for (let s = 0; s < sayfa; s++) {
    const katman = [];
    for (const [i, g] of secili.slice(s * ADET, (s + 1) * ADET).entries()) {
      const yol = path.join(klasor, String(g.no).padStart(4, '0') + '.jpg');
      if (!fs.existsSync(yol)) continue;
      const x = (i % SUTUN) * BOY, y = Math.floor(i / SUTUN) * BOY;
      const kare = await sharp(yol).resize(BOY - 6, BOY - 6, { fit: 'inside' }).png().toBuffer();
      const m = await sharp(kare).metadata();
      katman.push({ input: kare, left: x + 3 + Math.floor((BOY - 6 - m.width) / 2), top: y + 3 + Math.floor((BOY - 6 - m.height) / 2) });
      katman.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="28"><rect width="64" height="28" fill="#000" opacity=".75"/><text x="32" y="21" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="19" fill="#fff">${g.no}</text></svg>`), left: x, top: y });
    }
    await sharp({ create: { width: SUTUN * BOY, height: SATIR * BOY, channels: 3, background: '#333' } })
      .composite(katman).jpeg({ quality: 82 }).toFile(path.join(klasor, `filtre-${s + 1}.jpg`));
  }
  console.log(`${kanal}: ${secili.length}/${k.gifler.length} eşleşme · ${sayfa} sayfa → filtre-K.jpg`);
})();
