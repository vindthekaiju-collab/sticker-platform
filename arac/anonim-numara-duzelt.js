'use strict';
/**
 * ANONİM HAVUZ NUMARA DÜZELTME (bir kerelik onarım + kalıcı sabitleme kontrolü).
 *
 * `_sahipsiz` / `_sahipsiz2` gerçek Giphy kanalı değil, arama sonuçlarından
 * türetilen SÖZDE kanallar. Sıra "kaç sorguda göründüğü"ne göre kuruluyordu;
 * yeni sorgu turu eklenince sıra değişti ve daha önce verilen numaralar başka
 * karelere kaydı (2026-09-23: 1.080 kaydın 1.067'si). Kayıtlar URL taşıdığı
 * için onarılabilir.
 *
 *   node arac/anonim-numara-duzelt.js [--yaz]
 * --yaz olmadan yalnız rapor eder.
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const yaz = process.argv.includes('--yaz');
const kanallar = JSON.parse(fs.readFileSync(path.join(KOK, 'veri', 'giphy', 'kanallar-2.json'), 'utf8'));
const hedefler = [
  path.join(KOK, 'cikti', 'havuz', 'kayit.json'),
  path.join(KOK, 'veri', 'giphy', 'kesif', 'secim2.json'),
];

const urlNo = {};
for (const ad of ['_sahipsiz', '_sahipsiz2']) {
  if (!kanallar[ad]) continue;
  urlNo[ad] = new Map(kanallar[ad].gifler.map(g => [g.url, g.no]));
}

for (const yol of hedefler) {
  if (!fs.existsSync(yol)) { console.log('yok:', yol); continue; }
  const liste = JSON.parse(fs.readFileSync(yol, 'utf8'));
  let duzelen = 0, bulunamayan = 0, ilgili = 0;
  for (const k of liste) {
    if (!urlNo[k.kanal]) continue;
    ilgili++;
    const dogru = urlNo[k.kanal].get(k.url);
    if (dogru === undefined) { bulunamayan++; continue; }
    if (dogru !== k.no) { k.no = dogru; duzelen++; }
  }
  console.log(`${path.basename(yol)}: ${ilgili} anonim kayıt · ${duzelen} numara düzeltildi · ${bulunamayan} eşleşmedi`);
  if (yaz && duzelen) fs.writeFileSync(yol, JSON.stringify(liste, null, 1));
}
if (!yaz) console.log('\n(yalnız rapor — yazmak için --yaz)');
