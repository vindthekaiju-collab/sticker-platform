'use strict';
/** Döküm dosyasında başlık/etiket araması.
 *   node arac/giphy-ara.js <kanal> <regex> [--dosya veri/giphy/kanallar-2.json] */
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const di = argv.indexOf('--dosya');
const dosya = di >= 0 ? path.resolve(argv[di + 1]) : path.join(__dirname, '..', 'veri', 'giphy', 'kanallar-2.json');
const [kanal, desen] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dosya');
const hepsi = JSON.parse(fs.readFileSync(dosya, 'utf8'));
const re = new RegExp(desen, 'i');
for (const ad of Object.keys(hepsi)) {
  if (kanal !== '*' && ad !== kanal) continue;
  for (const g of hepsi[ad].gifler) {
    if (!re.test(g.title + ' ' + g.tags.join(' '))) continue;
    console.log(`${ad.slice(0, 14).padEnd(14)} ${String(g.no).padStart(4)} | ${g.title.replace(/ GIF$| Sticker$/, '').slice(0, 40).padEnd(40)} | ${g.sticker ? 'STK' : '   '} | ${g.tags.slice(0, 8).join(', ').slice(0, 70)}`);
  }
}
