'use strict';
/** Kanal dökümünden bir sayfalık (30) GIF'in başlık + etiket + boyut satırlarını basar.
 *   node arac/giphy-dok.js <kanal> <sayfa>  (sayfa 1'den) */
const fs = require('fs');
const path = require('path');
const [kanal, sayfaStr] = process.argv.slice(2);
const hepsi = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'veri', 'giphy', 'kanallar.json'), 'utf8'));
const k = hepsi[kanal];
const s = Number(sayfaStr) || 1;
for (const g of k.gifler.slice((s - 1) * 30, s * 30)) {
  const tags = (g.tags || []).filter(t => !/^string\d/.test(t)).slice(0, 12).join(', ');
  console.log(`${String(g.no).padStart(4)} | ${g.title.replace(/ GIF$/, '').slice(0, 44).padEnd(44)} | ${g.w}x${g.h} ${g.frames}k${g.sticker ? ' STK' : ''} | ${tags}`);
}
