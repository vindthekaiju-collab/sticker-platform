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
 *     node arac/koleksiyon-onizleme.js [--setler cikti/setler] [--site site] [--yeniden]
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

/**
 * Orta karenin saydam olmayan sınır kutusu. Havuzun %38'i (400/1.051, 2026-10-02
 * ölçümü) 16:9 GIF kesiği: 512×512 tuvalde üstte-altta saydam bant kalıyor,
 * vitrinde "boş/arkası yok" görünüyordu. Bantlı kare için kutu kesilip kareye
 * DOLDURULUR (cover); gerçek kesik (kedi silueti gibi, oran kareye yakın)
 * olduğu gibi sığdırılır. Satılan 512'lik dosyaya dokunulmaz.
 */
async function sinirKutusu(dosya) {
  const m = await sharp(dosya, { animated: true }).metadata();
  const orta = Math.floor((m.pages || 1) / 2);
  const { data, info } = await sharp(dosya, { page: orta, pages: 1 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

async function kucult(kay, hed) {
  const kutu = await sinirKutusu(kay);
  const oran = kutu ? kutu.width / kutu.height : 1;
  let hat = sharp(kay, { animated: true });
  if (kutu && (oran > 1.3 || oran < 0.77)) hat = hat.extract(kutu).resize(BOY, BOY, { fit: 'cover' });
  else hat = hat.resize(BOY, BOY);
  await hat.webp({ quality: 58, effort: 4 }).toFile(hed);
  return !!(kutu && (oran > 1.3 || oran < 0.77));
}

async function calistir() {
  const setler = JSON.parse(fs.readFileSync(path.join(setDiz, 'setler.json'), 'utf8')).filter(s => !s.raf);
  const yeniden = argv.includes('--yeniden');
  let yazildi = 0, atlandi = 0, kesilen = 0, oncekiKB = 0, sonrakiKB = 0;
  for (const s of setler) {
    for (const f of s.dosyalar) {
      const kay = path.join(setDiz, s.slug, f.dosya);
      const hed = path.join(siteDiz, 'k', s.slug, f.dosya);
      if (!fs.existsSync(kay)) continue;
      if (!yeniden && fs.existsSync(hed) && fs.statSync(hed).mtimeMs >= fs.statSync(kay).mtimeMs) { atlandi++; continue; }
      fs.mkdirSync(path.dirname(hed), { recursive: true });
      if (await kucult(kay, hed)) kesilen++;
      oncekiKB += fs.statSync(kay).size / 1024;
      sonrakiKB += fs.statSync(hed).size / 1024;
      yazildi++;
    }
  }
  console.log(`${setler.length} set · ${yazildi} küçük yazıldı (${kesilen} bantlı kare kesildi), ${atlandi} atlandı · ${Math.round(oncekiKB / 1024)} MB → ${Math.round(sonrakiKB / 1024)} MB`);
}

calistir().catch(e => { console.error(e); process.exit(1); });
