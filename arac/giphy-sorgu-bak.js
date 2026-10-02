'use strict';
/** Keşif dökümünde bir sorgunun sonuçlarını (hesap · başlık) basar.
 *   node arac/giphy-sorgu-bak.js "<sorgu>" [gif|sticker] */
const fs = require('fs');
const path = require('path');
const aramalar = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'veri', 'giphy', 'kesif', 'aramalar.json'), 'utf8'));
const [q, tur] = process.argv.slice(2);
const k = aramalar[q];
if (!k) { console.log('sorgu yok:', q); process.exit(1); }
for (const t of tur ? [tur] : ['gif', 'sticker']) {
  console.log(`— ${t}`);
  for (const g of k[t] || []) console.log(`  ${(g.username || '?').padEnd(24)} ${g.title.replace(/ GIF$| Sticker$/, '').slice(0, 50)}`);
}
