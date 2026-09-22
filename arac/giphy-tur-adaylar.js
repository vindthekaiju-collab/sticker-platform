'use strict';
/** Belirli bir sorgu dosyasının sorgularında görülen hesapları sıralar (bilinen/dökülmüş hariç).
 *   node arac/giphy-tur-adaylar.js arac/giphy-sorgular-4.txt [--en-az 3] */
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '..', 'veri', 'giphy');
const argv = process.argv.slice(2);
const sorguDosya = argv.find(a => !a.startsWith('--'));
const ei = argv.indexOf('--en-az'); const enAz = ei >= 0 ? Number(argv[ei + 1]) : 3;
const sorgular = new Set(fs.readFileSync(sorguDosya, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')));
const aramalar = JSON.parse(fs.readFileSync(path.join(KOK, 'kesif', 'aramalar.json'), 'utf8'));
const bilinen = new Set([...Object.keys(JSON.parse(fs.readFileSync(path.join(KOK, 'kanallar.json'), 'utf8'))), ...Object.keys(JSON.parse(fs.readFileSync(path.join(KOK, 'kanallar-2.json'), 'utf8')))]);
const MARKA = /^(netflix|hulu|paramount\w*|nbc\w*|abc\w*|cbs|fox\w*|mtv|disney\w*|nickelodeon|snl|fallontonight|hbo\w*|starz|bravo\w*|tlc|peacock\w*|amazon\w*|primevideo|pusheen|imoji|moodman|theoffice|southpark|cbc|bounce_tv|buzzfeed|espn|nba|nfl|mlb|nhl|wwe|ufc|giphy\w*|tiktok|youtube|spotify|apple\w*|google|samsung|pixar|marvel|dc|warner\w*|universal\w*|sony\w*|adultswim|cartoonnetwork|comedycentral|vh1|bet|tbs|tnt|amc\w*|showtime\w*|crunchyroll|funimation|hyperrpg|boo_app|veefriends|pudgypenguins|benjammins)$/i;
const say = {};
for (const q of sorgular) {
  const k = aramalar[q]; if (!k) continue;
  for (const tur of ['gif', 'sticker']) for (const g of k[tur] || []) {
    if (!g.username || bilinen.has(g.username) || MARKA.test(g.username)) continue;
    const a = say[g.username] || (say[g.username] = { hesap: g.username, sorgular: new Set(), n: 0, stk: 0, ornek: [] });
    a.sorgular.add(q); a.n++; if (g.sticker) a.stk++;
    if (a.ornek.length < 3) a.ornek.push(g.title.replace(/ GIF$| Sticker$/, '').slice(0, 30));
  }
}
const l = Object.values(say).filter(a => a.sorgular.size >= enAz).sort((a, b) => b.sorgular.size - a.sorgular.size || b.n - a.n);
for (const a of l.slice(0, 80)) console.log(`${a.hesap.padEnd(26)} ${String(a.sorgular.size).padStart(3)} sorgu ${String(a.n).padStart(3)} sonuç ${String(a.stk).padStart(3)} stk · ${[...a.sorgular].slice(0, 4).join(', ').slice(0, 50).padEnd(50)} · ${a.ornek.join(' / ')}`);
console.log(l.length, 'hesap');
