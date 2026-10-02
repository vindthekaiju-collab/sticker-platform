'use strict';
/**
 * Yayındaki setlerin kapaklarını tek katalog görseline döker (göz denetimi,
 * kullanıcıya "işte hepsi" demek için).  node arac/katalog-sayfasi.js
 * → veri/tarama/setler/katalog.jpg  (3 sütun, kapak 1200×630 → 400×210)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const depo = require('../lib/depo');

const KOK = path.join(__dirname, '..');
const SUTUN = 3, W = 400, H = 210, BOSLUK = 8;

(async () => {
  const setler = depo.setListe().filter(s => s.durum === 'yayinda' && fs.existsSync(path.join(KOK, 'yayin-kaydi', 'kapak', s.id + '.png')));
  const satir = Math.ceil(setler.length / SUTUN);
  const katman = [];
  for (const [i, s] of setler.entries()) {
    const k = await sharp(path.join(KOK, 'yayin-kaydi', 'kapak', s.id + '.png')).resize(W, H).png().toBuffer();
    katman.push({ input: k, left: (i % SUTUN) * (W + BOSLUK), top: Math.floor(i / SUTUN) * (H + BOSLUK) });
  }
  const cikti = path.join(depo.VERI, 'tarama', 'setler', 'katalog.jpg');
  await sharp({ create: { width: SUTUN * (W + BOSLUK) - BOSLUK, height: satir * (H + BOSLUK) - BOSLUK, channels: 3, background: '#12111A' } })
    .composite(katman).jpeg({ quality: 86 }).toFile(cikti);
  console.log(`${setler.length} kapak → ${path.relative(KOK, cikti)}`);
})();
