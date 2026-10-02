'use strict';
/**
 * Havuzdaki her sticker'ın ilk karesini ölçer: ne kadarı dolu (alfa), ne kadar
 * kontrast var. Boş/neredeyse boş kareler sete girmemeli — kontak sayfasında
 * beyaz kutu olarak görünüyorlardı.
 *   node arac/havuz-denetle.js [--havuz cikti/havuz]
 * Çıktı: <havuz>/kalite.json  { ad: { dolu, sapma, bos } }
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

sharp.cache(false);
const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const havuz = path.resolve(sec('--havuz', path.join(KOK, 'cikti', 'havuz')));
const kayit = JSON.parse(fs.readFileSync(path.join(havuz, 'kayit.json'), 'utf8'));

(async () => {
  const kalite = {};
  let bos = 0;
  for (const k of kayit) {
    const yol = path.join(havuz, k.ad + '.webp');
    try {
      const veri = fs.readFileSync(yol);
      const m = await sharp(veri, { animated: true }).metadata();
      const orta = Math.floor((m.pages || 1) / 2);
      const ham = await sharp(veri, { page: orta, pages: 1 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const { data, info } = ham;
      const n = info.width * info.height;
      let dolu = 0, toplam = 0, kareToplam = 0;
      for (let i = 0; i < n; i++) {
        const a = data[i * info.channels + 3];
        if (a > 24) dolu++;
        const g = (data[i * info.channels] + data[i * info.channels + 1] + data[i * info.channels + 2]) / 3;
        toplam += g; kareToplam += g * g;
      }
      const ort = toplam / n;
      const sapma = Math.sqrt(Math.max(0, kareToplam / n - ort * ort));
      const oran = dolu / n;
      const bosMu = oran < 0.04 || sapma < 6;
      kalite[k.ad] = { dolu: Math.round(oran * 1000) / 1000, sapma: Math.round(sapma * 10) / 10, bos: bosMu };
      if (bosMu) bos++;
    } catch (e) {
      kalite[k.ad] = { hata: e.message.slice(0, 60), bos: true };
      bos++;
    }
  }
  fs.writeFileSync(path.join(havuz, 'kalite.json'), JSON.stringify(kalite, null, 1));
  console.log(`${kayit.length} kare ölçüldü · ${bos} boş/düşük kontrast → kalite.json`);
  for (const [ad, v] of Object.entries(kalite).filter(x => x[1].bos).slice(0, 25)) {
    const k = kayit.find(x => x.ad === ad);
    console.log(`  ${ad} ${k.kanal}#${k.no} dolu=${v.dolu} sapma=${v.sapma} "${k.metin || ''}"`);
  }
})();
