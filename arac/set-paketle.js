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
const { EMOJI } = require('../lib/temalar');

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
    rapor.push({ slug: s.slug, ad: s.ad, desc: s.desc, raf: !!s.raf, sticker: stickerlar.length, atlanan: buyuk, wastickersKB: Math.round(wa / 1024) });
    console.log(`${s.slug.padEnd(22)} ${String(stickerlar.length).padStart(3)} sticker · ${Math.round(wa / 1024)} KB${buyuk ? ' · ' + buyuk + ' büyük atlandı' : ''}${s.raf ? ' · raf' : ''}`);
  }
  fs.writeFileSync(path.join(hedefDiz, 'rapor.json'), JSON.stringify(rapor, null, 1));

  // Vitrin listesi (site/paketler/index.html'e kopyalanır): ad · adet · önizleme ·
  // iki indirme bağlantısı. Raftaki setler ayrı başlıkta, vitrin sayımına girmez.
  const kacar = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const satir = r => `<tr><td><b>${kacar(r.ad)}</b><br><small>${kacar(r.desc)}</small></td><td>${r.sticker}</td><td><a href="../setler/${r.slug}/index.html">önizleme</a></td><td><a href="${r.slug}.wastickers">.wastickers</a></td><td><a href="${r.slug}.zip">.zip</a></td><td>${r.wastickersKB} KB</td></tr>`;
  const vitrin = rapor.filter(r => !r.raf), rafta = rapor.filter(r => r.raf);
  const toplam = l => l.reduce((a, b) => a + b.sticker, 0);
  fs.writeFileSync(path.join(hedefDiz, 'index.html'), `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>stickky · ${vitrin.length} paket</title>
<style>body{margin:0;background:#0d0d0d;color:#eee;font:14px system-ui,sans-serif}h1{padding:14px 16px;margin:0;font-size:18px;border-bottom:1px solid #333}h1.raf{color:#888;margin-top:24px}
table{border-collapse:collapse;width:100%}td{padding:9px 14px;border-bottom:1px solid #222;vertical-align:top}small{color:#888}a{color:#ff2d87}</style></head><body>
<h1>stickky · ${vitrin.length} paket · ${toplam(vitrin)} sticker</h1><table>${vitrin.map(satir).join('')}</table>
${rafta.length ? `<h1 class="raf">Rafta — vitrine çıkmaz · ${rafta.length} paket · ${toplam(rafta)} sticker</h1><table>${rafta.map(satir).join('')}</table>` : ''}
</body></html>`);
  console.log(`\n${vitrin.length} paket vitrin + ${rafta.length} rafta → ${hedefDiz}`);
})();
