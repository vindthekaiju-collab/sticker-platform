'use strict';
/**
 * Platform biçim sınırları — üretim hattının tek gerçek kaynağı.
 *
 * DURUM: DOĞRULANDI (2026-08-14)
 *  - WhatsApp: resmî depo README'sinden birebir
 *    (github.com/WhatsApp/stickers/Android/README.md)
 *  - Telegram: core.telegram.org egress engelliydi; birden çok ikincil
 *    kaynak çapraz okunarak doğrulandı (core.telegram.org/stickers ve
 *    /import-stickers'ı aktaran kaynaklar birbiriyle tutarlı).
 *
 * DURUM: DOĞRULANMADI
 *  - .wastickers arşiv düzeni (title.txt / author.txt / tray + webp'ler)
 *    üçüncü parti Sticker Maker uygulamalarının geleneğidir, resmî bir
 *    şartname yoktur. İlk gerçek telefonda içe aktarma testi bunu sınar.
 */

// Temsili karenin bu orandan azı opaksa sticker "boş" görünür (uyarı eşiği).
const seyrekEsigi = 0.05;

module.exports = {
  seyrekEsigi,
  telegram: {
    statik: {
      bicimler: ['png', 'webp'],
      // En az bir kenar tam 512px olmalı; iki kenar da 512'yi aşamaz.
      kenar: 512,
      azamiBayt: 512 * 1024
    },
    video: {
      bicim: 'webm', // VP9 + alfa kanalı
      kenar: 512,
      azamiBayt: 256 * 1024,
      azamiSaniye: 3,
      fps: 30
    },
    // Bot API: set adı 1-64 karakter, harfle başlar ve "_by_<botadi>" ile
    // bitmek zorundadır. createNewStickerSet / addStickerToSet lib/telegram.js'te.
    setAdiSonEk: '_by_'
  },

  whatsapp: {
    bicim: 'webp',
    // Tam 512×512 — Telegram'dan farklı: iki kenar da tam 512 olmalı.
    kenar: 512,
    statikAzamiBayt: 100 * 1024,
    animasyonAzamiBayt: 500 * 1024,
    animasyonAzamiSaniye: 10,
    karePayiMinMs: 8,
    tepsi: { bicim: 'png', kenar: 96, azamiBayt: 50 * 1024 },
    setAsgari: 3,
    setAzami: 30
    // Paket ya tümüyle statik ya tümüyle animasyonlu olur, karışmaz.
  }
};
