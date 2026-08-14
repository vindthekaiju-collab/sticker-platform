'use strict';
/**
 * Üretim hattı: havuzdaki ham medyayı platform biçimlerine dönüştürür.
 *
 * - Telegram statik: WebP, en büyük kenar tam 512, ≤512KB
 * - Telegram video:  WebM VP9 — ffmpeg ister; yoksa açıkça "yapılamadı" der
 * - WhatsApp:        WebP tam 512×512 (şeffaf dolgu), statik ≤100KB,
 *                    animasyon ≤500KB; 96×96 PNG tepsi ikonu
 *
 * Boyut sınırına "kalite düşürme döngüsüyle" inilir: q=90'dan başla,
 * sınırın altına inene kadar düşür. Hiç inmiyorsa hata — sessizce bozuk
 * dosya teslim edilmez.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const sinirlar = require('./sinirlar');

sharp.cache(false);

function ffmpegVar() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function girdiOku(dosyaYolu) {
  const meta = await sharp(dosyaYolu, { animated: true }).metadata();
  return {
    animasyonlu: (meta.pages || 1) > 1,
    genislik: meta.width,
    yukseklik: meta.pages ? meta.height / meta.pages || meta.height : meta.height,
    format: meta.format
  };
}

/** Kaliteyi düşüre düşüre sınırın altına in. */
async function boyutaSigdir(uret, azamiBayt, etiket) {
  for (const q of [90, 80, 70, 60, 50, 40, 30, 20]) {
    const veri = await uret(q);
    if (veri.length <= azamiBayt) return { veri, kalite: q };
  }
  throw new Error(etiket + ': en düşük kalitede bile ' + azamiBayt + ' baytın altına inmedi');
}

/** Telegram statik: en büyük kenar tam 512, oran korunur. */
async function telegramStatik(dosyaYolu) {
  const s = sinirlar.telegram.statik;
  const { veri, kalite } = await boyutaSigdir(
    q => sharp(dosyaYolu)
      .resize(s.kenar, s.kenar, { fit: 'inside', withoutEnlargement: false })
      .webp({ quality: q, effort: 4 })
      .toBuffer(),
    s.azamiBayt, 'telegram statik'
  );
  return { veri, uzanti: '.webp', kalite };
}

/** WhatsApp: tam 512×512 — kısa kenar şeffaf dolguyla tamamlanır. */
async function whatsappStatik(dosyaYolu) {
  const w = sinirlar.whatsapp;
  const { veri, kalite } = await boyutaSigdir(
    q => sharp(dosyaYolu)
      .resize(w.kenar, w.kenar, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: q, effort: 4 })
      .toBuffer(),
    w.statikAzamiBayt, 'whatsapp statik'
  );
  return { veri, uzanti: '.webp', kalite };
}

/** WhatsApp animasyon: sharp animasyonlu WebP üretebiliyor (gif → webp). */
async function whatsappAnimasyon(dosyaYolu) {
  const w = sinirlar.whatsapp;
  const { veri, kalite } = await boyutaSigdir(
    q => sharp(dosyaYolu, { animated: true })
      .resize(w.kenar, w.kenar, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: q, effort: 4 })
      .toBuffer(),
    w.animasyonAzamiBayt, 'whatsapp animasyon'
  );
  return { veri, uzanti: '.webp', kalite };
}

/** Telegram video sticker: WebM VP9 — ffmpeg gerektirir. */
function telegramVideo(dosyaYolu, ciktiYolu) {
  const v = sinirlar.telegram.video;
  if (!ffmpegVar()) {
    throw new Error('ffmpeg yok — Telegram video sticker üretilemedi. ' +
      'Windows: winget install ffmpeg');
  }
  // Ölçek: büyük kenar 512; süre 3sn'ye kırpılır; VP9 + alfa; ses yok.
  // Bit hızı 256KB sınırına iki geçişte yaklaşılır: önce varsayılan, sığmazsa düşür.
  const olcek = `scale=w=${v.kenar}:h=${v.kenar}:force_original_aspect_ratio=decrease`;
  for (const bitHizi of ['600k', '400k', '250k', '150k']) {
    execFileSync('ffmpeg', [
      '-y', '-i', dosyaYolu,
      '-t', String(v.azamiSaniye),
      '-vf', `${olcek},fps=${v.fps}`,
      '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
      '-b:v', bitHizi, '-an',
      ciktiYolu
    ], { stdio: 'ignore' });
    if (fs.statSync(ciktiYolu).size <= v.azamiBayt) {
      return { dosya: ciktiYolu, bitHizi };
    }
  }
  throw new Error('telegram video: en düşük bit hızında bile 256KB altına inmedi');
}

/** WhatsApp tepsi ikonu: 96×96 PNG ≤50KB. */
async function tepsiUret(dosyaYolu) {
  const t = sinirlar.whatsapp.tepsi;
  // PNG'de kalite döngüsü yerine palet sıkıştırması: 96px'te neredeyse
  // her görsel 50KB altındadır; değilse renk sayısı düşürülür.
  for (const renkler of [256, 128, 64]) {
    const veri = await sharp(dosyaYolu, { animated: false })
      .resize(t.kenar, t.kenar, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ palette: true, colors: renkler })
      .toBuffer();
    if (veri.length <= t.azamiBayt) return veri;
  }
  throw new Error('tepsi ikonu 50KB altına inmedi');
}

module.exports = {
  ffmpegVar, girdiOku, boyutaSigdir,
  telegramStatik, telegramVideo,
  whatsappStatik, whatsappAnimasyon, tepsiUret
};
