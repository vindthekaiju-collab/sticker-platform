'use strict';
/**
 * Setlerin hazır sticker'larını kontak sayfasına döker — göz denetimi için.
 *   node arac/set-kontak.js            → veri/tarama/setler/<set-adi>.jpg (her set)
 * Kare başına: sticker + sıra numarası; 4 sütun, 300px.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const depo = require('../lib/depo');
const { guvenliAd } = require('../lib/uret');

const HEDEF = path.join(depo.VERI, 'tarama', 'setler');
const BOY = 300, SUTUN = 4;

(async () => {
  fs.mkdirSync(HEDEF, { recursive: true });
  for (const set of depo.setListe()) {
    const katman = [];
    const uyeler = set.uyeler.map(id => depo.adayBul(id)).filter(a => a && a.dosya);
    const satir = Math.max(1, Math.ceil(uyeler.length / SUTUN));
    for (const [i, a] of uyeler.entries()) {
      const yol = depo.coz(a.dosya);
      if (!fs.existsSync(yol)) continue;
      const kare = await sharp(yol).resize(BOY - 8, BOY - 8).png().toBuffer();
      const x = (i % SUTUN) * BOY + 4, y = Math.floor(i / SUTUN) * BOY + 4;
      katman.push({ input: kare, left: x, top: y });
      katman.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="26"><rect width="44" height="26" fill="#000" opacity=".7"/><text x="22" y="19" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="16" fill="#fff">${i + 1}</text></svg>`), left: x, top: y });
    }
    const dosya = path.join(HEDEF, guvenliAd(set.ad) + '.jpg');
    await sharp({ create: { width: SUTUN * BOY, height: satir * BOY, channels: 3, background: '#2b2b2b' } })
      .composite(katman).jpeg({ quality: 84 }).toFile(dosya);
    console.log(`${set.ad}: ${uyeler.length} sticker → ${path.relative(depo.KOK, dosya)}`);
  }
})();
