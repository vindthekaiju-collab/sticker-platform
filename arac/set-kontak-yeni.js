'use strict';
/**
 * Her set için tek sayfalık kontak (ilk kareler, beyaz zemin) — gözle denetim.
 *   node arac/set-kontak-yeni.js [--setler cikti/setler]
 * Çıktı: <set>/kontak.jpg ve <setler>/kontak-tumu.jpg (set başına ilk 12 kare).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

sharp.cache(false);
const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const kok = path.resolve(sec('--setler', path.join(KOK, 'cikti', 'setler')));
const setler = JSON.parse(fs.readFileSync(path.join(kok, 'setler.json'), 'utf8'));

async function kare(dosya, boy) {
  const veri = fs.readFileSync(dosya);
  const meta = await sharp(veri, { animated: true }).metadata();
  const orta = Math.floor((meta.pages || 1) / 2);
  const b = await sharp(veri, { page: orta, pages: 1 }).resize(boy - 6, boy - 6, { fit: 'inside' }).flatten({ background: '#ffffff' }).png().toBuffer();
  const m = await sharp(b).metadata();
  return { b, w: m.width, h: m.height };
}

(async () => {
  const BOY = 170, SUT = 10;
  for (const s of setler) {
    const d = path.join(kok, s.slug);
    const kat = [];
    for (const [i, f] of s.dosyalar.entries()) {
      const { b, w, h } = await kare(path.join(d, f.dosya), BOY);
      const x = (i % SUT) * BOY, y = Math.floor(i / SUT) * BOY;
      kat.push({ input: b, left: x + 3 + Math.floor((BOY - 6 - w) / 2), top: y + 3 + Math.floor((BOY - 6 - h) / 2) });
    }
    await sharp({ create: { width: SUT * BOY, height: Math.ceil(s.dosyalar.length / SUT) * BOY, channels: 3, background: '#3a3a3a' } })
      .composite(kat).jpeg({ quality: 82 }).toFile(path.join(d, 'kontak.jpg'));
  }
  // tüm setler: satır başına bir set, ilk 12 kare
  const SBOY = 120, SSUT = 12;
  const kat = [];
  for (const [r, s] of setler.entries()) {
    const y = r * SBOY;
    kat.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SSUT * SBOY}" height="16"><rect width="${SSUT * SBOY}" height="16" fill="#000" opacity=".75"/><text x="4" y="12" font-family="Arial" font-weight="bold" font-size="11" fill="#ff2d87">${s.ad} (${s.adet})</text></svg>`), left: 0, top: y });
    for (const [i, f] of s.dosyalar.slice(0, SSUT).entries()) {
      const { b, w, h } = await kare(path.join(kok, s.slug, f.dosya), SBOY);
      kat.push({ input: b, left: i * SBOY + 3 + Math.floor((SBOY - 6 - w) / 2), top: y + 18 + Math.floor((SBOY - 24 - h) / 2) });
    }
  }
  await sharp({ create: { width: SSUT * SBOY, height: setler.length * SBOY, channels: 3, background: '#2a2a2a' } })
    .composite(kat).jpeg({ quality: 80 }).toFile(path.join(kok, 'kontak-tumu.jpg'));
  console.log(`${setler.length} set kontağı + kontak-tumu.jpg → ${kok}`);
})();
