'use strict';
/**
 * Paralel dilimlerin çıktısını tek klasörde birleştirir, kontak sayfalarını
 * ve galeriyi üretir.
 *   node arac/toplu-birlestir.js [--dilim cikti/toplu] [--hedef cikti/havuz] [--sayfa 60]
 * Çıktı: <hedef>/NNNN.webp + kayit.json + kontak-K.jpg + index.html
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

sharp.cache(false);
const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const onek = path.resolve(sec('--dilim', path.join(KOK, 'cikti', 'toplu')));
const hedef = path.resolve(sec('--hedef', path.join(KOK, 'cikti', 'havuz')));
const SAYFA = Number(sec('--sayfa', 60));
const kacar = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

(async () => {
  fs.mkdirSync(hedef, { recursive: true });
  const hepsi = [];
  for (let i = 1; i <= 12; i++) {
    const d = onek + '-' + i;
    const kj = path.join(d, 'kayit.json');
    if (!fs.existsSync(kj)) continue;
    for (const k of JSON.parse(fs.readFileSync(kj, 'utf8'))) hepsi.push({ ...k, kaynakDosya: path.join(d, k.ad + '.webp') });
  }
  // aynı GIF birden çok dilimde olmasın
  const gorulen = new Set();
  const kayit = [];
  for (const k of hepsi) {
    const anahtar = k.kanal + '#' + k.no;
    if (gorulen.has(anahtar) || !fs.existsSync(k.kaynakDosya)) continue;
    gorulen.add(anahtar);
    const ad = String(kayit.length + 1).padStart(4, '0');
    fs.copyFileSync(k.kaynakDosya, path.join(hedef, ad + '.webp'));
    kayit.push({ ad, kanal: k.kanal, no: k.no, metin: k.metin, baslik: k.baslik, url: k.url, kb: k.kb, kare: k.kare });
  }
  fs.writeFileSync(path.join(hedef, 'kayit.json'), JSON.stringify(kayit, null, 1));

  // kontak sayfaları (ilk kare, beyaz zemin — şeffaf olanı da görebilmek için)
  const BOY = 200, SUT = 10;
  const sayfaAdet = Math.ceil(kayit.length / SAYFA);
  for (let s = 0; s < sayfaAdet; s++) {
    const dilim = kayit.slice(s * SAYFA, (s + 1) * SAYFA);
    const kat = [];
    for (const [i, k] of dilim.entries()) {
      const buf = fs.readFileSync(path.join(hedef, k.ad + '.webp'));
      const kare = await sharp(buf).resize(BOY - 6, BOY - 6, { fit: 'inside' }).flatten({ background: '#ffffff' }).png().toBuffer();
      const m = await sharp(kare).metadata();
      const x = (i % SUT) * BOY, y = Math.floor(i / SUT) * BOY;
      kat.push({ input: kare, left: x + 3 + Math.floor((BOY - 6 - m.width) / 2), top: y + 3 + Math.floor((BOY - 6 - m.height) / 2) });
      kat.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${BOY}" height="18"><rect width="${BOY}" height="18" fill="#000" opacity=".72"/><text x="3" y="13" font-family="Arial" font-weight="bold" font-size="11" fill="#fff">${k.ad} ${k.kanal.slice(0, 8)} ${k.kb}KB</text></svg>`), left: x, top: y });
    }
    await sharp({ create: { width: SUT * BOY, height: Math.ceil(dilim.length / SUT) * BOY, channels: 3, background: '#3a3a3a' } })
      .composite(kat).jpeg({ quality: 82 }).toFile(path.join(hedef, `kontak-${s + 1}.jpg`));
  }

  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>stickky · üretilen havuz (${kayit.length})</title>
<style>body{margin:0;background:#0d0d0d;color:#eee;font:14px system-ui,sans-serif}
header{position:sticky;top:0;background:#0d0d0d;padding:10px 14px;border-bottom:1px solid #333;display:flex;gap:8px;flex-wrap:wrap;align-items:center;z-index:2}
header b{font-size:16px}header button{background:#222;color:#eee;border:1px solid #444;border-radius:999px;padding:4px 10px;cursor:pointer;font-size:12px}
header button.on{background:#ff2d87;border-color:#ff2d87}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:9px;padding:12px}
.k{background:#1b1b1b;border-radius:11px;overflow:hidden}
.k .r{background:repeating-conic-gradient(#2a2a2a 0% 25%,#222 0% 50%) 50%/20px 20px;aspect-ratio:1}
.k img{width:100%;height:100%;object-fit:contain}
.k .m{padding:6px 8px;font-size:11px;color:#aaa}.k .m b{color:#fff;display:block;font-size:12px}
.k.gizli{display:none}</style></head><body>
<header><b id="say">${kayit.length} sticker</b>
${[...new Set(kayit.map(k => k.kanal))].map(k => `<button data-k="${k}">${k} (${kayit.filter(x => x.kanal === k).length})</button>`).join('')}
<button data-k="" class="on">hepsi</button></header>
<div class="g">${kayit.map(k => `<div class="k" data-kanal="${k.kanal}"><div class="r"><img src="${k.ad}.webp" loading="lazy" alt=""></div><div class="m"><b>${kacar(k.metin) || '—'}</b>${kacar(k.kanal)} #${k.no} · ${k.kare}k · ${k.kb}KB</div></div>`).join('')}</div>
<script>document.querySelectorAll('header button').forEach(b=>b.addEventListener('click',()=>{
document.querySelectorAll('header button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
const k=b.dataset.k;let n=0;document.querySelectorAll('.k').forEach(el=>{const ok=!k||el.dataset.kanal===k;el.classList.toggle('gizli',!ok);if(ok)n++});
document.getElementById('say').textContent=n+' sticker';}));</script></body></html>`;
  fs.writeFileSync(path.join(hedef, 'index.html'), html);
  console.log(`${kayit.length} sticker · ${sayfaAdet} kontak sayfası → ${hedef}`);
})();
