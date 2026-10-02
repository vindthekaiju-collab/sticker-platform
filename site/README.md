# stickky.xyz sitesi

Bu klasör alıcıya bakan yüzdür — statik, bağımlılıksız.

- `index.html` — açılış sayfası. Kaydırmayla akan tek sayfa: giriş
  (yüzen pullar), şerit, set perdeleri, "nasıl", kapanış. `#packs` bölümü
  ve giriş şeridindeki sayılar **üretilir** (`arac/anasayfa-perdeleri.js`,
  depodaki yayında setlerden); gerisi elle.
- `stil.css` — iki sayfanın ortak stili. Alt yarısı `lib/magaza.js`
  şablonuyla eşleşir; oradaki sınıf adlarına dokunma.
- `canli.js` — hareket katmanı (GSAP + ScrollTrigger, `js/` altında yerel
  kopya, 3.15). Her animasyon "from" biçiminde: betik yüklenmezse ya da
  `prefers-reduced-motion` açıksa sayfa düz ve tam görünür kalır.
- `k/<set>/NN.webp` — ana sayfanın kullandığı 256 px animasyonlu kopyalar.
  Tam boy (512 px, ~450 KB) `s/` altında kalır; yirmi tanesini birden
  yüzdürmek 8 MB ediyordu. Üretimi: `node arac/kucuk-onizleme.js`
  (magaza.js'den sonra bir kez).
- Mağaza (`magaza.html`) ve set teslimat sayfaları setler yayınlanınca
  atölyeden üretilip buraya kopyalanır: `cikti/magaza.html` + `cikti/<set>/`

## Canlıya alma (bir kez, ~10 dk)

Önerilen: Vercel (onchainbuddies zaten oradaysa aynı hesap).

1. vercel.com → Add New Project → GitHub'dan `sticker-platform`ı içe aktar
2. Root Directory: `site` · Framework: Other (statik) → Deploy
3. Project → Settings → Domains → `stickky.xyz` ekle
4. Domain'i aldığın yerde (registrar) Vercel'in gösterdiği DNS kayıtlarını gir
5. 10-30 dk içinde stickky.xyz canlı

Paddle webhook'u ileride aynı projeye küçük bir işlev olarak eklenir
(`api/webhook.js`) — F1'in son adımı, setler hazır olunca.
