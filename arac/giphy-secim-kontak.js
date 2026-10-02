'use strict';
/**
 * İnceleme dosyalarındaki ✅ satırlarını toplar, o karelerin still'lerini
 * tek kontak sayfasına döker (kanal + no etiketiyle) ve listeyi JSON'a yazar.
 *   node arac/giphy-secim-kontak.js  → veri/giphy/secim/kontak-K.jpg + secim.json
 * "no" sütunu tek sayı, "a-b" aralık ya da "a, b, c" liste olabilir.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const KOK = path.join(__dirname, '..', 'veri', 'giphy');
const hepsi = JSON.parse(fs.readFileSync(path.join(KOK, 'kanallar.json'), 'utf8'));
const secim = [];

for (const dosya of fs.readdirSync(path.join(KOK, 'inceleme'))) {
  const kanal = dosya.replace(/\.md$/, '');
  if (!hepsi[kanal]) continue;
  for (const satir of fs.readFileSync(path.join(KOK, 'inceleme', dosya), 'utf8').split('\n')) {
    if (!/^\| *[\d,\- ]+ *\|/.test(satir) || !/\| ✅/.test(satir)) continue;
    const hucre = satir.split('|').map(s => s.trim());
    const nolar = [];
    for (const parca of hucre[1].split(',')) {
      const m = parca.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!m) continue;
      const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
      for (let i = a; i <= b; i++) nolar.push(i);
    }
    const hukum = hucre[hucre.length - 2] || '';
    for (const no of nolar) {
      const g = hepsi[kanal].gifler[no - 1];
      if (!g) continue;
      secim.push({ kanal, no, id: g.id, baslik: g.title.replace(/ GIF$/, ''), url: g.url, gif: g.gif, hukum, not: hucre[3] || '' });
    }
  }
}

(async () => {
  const klasor = path.join(KOK, 'secim');
  fs.mkdirSync(klasor, { recursive: true });
  fs.writeFileSync(path.join(klasor, 'secim.json'), JSON.stringify(secim, null, 1));
  const BOY = 200, SUTUN = 8, SATIR = 6, ADET = SUTUN * SATIR;
  const sayfa = Math.ceil(secim.length / ADET);
  for (let s = 0; s < sayfa; s++) {
    const katman = [];
    for (const [i, k] of secim.slice(s * ADET, (s + 1) * ADET).entries()) {
      const yol = path.join(KOK, k.kanal, String(k.no).padStart(4, '0') + '.jpg');
      if (!fs.existsSync(yol)) continue;
      const x = (i % SUTUN) * BOY, y = Math.floor(i / SUTUN) * BOY;
      const kare = await sharp(yol).resize(BOY - 4, BOY - 4, { fit: 'inside' }).png().toBuffer();
      const m = await sharp(kare).metadata();
      katman.push({ input: kare, left: x + 2 + Math.floor((BOY - 4 - m.width) / 2), top: y + 2 + Math.floor((BOY - 4 - m.height) / 2) });
      const etiket = `${k.kanal.slice(0, 7)} ${k.no}`;
      katman.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${BOY}" height="22"><rect width="${BOY}" height="22" fill="#000" opacity=".7"/><text x="4" y="16" font-family="Arial" font-weight="bold" font-size="13" fill="#fff">${etiket}</text></svg>`), left: x, top: y + BOY - 22 });
    }
    await sharp({ create: { width: SUTUN * BOY, height: SATIR * BOY, channels: 3, background: '#2a2a2a' } })
      .composite(katman).jpeg({ quality: 82 }).toFile(path.join(klasor, `kontak-${s + 1}.jpg`));
  }
  console.log(`${secim.length} seçim · ${sayfa} kontak sayfası → veri/giphy/secim/`);
})();
