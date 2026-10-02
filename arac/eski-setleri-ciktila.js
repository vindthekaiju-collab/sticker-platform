'use strict';
/**
 * eski-setleri-yukle.js'nin ikinci yarısı: yayındaki üç setin çıktı
 * kayıtlarını kurar, yoksa magaza.js onları vitrinden düşürüyor
 * (stickerlariKopyala cikti/<id>/wastickers arar; yoksa set atlanır).
 *
 * site/s/<id>/NN.webp + <ad>.wastickers + <ad>.zip → cikti/<id>/{wastickers,zip}/
 * ve set.ciktilar raporu (dosyalar: adayId + emoji, paket adı, animasyonlu).
 *
 *   node arac/eski-setleri-ciktila.js
 */
const fs = require('fs');
const path = require('path');
const depo = require('../lib/depo');

const KOK = path.join(__dirname, '..');
let n = 0;

for (const set of depo.setListe()) {
  if (set.ciktilar && set.ciktilar.wastickers) continue;
  const kaynak = path.join(KOK, 'site', 's', set.id);
  if (!fs.existsSync(kaynak)) continue;
  const dosyalar = fs.readdirSync(kaynak);
  const webpler = dosyalar.filter(d => /^\d+\.webp$/.test(d)).sort();
  const wast = dosyalar.find(d => d.endsWith('.wastickers'));
  const zipAd = dosyalar.find(d => d.endsWith('.zip'));
  if (!webpler.length) continue;

  const uyeler = set.uyeler.map(id => depo.adayBul(id)).filter(Boolean);
  const liste = webpler.map((d, i) => ({ adayId: uyeler[i] ? uyeler[i].id : null, dosya: d, emoji: uyeler[i] ? uyeler[i].emoji : '🙂' }));

  for (const hedef of ['wastickers', 'zip']) {
    const klasor = path.join(depo.CIKTI, set.id, hedef);
    fs.mkdirSync(klasor, { recursive: true });
    for (const d of webpler) fs.copyFileSync(path.join(kaynak, d), path.join(klasor, d));
  }
  const ciktilar = {
    wastickers: { hedef: 'wastickers', dosyalar: liste, hatalar: [], paket: wast || null, animasyonlu: true, zaman: '2026-08-17T00:00:00.000Z', not: 'MacBook üretimi; buraya yayın kopyasından alındı' },
    zip: { hedef: 'zip', dosyalar: liste.map(({ adayId, dosya }) => ({ adayId, dosya })), hatalar: [], paket: zipAd || null, zaman: '2026-08-17T00:00:00.000Z' }
  };
  if (wast) fs.copyFileSync(path.join(kaynak, wast), path.join(depo.CIKTI, set.id, 'wastickers', wast));
  if (zipAd) fs.copyFileSync(path.join(kaynak, zipAd), path.join(depo.CIKTI, set.id, 'zip', zipAd));
  depo.setGuncelle(set.id, { ciktilar });
  n++;
  console.log(`+ ${set.ad}: ${webpler.length} webp · wastickers ${wast ? 'var' : 'yok'} · zip ${zipAd ? 'var' : 'yok'}`);
}
console.log(`${n} setin çıktı kaydı kuruldu`);
