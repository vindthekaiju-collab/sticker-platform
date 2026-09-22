'use strict';
/**
 * DENEME SETİ: keşif seçiminden N kare → gerçek sticker (512×512 animasyonlu
 * WebP) + altyazı. ffmpeg yok; altyazı sharp ile HER KAREYE basılıyor
 * (animasyonlu girdi sharp'ta sayfa şeridi olarak gelir: yükseklik = kare ×
 * sayfa sayısı; bindirme de aynı şeritte tekrarlanır).
 *
 *   node arac/deneme-set.js [--plan arac/planlar/deneme-1.json] [--cikti cikti/deneme]
 *
 * Plan satırı: { "kanal": "_sahipsiz2", "no": 8, "metin": "…", "kirp": {...} }
 * Plan yoksa secim2.json'dan cümlesi olan ilk N kare alınır (--adet).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getir } = require('../lib/indir');

sharp.cache(false);
const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const planYol = sec('--plan', '');
const ciktiDiz = path.resolve(sec('--cikti', path.join(KOK, 'cikti', 'deneme')));
const ADET = Number(sec('--adet', 30));
const KENAR = 512, AZAMI = 500 * 1024;

const kanallar = JSON.parse(fs.readFileSync(path.join(KOK, 'veri', 'giphy', 'kanallar-2.json'), 'utf8'));
const secim = JSON.parse(fs.readFileSync(path.join(KOK, 'veri', 'giphy', 'kesif', 'secim2.json'), 'utf8'));
const kacar = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** Cümle gerçek bir cümle mi (nokta, emoji ya da "yazısız" değil)? */
function cumleMi(c) {
  const t = String(c || '').replace(/^"|"$/g, '').trim();
  if (!t || t === '—' || /yazısız/i.test(t) || /^metin/i.test(t)) return false;
  if (/^[…\.\?\!]+$/.test(t)) return false;
  if (/^[\u{1F300}-\u{1FAFF}☀-➿\s]+$/u.test(t)) return false;
  return true;
}

function satirla(metin, azami = 22) {
  const k = metin.split(/\s+/);
  if (metin.length <= azami || k.length < 2) return [metin];
  let enIyi = null, fark = 1e9;
  for (let i = 1; i < k.length; i++) {
    const a = k.slice(0, i).join(' '), b = k.slice(i).join(' ');
    if (Math.max(a.length, b.length) > azami + 6) continue;
    if (Math.abs(a.length - b.length) < fark) { fark = Math.abs(a.length - b.length); enIyi = [a, b]; }
  }
  return enIyi || [metin];
}

