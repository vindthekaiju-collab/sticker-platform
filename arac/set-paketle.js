'use strict';
/**
 * Setleri TESLİM EDİLEBİLİR pakete çevirir.
 *   node arac/set-paketle.js [--setler cikti/setler] [--hedef cikti/paketler]
 *
 * Her set için:
 *   <slug>.wastickers  — WhatsApp (tray.png + title/author + contents.json + webp)
 *   <slug>.zip         — her yerde açılan sade paket (webp + README + CREDITS)
 *
 * Sınırlar `lib/sinirlar.js`ten: animasyonlu sticker ≤500 KB, tepsi 96×96 ≤50 KB,
 * set 3-30 arası. Sticker'lar zaten 512×512 animasyonlu WebP olarak üretildi;
 * burada yalnız paketlenir, yeniden kodlanmaz.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const zip = require('../lib/zip');
const sinirlar = require('../lib/sinirlar');

sharp.cache(false);
const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const setDiz = path.resolve(sec('--setler', path.join(KOK, 'cikti', 'setler')));
const hedefDiz = path.resolve(sec('--hedef', path.join(KOK, 'cikti', 'paketler')));
const setler = JSON.parse(fs.readFileSync(path.join(setDiz, 'setler.json'), 'utf8'));

/** Tema → tepsi/arama emojisi (WhatsApp her sticker için en az bir emoji ister). */
const EMOJI = {
  'side-eye': '👀', 'say-it-again': '😠', 'dead-inside': '😵', 'crying-rights': '😭',
  'caught-in-4k': '😱', 'not-funny': '😂', 'unhinged': '🤪', 'big-brain': '🤔',
  'hard-no': '🙅', 'certified-sigma': '😎', 'soft-hours': '🥰', 'work-mode': '💻',
  'tea-time': '☕', 'dance-floor': '💃', 'canon-classics': '🐸', 'oops': '😬',
  'snack-time': '😋', 'mixed-reactions': '🙂',
};

async function tepsi(dosya) {
  const t = sinirlar.whatsapp.tepsi;
  const veri = fs.readFileSync(dosya);
  const m = await sharp(veri, { animated: true }).metadata();
  const orta = Math.floor((m.pages || 1) / 2);         // ilk kare boş olabiliyor
  for (const renkler of [256, 128, 64]) {
    const png = await sharp(veri, { page: orta, pages: 1 })
      .resize(t.kenar, t.kenar, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ palette: true, colors: renkler }).toBuffer();
    if (png.length <= t.azamiBayt) return png;
  }
  throw new Error('tepsi ikonu 50KB altına inmedi');
}

(async () => {
  fs.mkdirSync(hedefDiz, { recursive: true });
  const rapor = [];
  for (const s of setler) {
    const d = path.join(setDiz, s.slug);
    const emoji = EMOJI[s.tema] || '🙂';
    const girdiler = [];
    const stickerlar = [];
    let buyuk = 0;
    for (const f of s.dosyalar) {
      const veri = fs.readFileSync(path.join(d, f.dosya));
      if (veri.length > sinirlar.whatsapp.animasyonAzamiBayt) { buyuk++; continue; }
      girdiler.push({ ad: f.dosya, veri });
      stickerlar.push({ image_file: f.dosya, emojis: [emoji] });
    }
    const tepsiPng = await tepsi(path.join(d, s.dosyalar[0].dosya));
    girdiler.push({ ad: 'tray.png', veri: tepsiPng });
    girdiler.push({ ad: 'title.txt', veri: Buffer.from(s.ad, 'utf8') });
    girdiler.push({ ad: 'author.txt', veri: Buffer.from('stickky', 'utf8') });
    girdiler.push({
      ad: 'contents.json',
      veri: Buffer.from(JSON.stringify({
        identifier: 'stickky-' + s.slug, name: s.ad, publisher: 'stickky',
        publisher_website: 'https://stickky.xyz', privacy_policy_website: 'https://stickky.xyz/legal.html',
        tray_image_file: 'tray.png', animated_sticker_pack: true, stickers: stickerlar,
      }, null, 2), 'utf8'),
    });
    fs.writeFileSync(path.join(hedefDiz, s.slug + '.wastickers'), zip.zipYap(girdiler));

    // sade ZIP: aynı dosyalar + okuma metni
    const okuma = [
      s.ad, s.desc, '',
      `${stickerlar.length} sticker · 512x512 animated WebP`,
      'WhatsApp: use the .wastickers file with a sticker app, or import the WebP files.',
      'Telegram: send the WebP files to @Stickers.',
      '',
      'stickky.xyz · support & DMCA: hello@stickky.xyz · stickky.xyz/legal.html',
    ].join('\n');
    const kaynaklar = s.dosyalar.map(f => `${f.dosya}  —  giphy.com (${f.kanal})`).join('\n');
    fs.writeFileSync(path.join(hedefDiz, s.slug + '.zip'), zip.zipYap([
      ...girdiler.filter(g => /\.webp$/.test(g.ad)),
      { ad: 'README.txt', veri: Buffer.from(okuma, 'utf8') },
      { ad: 'SOURCES.txt', veri: Buffer.from(kaynaklar, 'utf8') },
    ]));

    const wa = fs.statSync(path.join(hedefDiz, s.slug + '.wastickers')).size;
    rapor.push({ slug: s.slug, ad: s.ad, sticker: stickerlar.length, atlanan: buyuk, wastickersKB: Math.round(wa / 1024) });
    console.log(`${s.slug.padEnd(22)} ${String(stickerlar.length).padStart(3)} sticker · ${Math.round(wa / 1024)} KB${buyuk ? ' · ' + buyuk + ' büyük atlandı' : ''}`);
  }
  fs.writeFileSync(path.join(hedefDiz, 'rapor.json'), JSON.stringify(rapor, null, 1));
  console.log(`\n${rapor.length} paket → ${hedefDiz}`);
})();
