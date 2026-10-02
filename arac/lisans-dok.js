'use strict';
/**
 * Bir tarama partisindeki adayların lisans + sanatçı + başlığını döker.
 * Seçim öncesi zorunlu kontrol: CC BY olanlar atıf ister, satış kitine
 * yazılır.  node arac/lisans-dok.js <parti> [no no …]
 */
const fs = require('fs');
const path = require('path');
const [parti, ...nolar] = process.argv.slice(2);
const a = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'veri', 'tarama', parti, 'adaylar.json'), 'utf8'));
const secim = nolar.length ? new Set(nolar.map(Number)) : null;
for (const x of a) {
  if (secim && !secim.has(x.no)) continue;
  console.log(String(x.no).padStart(3), '|', x.lisans.padEnd(22), '|', (x.sanatci || '-').slice(0, 34).padEnd(34), '|', x.baslik.slice(0, 55));
}