/** Tek karelik altyazı katmanı (şeffaf), sonra her sayfaya tekrarlanır. */
function altyaziSvg(metin, w, h) {
  const satirlar = satirla(metin.toUpperCase());
  const enUzun = Math.max(...satirlar.map(s => s.length));
  const punto = Math.max(22, Math.min(46, Math.floor((w - 40) / (enUzun * 0.56))));
  const satirYuk = Math.round(punto * 1.16);
  const altPay = Math.round(h * 0.045) + 4;
  const yazi = satirlar.map((s, i) => {
    const y = h - altPay - (satirlar.length - 1 - i) * satirYuk;
    return `<text x="${w / 2}" y="${y}" text-anchor="middle" font-family="Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif" font-size="${punto}" fill="#fff" stroke="#000" stroke-width="${(punto * 0.16).toFixed(1)}" stroke-linejoin="round" paint-order="stroke" letter-spacing="0.5">${kacar(s)}</text>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${yazi}</svg>`);
}

const AZAMI_KARE = 30;   // 512 × 31 = 15.872 < WebP'in 16.383 piksel sınırı

/**
 * Ham GIF → 512×512 animasyonlu WebP + altyazı.
 * ffmpeg yok; zincir tek parça kalmalı (araya PNG girerse sayfa bilgisi
 * kaybolur ve animasyon düzleşir — 2026-09-22'de bir kez çarpıldı).
 * Kırpma yalnız SOL/SAĞ: animasyonlu şeritte dikey kesim sayfaları böler.
 */
async function sticker(ham, metin, kirp) {
  const meta = await sharp(ham, { animated: true }).metadata();
  const sayfa = Math.min(meta.pages || 1, AZAMI_KARE);
  for (const q of [80, 70, 60, 50, 40, 30, 20]) {
    let zincir = sharp(ham, { animated: true, pages: sayfa });
    if (kirp && ((kirp.sol || 0) > 0 || (kirp.sag || 0) > 0)) {
      const sol = Math.round(meta.width * (kirp.sol || 0));
      const sag = Math.round(meta.width * (kirp.sag || 0));
      const kareY = Math.round(meta.pageHeight || meta.height);
      zincir = zincir.extract({ left: sol, top: 0, width: meta.width - sol - sag, height: kareY * sayfa });
    }
    // Dikey kırpma (alt banttaki filigran): şeritte extract sayfaları böler,
    // ama fit:'cover' + position:'top' sayfa farkındadır. AYRI GEÇİŞ olmalı —
    // sharp zincirde yalnız SON resize'ı uygular (2026-09-22'de ölçüldü:
    // iki resize yan yana konunca kırpma sessizce düşüyordu).
    if (kirp && (kirp.alt || 0) > 0) {
      const kareY = Math.round(meta.pageHeight || meta.height);
      const ara = await zincir
        .resize({ width: meta.width - Math.round(meta.width * ((kirp.sol || 0) + (kirp.sag || 0))), height: Math.round(kareY * (1 - kirp.alt)), fit: 'cover', position: 'top' })
        .webp({ quality: 95, effort: 2 }).toBuffer();
      zincir = sharp(ara, { animated: true });
    }
    zincir = zincir.resize({ width: KENAR, height: KENAR, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
    if (metin) {
      const katman = altyaziSvg(metin, KENAR, KENAR);
      const bindirme = [];
      for (let i = 0; i < sayfa; i++) bindirme.push({ input: katman, left: 0, top: i * KENAR });
      zincir = zincir.composite(bindirme);
    }
    const veri = await zincir.webp({ quality: q, effort: 4, loop: 0 }).toBuffer();
    if (veri.length <= AZAMI) return { veri, kalite: q, kare: sayfa };
  }
  throw new Error('500KB altına inmedi (' + sayfa + ' kare)');
}

(async () => {
  fs.mkdirSync(ciktiDiz, { recursive: true });
  let plan;
  if (planYol) plan = JSON.parse(fs.readFileSync(path.resolve(planYol), 'utf8'));
  else plan = secim.filter(s => cumleMi(s.cumle)).slice(0, ADET).map(s => ({ kanal: s.kanal, no: s.no, metin: s.cumle.replace(/^"|"$/g, '').trim() }));

  const kayit = [];
  for (const [i, p] of plan.entries()) {
    const g = (kanallar[p.kanal] || { gifler: [] }).gifler[p.no - 1];
    if (!g) { console.log(`${i + 1}: ${p.kanal} #${p.no} bulunamadı`); continue; }
    const ad = String(i + 1).padStart(2, '0');
    const hedef = path.join(ciktiDiz, ad + '.webp');
    try {
      const { veri } = await getir(g.gif, 6);
      const { veri: webp, kare } = await sticker(veri, p.metin, p.kirp);
      fs.writeFileSync(hedef, webp);
      kayit.push({ ad, kanal: p.kanal, no: p.no, metin: p.metin, baslik: g.title, url: g.url, kb: Math.round(webp.length / 1024), kare });
      console.log(`${ad} ${p.kanal} #${p.no} · ${kare} kare · ${Math.round(webp.length / 1024)} KB · "${p.metin}"`);
    } catch (e) {
      console.log(`${ad} ${p.kanal} #${p.no} HATA: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(ciktiDiz, 'kayit.json'), JSON.stringify(kayit, null, 1));

  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>stickky · deneme seti (${kayit.length})</title>
<style>body{margin:0;background:#0d0d0d;color:#eee;font:14px system-ui,sans-serif}
h1{font-size:18px;padding:14px 16px;margin:0;border-bottom:1px solid #333}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;padding:14px}
.k{background:#1b1b1b;border-radius:12px;overflow:hidden}
.k .r{background:repeating-conic-gradient(#2a2a2a 0% 25%,#222 0% 50%) 50%/22px 22px;aspect-ratio:1;display:flex;align-items:center;justify-content:center}
.k img{width:100%;height:100%;object-fit:contain}
.k .m{padding:7px 9px;font-size:12px;color:#bbb}
.k .m b{color:#fff;display:block;font-size:13px;margin-bottom:2px}</style></head><body>
<h1>stickky · deneme seti — ${kayit.length} sticker (512×512 animasyonlu WebP, WhatsApp sınırı 500 KB)</h1>
<div class="g">${kayit.map(k => `<div class="k"><div class="r"><img src="${k.ad}.webp" alt=""></div><div class="m"><b>${kacar(k.metin)}</b>${kacar(k.kanal)} #${k.no} · ${k.kare} kare · ${k.kb} KB</div></div>`).join('')}</div>
</body></html>`;
  fs.writeFileSync(path.join(ciktiDiz, 'index.html'), html);
  console.log(`\n${kayit.length} sticker → ${ciktiDiz}`);
})();
