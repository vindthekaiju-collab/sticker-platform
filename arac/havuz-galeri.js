'use strict';
/**
 * HAVUZ GALERİSİ — 1.400+ animasyonlu sticker'ı tarayıcıda açılabilir hale getirir.
 * Izgarada 220 px DURAĞAN küçük resim (orta kare) gösterilir; üstüne gelince
 * animasyonlu WebP yüklenir. Hepsini birden animasyonlu yüklemek ~430 MB'lık
 * bir sayfa demekti ve Chrome hiçbirini çizemiyordu (2026-09-23'te ölçüldü).
 *
 *   node arac/havuz-galeri.js [--havuz cikti/havuz] [--site site/havuz]
 * Çıktı: <site>/k/NNNN.jpg (küçük) + <site>/index.html
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

sharp.cache(false);
const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const havuz = path.resolve(sec('--havuz', path.join(KOK, 'cikti', 'havuz')));
const siteDiz = path.resolve(sec('--site', path.join(KOK, 'site', 'havuz')));
const kayit = JSON.parse(fs.readFileSync(path.join(havuz, 'kayit.json'), 'utf8'));
const setlerYol = path.join(KOK, 'cikti', 'setler', 'setler.json');
const setler = fs.existsSync(setlerYol) ? JSON.parse(fs.readFileSync(setlerYol, 'utf8')) : [];
const kacar = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// sticker → hangi sette
const setAdi = new Map();
for (const s of setler) for (const f of s.dosyalar) setAdi.set(f.kanal + '#' + f.no, s.ad);

(async () => {
  fs.mkdirSync(path.join(siteDiz, 'k'), { recursive: true });
  let uretildi = 0;
  for (const k of kayit) {
    const hedef = path.join(siteDiz, 'k', k.ad + '.jpg');
    if (fs.existsSync(hedef)) continue;
    const veri = fs.readFileSync(path.join(havuz, k.ad + '.webp'));
    const m = await sharp(veri, { animated: true }).metadata();
    const orta = Math.floor((m.pages || 1) / 2);
    await sharp(veri, { page: orta, pages: 1 })
      .resize(220, 220, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 78 }).toFile(hedef);
    uretildi++;
  }

  const kanallar = [...new Set(kayit.map(k => k.kanal))].sort();
  // İlk ekran dolusu kare tembel YÜKLENMEZ: sekme arka plandayken Chrome
  // loading=lazy görselleri hiç istemiyor, sayfa boş açılıyordu (2026-09-23).
  const kartlar = kayit.map((k, i) => {
    const set = setAdi.get(k.kanal + '#' + k.no) || '';
    return `<div class="k" data-kanal="${k.kanal}" data-set="${kacar(set)}" data-ad="${k.ad}">
  <div class="r"><img src="k/${k.ad}.jpg"${i < 60 ? '' : ' loading="lazy"'} alt=""></div>
  <div class="m"><b>${kacar(k.metin) || '—'}</b>${kacar(set) || kacar(k.kanal)}</div></div>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>stickky · ${kayit.length} sticker</title>
<style>
 body{margin:0;background:#0d0d0d;color:#eee;font:14px system-ui,sans-serif}
 header{position:sticky;top:0;background:#0d0d0d;padding:10px 14px;border-bottom:1px solid #333;display:flex;gap:7px;flex-wrap:wrap;align-items:center;z-index:3}
 header b{font-size:16px;margin-right:6px}
 header input{background:#1b1b1b;color:#eee;border:1px solid #444;border-radius:8px;padding:6px 10px;width:220px;font-size:13px}
 header button{background:#222;color:#eee;border:1px solid #444;border-radius:999px;padding:4px 10px;cursor:pointer;font-size:12px}
 header button.on{background:#ff2d87;border-color:#ff2d87}
 header small{color:#777}
 .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;padding:12px}
 .k{background:#1b1b1b;border-radius:10px;overflow:hidden;cursor:pointer}
 .k .r{aspect-ratio:1;background:#fff}
 .k img{width:100%;height:100%;object-fit:contain;display:block}
 .k .m{padding:5px 7px;font-size:11px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .k .m b{color:#fff;display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .k.gizli{display:none}
 #buyuk{position:fixed;inset:0;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;z-index:9}
 #buyuk img{max-width:min(90vw,520px);max-height:80vh;background:repeating-conic-gradient(#2a2a2a 0% 25%,#222 0% 50%) 50%/24px 24px;border-radius:14px}
 #buyuk .bilgi{position:fixed;bottom:22px;left:0;right:0;text-align:center;color:#ddd;font-size:13px}
</style></head><body>
<header><b id="say">${kayit.length} sticker</b>
 <input id="ara" placeholder="cümle ya da set ara…">
 <span class="grup">${kanallar.map(k => `<button data-k="${k}">${k}</button>`).join('')}</span>
 <button data-k="" class="on">hepsi</button>
 <small>küçük resim durağan · tıkla: animasyonlu</small></header>
<div class="g">${kartlar}</div>
<div id="buyuk"><img alt=""><div class="bilgi"></div></div>
<script>
const kartlarEl=[...document.querySelectorAll('.k')];
let kanal='';
function uygula(){const q=document.getElementById('ara').value.trim().toLowerCase();let n=0;
 for(const el of kartlarEl){const metin=(el.querySelector('.m').textContent||'').toLowerCase();
  const ok=(!kanal||el.dataset.kanal===kanal)&&(!q||metin.includes(q));
  el.classList.toggle('gizli',!ok);if(ok)n++;}
 document.getElementById('say').textContent=n+' sticker';}
document.querySelectorAll('header button').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('header button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
 kanal=b.dataset.k;uygula();}));
document.getElementById('ara').addEventListener('input',uygula);
const buyuk=document.getElementById('buyuk');
document.querySelector('.g').addEventListener('click',e=>{const k=e.target.closest('.k');if(!k)return;
 buyuk.querySelector('img').src=k.dataset.ad+'.webp';
 buyuk.querySelector('.bilgi').textContent=k.querySelector('.m').textContent;
 buyuk.style.display='flex';});
buyuk.addEventListener('click',()=>{buyuk.style.display='none';buyuk.querySelector('img').src='';});
</script></body></html>`;
  fs.writeFileSync(path.join(siteDiz, 'index.html'), html);
  console.log(`${kayit.length} sticker · ${uretildi} yeni küçük resim → ${siteDiz}/index.html`);
})();
