'use strict';
/**
 * Ortak toplama katmanı: sayfadaki görsellerin üzerine gelince "havuza at"
 * düğmesi çıkarır. Site-özel dosya (giphy.js / pinterest.js) yalnızca
 * `window.__havuzKurali` tanımlar:
 *   { kaynak: 'giphy', uygunMu(img) → bool, medyaUrl(img) → str, etiketler(img) → [] }
 *
 * Sunucuya gönderim arka plan service worker'ından yapılır — content
 * script'ten localhost'a fetch CORS/karma-içerik engeline takılabilir
 * (2026-08-02 eklenti tuzağının dersi).
 */

(() => {
  const DUGME_SINIF = 'sticker-havuz-dugme';

  const stil = document.createElement('style');
  stil.textContent = `
    .${DUGME_SINIF} {
      position: absolute; z-index: 2147483646;
      background: #33c6b5; color: #0a2622;
      border: 0; border-radius: 8px; padding: 4px 9px;
      font: 600 12px system-ui, sans-serif; cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,.4);
    }
    .${DUGME_SINIF}[data-durum="tamam"] { background: #7ee081; }
    .${DUGME_SINIF}[data-durum="hata"] { background: #e06c6c; color: #fff; }
  `;
  document.documentElement.appendChild(stil);

  const dugme = document.createElement('button');
  dugme.className = DUGME_SINIF;
  dugme.type = 'button';
  dugme.textContent = '＋ havuza';
  dugme.style.display = 'none';
  document.documentElement.appendChild(dugme);

  let aktifImg = null;
  let gizlemeZamani = null;

  function goster(img) {
    aktifImg = img;
    const k = img.getBoundingClientRect();
    dugme.style.display = 'block';
    dugme.style.top = (window.scrollY + k.top + 6) + 'px';
    dugme.style.left = (window.scrollX + k.left + 6) + 'px';
    dugme.dataset.durum = '';
    dugme.textContent = '＋ havuza';
  }

  function gizle() {
    dugme.style.display = 'none';
    aktifImg = null;
  }

  document.addEventListener('mouseover', e => {
    const kural = window.__havuzKurali;
    if (!kural) return;
    if (e.target === dugme) { clearTimeout(gizlemeZamani); return; }
    const img = e.target.closest('img, video');
    if (img && kural.uygunMu(img)) {
      clearTimeout(gizlemeZamani);
      goster(img);
    } else if (aktifImg) {
      gizlemeZamani = setTimeout(gizle, 400);
    }
  }, true);

  dugme.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    const kural = window.__havuzKurali;
    if (!kural || !aktifImg) return;
    const kayit = {
      kaynak: kural.kaynak,
      medyaUrl: kural.medyaUrl(aktifImg),
      sayfaUrl: location.href,
      etiketler: kural.etiketler(aktifImg)
    };
    dugme.textContent = '…';
    chrome.runtime.sendMessage({ tip: 'aday', kayit }, cevap => {
      if (chrome.runtime.lastError || !cevap || !cevap.ok) {
        dugme.dataset.durum = 'hata';
        dugme.textContent = '✕ kuyrukta';
      } else {
        dugme.dataset.durum = 'tamam';
        dugme.textContent = cevap.yeni === false ? '✓ zaten var' : '✓ havuzda';
      }
      setTimeout(gizle, 900);
    });
  });
})();
