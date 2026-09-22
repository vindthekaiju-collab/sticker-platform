'use strict';
/**
 * Keşif turu (kanallar-2.json + inceleme2/*.md) → seçim JSON + canlı galeri.
 * İnceleme satırı: | no | başlık | duygu | mekanizma | cümle | kullanım |
 *   ✅ içeren satırlar seçime girer. "no" tek sayı, "a-b" aralık, "a, b" liste.
 *   node arac/giphy-kesif-galeri.js  → veri/giphy/kesif/secim2.json + site/giphy-kesif.html
 */
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '..', 'veri', 'giphy');
const hepsi = JSON.parse(fs.readFileSync(path.join(KOK, 'kanallar-2.json'), 'utf8'));
const secim = [];
const kacar = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

for (const dosya of fs.readdirSync(path.join(KOK, 'inceleme2'))) {
  const kanal = dosya.replace(/\.md$/, '');
  if (!hepsi[kanal]) continue;
  for (const satir of fs.readFileSync(path.join(KOK, 'inceleme2', dosya), 'utf8').split('\n')) {
    if (!/^\| *[\d,\- ]+ *\|/.test(satir) || !/✅/.test(satir)) continue;
    const h = satir.split('|').map(s => s.trim());
    const nolar = [];
    for (const p of h[1].split(',')) {
      const m = p.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!m) continue;
      for (let i = Number(m[1]); i <= Number(m[2] || m[1]); i++) nolar.push(i);
    }
    for (const no of nolar) {
      const g = hepsi[kanal].gifler[no - 1];
      if (!g) continue;
      secim.push({ kanal, no, id: g.id, baslik: g.title.replace(/ GIF$/, ''), url: g.url, gif: g.gif, sticker: g.sticker, duygu: h[3] || '', mek: (h[4] || '').match(/M[1-5]/g) || [], cumle: h[5] || '', not: h[6] || '' });
    }
  }
}
fs.writeFileSync(path.join(KOK, 'kesif', 'secim2.json'), JSON.stringify(secim, null, 1));

const kanallar = [...new Set(secim.map(s => s.kanal))];
const duyguSay = {}; for (const s of secim) { const d = s.duygu.split(/[,/]/)[0].trim(); if (d) duyguSay[d] = (duyguSay[d] || 0) + 1; }
const duygular = Object.keys(duyguSay).sort((a, b) => duyguSay[b] - duyguSay[a] || a.localeCompare(b));
const kartlar = secim.map((s, i) => `
<a class="k" data-kanal="${s.kanal}" data-duygu="${kacar(s.duygu.split(/[,/]/)[0].trim())}" data-mek="${s.mek.join(' ')}" href="${s.url}" target="_blank" rel="noopener">
  <img src="${s.gif}" loading="lazy" alt="">
  <span class="e">${i + 1} · ${kacar(s.kanal)} #${s.no}${s.sticker ? ' · STK' : ''}</span>
  <span class="d">${kacar(s.duygu)} · ${s.mek.join(' ')}</span>
  <span class="n"><b>${kacar(s.cumle)}</b><br>${kacar(s.baslik)}<br><small>${kacar(s.not)}</small></span>
</a>`).join('');

const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">
<title>stickky · Giphy keşif turu (${secim.length})</title>
<style>
  body{margin:0;background:#141414;color:#eee;font:14px/1.4 system-ui,sans-serif}
  header{position:sticky;top:0;background:#141414;padding:10px 16px;border-bottom:1px solid #333;display:flex;gap:6px;flex-wrap:wrap;align-items:center;z-index:2}
  header b{font-size:16px;margin-right:8px}
  header button{background:#222;color:#eee;border:1px solid #444;border-radius:999px;padding:4px 10px;cursor:pointer;font-size:12px}
  header button.on{background:#ff2d87;border-color:#ff2d87;color:#fff}
  header .grup{display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-right:12px}
  header .grup span{color:#888;font-size:11px;margin-right:2px}
  header select{background:#222;color:#eee;border:1px solid #444;border-radius:8px;padding:4px 8px;font-size:12px;max-width:260px}
  .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;padding:12px}
  .k{position:relative;display:block;background:#000;aspect-ratio:1;overflow:hidden;border-radius:10px;text-decoration:none;color:#fff}
  .k img{width:100%;height:100%;object-fit:contain;display:block}
  .e{position:absolute;left:6px;top:6px;background:rgba(0,0,0,.7);padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700}
  .d{position:absolute;right:6px;top:6px;background:#ff2d87;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700}
  .n{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.82);padding:6px 8px;font-size:12px;opacity:0;transition:opacity .15s}
  .k:hover .n{opacity:1}
  .n small{color:#bbb}
  .k.gizli{display:none}
</style></head><body>
<header><b id="say">${secim.length} kare</b>
<div class="grup"><span>kanal</span>${kanallar.map(k => `<button data-t="kanal" data-v="${k}">${k} (${secim.filter(s => s.kanal === k).length})</button>`).join('')}</div>
<div class="grup"><span>mekanizma</span>${['M1', 'M2', 'M3', 'M4', 'M5'].map(m => `<button data-t="mek" data-v="${m}">${m} (${secim.filter(s => s.mek.includes(m)).length})</button>`).join('')}</div>
<div class="grup"><span>duygu</span><select id="duygu"><option value="">hepsi</option>${duygular.map(d => `<option value="${kacar(d)}">${kacar(d)} (${secim.filter(s => s.duygu.split(/[,/]/)[0].trim() === d).length})</option>`).join('')}</select></div>
<button id="hepsi" class="on">hepsi</button></header>
<div class="g">${kartlar}</div>
<script>
const f={kanal:'',mek:'',duygu:''};
function uygula(){let n=0;document.querySelectorAll('.k').forEach(el=>{const ok=(!f.kanal||el.dataset.kanal===f.kanal)&&(!f.mek||el.dataset.mek.split(' ').includes(f.mek))&&(!f.duygu||el.dataset.duygu===f.duygu);el.classList.toggle('gizli',!ok);if(ok)n++});document.getElementById('say').textContent=n+' kare';}
document.querySelectorAll('header button[data-t]').forEach(b=>b.addEventListener('click',()=>{const t=b.dataset.t;const ayni=f[t]===b.dataset.v;document.querySelectorAll('header button[data-t="'+t+'"]').forEach(x=>x.classList.remove('on'));f[t]=ayni?'':b.dataset.v;if(!ayni)b.classList.add('on');document.getElementById('hepsi').classList.toggle('on',!f.kanal&&!f.mek&&!f.duygu);uygula();}));
document.getElementById('duygu').addEventListener('change',e=>{f.duygu=e.target.value;document.getElementById('hepsi').classList.toggle('on',!f.kanal&&!f.mek&&!f.duygu);uygula();});
document.getElementById('hepsi').addEventListener('click',()=>{f.kanal=f.mek=f.duygu='';document.getElementById('duygu').value='';document.querySelectorAll('header button').forEach(x=>x.classList.remove('on'));document.getElementById('hepsi').classList.add('on');uygula();});
</script></body></html>`;
fs.writeFileSync(path.join(__dirname, '..', 'site', 'giphy-kesif.html'), html);
console.log(`${secim.length} seçim · ${kanallar.length} kanal → site/giphy-kesif.html`);
