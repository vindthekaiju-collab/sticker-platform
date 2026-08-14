'use strict';
/**
 * Teslimat sayfası üretici — tasarımın kritik alanı (^teslim).
 *
 * Ödeme sonrası alıcının düştüğü, kanaldan bağımsız mobil sayfa.
 * Her kanal bir adaptör: sayfada yalnızca o set için üretilmiş paketlerin
 * düğmeleri görünür. Şablon: teslimat/sablon.html
 *
 * F1'de sayfa yerelde üretilir ve satış sağlayıcısının (Gumroad vb.)
 * "içerik" alanına yüklenir ya da statik hosta konur. Sunucu tarafı
 * lisans/link tekilleştirme F2+ işi.
 */

const fs = require('fs');
const path = require('path');
const depo = require('./depo');
const uretLib = require('./uret');

function sayfaUret(setId) {
  const set = depo.setBul(setId);
  if (!set) throw new Error('set yok: ' + setId);

  const sablon = fs.readFileSync(path.join(depo.KOK, 'teslimat', 'sablon.html'), 'utf8');

  const telegram = set.ciktilar.telegram;
  const wastickers = set.ciktilar.wastickers;
  const zipCikti = set.ciktilar.zip;

  // Telegram linki bot kurulumundan sonra gerçekleşir; şimdilik yer tutucu
  // ya da set yayınlandıysa kaydedilmiş link.
  const telegramLink = (set.ciktilar.telegramYayin && set.ciktilar.telegramYayin.link) || '';

  /* Linkler bilerek GÖRELİ: cikti/<setId>/ klasörü olduğu gibi herhangi bir
     statik hosta kopyalanınca sayfa hiç değişmeden çalışır (kanal
     bağımsızlığının teslimat sayfasındaki karşılığı). */
  const kartlar = [];
  if (telegram && telegram.dosyalar.length) {
    kartlar.push(telegramLink
      ? `<a class="kanal telegram" href="${telegramLink}">📨 Telegram'a ekle<span>tek dokunuş — set anında klavyende</span></a>`
      : `<div class="kanal bekliyor">📨 Telegram seti hazırlanıyor<span>bot yayını bekliyor</span></div>`);
  }
  if (wastickers && wastickers.paket) {
    kartlar.push(`<a class="kanal whatsapp" href="wastickers/${wastickers.paket}" download>💬 WhatsApp'a ekle<span>.wastickers indir → "Sticker Maker" ile aç</span></a>`);
  }
  if (zipCikti && zipCikti.paket) {
    kartlar.push(`<a class="kanal zip" href="zip/${zipCikti.paket}" download>📦 Paketi indir (ZIP)<span>512px WebP — her yerde kullan</span></a>`);
  }
  if (!kartlar.length) {
    kartlar.push('<div class="kanal bekliyor">Henüz üretilmiş paket yok — önce atölyeden üret.</div>');
  }

  // Canlı paket ızgarası: TÜM sticker'lar, her biri dokun→paylaş.
  // Sayfa her açılışta yeniden üretildiği için trend setinde bu ızgara
  // kendiliğinden güncel kalır — "sayfa paketin kendisidir".
  const onizleme = telegram
    ? telegram.dosyalar.filter(d => d.tur === 'statik')
        .map(d => `<button class="stk" data-src="telegram/${d.dosya}" type="button"><img src="telegram/${d.dosya}" alt="" loading="lazy"></button>`).join('')
    : '';

  const kacarHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const sayfa = sablon
    .replace(/{{SET_ADI}}/g, kacarHtml(set.ad))
    .replace(/{{SET_ACIKLAMA}}/g, kacarHtml(set.aciklama || ''))
    .replace(/{{ONIZLEME}}/g, onizleme)
    .replace(/{{KARTLAR}}/g, kartlar.join('\n'));

  const klasor = path.join(depo.KOK, 'cikti', set.id);
  fs.mkdirSync(klasor, { recursive: true });
  const dosya = path.join(klasor, 'teslimat.html');
  fs.writeFileSync(dosya, sayfa);

  return { dosya: '/cikti/' + set.id + '/teslimat.html', kanallar: kartlar.length };
}

module.exports = { sayfaUret };
