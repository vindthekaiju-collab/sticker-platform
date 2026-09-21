'use strict';
/**
 * Onarım: 500 px küçükten inmiş ham dosyaları 1200 px ile değiştirir ve
 * sticker'ı aynı kırpma + altyazıyla yeniden üretir.
 *
 * Sebep (2026-09-21): havuza-al.js küçük adreste yalnız "360px-" arıyordu;
 * Commons çoğu dosyada "500px-" veriyor, kalıp tutmayınca 500 px küçük
 * indi. Kırpılıp 512'ye büyütülünce bulanık.
 *
 * Aday kaydı KORUNUR (id, set üyeliği, kaynak kaydı aynı); yalnız
 * medyaUrl yeni adrese çevrilir, ham dosya üstüne yazılır, hazır PNG
 * yeniden çizilir. Panelli sticker'lar (paneller alanı olanlar) atlanır;
 * onlar zaten düzeltilmiş kodla üretilir.
 *
 *   node arac/ham-yenile.js [--kuru]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const depo = require('../lib/depo');
const { getir } = require('../lib/indir');
const { stickerYap } = require('./havuza-al');

const kuru = process.argv.includes('--kuru');
const bekle = ms => new Promise(r => setTimeout(r, ms));
const KAYNAKLAR = path.join(depo.VERI, 'kaynaklar.json');

(async () => {
  const kaynaklar = JSON.parse(fs.readFileSync(KAYNAKLAR, 'utf8'));
  let bakildi = 0, yenilendi = 0, hata = 0;
  for (const a of depo.havuzListe()) {
    if (a.kaynak !== 'commons' || !/\/\d+px-/.test(a.medyaUrl)) continue;
    // İlk alımlarda `ham` alanı yoktu; dosya diskte id ile bulunur.
    let ham = a.ham ? path.join(depo.KOK, a.ham) : null;
    if (!ham || !fs.existsSync(ham)) {
      ham = ['.jpg', '.png', '.webp'].map(u => path.join(depo.VERI, 'medya', a.id + u)).find(y => fs.existsSync(y));
    }
    if (!ham) continue;
    const m = await sharp(ham).metadata();
    bakildi++;
    if (m.width >= 900) continue;
    const kayit = kaynaklar[a.id];
    if (kayit && kayit.paneller) continue;
    const yeniUrl = a.medyaUrl.replace(/\/\d+px-/, '/1280px-');   // 1200 Commons listesinde yok (400)
    if (kuru) { console.log(`~ ${a.id} ${m.width}px → 1280px`); yenilendi++; continue; }
    try {
      let veri;
      for (let d = 0; d < 4; d++) {
        try { ({ veri } = await getir(yeniUrl, 5)); break; }
        catch (e) { if (d === 3 || !/429|zaman/.test(e.message)) throw e; await bekle(6000 * (d + 1)); }
      }
      fs.writeFileSync(ham, veri);
      const metin = a.etiketler && a.etiketler[0] && a.etiketler[0] !== '(no caption)' ? a.etiketler[0] : '';
      await stickerYap(ham, a.kirp || null, metin, depo.coz(a.dosya), !!a.sigdir);
      depo.adayGuncelle(a.id, { medyaUrl: yeniUrl, ham: path.relative(depo.KOK, ham).split(path.sep).join('/') });
      yenilendi++;
      const yeniM = await sharp(ham).metadata();
      console.log(`✓ ${a.id} ${m.width}px → ${yeniM.width}px "${metin}"`);
      await bekle(1500);
    } catch (e) {
      hata++;
      console.log(`× ${a.id}: ${e.message}`);
    }
  }
  console.log(`bakıldı ${bakildi} · yenilendi ${yenilendi} · hata ${hata}`);
})().catch(e => { console.error(e); process.exit(1); });
