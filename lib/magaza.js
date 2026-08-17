'use strict';
/**
 * Mağaza — kendi vitrinimiz (^hub). Bağımsızlık ilkesinin ön yüzü:
 * keşif ve satış hiçbir platforma değil, bu sayfaya bağlıdır.
 *
 * Sayfa `site/setler.html` olarak üretilir ve sticker'lar `site/s/<setId>/`
 * altına kopyalanır — çıktı doğrudan yayınlanabilir, build adımı yok.
 *
 * DÜZEN: setler yukarıdan aşağıya LİSTE. Her satırda ad, açıklama, sayı ve
 * küçük bir önizleme şeridi var; satıra dokununca setin TAMAMI büyük boyda
 * açılıyor, oradan tek sticker'a geçilip oklarla gezilebiliyor.
 *
 * Neden liste + önizleme: ilk sürüm her setin bütün sticker'larını sayfaya
 * seriyordu. İki sette güzel duruyordu ama on sette sayfa gezilemez oluyor ve
 * hangi setin nerede bittiği kayboluyordu (kullanıcı bulgusu 2026-08-17).
 * Liste tarama için, önizleme inceleme için.
 *
 * Kaynak dosya WhatsApp çıktısı: hep 512×512, animasyonlusu animasyonlu webp —
 * <img> içinde kendiliğinden oynuyor, oynatıcı gerekmiyor.
 *
 * Varsayılan yalnız `durum: 'yayinda'` setleri listeler. `--taslak` bayrağı
 * taslakları da katar ama "hazırlanıyor" rozetiyle ve satın alma düğmesi
 * OLMADAN — onaysız hiçbir set satışa çıkmaz kuralı korunur.
 */

const fs = require('fs');
const path = require('path');
const depo = require('./depo');

// VERI/CIKTI gibi SITE de taşınabilir. Şart: duman testi gerçek site/
// klasörüne yazmamalı — aynı tuzağa daha önce iki kez düşüldü.
const SITE = process.env.STICKKY_SITE || path.join(depo.KOK, 'site');

const ONIZLEME_ADET = 6;   // liste satırında gösterilen küçük kare sayısı

