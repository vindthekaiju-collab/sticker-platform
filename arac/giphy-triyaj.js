'use strict';
/**
 * Aday hesapların hızlı TRİYAJI: kanal meta + ilk 100 GIF'ten sayısal profil.
 *   node arac/giphy-triyaj.js [--en-az 2] [--sinir 200]
 * Girdi: veri/giphy/kesif/adaylar.json (arama) + komsular.json (ilgili-GIF)
 * Çıktı: veri/giphy/kesif/triyaj.json + ekrana sıralı tablo.
 * Zaten triyajı yapılmış hesap atlanır. Bilinen 10 kanal atlanır.
 */
const fs = require('fs');
const path = require('path');
const { json, sadelestir } = require('./giphy-kanal-dok');

const KOK = path.join(__dirname, '..', 'veri', 'giphy');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? Number(argv[i + 1]) : v; };
const enAz = sec('--en-az', 2), sinir = sec('--sinir', 200);
const bilinen = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(KOK, 'kanallar.json'), 'utf8'))));
const adaylar = fs.existsSync(path.join(KOK, 'kesif', 'adaylar.json')) ? JSON.parse(fs.readFileSync(path.join(KOK, 'kesif', 'adaylar.json'), 'utf8')) : [];
const komsular = fs.existsSync(path.join(KOK, 'kesif', 'komsular.json')) ? Object.values(JSON.parse(fs.readFileSync(path.join(KOK, 'kesif', 'komsular.json'), 'utf8')).hesaplar || {}) : [];
const triyajYol = path.join(KOK, 'kesif', 'triyaj.json');
const triyaj = fs.existsSync(triyajYol) ? JSON.parse(fs.readFileSync(triyajYol, 'utf8')) : {};
const bekle = ms => new Promise(r => setTimeout(r, ms));

// Puan: arama sorgusu sayısı + komşuluk sayısı (komşuluk daha değerli: küçük hesaplara ulaşır)
const puan = {};
for (const a of adaylar) puan[a.hesap] = (puan[a.hesap] || 0) + a.sorgular.length;
for (const k of komsular) puan[k.hesap] = (puan[k.hesap] || 0) + k.komsu * 2;
const sira = Object.entries(puan).filter(([h, p]) => p >= enAz && !bilinen.has(h)).sort((a, b) => b[1] - a[1]).slice(0, sinir).map(([h]) => h);

const MEME = /\b(meme|reaction|reactions|mood|me when|pov|relatable|vibes?)\b/i;
const HAYVAN = /\b(cat|cats|kitten|kitty|dog|dogs|puppy|pup|hamster|monkey|raccoon|frog|duck|goose|capybara|bird|rat|possum|bunny|rabbit)\b/i;
const MARKA = /\b(nba|nfl|mlb|nhl|netflix|hbo|disney|pixar|nickelodeon|cartoon network|adult swim|paramount|warner|universal|sony|marvel|dc|bbc|cbs|nbc|abc|fox|espn|mtv|vh1|tlc|bravo|peacock|hulu|apple tv|amazon|prime video|starz|showtime|comedy central|the office|friends|snl|jimmy fallon|tonight show|kimmel|colbert|ellen)\b/i;

(async () => {
  let n = 0;
  for (const hesap of sira) {
    if (triyaj[hesap]) continue;
    let k;
    try { k = await json(`https://giphy.com/api/v4/channels?slug=${encodeURIComponent(hesap)}`); }
    catch (e) { triyaj[hesap] = { hesap, hata: e.message.slice(0, 40) }; continue; }
    let f = { results: [] };
    try { f = await json(`https://giphy.com/api/v4/channels/${k.id}/feed?offset=0&limit=100`); } catch (e) { /* feed kapalı */ }
    const g = (f.results || []).map(sadelestir);
    const u = k.user || {};
    const say = (re, alan) => g.filter(x => re.test(alan === 'tags' ? x.tags.join(' ') : x.title)).length;
    const yillar = g.map(x => Number((x.tarih || '').slice(0, 4))).filter(Boolean);
    triyaj[hesap] = {
      hesap, id: k.id, display: k.display_name, tur: k.type, icerik: k.content_type, verified: !!u.is_verified,
      puan: puan[hesap], adet: g.length, sticker: g.filter(x => x.sticker).length,
      meme: say(MEME, 'tags'), hayvan: say(HAYVAN, 'tags'), marka: say(MARKA, 'tags') + (MARKA.test(k.display_name || '') ? 50 : 0),
      kare: g.filter(x => x.w && x.h && Math.abs(x.w / x.h - 1) < 0.25).length,
      yil: yillar.length ? Math.round(yillar.reduce((a, b) => a + b, 0) / yillar.length) : 0,
      ornek: g.slice(0, 5).map(x => x.title.replace(/ GIF$/, '')),
      etiketler: [...new Set(g.flatMap(x => x.tags))].slice(0, 25),
    };
    n++;
    if (n % 10 === 0) { fs.writeFileSync(triyajYol, JSON.stringify(triyaj, null, 1)); console.log(`${n}/${sira.length}`); }
    await bekle(500);
  }
  fs.writeFileSync(triyajYol, JSON.stringify(triyaj, null, 1));

  // Damar puanı: topluluk, doğrulanmamış, meme/hayvan etiketli, marka değil
  const liste = Object.values(triyaj).filter(t => !t.hata).map(t => {
    const damar = (t.tur === 'community' ? 2 : 0) + (t.verified ? -3 : 1) + (t.adet ? (t.meme + t.hayvan) / t.adet * 4 : 0) - (t.marka > 0 ? 3 : 0) + Math.min(t.adet, 100) / 100 + (t.yil >= 2025 ? 1 : 0);
    return { ...t, damar: Math.round(damar * 10) / 10 };
  }).sort((a, b) => b.damar - a.damar || b.puan - a.puan);
  fs.writeFileSync(path.join(KOK, 'kesif', 'triyaj-sira.json'), JSON.stringify(liste, null, 1));
  console.log(`\n${liste.length} hesap triyajlandı`);
  console.log('damar | puan | hesap                    | tür       | v | adet stk meme hayv marka | yıl  | örnek');
  for (const t of liste.slice(0, 80)) console.log(`${String(t.damar).padStart(5)} | ${String(t.puan).padStart(4)} | ${t.hesap.slice(0, 24).padEnd(24)} | ${String(t.tur).padEnd(9)} | ${t.verified ? 'V' : ' '} | ${String(t.adet).padStart(4)} ${String(t.sticker).padStart(3)} ${String(t.meme).padStart(4)} ${String(t.hayvan).padStart(4)} ${String(t.marka).padStart(5)} | ${t.yil} | ${t.ornek.slice(0, 3).join(' / ').slice(0, 60)}`);
})();
