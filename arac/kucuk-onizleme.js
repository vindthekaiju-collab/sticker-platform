'use strict';
/**
 * Ana sayfa için küçük animasyonlu önizlemeler.
 *
 * site/s/<set>/NN.webp (512×512, ~450 KB, animasyonlu) → site/k/<set>/NN.webp
 * (256×256, animasyon korunur, çok daha küçük). Ana sayfa yirmi sticker'ı
 * birden yüzdürüyor; 8 MB'lık tam boyları telefonda takılıyor.
 *
 * Veri klasörü gerektirmez; doğrudan site/s içinden okur. Yeni set
 * yayınlanınca (lib/magaza.js sonrası) bir kez koştur:
 *     node arac/kucuk-onizleme.js
 * Var olan ve kaynağından yeni olan dosyalar atlanır.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const KOK = path.join(__dirname, '..', 'site');
const KAYNAK = path.join(KOK, 's');
const HEDEF = path.join(KOK, 'k');
const BOY = 256;

async function calistir() {
  let yazildi = 0, atlandi = 0, oncekiKB = 0, sonrakiKB = 0;
  for (const setId of fs.readdirSync(KAYNAK)) {
    const klasor = path.join(KAYNAK, setId);
    if (!fs.statSync(klasor).isDirectory()) continue;
    for (const dosya of fs.readdirSync(klasor).filter(d => /^\d+\.webp$/.test(d))) {
      const kay = path.join(klasor, dosya);
      const hed = path.join(HEDEF, setId, dosya);
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
  console.log(`site/k → ${yazildi} yazıldı, ${atlandi} atlandı` +
    (yazildi ? ` · ${Math.round(oncekiKB)} KB → ${Math.round(sonrakiKB)} KB` : ''));
}

calistir().catch(e => { console.error(e); process.exit(1); });
