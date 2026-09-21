'use strict';
/**
 * site/index.html içindeki #packs bölümünü (set perdeleri) depodan kurar.
 *
 * Ana sayfanın geri kalanı elle yazılmış ve öyle kalır; yalnız
 *   <section class="deste" id="packs" …> … </section>
 * arası ve giriş şeridindeki sayılar ("N packs / M animated stickers")
 * değişir. Yayında olan her set bir perde: renk sırayla pembe/sarı/mavi/
 * lime, yelpazede en fazla 7 sticker, site/k/<id>/NN.webp küçükleri.
 *
 * Sıra: en yeni set en üstte değil — ilk üç (animasyonlu, Giphy dönemi)
 * en sonda kalsın, önce kamu malı setler: onlar satışa daha temiz.
 *
 *   node arac/anasayfa-perdeleri.js
 */
const fs = require('fs');
const path = require('path');
const depo = require('../lib/depo');

const KOK = path.join(__dirname, '..');
const INDEX = path.join(KOK, 'site', 'index.html');
const RENKLER = [
  ['#FF2D87', '#fff'], ['#FFD23F', '#12111A'], ['#2F5BFF', '#fff'], ['#B9F53D', '#12111A'],
  ['#12111A', '#fff'], ['#FF7A1A', '#fff']
];

function kacar(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function perde(set, sira, toplam, siteSira) {
  const [renk, yazi] = RENKLER[sira % RENKLER.length];
  const klasor = path.join(KOK, 'site', 'k', set.id);
  const dosyalar = fs.existsSync(klasor)
    ? fs.readdirSync(klasor).filter(d => /^\d+\.webp$/.test(d)).sort().slice(0, 7) : [];
  const animasyonlu = set.ciktilar && set.ciktilar.wastickers && set.ciktilar.wastickers.animasyonlu;
  const sayi = `${set.uyeler.length} ${animasyonlu ? 'animated ' : ''}stickers`;
  const pullar = dosyalar.map(d =>
    `        <div class="pul"><img src="k/${set.id}/${d}" alt="" loading="lazy"></div>`).join('\n');
  return `  <article class="perde" style="--renk:${renk}; --renk-yazi:${yazi}">
    <div class="perde-ic">
      <div class="perde-metin">
        <p class="perde-no">${String(sira + 1).padStart(2, '0')} / ${String(toplam).padStart(2, '0')}</p>
        <h2>${kacar(set.ad)}</h2>
        <p class="perde-alt">${kacar(set.aciklama)}</p>
        <p class="perde-sayi">${sayi}</p>
        <div class="dugmeler">
          <a class="dugme ters" href="setler.html#set-${siteSira}">Add</a>
          <a class="baglanti" href="setler.html#set-${siteSira}">see all</a>
        </div>
      </div>
      <div class="yelpaze" aria-hidden="true">
${pullar}
      </div>
    </div>
  </article>`;
}

// setler.html'deki sıra = magaza.js'nin sırası (depo sırası, yalnız yayında
// ve üretilmiş olanlar). Ana sayfada kamu malı setleri öne alıyoruz ama
// #set-N bağlantısı mağazadaki gerçek sırayı göstermeli.
const yayinda = depo.setListe().filter(s => s.durum === 'yayinda' && s.uyeler.length);
const magazaSirasi = new Map(yayinda.map((s, i) => [s.id, i]));
const oncelik = s => (s.uyeler.some(id => { const a = depo.adayBul(id); return a && a.kaynak === 'giphy'; }) ? 1 : 0);
const sirali = [...yayinda].sort((a, b) => oncelik(a) - oncelik(b));

const govde = sirali.map((s, i) => perde(s, i, sirali.length, magazaSirasi.get(s.id))).join('\n\n');
const toplamSticker = yayinda.reduce((t, s) => t + s.uyeler.length, 0);

let html = fs.readFileSync(INDEX, 'utf8');
const once = html;
html = html.replace(/(<section class="deste" id="packs"[^>]*>)[\s\S]*?(<\/section>)/,
  `$1\n\n${govde}\n\n$2`);
html = html.replace(/<span>\d+ packs<\/span><span>\d+ animated stickers<\/span>/,
  `<span>${yayinda.length} packs</span><span>${toplamSticker} stickers</span>`);
html = html.replace(/<span>\d+ packs<\/span><span>\d+ stickers<\/span>/,
  `<span>${yayinda.length} packs</span><span>${toplamSticker} stickers</span>`);
if (html === once) console.log('index.html değişmedi');
else { fs.writeFileSync(INDEX, html); console.log(`index.html: ${sirali.length} perde · ${toplamSticker} sticker`); }
