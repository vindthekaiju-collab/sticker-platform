# sticker-platform

Meme sticker seti platformu: **havuz → set atölyesi → üretim hattı → teslimat.**
Tasarım: `../docs/2026-08-14-sticker-platform-tasarim.md` · Şema: `../projects/sticker-platform.md`

> **Geçici konum.** Bu kod beyin deposunda `platform/` altında duruyor çünkü
> uzak oturumun GitHub yetkisi yeni depo açmaya yetmedi. Kullanıcı
> `sticker-platform` adında boş bir GitHub deposu açınca buradan taşınacak;
> beyin deposunda kod kalmayacak.

## Kurulum (Windows)

```
cd platform
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
