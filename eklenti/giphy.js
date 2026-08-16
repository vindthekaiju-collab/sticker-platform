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
    // Giphy iki biçim kullanıyor:
    //   eski: /media/<kimlik>/giphy.webp
    //   yeni: /media/v1.<jeton>/<kimlik>/200.webp   (2026-08-16'da ölçüldü)
    // Araya giren `v1.<jeton>` segmenti nokta içerdiği için eski desen
    // eşleşmiyor, sessizce ekrandaki 200px önizlemeye düşüyordu — sticker
    // 512px istediği için bu bulanık çıktı demekti. Jeton segmenti opsiyonel
    // atlanır; kimlik her zaman ondan sonraki segmenttir.
    let m = src.match(/\/media\/(?:v\d+\.[^/]+\/)?([A-Za-z0-9]+)\//);
    if (m) return 'https://i.giphy.com/' + m[1] + '.gif';
    // Zaten tam boy adres verilmişse olduğu gibi bırak.
    m = src.match(/i\.giphy\.com\/([A-Za-z0-9]+)\./);
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
