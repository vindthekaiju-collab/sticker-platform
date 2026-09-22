'use strict';
/**
 * Giphy kanal dökümünden (veri/giphy/kanallar.json) kanal başına numaralı
 * kontak sayfaları: her GIF'in DURAĞAN karesi (original_still) 220 px.
 * İnceleme için; sonra her kare tek tek animasyonlu bakılır.
 *   node arac/giphy-kontak.js [kanal] [--dosya veri/giphy/kanallar-2.json]   → veri/giphy/<kanal>/kontak-K.jpg + still'ler
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getir } = require('../lib/indir');

const KOK = path.join(__dirname, '..', 'veri', 'giphy');
const argv = process.argv.slice(2);
const di = argv.indexOf('--dosya');
const DOSYA = di >= 0 ? path.resolve(argv[di + 1]) : path.join(KOK, 'kanallar.json');
const hepsi = JSON.parse(fs.readFileSync(DOSYA, 'utf8'));
const secim = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dosya')[0];
const BOY = 220, SUTUN = 6, SATIR = 5, ADET = SUTUN * SATIR;
const bekle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  for (const [ad, k] of Object.entries(hepsi)) {
    if (secim && ad !== secim) continue;
    const klasor = path.join(KOK, ad);
    fs.mkdirSync(klasor, { recursive: true });
    let inen = 0;
    for (const [i, g] of k.gifler.entries()) {
      g.no = i + 1;
      const hedef = path.join(klasor, String(g.no).padStart(4, '0') + '.jpg');
      if (fs.existsSync(hedef)) continue;
      const url = g.still || g.kucuk;
      if (!url) continue;
      try {
        const { veri } = await getir(url, 5);
        await sharp(veri, { animated: false }).resize(BOY, BOY, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(hedef);
        inen++;
      } catch (e) { /* kırık kare atlanır */ }
      if (inen % 20 === 0) await bekle(300);
    }
    const sayfa = Math.ceil(k.gifler.length / ADET);
    for (let s = 0; s < sayfa; s++) {
      const katman = [];
      for (const g of k.gifler.slice(s * ADET, (s + 1) * ADET)) {
        const yol = path.join(klasor, String(g.no).padStart(4, '0') + '.jpg');
        if (!fs.existsSync(yol)) continue;
        const i = (g.no - 1) % ADET;
        const x = (i % SUTUN) * BOY, y = Math.floor(i / SUTUN) * BOY;
        const kare = await sharp(yol).resize(BOY - 6, BOY - 6, { fit: 'inside' }).png().toBuffer();
        const m = await sharp(kare).metadata();
        katman.push({ input: kare, left: x + 3 + Math.floor((BOY - 6 - m.width) / 2), top: y + 3 + Math.floor((BOY - 6 - m.height) / 2) });
        katman.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="28"><rect width="64" height="28" fill="#000" opacity=".75"/><text x="32" y="21" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="19" fill="#fff">${g.no}</text></svg>`), left: x, top: y });
      }
      await sharp({ create: { width: SUTUN * BOY, height: SATIR * BOY, channels: 3, background: '#333' } })
        .composite(katman).jpeg({ quality: 82 }).toFile(path.join(klasor, `kontak-${s + 1}.jpg`));
    }
    console.log(`${ad}: ${k.gifler.length} gif · ${inen} kare indi · ${sayfa} kontak sayfası`);
  }
  fs.writeFileSync(DOSYA, JSON.stringify(hepsi, null, 1));
})();
