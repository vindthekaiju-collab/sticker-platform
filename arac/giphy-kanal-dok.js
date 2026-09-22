'use strict';
/**
 * Giphy kanalını (kullanıcı adıyla) döker: meta + tam feed.
 *   node arac/giphy-kanal-dok.js <hesap> [<hesap> ...] [--hedef veri/giphy/kanallar-2.json] [--en-cok 400]
 * Biçim veri/giphy/kanallar.json ile aynı; giphy-kontak.js / giphy-dok.js
 * bu dosyayı --dosya ile okuyabilir. Zaten dökülmüş hesap atlanır.
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const secenek = (ad, vars) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : vars; };
const hedefYol = path.resolve(secenek('--hedef', path.join(__dirname, '..', 'veri', 'giphy', 'kanallar-2.json')));
const enCok = Number(secenek('--en-cok', 400));
const hesaplar = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--hedef' && argv[i - 1] !== '--en-cok');
const hepsi = fs.existsSync(hedefYol) ? JSON.parse(fs.readFileSync(hedefYol, 'utf8')) : {};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36';
const bekle = ms => new Promise(r => setTimeout(r, ms));

async function json(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.json();
}

function sadelestir(g) {
  const im = g.images || {};
  const o = im.original || {}, d = im.downsized || {};
  return {
    id: g.id, title: g.title || '', tags: g.tags || [], url: g.url,
    sticker: !!(g.is_sticker === 1 || g.is_sticker === true), video: !!g.has_video || false,
    tarih: g.create_datetime || g.import_datetime || '', rating: g.rating || '', kaynak: g.source || '', alt: g.alt_text || '',
    w: Number(o.width || d.width || 0), h: Number(o.height || d.height || 0), frames: Number(o.frames || d.frames || 0),
    gif: o.url || d.url || '', still: (im.original_still || im.downsized_still || {}).url || '',
    kucuk: (im.fixed_height || {}).url || '', mp4: o.mp4 || (im.hd || {}).mp4 || '',
  };
}

module.exports = { json, sadelestir };

if (require.main === module) (async () => {
  for (const hesap of hesaplar) {
    if (hepsi[hesap]) { console.log(`${hesap}: zaten var (${hepsi[hesap].gifler.length})`); continue; }
    let k;
    try { k = await json(`https://giphy.com/api/v4/channels?slug=${encodeURIComponent(hesap)}`); }
    catch (e) { console.log(`${hesap}: kanal yok (${e.message})`); continue; }
    const u = k.user || {};
    const kayit = {
      id: k.id, slug: k.slug, display: k.display_name, desc: k.description || '', userId: k.user_id,
      tur: k.type, icerik: k.content_type, about: u.about || '', website: u.website_url || null,
      instagram: u.instagram_url || null, tiktok: u.tiktok_url || null, twitter: u.twitter_url || null, youtube: u.youtube_url || null,
      verified: !!u.is_verified, upgraded: !!u.is_upgraded, gifler: [],
    };
    for (let offset = 0; offset < enCok; offset += 100) {
      let f;
      try { f = await json(`https://giphy.com/api/v4/channels/${k.id}/feed?offset=${offset}&limit=100`); }
      catch (e) { console.log(`  feed ${offset}: ${e.message}`); break; }
      for (const g of f.results || []) kayit.gifler.push(sadelestir(g));
      if (!f.next || !(f.results || []).length) break;
      await bekle(700);
    }
    kayit.gifler.forEach((g, i) => { g.no = i + 1; });
    hepsi[hesap] = kayit;
    fs.writeFileSync(hedefYol, JSON.stringify(hepsi, null, 1));
    console.log(`${hesap.padEnd(26)} ${String(kayit.gifler.length).padStart(4)} GIF · ${kayit.tur} · ${kayit.gifler.filter(g => g.sticker).length} stk · ${kayit.display}`);
    await bekle(600);
  }
})();
