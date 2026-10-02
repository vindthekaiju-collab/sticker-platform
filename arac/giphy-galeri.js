'use strict';
/** secim.json → tek sayfalık canlı GIF galerisi (veri/giphy/secim/galeri.html). */
const fs = require('fs');
const path = require('path');
const klasor = path.join(__dirname, '..', 'veri', 'giphy', 'secim');
const secim = JSON.parse(fs.readFileSync(path.join(klasor, 'secim.json'), 'utf8'));
const kacar = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const kanallar = [...new Set(secim.map(s => s.kanal))];

const kartlar = secim.map((s, i) => `
<a class="k" data-kanal="${s.kanal}" href="${s.url}" target="_blank" rel="noopener">
  <img src="${s.gif}" loading="lazy" alt="">
  <span class="e">${i + 1} · ${kacar(s.kanal)} #${s.no}</span>
  <span class="n">${kacar(s.baslik)}<br><small>${kacar(s.not)}</small></span>
</a>`).join('');

const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">
<title>stickky · Giphy seçimi (${secim.length})</title>
<style>
  body{margin:0;background:#141414;color:#eee;font:14px/1.4 system-ui,sans-serif}
  header{position:sticky;top:0;background:#141414;padding:12px 16px;border-bottom:1px solid #333;display:flex;gap:10px;flex-wrap:wrap;align-items:center;z-index:2}
  header b{font-size:16px}
  header button{background:#222;color:#eee;border:1px solid #444;border-radius:999px;padding:5px 12px;cursor:pointer}
  header button.on{background:#ff2d87;border-color:#ff2d87;color:#fff}
  .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;padding:12px}
  .k{position:relative;display:block;background:#000;aspect-ratio:1;overflow:hidden;border-radius:10px;text-decoration:none;color:#fff}
  .k img{width:100%;height:100%;object-fit:contain;display:block}
  .e{position:absolute;left:6px;top:6px;background:rgba(0,0,0,.7);padding:2px 7px;border-radius:6px;font-size:12px;font-weight:700}
  .n{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.78);padding:6px 8px;font-size:12px;opacity:0;transition:opacity .15s}
  .k:hover .n{opacity:1}
  .n small{color:#bbb}
  .k.gizli{display:none}
</style></head><body>
<header><b>${secim.length} kare</b> · üstüne gel: not · tıkla: Giphy sayfası ·
${kanallar.map(k => `<button data-k="${k}">${k} (${secim.filter(s => s.kanal === k).length})</button>`).join(' ')}
<button data-k="" class="on">hepsi</button></header>
<div class="g">${kartlar}</div>
<script>
document.querySelectorAll('header button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('header button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  const k=b.dataset.k;document.querySelectorAll('.k').forEach(el=>el.classList.toggle('gizli',!!k&&el.dataset.kanal!==k));
}));
</script></body></html>`;
fs.writeFileSync(path.join(klasor, 'galeri.html'), html);
console.log(path.join(klasor, 'galeri.html'), secim.length);
