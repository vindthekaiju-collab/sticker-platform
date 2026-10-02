'use strict';
/**
 * Koleksiyon setleri (arac/set-kur.js çıktısı) için küçük animasyonlu önizlemeler.
 *
 * cikti/setler/<slug>/NN.webp (512×512, 50-480 KB) → site/k/<slug>/NN.webp
 * (256×256, animasyon korunur). Mağaza ve ana sayfa yalnız BU küçükleri
 * gösterir: satılan 512'lik dosyalar siteye hiç kopyalanmaz, alıcı ödemeden
 * ürünün kendisine ulaşamaz. Raftaki setler atlanır.
 *
 * arac/kucuk-onizleme.js'in kardeşi: o depo setleri için site/s'den okur,
 * bu koleksiyon için cikti/setler'den. Var olan ve kaynağından yeni olan
 * dosyalar atlanır; yeniden koşmak ucuz.
 *
 *     node arac/koleksiyon-onizleme.js [--setler cikti/setler] [--site site]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false);

const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const setDiz = path.resolve(sec('--setler', path.join(KOK, 'cikti', 'setler')));
const siteDiz = path.resolve(sec('--site', process.env.STICKKY_SITE || path.join(KOK, 'site')));
const BOY = 256;

async function calistir() {
  const setler = JSON.parse(fs.readFileSync(path.join(setDiz, 'setler.json'), 'utf8')).filter(s => !s.raf);
  let yazildi = 0, atlandi = 0, oncekiKB = 0, sonrakiKB = 0;
  for (const s of setler) {
    for (const f of s.dosyalar) {
      const kay = path.join(setDiz, s.slug, f.dosya);
      const hed = path.join(siteDiz, 'k', s.slug, f.dosya);
      if (!fs.existsSync(kay)) continue;
      if (fs.existsSync(hed) && fs.statSync(hed).mtimeMs >= fs.statSync(kay).mtimeMs) { atlandi++; continue; }
      fs.mkdirSync(path.dirname(hed), { recursive: true });
      await sharp(kay, { animated: true })
        .resize(BOY, BOY)
        .webp({ quality: 58, effort: 4 })
        .toFile(hed);
      oncekiKB += fs.statSync(kay).size / 1024;
      sonrakiKB += fs.statSync(hed).size / 1024;
      yazildi++;
    }
  }
  console.log(`${setler.length} set · ${yazildi} küçük yazıldı, ${atlandi} atlandı · ${Math.round(oncekiKB / 1024)} MB → ${Math.round(sonrakiKB / 1024)} MB`);
}

calistir().catch(e => { console.error(e); process.exit(1); });
