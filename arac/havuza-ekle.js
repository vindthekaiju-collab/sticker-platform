'use strict';
/**
 * Üretilmiş bir partiyi (deneme-set.js çıktısı) mevcut havuza EKLER.
 * Havuzu yeniden kurmaz — toplu-birlestir.js baştan kurduğu için sonradan
 * yapılan düzeltmeleri (cümle varyantları) siliyordu.
 *
 *   node arac/havuza-ekle.js --parti cikti/toplu-5 [--havuz cikti/havuz]
 *
 * Aynı kanal+no zaten havuzdaysa atlanır.
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const parti = path.resolve(sec('--parti', ''));
const havuz = path.resolve(sec('--havuz', path.join(KOK, 'cikti', 'havuz')));
if (!parti || !fs.existsSync(path.join(parti, 'kayit.json'))) {
  console.error('parti klasörü ya da kayit.json yok: ' + parti);
  process.exit(1);
}
const yeni = JSON.parse(fs.readFileSync(path.join(parti, 'kayit.json'), 'utf8'));
const kayit = JSON.parse(fs.readFileSync(path.join(havuz, 'kayit.json'), 'utf8'));
const varOlan = new Set(kayit.map(k => k.kanal + '#' + k.no));
let sonAd = kayit.reduce((a, k) => Math.max(a, Number(k.ad)), 0);

let eklendi = 0, atlandi = 0;
for (const y of yeni) {
  const anahtar = y.kanal + '#' + y.no;
  if (varOlan.has(anahtar)) { atlandi++; continue; }
  varOlan.add(anahtar);
  const ad = String(++sonAd).padStart(4, '0');
  fs.copyFileSync(path.join(parti, y.ad + '.webp'), path.join(havuz, ad + '.webp'));
  kayit.push({ ad, kanal: y.kanal, no: y.no, metin: y.metin, baslik: y.baslik, url: y.url, kb: y.kb, kare: y.kare });
  eklendi++;
}
fs.writeFileSync(path.join(havuz, 'kayit.json'), JSON.stringify(kayit, null, 1));
console.log(`${eklendi} eklendi · ${atlandi} zaten vardı · havuz ${kayit.length}`);
