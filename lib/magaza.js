'use strict';
/**
 * Mağaza — kendi vitrinimiz (^hub). Bağımsızlık ilkesinin ön yüzü:
 * keşif ve satış hiçbir platforma değil, bu sayfaya bağlıdır.
 *
 * `durum: 'yayinda'` olan setleri listeler. Satın alma düğmesi set başına
 * `satisUrl` alanından gelir (Paddle checkout linki — hesap açılınca
 * atölyeden yapıştırılır); yoksa "yakında" görünür.
 *
 * F1'de localhost'ta çalışır; internete çıkarken bu sayfa olduğu gibi
 * statik hosta taşınabilir (üretilen HTML kendi kendine yeter).
 */

const fs = require('fs');
const path = require('path');
const depo = require('./depo');

function kacar(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sayfaUret() {
  const setler = depo.setListe().filter(s => s.durum === 'yayinda');

  const kartlar = setler.map(s => {
    const kapak = s.ciktilar && s.ciktilar.vitrin;
    const satis = s.satisUrl
      ? `<a class="al" href="${kacar(s.satisUrl)}">Satın al</a>`
      : '<span class="al bekliyor">Yakında</span>';
    return `<div class="urun">
      ${kapak ? `<img src="${kacar(kapak)}" alt="" loading="lazy">` : '<div class="kapak-bos"></div>'}
      <div class="bilgi">
        <b>${kacar(s.ad)}</b>
        <span>${s.uyeler.length} sticker</span>
        ${satis}
      </div>
    </div>`;
  }).join('\n');

  const govde = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sticker Mağazası</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { background: #12141a; color: #e8eaf0; font: 16px/1.5 system-ui, sans-serif; padding: 24px 16px 60px; }
  .kap { max-width: 960px; margin: 0 auto; }
  h1 { font-size: 26px; margin-bottom: 4px; }
  .alt-baslik { color: #8a91a5; margin-bottom: 26px; }
  .liste { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  .urun { background: #1c1f28; border: 1px solid #333849; border-radius: 14px; overflow: hidden; }
  .urun img { width: 100%; aspect-ratio: 1200/630; object-fit: cover; display: block; }
  .kapak-bos { width: 100%; aspect-ratio: 1200/630; background: #262a36; }
  .bilgi { padding: 12px 14px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .bilgi b { flex: 1; }
  .bilgi span { color: #8a91a5; font-size: 13px; }
  .al { background: #33c6b5; color: #0a2622; font-weight: 600; font-size: 14px;
        padding: 6px 14px; border-radius: 8px; text-decoration: none; }
  .al.bekliyor { background: #262a36; color: #8a91a5; }
  .bos { color: #8a91a5; padding: 40px 0; text-align: center; }
</style>
</head>
<body>
<div class="kap">
  <h1>🏭 Sticker Mağazası</h1>
  <div class="alt-baslik">Hazır meme sticker setleri — tek dokunuşla klavyende.</div>
  ${setler.length ? '<div class="liste">' + kartlar + '</div>' : '<div class="bos">Henüz yayında set yok.</div>'}
</div>
</body>
</html>`;

  const dosya = path.join(depo.CIKTI, 'magaza.html');
  fs.mkdirSync(path.dirname(dosya), { recursive: true });
  fs.writeFileSync(dosya, govde);
  return { dosya: '/magaza', yayinda: setler.length };
}

module.exports = { sayfaUret };
