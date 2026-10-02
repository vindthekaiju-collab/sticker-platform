# Kasa — satışı açmak için kalan adımlar

Kod ve altyapı hazır: Worker yayında (`https://stickky-kasa.vindthekaiju.workers.dev`),
paketler KV'de, mağaza `satis.json` dolunca Buy düğmesi gösteriyor, teşekkür
sayfası paketi kasadan çekiyor. Kalan her adım **Paddle hesabı** ister; hepsi
Paddle panelinde, toplam ~15 dakika.

## 1. Paddle'da ürün ve fiyat (Catalog → Products)
- Tek ürün: **stickky pack** · tek fiyat: **$2.99 one-time**. Hangi paketin
  alındığı `custom_data.slug` ile taşınır; paket başına ürün açmak gerekmez.
- Fiyatın kimliğini kopyala: `pri_…`

## 2. Client-side token (Developer tools → Authentication)
- "Client-side token" oluştur → `test_…` (sandbox) ya da `live_…`.
- `site/satis.json`'a yaz:
  ```json
  { "token": "live_…", "priceId": "pri_…", "env": "live",
    "kasa": "https://stickky-kasa.vindthekaiju.workers.dev" }
  ```
  Sandbox'ta denemek için `env: "sandbox"` + `test_` token + sandbox fiyat.

## 3. Ödeme kanıtı — ikisinden biri yeter, ikisi de olursa daha sağlam
- **Webhook** (Developer tools → Notifications): hedef
  `https://stickky-kasa.vindthekaiju.workers.dev/webhook/paddle`, olay
  `transaction.completed`. Verdiği sırrı Worker'a koy:
  `cd kasa && printf '%s' 'pdl_ntfset_…' | npx wrangler secret put PADDLE_WEBHOOK_SECRET`
- **API anahtarı** (Developer tools → Authentication → API keys, yalnız
  `transaction.read` izni yeter):
  `cd kasa && printf '%s' 'pdl_live_apikey_…' | npx wrangler secret put PADDLE_API_KEY`
  (sandbox anahtarı için ayrıca `PADDLE_API_BASE = https://sandbox-api.paddle.com`
  — `wrangler.toml` `[vars]`.)
- `printf` şart: PowerShell borusu sırra satır sonu yapıştırıyor (makine tuzağı).
- Komutları `env -u CLOUDFLARE_API_TOKEN` ile koştur; env'deki token KV'ye yetkisiz.

## 4. Alan adı onayı (Checkout → Website approval)
`stickky.xyz` canlı ortamda onaylanmadan Paddle overlay açılmaz. Sandbox'ta
gerekmez.

## 5. Yayın
`satis.json` değişince commit + `main`'e push → Vercel kendisi yayınlar.
Sandbox'ta bir deneme alışverişi yap: Buy → ödeme → tesekkur.html iki
indirme bağlantısı göstermeli. Göstermiyorsa `/indir?txn=…` cevabına bak.

## Akış (doğrulandı: kasa/test.js, 15 sınama)
```
Buy (satis.js) → Paddle overlay (priceId + customData.slug)
   → ödeme → successUrl tesekkur.html (+ checkout.completed → sessionStorage txn)
   → GET kasa/indir?txn → KV txn:<id> (webhook yazdı) ya da Paddle API
   → HMAC imzalı, 24 saatlik /dosya/<slug>.wastickers|.zip → KV'den akış
```
Gerçek Paddle'a karşı DENENMEDİ (hesap oturumu yok); imza matematiği
`lib/satis.js` ile aynı, Paddle belgesine göre (ts + ':' + gövde, HMAC-SHA256).

## Bilinen eksikler
- Alıcıya e-posta gitmiyor; bağlantı teşekkür sayfasında. Sayfayı kaybeden
  Paddle makbuzundaki `txn_…` kimliğiyle tesekkur.html'den yeniden alabilir.
- Koleksiyon setleri Giphy kanallarından kesildi; listeleme kiti bunları
  "resale için lisans temizlenmedi" diye işaretliyor. Satışa çıkmadan karar ver.
