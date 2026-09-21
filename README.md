# sticker-platform

Meme sticker seti platformu: **havuz → set atölyesi → üretim hattı → teslimat.**
Tasarım ve proje şeması `analitik-brain` deposunda:
`docs/2026-08-14-sticker-platform-tasarim.md` · `projects/sticker-platform.md`

## Kurulum (Windows)

```
git clone https://github.com/vindthekaiju-collab/sticker-platform
cd sticker-platform
npm install          # tek bağımlılık: sharp
npm start            # http://127.0.0.1:47411
npm test             # duman testi — ağsız, uçtan uca
```

- **ffmpeg** isteğe bağlı: yalnız Telegram *video* sticker üretimi için.
  `winget install ffmpeg`. Yoksa statik her şey çalışır, arayüz durumda söyler.
- Sunucu yalnız `127.0.0.1`'i dinler (pano geleneği).

## Eklenti

`eklenti/` klasörü → Chrome `chrome://extensions` → Geliştirici modu →
"Paketlenmemiş öğe yükle". Giphy/Pinterest'te görsele gelince **＋ havuza**
düğmesi çıkar. Sunucu kapalıysa kuyruğa yazar, açılınca boşaltır.

## Parçalar

| Dosya | İş |
|---|---|
| `sunucu.js` | HTTP sunucu + API (bağımlılıksız) |
| `lib/depo.js` | JSON depolama: havuz + setler |
| `lib/indir.js` | Kaynak medyayı diske alır (teslim edilen dosya hep yerel kopyadan) |
| `lib/donustur.js` | sharp/ffmpeg dönüşümleri + boyuta sıkıştırma döngüsü |
| `lib/uret.js` | Set → telegram / wastickers / zip paketleri, raporlu |
| `lib/zip.js` | Asgari ZIP yazıcı (store) — bağımlılık yerine biçimin kendisi |
| `lib/telegram.js` | Bot API `createNewStickerSet` — token yoksa kuru çalışma |
| `lib/teslimat.js` + `teslimat/sablon.html` | Ödeme sonrası mobil teslimat sayfası |
| `lib/sinirlar.js` | Platform biçim sınırları, kaynaklı — tek gerçek |
| `ui/` | Set atölyesi arayüzü |
| `eklenti/` | Chrome MV3 toplayıcı |
| `test/duman.js` | Ağsız uçtan uca test |

## Ortam değişkenleri

| Değişken | Ne açar |
|---|---|
| `GIPHY_API_KEY` | Küratörün Giphy araması (kademe 2-3) |
| `TELEGRAM_BOT_TOKEN` | Bot canlanır: /paket, /trend + set kurulumu |
| `PADDLE_WEBHOOK_SECRET` | Paddle webhook imza doğrulaması (canlıda zorunlu) |

Hiçbiri yokken de her şey çalışır — ilgili özellik uyur ya da kuru çalışır.

## Kamu malı hat (2026-09-21)

Giphy/Pinterest ticari kaynak olamaz (hizmet şartları yeniden paketlemeyi
yasaklıyor). Satılabilir paketler **kamu malı / CC0** görsellerden üretilir;
her sticker'ın kaynağı, sanatçısı, lisansı ve lisans sayfası
`veri/kaynaklar.json`'da durur.

| Adım | Komut | Ne yapar |
|---|---|---|
| 1 | `node arac/kaynak-tara.js <parti> <commons\|met\|aic\|openverse> "<sorgu>" [adet]` | Yalnız PD/CC0 adayları çeker, `veri/tarama/<parti>/` altına küçük kopya + numaralı kontak sayfası |
| 2 | `node arac/yakin-bak.js <parti> <no>…` | Seçilenlere ızgaralı yakın bakış (kırpma kararı için) |
| 3 | `arac/planlar/pd-<ad>.json` | Seçim: parti+no, kırpma oranı, altyazı, emoji, set adı |
| 4 | `node arac/havuza-al.js arac/planlar/pd-<ad>.json` | İndirir, kırpar, Impact altyazı basar, havuza + sete alır, kaynak kaydını yazar |
| 5 | `node arac/set-kontak.js` | Setlerin hazır sticker'larını kontak sayfasına döker (göz denetimi) |
| 6 | `node arac/yayina-hazirla.js [--kuru]` | Taslak setleri paketler (tg/wa/zip), teslimat sayfası, yayında; `setler.html` + `site/k` + ana sayfa perdeleri |

Ek araçlar: `arac/dev-eser-bak.js <parti> <no> [x y w h]` dev eseri (Bosch,
Bruegel) orijinal boyutta indirip 4×4 ızgaralar, hücrelere oran basar — plan
dosyasındaki `kirp` doğrudan oradan; kayıtta `"buyuk": true` orijinali
indirtir. Plan kaydında `"paneller": [...]` + `"yon": "dikey|yatay"` iki
panelli meme formatı üretir (Drake, woman-yelling-at-cat). `arac/ham-yenile.js`
düşük çözünürlüklü ham indirmeleri 1280 px ile değiştirip sticker'ı yeniden
çizer. Commons küçük genişlikleri **listeli**: 1200 → HTTP 400; 1280 ve 1920
çalışır.

Commons `upload.wikimedia.org` anonim User-Agent'a 429 veriyor; `lib/indir.js`
tanımlayıcı UA gönderir ve `havuza-al.js` 1200 px küçüğü çeker (orijinal
20 MB'ı aşabiliyor). AIC IIIF görselleri bu makineden 403 döndü (2026-09-21),
kaynak listede ama kullanılmadı. Openverse API artık anahtar istiyor (401).

## Otonom küratör

Atölyedeki 📡 kutusuna keyword ekle → sunucu 6 saatte bir tarar (havuz +
anahtar varsa Giphy) ve **taslak** set üretir. Onay bekleyen taslağı olan
keyword atlanır. Hiçbir şey onaysız yayına/trende gitmez.

## Satış akışı (F1)

1. Atölyede seti üret (Telegram/WhatsApp/ZIP) → **Vitrin görseli** ile kapak al.
2. **Satış linki** → `/t/<token>` teslimat linki; alıcıya ödeme sonrası bu
   link verilir (Gumroad "content" alanına da bu konur).
3. Gumroad webhook'u `/api/webhook/gumroad`'a bağlanınca token otomatik
   üretilir; ürün→set eşlemesi `veri/urunler.json`:
   `{ "<product_permalink>": "<setId>" }`.

## Bilinenler

- `.wastickers` düzeni üçüncü parti gelenek, **telefonda doğrulanmadı** —
  ilk gerçek içe aktarma testi bunu sınar.
- Giphy/Pinterest DOM'u değişkendir; eklenti seçicileri src desenine dayanır
  ama ilk gerçek test kullanıcının tarayıcısında yapılmalı (^sp6).
- Telegram gerçek set kurulumu bot token'ı ister: `TELEGRAM_BOT_TOKEN`
  ortam değişkeni + botun kullanıcı adı. Tokensız kuru çalışma çalışıyor.
