'use strict';
/** Triyaj dosyasını hayvan payına göre sıralar.
 *   node arac/giphy-triyaj-sira.js [--oran 0.25] [--en-az 10] */
const path = require('path');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? Number(argv[i + 1]) : v; };
const oranEsik = sec('--oran', 0.25), enAz = sec('--en-az', 10);
const t = require(path.join(__dirname, '..', 'veri', 'giphy', 'kesif', 'triyaj.json'));
const l = Object.values(t)
  .filter(x => !x.hata && x.adet >= enAz && !x.verified && x.marka === 0)
  .map(x => ({ ...x, oran: x.hayvan / x.adet }))
  .filter(x => x.oran >= oranEsik)
  .sort((a, b) => b.oran - a.oran);
for (const x of l) console.log(`${x.hesap.padEnd(24)} ${String(x.tur).padEnd(9)} adet ${String(x.adet).padStart(3)} hayvan ${String(x.hayvan).padStart(3)} meme ${String(x.meme).padStart(3)} stk ${String(x.sticker).padStart(3)} yıl ${x.yil} · ${x.ornek.slice(0, 3).join(' / ').slice(0, 60)}`);
console.log(l.length, 'hesap /', Object.keys(t).length);
