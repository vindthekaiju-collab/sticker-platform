'use strict';
/**
 * Dev eserlerden (Bosch, Bruegel, Bayeux) ayrıntı seçmek için: 4000 px
 * kopyayı indirir, verilen bölgeyi 4×4 ızgaraya böler ve her hücreyi
 * numaralı kontak sayfasına döker. Hücre koordinatları TAM BOYUN ORANI
 * olarak basılır; plan dosyasındaki "kirp" doğrudan buradan alınır.
 *
 *   node arac/dev-eser-bak.js <parti> <no> [x y w h]   (oranlar, varsayılan tümü)
 *   → veri/tarama/<parti>/dev-<no>-<x>-<y>.jpg  ve  veri/tarama/<parti>/dev-<no>.jpg (kaynak)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getir } = require('../lib/indir');

const [parti, noStr, ...oran] = process.argv.slice(2);
const no = Number(noStr);
const klasor = path.join(__dirname, '..', 'veri', 'tarama', parti);
const [X, Y, W, H] = oran.length === 4 ? oran.map(Number) : [0, 0, 1, 1];

(async () => {
  const aday = JSON.parse(fs.readFileSync(path.join(klasor, 'adaylar.json'), 'utf8')).find(a => a.no === no);
  if (!aday) throw new Error('aday yok');
  const kaynak = path.join(klasor, `dev-${no}.jpg`);
  if (!fs.existsSync(kaynak)) {
    // Commons küçük genişlikleri listeli (1280/1920 var, 4000 yok); dev eser
    // için orijinal indirilir (lib/indir 25 MB tavanı).
    const url = aday.medyaUrl;
    const { veri } = await getir(url, 5);
    fs.writeFileSync(kaynak, veri);
  }
  const meta = await sharp(kaynak).metadata();
  const N = 4, BOY = 300;
  const katman = [];
  const x0 = Math.round(X * meta.width), y0 = Math.round(Y * meta.height);
  const cw = Math.floor(W * meta.width / N), ch = Math.floor(H * meta.height / N);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const hucre = await sharp(kaynak).extract({ left: x0 + c * cw, top: y0 + r * ch, width: cw, height: ch })
      .resize(BOY - 6, BOY - 6, { fit: 'inside' }).png().toBuffer();
    const m = await sharp(hucre).metadata();
    const px = c * BOY + 3 + Math.floor((BOY - 6 - m.width) / 2), py = r * BOY + 3 + Math.floor((BOY - 6 - m.height) / 2);
    katman.push({ input: hucre, left: px, top: py });
    const ox = (X + c * W / N).toFixed(3), oy = (Y + r * H / N).toFixed(3);
    katman.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="26"><rect width="150" height="26" fill="#000" opacity=".75"/><text x="5" y="19" font-family="Arial" font-weight="bold" font-size="15" fill="#fff">${ox},${oy}</text></svg>`), left: c * BOY, top: r * BOY });
  }
  const ad = `dev-${no}-${X}-${Y}-${W}-${H}.jpg`;
  await sharp({ create: { width: N * BOY, height: N * BOY, channels: 3, background: '#333' } })
    .composite(katman).jpeg({ quality: 85 }).toFile(path.join(klasor, ad));
  console.log(path.join('veri', 'tarama', parti, ad), `kaynak ${meta.width}x${meta.height}, hücre ${(W / N).toFixed(3)}x${(H / N).toFixed(3)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