function kacar(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Setin sticker'larını site/s/<id>/ altına kopyalar, göreli yolları döner. */
function stickerlariKopyala(set) {
  const kaynak = path.join(depo.CIKTI, set.id, 'wastickers');
  if (!fs.existsSync(kaynak)) return [];
  const rapor = (set.ciktilar && set.ciktilar.wastickers) || {};
  const sirali = (rapor.dosyalar || []).map(d => d.dosya);
  const dosyalar = sirali.length
    ? sirali
    : fs.readdirSync(kaynak).filter(f => /^\d+\.webp$/.test(f)).sort();

  const hedef = path.join(SITE, 's', set.id);
  fs.mkdirSync(hedef, { recursive: true });
  const cikti = [];
  for (const [i, d] of dosyalar.entries()) {
    const kay = path.join(kaynak, d);
    if (!fs.existsSync(kay)) continue;
    fs.copyFileSync(kay, path.join(hedef, d));
    const uye = (rapor.dosyalar || [])[i] || {};
    const aday = uye.adayId ? depo.adayBul(uye.adayId) : null;
    // İlk etiket altyazı metni ("(yazısız)" olabilir) — alt metni olarak işe yarar.
    const baslik = aday && (aday.etiketler || [])[0];
    cikti.push({ yol: `s/${set.id}/${d}`, emoji: uye.emoji || '🙂', baslik: baslik || '' });
  }
  return cikti;
}

function satir(set, stickerlar, sira) {
  const yayinda = set.durum === 'yayinda';
  const satis = set.satisUrl
    ? `<a class="al" href="${kacar(set.satisUrl)}" onclick="event.stopPropagation()">Satın al</a>`
    : (yayinda ? '<span class="al bekliyor">Yakında</span>' : '');
  const rozet = yayinda ? '' : '<span class="rozet">hazırlanıyor</span>';

  const kucukler = stickerlar.slice(0, ONIZLEME_ADET).map(s => `
          <img src="${kacar(s.yol)}" alt="" loading="lazy" decoding="async">`).join('');
  const kalan = stickerlar.length - ONIZLEME_ADET;

  return `
    <li class="satir" data-set="${sira}" tabindex="0" role="button"
        aria-label="${kacar(set.ad)} — önizle">
      <div class="satir-bilgi">
        <h2>${kacar(set.ad)}${rozet}</h2>
        ${set.aciklama ? `<p class="satir-alt">${kacar(set.aciklama)}</p>` : ''}
        <span class="sayi">${stickerlar.length} sticker</span>
      </div>
      <div class="mini">${kucukler}${kalan > 0 ? `<span class="kalan">+${kalan}</span>` : ''}</div>
      <div class="satir-sag">
        ${satis}
        <span class="onizle">Önizle</span>
      </div>
    </li>`;
}

function sayfaUret({ taslakDahil = false } = {}) {
  const secili = depo.setListe().filter(s =>
    s.durum === 'yayinda' || (taslakDahil && s.uyeler.length));

  const satirlar = [];
  const veri = [];          // önizleme penceresi bunu okuyor
  let toplamSticker = 0;

  for (const s of secili) {
    const stickerlar = stickerlariKopyala(s);
    if (!stickerlar.length) continue;      // üretilmemiş set vitrine çıkmaz
    satirlar.push(satir(s, stickerlar, veri.length));
    veri.push({ ad: s.ad, aciklama: s.aciklama || '', stickerlar });
    toplamSticker += stickerlar.length;
  }

  const bos = `
    <div class="bos">
      <b>Raflar dolduruluyor</b>
      <p>İlk setler çok yakında burada olacak.</p>
    </div>`;

  const govde = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Setler — stickky</title>
<meta name="description" content="Hazır meme sticker setleri. Telegram, WhatsApp ve her yer için — tek dokunuşla klavyende.">
<meta property="og:title" content="stickky — setler">
<meta property="og:description" content="Hazır meme sticker setleri, tek dokunuşla klavyende.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%2333c6b5'/%3E%3Cpath d='M20 8H12a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h4l8-8v-4a4 4 0 0 0-4-4Z' fill='%230a2622'/%3E%3C/svg%3E">
<link rel="stylesheet" href="stil.css">
</head>
<body>

<header class="ust">
  <a class="marka" href="./">stick<span>ky</span></a>
  <nav class="sekmeler">
    <a href="./">Ana sayfa</a>
    <a href="setler.html" class="etkin" aria-current="page">Setler</a>
  </nav>
</header>

<main class="tuval">
  <div class="sayfa-ust">
    <h1>Setler</h1>
    <p>${toplamSticker ? `${satirlar.length} set · ${toplamSticker} sticker · satıra dokun, içindekileri gör.`
                       : 'Raflar dolduruluyor.'}</p>
  </div>
  ${satirlar.length ? `<ul class="liste">${satirlar.join('\n')}</ul>` : bos}
</main>

<!-- önizleme penceresi -->
<div id="onizleme" class="onizleme gizli" role="dialog" aria-modal="true" aria-label="Set önizleme">
  <button type="button" class="kapat" data-is="kapat" aria-label="Kapat">✕</button>
  <div class="onizleme-govde">
    <header class="onizleme-ust">
      <h3 id="oz-ad"></h3>
      <p id="oz-alt"></p>
    </header>
    <div class="izgara" id="oz-izgara"></div>
  </div>

  <!-- tek sticker görünümü -->
  <div id="tekli" class="tekli gizli">
    <button type="button" class="ok sol" data-is="geri" aria-label="Önceki">‹</button>
    <figure>
      <div class="sahne"><img id="tek-gorsel" alt=""></div>
      <figcaption><span id="tek-emoji"></span><span id="tek-sayac"></span></figcaption>
    </figure>
    <button type="button" class="ok sag" data-is="ileri" aria-label="Sonraki">›</button>
  </div>
</div>

<footer class="dip">© stickky · <a href="https://stickky.xyz">stickky.xyz</a></footer>

<script>
const SETLER = ${JSON.stringify(veri)};
const oz = document.getElementById('onizleme');
const tekli = document.getElementById('tekli');
let aktifSet = null, aktifSira = 0;

function setAc(i) {
  aktifSet = SETLER[i];
  if (!aktifSet) return;
  document.getElementById('oz-ad').textContent = aktifSet.ad;
  document.getElementById('oz-alt').textContent = aktifSet.aciklama;
  document.getElementById('oz-izgara').innerHTML = aktifSet.stickerlar.map((s, j) =>
    '<button type="button" class="kare" data-sira="' + j + '">' +
      '<img src="' + s.yol + '" alt="' + s.baslik.replace(/"/g, '&quot;') + '" loading="lazy">' +
      '<span class="kare-emoji">' + s.emoji + '</span>' +
    '</button>').join('');
  tekli.classList.add('gizli');
  oz.classList.remove('gizli');
  document.body.style.overflow = 'hidden';
}
function kapat() {
  oz.classList.add('gizli');
  tekli.classList.add('gizli');
  document.body.style.overflow = '';
}
function tekAc(j) {
  aktifSira = j;
  const s = aktifSet.stickerlar[j];
  document.getElementById('tek-gorsel').src = s.yol;
  document.getElementById('tek-emoji').textContent = s.emoji;
  document.getElementById('tek-sayac').textContent = (j + 1) + '/' + aktifSet.stickerlar.length;
  tekli.classList.remove('gizli');
}
function tekGit(adim) {
  if (!aktifSet) return;
  const n = aktifSet.stickerlar.length;
  tekAc((aktifSira + adim + n) % n);
}

document.querySelectorAll('.satir').forEach(el => {
  const ac = () => setAc(Number(el.dataset.set));
  el.addEventListener('click', ac);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); }
  });
});

oz.addEventListener('click', e => {
  const is = e.target.dataset.is;
  if (is === 'kapat') return kapat();
  if (is === 'geri') return tekGit(-1);
  if (is === 'ileri') return tekGit(1);
  const kare = e.target.closest('.kare');
  if (kare) return tekAc(Number(kare.dataset.sira));
  // Boşluğa dokunmak: tekli açıksa listeye dön, değilse pencereyi kapat.
  if (e.target === oz || e.target === tekli) {
    if (!tekli.classList.contains('gizli')) tekli.classList.add('gizli');
    else kapat();
  }
});

document.addEventListener('keydown', e => {
  if (oz.classList.contains('gizli')) return;
  if (e.key === 'Escape') {
    if (!tekli.classList.contains('gizli')) tekli.classList.add('gizli');
    else kapat();
  }
  if (tekli.classList.contains('gizli')) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); tekGit(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); tekGit(1); }
});
</script>
</body>
</html>
`;

  fs.mkdirSync(SITE, { recursive: true });
  const dosya = path.join(SITE, 'setler.html');
  fs.writeFileSync(dosya, govde);
  return { dosya: 'site/setler.html', set: satirlar.length, sticker: toplamSticker };
}

module.exports = { sayfaUret };

if (require.main === module) {
  const r = sayfaUret({ taslakDahil: process.argv.includes('--taslak') });
  console.log(`${r.dosya} → ${r.set} set · ${r.sticker} sticker`);
}
