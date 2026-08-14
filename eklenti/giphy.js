'use strict';
/**
 * Giphy kuralı. Görsel adresleri media<N>.giphy.com / i.giphy.com üzerinden
 * gelir; en iyi kaliteyi URL'deki medya kimliğinden türetmeyi dener,
 * bulamazsa görünen src ile yetinir.
 *
 * DOM sınıf adları Giphy'de sık değişir — seçim bilerek src desenine
 * dayanır, sınıf adına değil. İlk gerçek test kullanıcının tarayıcısında.
 */

window.__havuzKurali = {
  kaynak: 'giphy',

  uygunMu(el) {
    const src = el.currentSrc || el.src || '';
    return /giphy\.com\/media|i\.giphy\.com/.test(src);
  },

  medyaUrl(el) {
    const src = el.currentSrc || el.src || '';
    // .../media/<kimlik>/... deseninden tam boy gif'e in.
    const m = src.match(/media\/([A-Za-z0-9]+)\//);
    if (m) return 'https://i.giphy.com/' + m[1] + '.gif';
    return src;
  },

  etiketler(el) {
    const etiketler = [];
    if (el.alt) etiketler.push(...el.alt.split(/\s+/).filter(k => k.length > 2).slice(0, 8));
    // Arama sayfasındaysak arama terimi de etikettir.
    const yol = location.pathname.match(/\/search\/([^/?]+)/);
    if (yol) etiketler.push(decodeURIComponent(yol[1]).replace(/-/g, ' '));
    return [...new Set(etiketler)];
  }
};
