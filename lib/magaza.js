'use strict';
/**
 * Mağaza — kendi vitrinimiz (^hub). Bağımsızlık ilkesinin ön yüzü:
 * keşif ve satış hiçbir platforma değil, bu sayfaya bağlıdır.
 *
 * Sayfa `site/setler.html` olarak üretilir ve sticker'lar `site/s/<setId>/`
 * altına kopyalanır — yani çıktı doğrudan yayınlanabilir durumda. Site statik
 * olduğu için build adımı yok: bu betik çalışır, sonuç deploy edilir.
 *
 * ÖNCEKİ SÜRÜMDEN FARK: eskiden set başına tek kapak görseli basıyordu ve
 * alıcı ne aldığını göremiyordu. Kullanıcı bulgusu (2026-08-17): "marketplace
 * gibi alt alta setlerin olduğu ve set içeriklerinin rahatça gözüktüğü bir
 * ekran". Artık her set kendi şeridinde TÜM sticker'larını gösteriyor.
 *
 * Kaynak dosya olarak WhatsApp çıktısı seçildi: hep 512×512, animasyonlusu
 * animasyonlu webp — <img> içinde kendiliğinden oynuyor, oynatıcı gerekmiyor.
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

function setBolumu(set, stickerlar) {
  const yayinda = set.durum === 'yayinda';
  const satis = set.satisUrl
    ? `<a class="al" href="${kacar(set.satisUrl)}">Satın al</a>`
    : (yayinda ? '<span class="al bekliyor">Yakında</span>' : '');
  const rozet = yayinda ? '' : '<span class="rozet">hazırlanıyor</span>';

  const kareler = stickerlar.map(s => `
        <figure class="stk">
          <img src="${kacar(s.yol)}" alt="${kacar(s.baslik)}" loading="lazy" decoding="async">
          <figcaption>${kacar(s.emoji)}</figcaption>
        </figure>`).join('');

  return `
    <section class="set">
      <div class="set-ust">
        <div class="set-kimlik">
          <h2>${kacar(set.ad)}${rozet}</h2>
          ${set.aciklama ? `<p class="set-alt">${kacar(set.aciklama)}</p>` : ''}
        </div>
        <div class="set-sag">
          <span class="sayi">${stickerlar.length} sticker</span>
          ${satis}
        </div>
      </div>
      <div class="serit">${kareler}</div>
    </section>`;
}

function sayfaUret({ taslakDahil = false } = {}) {
  const hepsi = depo.setListe();
  const secili = hepsi.filter(s =>
    s.durum === 'yayinda' || (taslakDahil && s.uyeler.length));

  const bolumler = [];
  let toplamSticker = 0;
  for (const s of secili) {
    const stickerlar = stickerlariKopyala(s);
    if (!stickerlar.length) continue;      // üretilmemiş set vitrine çıkmaz
    toplamSticker += stickerlar.length;
    bolumler.push(setBolumu(s, stickerlar));
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
    <p>${toplamSticker ? `${bolumler.length} set · ${toplamSticker} sticker · hepsi hazır, indirip kırpmak yok.`
                       : 'Raflar dolduruluyor.'}</p>
  </div>
  ${bolumler.length ? bolumler.join('\n') : bos}
</main>

<footer class="dip">© stickky · <a href="https://stickky.xyz">stickky.xyz</a></footer>
</body>
</html>
`;

  fs.mkdirSync(SITE, { recursive: true });
  const dosya = path.join(SITE, 'setler.html');
  fs.writeFileSync(dosya, govde);
  return { dosya: 'site/setler.html', set: bolumler.length, sticker: toplamSticker };
}

module.exports = { sayfaUret };

if (require.main === module) {
  const r = sayfaUret({ taslakDahil: process.argv.includes('--taslak') });
  console.log(`${r.dosya} → ${r.set} set · ${r.sticker} sticker`);
}
