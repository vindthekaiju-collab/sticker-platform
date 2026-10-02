/* Satın alma — Paddle overlay checkout.
 *
 * Ayar `satis.json`'dan: { token, priceId, env, kasa }. Dördü de doluysa
 * "$2.99 · checkout soon" yazıları Buy düğmesine dönüşür; boşsa sayfa
 * olduğu gibi kalır (düğmesiz, yalan vaat yok). Tek fiyat, tek Paddle
 * price; hangi paketin alındığı customData.slug ile işleme yazılır,
 * kasa (Worker) teslimi oradan okur.
 *
 * Başarı: Paddle successUrl'e yönlendirir (tesekkur.html). İşlem kimliği
 * iki yoldan taşınır — checkout.completed olayından sessionStorage'a, ve
 * Paddle'ın yönlendirmeye eklediği sorgu parametresinden (varsa). */
(function () {
  'use strict';
  const FIYAT_YAZISI = 'Buy $2.99';

  fetch('satis.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(ayar => {
    if (!ayar || !ayar.token || !ayar.priceId || !ayar.kasa) return;
    const s = document.createElement('script');
    s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    s.onload = () => kur(ayar);
    document.head.appendChild(s);
  }).catch(() => {});

  function kur(ayar) {
    if (!window.Paddle) return;
    if (ayar.env === 'sandbox' && window.Paddle.Environment) window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({
      token: ayar.token,
      eventCallback: olay => {
        const ad = olay && olay.name;
        const veri = (olay && olay.data) || {};
        if (ad === 'checkout.completed') {
          const txn = veri.transaction_id || veri.transactionId || (veri.transaction && veri.transaction.id) || '';
          try { if (txn) sessionStorage.setItem('stickky-txn', txn); } catch (e) { /* özel pencere */ }
        }
      }
    });

    document.querySelectorAll('[data-al]').forEach(el => {
      const slug = el.getAttribute('data-al');
      const dugme = document.createElement('button');
      dugme.type = 'button';
      dugme.className = 'al';
      dugme.textContent = FIYAT_YAZISI;
      dugme.setAttribute('aria-label', (el.getAttribute('data-ad') || slug) + ' — ' + FIYAT_YAZISI);
      dugme.addEventListener('click', e => {
        e.stopPropagation();
        window.Paddle.Checkout.open({
          items: [{ priceId: ayar.priceId, quantity: 1 }],
          customData: { slug: slug },
          settings: { displayMode: 'overlay', successUrl: location.origin + '/tesekkur.html', theme: 'light' }
        });
      });
      el.replaceWith(dugme);
    });
    // Önizleme penceresi satış etiketini SETLER[i].satis'ten basıyor; orada da
    // data-al var — pencere her açıldığında aynı dönüşüm uygulanır.
    const ozSatis = document.getElementById('oz-satis');
    if (ozSatis && window.MutationObserver) {
      new MutationObserver(() => {
        ozSatis.querySelectorAll('[data-al]').forEach(el => {
          const slug = el.getAttribute('data-al');
          const d = document.createElement('button');
          d.type = 'button'; d.className = 'al'; d.textContent = FIYAT_YAZISI;
          d.addEventListener('click', () => window.Paddle.Checkout.open({
            items: [{ priceId: ayar.priceId, quantity: 1 }], customData: { slug: slug },
            settings: { displayMode: 'overlay', successUrl: location.origin + '/tesekkur.html', theme: 'light' }
          }));
          el.replaceWith(d);
        });
      }).observe(ozSatis, { childList: true });
    }
  }
})();
