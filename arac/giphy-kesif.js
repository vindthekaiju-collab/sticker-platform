'use strict';
/**
 * Giphy arama sayfalarından KANAL KEŞFİ.
 * Giphy'nin arama API'si anahtar istiyor; ama arama sayfasının HTML'i ilk 25
 * sonucu (id, başlık, yükleyen, etiketler) gömülü taşıyor. Bu betik sorgu
 * listesini gezer, her sorgu için GIF + sticker sayfasını okur, yükleyen
 * hesapları sayar.
 *
 *   node arac/giphy-kesif.js [sorgu-dosyası]   (varsayılan arac/giphy-sorgular.txt)
 *
 * Çıktı: veri/giphy/kesif/aramalar.json  (sorgu → 25+25 sonuç)
 *        veri/giphy/kesif/adaylar.json    (hesap → kaç sorguda, kaç kez, örnekler)
 * Zaten okunmuş sorgular atlanır (yeniden okumak için dosyadan sil).
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..', 'veri', 'giphy', 'kesif');
fs.mkdirSync(KOK, { recursive: true });
const sorguDosya = process.argv[2] || path.join(__dirname, 'giphy-sorgular.txt');
const sorgular = fs.readFileSync(sorguDosya, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
const aramaYol = path.join(KOK, 'aramalar.json');
const aramalar = fs.existsSync(aramaYol) ? JSON.parse(fs.readFileSync(aramaYol, 'utf8')) : {};
const bekle = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36';

/** Sayfa HTML'inden gömülü GIF nesnelerini çıkarır. */
function ayikla(html) {
  const duz = html.replace(/\\\\"/g, '"').replace(/\\"/g, '"');
  const sonuc = [];
  const desen = /"type":"(gif|sticker)","id":"([A-Za-z0-9]+)","index_id":\d+,"url":"([^"]+)","slug":"[^"]*","bitly_gif_url":"[^"]*","bitly_url":"[^"]*","embed_url":"[^"]*","username":"([^"]*)","source":"([^"]*)","title":"([^"]*)","rating":"([^"]*)","content_url":"[^"]*","tags":\[([^\]]*)\]/g;
  let m;
  while ((m = desen.exec(duz))) {
    const [, tur, id, url, username, source, title, rating, tagsHam] = m;
    const cozTitle = s => s.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const tags = tagsHam ? tagsHam.split('","').map(t => t.replace(/^"|"$/g, '')) : [];
    const kalan = duz.slice(m.index, m.index + 6000);
    const tarih = (kalan.match(/"create_datetime":"([^"]+)"/) || [])[1] || '';
    const sticker = /"is_sticker":(1|true)/.test(kalan.slice(0, 1500));
    sonuc.push({ id, tur, url, username, source, title: cozTitle(title), rating, tags, tarih, sticker });
  }
  return sonuc;
}

async function sayfa(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return ayikla(await r.text());
}

(async () => {
  let yeni = 0;
  for (const q of sorgular) {
    if (aramalar[q]) continue;
    const slug = q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const kayit = { gif: [], sticker: [] };
    for (const [tur, ek] of [['gif', ''], ['sticker', '-stickers']]) {
      try {
        kayit[tur] = await sayfa(`https://giphy.com/search/${slug}${ek}`);
      } catch (e) {
        console.error(`${q} (${tur}): ${e.message}`);
        kayit[tur] = null;
      }
      await bekle(900);
    }
    aramalar[q] = kayit;
    yeni++;
    console.log(`${q.padEnd(34)} gif ${String((kayit.gif || []).length).padStart(2)} · sticker ${String((kayit.sticker || []).length).padStart(2)}`);
    if (yeni % 5 === 0) fs.writeFileSync(aramaYol, JSON.stringify(aramalar));
  }
  fs.writeFileSync(aramaYol, JSON.stringify(aramalar));

  // Aday tablosu: hesap → sorgu sayısı, toplam, sticker payı, örnekler
  const adaylar = {};
  for (const [q, k] of Object.entries(aramalar)) {
    for (const tur of ['gif', 'sticker']) {
      for (const g of k[tur] || []) {
        if (!g.username) continue;
        const a = adaylar[g.username] || (adaylar[g.username] = { hesap: g.username, sorgular: new Set(), toplam: 0, sticker: 0, ornek: [] });
        a.sorgular.add(q);
        a.toplam++;
        if (g.sticker) a.sticker++;
        if (a.ornek.length < 6 && !a.ornek.some(o => o.id === g.id)) a.ornek.push({ id: g.id, title: g.title.replace(/ GIF$/, ''), url: g.url, sorgu: q });
      }
    }
  }
  const liste = Object.values(adaylar).map(a => ({ ...a, sorgular: [...a.sorgular] })).sort((x, y) => y.sorgular.length - x.sorgular.length || y.toplam - x.toplam);
  fs.writeFileSync(path.join(KOK, 'adaylar.json'), JSON.stringify(liste, null, 1));
  console.log(`\n${Object.keys(aramalar).length} sorgu · ${liste.length} hesap → veri/giphy/kesif/`);
  for (const a of liste.slice(0, 40)) console.log(`${a.hesap.padEnd(26)} ${String(a.sorgular.length).padStart(3)} sorgu · ${String(a.toplam).padStart(3)} sonuç · ${a.sticker} stk · ${a.ornek.slice(0, 3).map(o => o.title).join(' / ').slice(0, 80)}`);
})();
