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

/** Üretilmiş paketi (wastickers | zip) siteye kopyalar; yoksa null. */
function paketiKopyala(set, hedefAd) {
  const rapor = (set.ciktilar && set.ciktilar[hedefAd]) || {};
  if (!rapor.paket) return null;
  const kay = path.join(depo.CIKTI, set.id, hedefAd, rapor.paket);
  if (!fs.existsSync(kay)) return null;
  const hedef = path.join(SITE, 's', set.id);
  fs.mkdirSync(hedef, { recursive: true });
  fs.copyFileSync(kay, path.join(hedef, rapor.paket));
  return `s/${set.id}/${rapor.paket}`;
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

const IKON = {
  tg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.9 4.3 18.8 19c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.9L18.2 6c.4-.3-.1-.5-.6-.2L6.6 12.7l-4.8-1.5c-1-.3-1-1 .2-1.5l18.7-7.2c.9-.3 1.6.2 1.2 1.8z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.8 14.1c-.2.7-1.2 1.3-2 1.4-.5.1-1.2.1-3.8-.9-3.2-1.3-5.2-4.6-5.4-4.8-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5l.9 2.2c.1.2.1.4 0 .6l-.4.6-.3.3c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.4.1.6-.1l.9-1c.2-.2.4-.2.6-.1l2.1 1c.3.1.5.2.5.3.1.2.1.7-.1 1.4z"/></svg>',
  zip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10.6l3.3-3.3 1.4 1.4L12 16.4l-4.7-4.7 1.4-1.4L12 13.6V3h0zM5 18h14v2H5z"/></svg>',
  ios: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 12.3c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7 1.9-1 2.6-2c.8-1.2 1.2-2.3 1.2-2.4-.1 0-2.3-.9-2.3-3.3zM14.6 5.5c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1.1 1.7-.9 2.6 1 .1 2-.5 2.6-1.2z"/></svg>'
};

/* Kanal listesi. Kullanıcı isteği (2026-08-17): tek "Ekle" düğmesi olsun,
   basınca seçenekler çıksın — vitrinde her kanalın ayrı düğmesi durmasın.
   Sebep sağlam: kanal sayısı arttıkça satır düğme çöplüğüne dönüyor ve asıl
   eylem ("bunu al") kayboluyor.

   `hazir: false` olanlar listede DURUYOR ama tıklanamıyor: alıcı neyin
   geleceğini görsün, ama olmayan şeye tıklayıp hüsrana uğramasın. */
function kanalListesi(set) {
  return [
    { anahtar: 'tg',  ad: 'Telegram',  not: 'Tek dokunuşla eklenir',
      url: set.telegramUrl || null, indir: false },
    { anahtar: 'wa',  ad: 'WhatsApp',  not: 'Sticker paketi dosyası',
      url: set.wastickersYol || null, indir: true },
    { anahtar: 'zip', ad: 'Her yer',   not: '512×512 dosyalar — Discord, Signal, klavye',
      url: set.zipYol || null, indir: true },
    { anahtar: 'ios', ad: 'iMessage',  not: 'Yakında', url: null, indir: false }
  ];
}

function kanalPanosu(set) {
  return kanalListesi(set).map(k => {
    const govde = `${IKON[k.anahtar]}<span class="k-ad">${kacar(k.ad)}</span>` +
                  `<span class="k-not">${kacar(k.not)}</span>`;
    if (!k.url) return `<span class="secenek ${k.anahtar} yok">${govde}</span>`;
    return `<a class="secenek ${k.anahtar}" href="${kacar(k.url)}"` +
      (k.indir ? ' download' : ' target="_blank" rel="noopener"') + `>${govde}</a>`;
  }).join('');
}

function satir(set, stickerlar, sira) {
  const yayinda = set.durum === 'yayinda';
  const satis = set.satisUrl
    ? `<a class="al" href="${kacar(set.satisUrl)}" onclick="event.stopPropagation()">Satın al</a>`
    : (yayinda ? '<span class="al bekliyor">Fiyat yakında</span>' : '');
  const rozet = yayinda ? '' : '<span class="rozet">hazırlanıyor</span>';

  const kucukler = stickerlar.slice(0, ONIZLEME_ADET).map(s => `
          <img src="${kacar(s.yol)}" alt="" loading="lazy" decoding="async">`).join('');
  const kalan = stickerlar.length - ONIZLEME_ADET;

  return `
    <li class="satir">
      <button type="button" class="satir-ac" data-set="${sira}"
              aria-label="${kacar(set.ad)} — ${stickerlar.length} sticker, önizle">
        <span class="satir-bilgi">
          <span class="satir-ad">${kacar(set.ad)}${rozet}</span>
          ${set.aciklama ? `<span class="satir-alt">${kacar(set.aciklama)}</span>` : ''}
          <span class="sayi">${stickerlar.length} sticker · önizle</span>
        </span>
        <span class="mini">${kucukler}${kalan > 0 ? `<span class="kalan">+${kalan}</span>` : ''}</span>
      </button>
      <div class="satir-eylem">
        <button type="button" class="ekle" data-ekle="${sira}"
                aria-label="${kacar(set.ad)} — nereye ekleneceğini seç">Ekle</button>
        ${satis}
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
    s.wastickersYol = paketiKopyala(s, 'wastickers');
    s.zipYol = paketiKopyala(s, 'zip');
    satirlar.push(satir(s, stickerlar, veri.length));
    veri.push({
      ad: s.ad, aciklama: s.aciklama || '', stickerlar,
      pano: kanalPanosu(s),
      satis: s.satisUrl
        ? `<a class="al" href="${kacar(s.satisUrl)}">Satın al</a>`
        : '<span class="al bekliyor">Fiyat yakında</span>'
    });
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
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%23EC4899'/%3E%3Cpath d='M20 8H12a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h4l8-8v-4a4 4 0 0 0-4-4Z' fill='%23fff'/%3E%3C/svg%3E">
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
    <p>${toplamSticker ? `${satirlar.length} set · ${toplamSticker} sticker · içeriği gör, uygulamanı seç.`
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
      <div class="oz-kanallar">
        <button type="button" class="ekle buyuk" id="oz-ekle">Ekle</button>
        <span id="oz-satis"></span>
      </div>
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

<!-- ekleme panosu -->
<div id="pano" class="pano gizli" role="dialog" aria-modal="true" aria-labelledby="pano-baslik">
  <div class="pano-govde">
    <h3 id="pano-baslik">Nereye eklensin?</h3>
    <p class="pano-alt" id="pano-set"></p>
    <div class="secenekler" id="pano-secenekler"></div>
    <button type="button" class="pano-kapat" data-pano="kapat">Vazgeç</button>
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
  document.getElementById('oz-satis').innerHTML = aktifSet.satis || '';
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

document.querySelectorAll('.satir-ac').forEach(el => {
  el.addEventListener('click', () => setAc(Number(el.dataset.set)));
});

/* --- ekleme panosu --- */
const pano = document.getElementById('pano');
function panoAc(i) {
  const s = SETLER[i];
  if (!s) return;
  document.getElementById('pano-set').textContent = s.ad;
  document.getElementById('pano-secenekler').innerHTML = s.pano;
  pano.classList.remove('gizli');
  document.body.style.overflow = 'hidden';
  const ilk = pano.querySelector('.secenek:not(.yok)');
  if (ilk) ilk.focus();
}
function panoKapat() {
  pano.classList.add('gizli');
  // Önizleme açıksa gövde kilidi orada kalsın.
  if (oz.classList.contains('gizli')) document.body.style.overflow = '';
}
document.querySelectorAll('.ekle[data-ekle]').forEach(el => {
  el.addEventListener('click', () => panoAc(Number(el.dataset.ekle)));
});
document.getElementById('oz-ekle').addEventListener('click', () => {
  panoAc(SETLER.indexOf(aktifSet));
});
pano.addEventListener('click', e => {
  if (e.target.dataset.pano === 'kapat' || e.target === pano) panoKapat();
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
  if (!pano.classList.contains('gizli')) {
    if (e.key === 'Escape') { e.preventDefault(); panoKapat(); }
    return;
  }
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
