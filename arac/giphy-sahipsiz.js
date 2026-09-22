'use strict';
/**
 * Keşif dökümünde YÜKLEYENİ OLMAYAN (anonim) sonuçları toplar — bunlar
 * Giphy'de hesabı silinmiş ya da anonim yüklenmiş viral GIF'ler; "sahipsiz"
 * havuzun en yakın karşılığı. Hayvan/emoji süzgeciyle listeler, JSON yazar.
 *   node arac/giphy-sahipsiz.js [--hepsi]   → veri/giphy/kesif/sahipsiz.json
 */
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '..', 'veri', 'giphy', 'kesif');
const aramalar = JSON.parse(fs.readFileSync(path.join(KOK, 'aramalar.json'), 'utf8'));
const hepsi = process.argv.includes('--hepsi');
const disi = process.argv.includes('--disi');
const kanalAdi = disi ? '_sahipsiz2' : '_sahipsiz';
const HAYVAN = /\b(cat|cats|kitten|kitty|dog|dogs|puppy|pup|hamster|monkey|raccoon|frog|duck|goose|capybara|bird|rat|possum|bunny|rabbit|seal|otter|squirrel|emoji|emote|fish|bear|cow|pig|goat|owl|penguin|fox|deer|lizard|turtle|horse|sheep|chicken|parrot|pigeon)\b/i;
const gorulen = new Map();
for (const [q, k] of Object.entries(aramalar)) {
  for (const tur of ['gif', 'sticker']) {
    for (const g of k[tur] || []) {
      if (g.username) continue;
      const metin = g.title + ' ' + g.tags.join(' ');
      if (disi ? HAYVAN.test(metin) : (!hepsi && !HAYVAN.test(metin))) continue;
      const v = gorulen.get(g.id) || { id: g.id, title: g.title.replace(/ GIF$| Sticker$/, ''), url: g.url, sticker: g.sticker, tags: g.tags.slice(0, 10), sorgular: [] };
      if (!v.sorgular.includes(q)) v.sorgular.push(q);
      gorulen.set(g.id, v);
    }
  }
}
const liste = [...gorulen.values()].sort((a, b) => b.sorgular.length - a.sorgular.length);
fs.writeFileSync(path.join(KOK, kanalAdi.slice(1) + '.json'), JSON.stringify(liste, null, 1));
console.log(`${liste.length} anonim GIF (${liste.filter(x => x.sticker).length} sticker) → kesif/sahipsiz.json`);
for (const x of liste.slice(0, 40)) console.log(`${String(x.sorgular.length).padStart(2)}× ${x.sticker ? 'STK' : '   '} ${x.title.slice(0, 40).padEnd(40)} ${x.sorgular.slice(0, 4).join(', ')}`);

// Sözde kanal olarak kanallar-2.json'a yaz (giphy-kontak.js / galeri için)
const k2yol = path.join(__dirname, '..', 'veri', 'giphy', 'kanallar-2.json');
const k2 = JSON.parse(fs.readFileSync(k2yol, 'utf8'));
k2[kanalAdi] = {
  id: 0, slug: kanalAdi, display: 'Anonim (yükleyeni yok) — ' + (disi ? 'hayvan dışı' : 'hayvan/emoji'), tur: 'sanal', verified: false,
  gifler: liste.map((x, i) => ({
    id: x.id, title: x.title, tags: [...x.tags, ...x.sorgular.map(s => 'q:' + s)], url: x.url, sticker: !!x.sticker, video: false,
    tarih: '', rating: '', kaynak: '', alt: '', w: 0, h: 0, frames: 0,
    gif: `https://media.giphy.com/media/${x.id}/giphy.gif`, still: `https://media.giphy.com/media/${x.id}/giphy_s.gif`,
    kucuk: `https://media.giphy.com/media/${x.id}/200.gif`, mp4: '', no: i + 1,
  })),
};
fs.writeFileSync(k2yol, JSON.stringify(k2, null, 1));
console.log(`${kanalAdi} sözde kanalı yazıldı: ${liste.length}`);
