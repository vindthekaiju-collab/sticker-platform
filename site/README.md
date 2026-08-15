# stickky.xyz sitesi

Bu klasör alıcıya bakan yüzdür — statik, bağımlılıksız.

- `index.html` — açılış sayfası (şu an "çok yakında" hali)
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
