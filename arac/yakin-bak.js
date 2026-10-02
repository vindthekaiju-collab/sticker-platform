'use strict';
/**
 * Seçilmiş adaylara yakından bakmak için 3 sütunlu 400px kontak.
 *   node arac/yakin-bak.js <parti> <no> <no> ...   → veri/tarama/<parti>/yakin-<ad>.jpg
 * Kırpma oranı kararı için karelere 0-1 ızgara çizgileri (0.25 aralık) basılır.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [parti, ...nolar] = process.argv.slice(2);
const klasor = path.join(__dirname, '..', 'veri', 'tarama', parti);
const BOY = 400, SUTUN = 3;

(async () => {
  const adaylar = JSON.parse(fs.readFileSync(path.join(klasor, 'adaylar.json'), 'utf8'));
  const secili = nolar.map(Number).map(n => adaylar.find(a => a.no === n)).filter(Boolean);
  const satir = Math.ceil(secili.length / SUTUN);
  const katman = [];
  for (const [i, a] of secili.entries()) {
    const yol = path.join(klasor, a.dosya);
    if (!fs.existsSync(yol)) continue;
    const kare = await sharp(yol).resize(BOY - 8, BOY - 8, { fit: 'inside' }).png().toBuffer();
    const m = await sharp(kare).metadata();
    const x = (i % SUTUN) * BOY + 4 + Math.floor((BOY - 8 - m.width) / 2);
    const y = Math.floor(i / SUTUN) * BOY + 4 + Math.floor((BOY - 8 - m.height) / 2);
    katman.push({ input: kare, left: x, top: y });
    // ızgara: görselin kendi 0-1 oranında
    const cizgi = [0.25, 0.5, 0.75].map(o =>
      `<line x1="${(o * m.width).toFixed(0)}" y1="0" x2="${(o * m.width).toFixed(0)}" y2="${m.height}" stroke="#0ff" stroke-width="1" opacity=".6"/>` +
      `<line x1="0" y1="${(o * m.height).toFixed(0)}" x2="${m.width}" y2="${(o * m.height).toFixed(0)}" stroke="#0ff" stroke-width="1" opacity=".6"/>`).join('');
    katman.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="${m.height}">${cizgi}</svg>`), left: x, top: y });
    katman.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="70" height="30"><rect width="70" height="30" fill="#000" opacity=".75"/><text x="35" y="22" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="20" fill="#fff">${a.no}</text></svg>`), left: (i % SUTUN) * BOY, top: Math.floor(i / SUTUN) * BOY });
  }
  const ad = 'yakin-' + nolar.join('-').slice(0, 40) + '.jpg';
  await sharp({ create: { width: SUTUN * BOY, height: satir * BOY, channels: 3, background: '#333' } })
    .composite(katman).jpeg({ quality: 85 }).toFile(path.join(klasor, ad));
  console.log(path.join('veri', 'tarama', parti, ad));
})();
