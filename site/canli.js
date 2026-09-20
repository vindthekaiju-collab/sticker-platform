/* stickky — hareket katmanı.
 *
 * GSAP + ScrollTrigger (js/ altında yerel kopya, 3.15). Her animasyon
 * "from" biçiminde: betik yüklenmezse ya da kullanıcı hareketi azaltmışsa
 * sayfa olduğu gibi, düz ve tam görünür kalır. Hiçbir içerik JS'e bağlı değil.
 *
 * Bölümler:
 *   1. üst bar          — kaydırınca dolar (her iki sayfa)
 *   2. giriş            — manşet kelimeleri, yüzen pullar, fare paralaksı,
 *                         kaydırınca pulların ortaya toplanması
 *   3. bant             — kaydırma hızıyla hızlanan şerit
 *   4. deste            — set perdeleri: yelpaze dizilişi + üstüne binen
 *                         perdeyle alttakinin küçülmesi
 *   5. nasıl            — sohbet balonları sırayla belirir
 *   6. son              — kapanış pulları
 *   7. setler.html      — #set-N ile önizlemeyi aç, satırlar sırayla gelsin
 */
(function () {
  'use strict';

  const azalt = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inceIsaretci = window.matchMedia('(pointer: fine)').matches;
  const ana = document.body.classList.contains('ana');

  /* ---------------------------------------------------------- 1. üst bar */
  const ust = document.querySelector('.ust');
  if (ust && ana) {
    const doldur = () => ust.classList.toggle('dolu', window.scrollY > 24);
    doldur();
    window.addEventListener('scroll', doldur, { passive: true });
  }

  /* ---------------------------------------------------------- 7. setler.html */
  if (!ana) {
    // Ana sayfadaki "Ekle" buraya #set-N ile gelir; önizleme doğrudan açılsın.
    const hashtenAc = () => {
      const es = location.hash.match(/^#set-(\d+)$/);
      if (es && typeof window.setAc === 'function') window.setAc(Number(es[1]));
    };
    hashtenAc();
    window.addEventListener('hashchange', hashtenAc);
  }

  if (azalt || !window.gsap) return;
  const gsap = window.gsap;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
  const ST = window.ScrollTrigger;

  const derece = el => parseFloat(getComputedStyle(el).getPropertyValue('--r')) || 0;
  const ondalik = (el, ad, vars) => parseFloat(getComputedStyle(el).getPropertyValue(ad)) || vars;

  if (!ana) {
    // Setler sayfası: satırlar aşağıdan sırayla gelsin.
    gsap.from('.satir', { y: 40, opacity: 0, duration: .6, stagger: .09, ease: 'power3.out', clearProps: 'transform,opacity' });
    return;
  }

  /* ---------------------------------------------------------- 2. giriş */
  const giris = document.querySelector('.giris');
  const pullar = gsap.utils.toArray('.giris-pullar .pul');

  pullar.forEach(p => gsap.set(p, { rotation: derece(p), transformOrigin: '50% 50%' }));

  const acilis = gsap.timeline({ defaults: { ease: 'power3.out' } });
  acilis
    .from('.ustyazi', { y: 20, opacity: 0, duration: .5 }, 0)
    .from('.manset .k', { y: 60, opacity: 0, rotation: 4, duration: .8, stagger: .09, ease: 'back.out(1.6)' }, .05)
    .from('.giris .aciklama', { y: 20, opacity: 0, duration: .6 }, .5)
    .from('.giris .dugmeler > *', { y: 20, opacity: 0, duration: .5, stagger: .08 }, .6)
    .from(pullar, {
      scale: 0, opacity: 0, rotation: '+=40',
      duration: .9, stagger: { each: .06, from: 'random' }, ease: 'back.out(2)'
    }, .25)
    .from('.giris-ok', { opacity: 0, duration: .6 }, 1.2);

  // Boşta yüzme: her pul kendi ritminde, transform'un y yüzdesi üzerinden
  // (x/y pikselleri paralaksa, ölçek/opaklık kaydırmaya ayrıldı).
  pullar.forEach(p => {
    gsap.to(p, {
      yPercent: gsap.utils.random(-7, 7),
      rotation: '+=' + gsap.utils.random(-4, 4),
      duration: gsap.utils.random(2.4, 4.2),
      yoyo: true, repeat: -1, ease: 'sine.inOut',
      delay: gsap.utils.random(0, 1.5)
    });
  });

  // Fare paralaksı: derinlik --d ile, yalnız hassas işaretçide.
  if (inceIsaretci && giris) {
    const hareket = pullar.map(p => ({
      x: gsap.quickTo(p, 'x', { duration: .9, ease: 'power3' }),
      y: gsap.quickTo(p, 'y', { duration: .9, ease: 'power3' }),
      d: ondalik(p, '--d', .8)
    }));
    giris.addEventListener('pointermove', e => {
      const r = giris.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - .5;
      const ny = (e.clientY - r.top) / r.height - .5;
      hareket.forEach(h => { h.x(-nx * 46 * h.d); h.y(-ny * 34 * h.d); });
    });
    giris.addEventListener('pointerleave', () => hareket.forEach(h => { h.x(0); h.y(0); }));
  }

  // Kaydırınca: pullar ortaya toplanıp küçülür, metin yukarı süzülür.
  if (ST) {
    gsap.to('.giris-pullar', {
      scale: .55, opacity: 0, transformOrigin: '50% 40%', ease: 'none',
      scrollTrigger: { trigger: giris, start: 'top top', end: 'bottom 30%', scrub: .4 }
    });
    gsap.to('.giris-metin', {
      y: -90, opacity: 0, ease: 'none',
      scrollTrigger: { trigger: giris, start: 'top top', end: 'bottom 40%', scrub: .4 }
    });
  }

  /* ---------------------------------------------------------- 3. bant */
  const bant = document.querySelector('.bant-ic');
  if (bant && ST) {
    bant.style.animation = 'none';
    const kayis = gsap.to(bant, { xPercent: -33.333, duration: 26, ease: 'none', repeat: -1 });
    let geri;
    ST.create({
      onUpdate: self => {
        const hiz = Math.min(Math.abs(self.getVelocity()) / 700, 3.5);
        gsap.to(kayis, { timeScale: 1 + hiz, duration: .2, overwrite: true });
        clearTimeout(geri);
        geri = setTimeout(() => gsap.to(kayis, { timeScale: 1, duration: 1.2 }), 120);
      }
    });
  }

  /* ---------------------------------------------------------- 4. deste */
  const perdeler = gsap.utils.toArray('.perde');

  // Yelpaze hedef konumları. CSS değişkenlerine de yazılır (JS'siz / azaltılmış
  // hareket düzeni için), ama gsap devredeyken transform'u gsap tutar:
  // CSS değişkenini tweenlemek denendi, gsap.from bitiş değerlerini yanlış
  // okudu (hepsi 0'a düştü). Tek sahip = tek gerçek.
  function yelpazeHedefleri(perde) {
    const kartlar = gsap.utils.toArray('.yelpaze .pul', perde);
    const n = kartlar.length;
    const orta = (n - 1) / 2;
    const b = (kartlar[0] && kartlar[0].getBoundingClientRect().width) || 160;
    const genis = window.innerWidth < 820;
    // Yelpaze kendi sütununa sığsın: kart sayısı artınca adım daralır
    // (9 kartlık set masaüstünde sağdan taşıyordu).
    const sutun = perde.querySelector('.yelpaze').getBoundingClientRect().width || b * 3;
    const adim = Math.min(b * (genis ? .42 : .55), n > 1 ? (sutun - b * 1.1) / (n - 1) : 0);
    const yay = n > 1 ? Math.min(11, 58 / (n - 1)) : 0;
    return kartlar.map((k, i) => {
      const u = i - orta;
      const h = { el: k, x: u * adim, y: u * u * b * .045, r: u * yay };
      k.style.setProperty('--tx', h.x.toFixed(1) + 'px');
      k.style.setProperty('--ty', h.y.toFixed(1) + 'px');
      k.style.setProperty('--r', h.r.toFixed(1) + 'deg');
      k.style.zIndex = String(10 - Math.abs(Math.round(u)));
      return h;
    });
  }

  const yelpazeler = [];
  perdeler.forEach((perde, i) => {
    const hedefler = yelpazeHedefleri(perde);
    yelpazeler.push({ perde, hedefler });
    const baglanti = perde.querySelector('.dugme.ters');

    hedefler.forEach(h => {
      gsap.set(h.el, { x: h.x, y: h.y, rotation: h.r, transformOrigin: '50% 50%' });
      // Pula tıklamak setin sayfasına götürsün; üstüne gelince kalksın.
      if (baglanti) h.el.addEventListener('click', () => { location.href = baglanti.href; });
      h.el.addEventListener('pointerenter', () => gsap.to(h.el, { y: h.y - 22, rotation: 0, scale: 1.08, duration: .3, ease: 'power3.out', overwrite: 'auto' }));
      h.el.addEventListener('pointerleave', () => gsap.to(h.el, { y: h.y, rotation: h.r, scale: 1, duration: .4, ease: 'power3.out', overwrite: 'auto' }));
    });

    if (!ST) return;

    // Giriş: kartlar alttan, kapalı deste olarak gelip yelpaze gibi açılır.
    gsap.timeline({ scrollTrigger: { trigger: perde, start: 'top 55%', once: true } })
      .from(hedefler.map(h => h.el), {
        x: 0, y: 260, rotation: 0, opacity: 0,
        duration: .9, stagger: { each: .07, from: 'center' }, ease: 'back.out(1.4)'
      }, 0)
      .from(perde.querySelectorAll('.perde-metin > *'), {
        y: 30, opacity: 0, duration: .6, stagger: .08, ease: 'power3.out'
      }, .1);

    // Üstüne bir sonraki perde binerken bu perde geri çekilsin.
    const sonraki = perdeler[i + 1];
    if (sonraki) {
      gsap.to(perde, {
        scale: .92, opacity: .55, ease: 'none',
        scrollTrigger: { trigger: sonraki, start: 'top bottom', end: 'top top', scrub: true }
      });
    }
  });

  window.addEventListener('resize', () => {
    yelpazeler.forEach(y => {
      const yeni = yelpazeHedefleri(y.perde);
      y.hedefler.forEach((h, i) => { Object.assign(h, yeni[i]); gsap.set(h.el, { x: h.x, y: h.y, rotation: h.r }); });
    });
  }, { passive: true });

  /* ---------------------------------------------------------- 5. nasıl */
  if (ST) {
    gsap.from('.nasil .baslik-b .k', {
      y: 50, opacity: 0, rotation: 3, duration: .7, stagger: .12, ease: 'back.out(1.6)',
      scrollTrigger: { trigger: '.nasil', start: 'top 70%', once: true }
    });
    gsap.from('.adimlar li', {
      x: -30, opacity: 0, duration: .6, stagger: .12, ease: 'power3.out',
      scrollTrigger: { trigger: '.adimlar', start: 'top 80%', once: true }
    });
    gsap.from('.sohbet', {
      y: 60, opacity: 0, rotation: 6, duration: .8, ease: 'back.out(1.4)',
      scrollTrigger: { trigger: '.sohbet', start: 'top 80%', once: true }
    });
    gsap.from('.sohbet .balon', {
      scale: 0, opacity: 0, duration: .55, stagger: .42, ease: 'back.out(2.2)',
      scrollTrigger: { trigger: '.sohbet', start: 'top 65%', once: true }
    });

    /* -------------------------------------------------------- 6. son */
    gsap.utils.toArray('.son-pullar .pul').forEach(p => gsap.set(p, { rotation: derece(p) }));
    gsap.from('.son-pullar .pul', {
      y: 80, opacity: 0, scale: .6, duration: .8, stagger: .1, ease: 'back.out(1.8)',
      scrollTrigger: { trigger: '.son', start: 'top 70%', once: true }
    });
    gsap.from('.son .baslik-b, .son .dugme', {
      y: 30, opacity: 0, duration: .6, stagger: .12, ease: 'power3.out',
      scrollTrigger: { trigger: '.son', start: 'top 60%', once: true }
    });
  }
})();
