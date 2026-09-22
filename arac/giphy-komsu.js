'use strict';
/**
 * KOMŞU KEŞFİ: seçilmiş karelerin (secim.json) Giphy sayfalarındaki "ilgili
 * GIF'ler" bloğundan yükleyen hesapları toplar. Arama sayfası büyük markaları
 * öne çıkarır; ilgili-GIF bloğu ise etiket komşuluğuyla küçük hesaplara ulaşır.
 *   node arac/giphy-komsu.js [secim.json yolu]
 * Çıktı: veri/giphy/kesif/komsular.json (hesap → kaç seçimin komşusu, örnekler)
 */
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '..', 'veri', 'giphy');
const secim = JSON.parse(fs.readFileSync(process.argv[2] || path.join(KOK, 'secim', 'secim.json'), 'utf8'));
const cikti = path.join(KOK, 'kesif', 'komsular.json');
fs.mkdirSync(path.dirname(cikti), { recursive: true });
const durum = fs.existsSync(cikti) ? JSON.parse(fs.readFileSync(cikti, 'utf8')) : { okunan: {}, hesaplar: {} };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36';
const bekle = ms => new Promise(r => setTimeout(r, ms));

function ayikla(html) {
  const duz = html.replace(/\\\\"/g, '"').replace(/\\"/g, '"');
  const sonuc = [];
  const desen = /"type":"(gif|sticker)","id":"([A-Za-z0-9]+)","index_id":\d+,"url":"([^"]+)","slug":"[^"]*","bitly_gif_url":"[^"]*","bitly_url":"[^"]*","embed_url":"[^"]*","username":"([^"]*)","source":"[^"]*","title":"([^"]*)"/g;
  let m;
  while ((m = desen.exec(duz))) sonuc.push({ tur: m[1], id: m[2], url: m[3], username: m[4], title: m[5].replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))) });
  return sonuc;
}

(async () => {
  let n = 0;
  for (const s of secim) {
    if (durum.okunan[s.id]) continue;
    let liste = [];
    try {
      const r = await fetch(s.url, { headers: { 'user-agent': UA } });
      if (r.ok) liste = ayikla(await r.text());
    } catch (e) { console.error(s.id, e.message); }
    durum.okunan[s.id] = liste.length;
    for (const g of liste) {
      if (g.id === s.id || !g.username) continue;
      const h = durum.hesaplar[g.username] || (durum.hesaplar[g.username] = { hesap: g.username, komsu: 0, kaynaklar: [], ornek: [] });
      h.komsu++;
      if (!h.kaynaklar.includes(s.kanal)) h.kaynaklar.push(s.kanal);
      if (h.ornek.length < 6 && !h.ornek.some(o => o.id === g.id)) h.ornek.push({ id: g.id, title: g.title.replace(/ GIF$/, ''), url: g.url });
    }
    n++;
    if (n % 10 === 0) { fs.writeFileSync(cikti, JSON.stringify(durum)); console.log(`${n} sayfa · ${Object.keys(durum.hesaplar).length} hesap`); }
    await bekle(800);
  }
  fs.writeFileSync(cikti, JSON.stringify(durum, null, 1));
  const liste = Object.values(durum.hesaplar).sort((a, b) => b.komsu - a.komsu);
  console.log(`\n${Object.keys(durum.okunan).length} sayfa · ${liste.length} hesap`);
  for (const h of liste.slice(0, 50)) console.log(`${h.hesap.padEnd(26)} ${String(h.komsu).padStart(3)} · ${h.kaynaklar.join(',').slice(0, 30).padEnd(30)} · ${h.ornek.slice(0, 3).map(o => o.title).join(' / ').slice(0, 70)}`);
})();
