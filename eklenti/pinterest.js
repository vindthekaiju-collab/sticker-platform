'use strict';
/**
 * Pinterest kuralı. Küçük boy görseller /236x/ veya /564x/ yolundan gelir;
 * /originals/ karşılığı çoğu zaman vardır ama garantisi yok — arka plan
 * indirici originals 404 verirse görünen boyuta düşer (sunucu tarafında
 * medyaUrl zaten denenen ilk URL'dir; hata durumu kayda işlenir).
 */

window.__havuzKurali = {
  kaynak: 'pinterest',

  uygunMu(el) {
    const src = el.currentSrc || el.src || '';
    return /pinimg\.com/.test(src);
  },

  medyaUrl(el) {
    const src = el.currentSrc || el.src || '';
    // En büyük hazır boyu iste: 236x/564x/736x → originals
    return src.replace(/\/\d{3,4}x\//, '/originals/');
  },

  etiketler(el) {
    const etiketler = [];
    if (el.alt) etiketler.push(...el.alt.split(/[,.]/).map(p => p.trim()).filter(p => p && p.length < 40).slice(0, 5));
    const arama = new URLSearchParams(location.search).get('q');
    if (arama) etiketler.push(arama);
    return [...new Set(etiketler)];
  }
};
