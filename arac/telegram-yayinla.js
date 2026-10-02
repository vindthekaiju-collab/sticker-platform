'use strict';
/**
 * Koleksiyon setlerini Telegram'a sticker seti olarak yayınlar — alıcı için
 * gerçek tek tık: t.me/addstickers/<ad>.
 *
 *     node arac/telegram-yayinla.js [--donustur] [--yalniz <slug>] [--kuru]
 *
 * İki aşama:
 *  1. DÖNÜŞTÜRME (token gerekmez): cikti/setler/<slug>/NN.webp (animasyonlu
 *     WebP) → cikti/telegram/<slug>/NN.webm (VP9 + alfa, ≤3 sn, ≤256 KB,
 *     ≤30 fps). ffmpeg'in animasyonlu WebP okuması sürüme bağlı; bu yüzden
 *     kareler sharp ile PNG'ye açılır, ffmpeg kare dizisini kodlar.
 *     3 sn'den uzun animasyon HIZLANDIRILIR (kesilmez — döngü bozulmasın).
 *  2. YAYIN (token + sahip kimliği): lib/telegram.setKur ile set kurulur,
 *     sonuç cikti/setler/telegram.json'a yazılır {slug → {setAdi, link}}.
 *     Bir kez kurulan set yeniden kurulmaz (Telegram adı tekil ister).
 *
 * Ortam: TELEGRAM_BOT_TOKEN, TELEGRAM_SAHIP_ID (setlerin sahibi — bizim
 * Telegram kullanıcı kimliğimiz; bot API set sahibi olarak bir KULLANICI
 * ister). İkisi .env'den de okunur (.env gitignore'da).
 * Set adı rastgele ek alır: bağlantı yalnız ödeme sonrası veriliyor, tahmin
 * edilebilir ad bunu boşa çıkarırdı.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const telegram = require('../lib/telegram');
const temalar = require('../lib/temalar');
sharp.cache(false);

const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const yalniz = sec('--yalniz', null);
const kuru = argv.includes('--kuru');
const yalnizDonustur = argv.includes('--donustur');
const BOT_ADI = 'stickky_app_bot';
const AZAMI_SN = 3, AZAMI_FPS = 30, AZAMI_BAYT = 256 * 1024, KENAR = 512;

// .env (varsa) → process.env; var olan değişken ezilmez.
const envYol = path.join(KOK, '.env');
if (fs.existsSync(envYol)) {
  for (const satir of fs.readFileSync(envYol, 'utf8').split(/\r?\n/)) {
    const m = satir.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

let ffmpeg = 'ffmpeg';
try { execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' }); } catch { ffmpeg = require('ffmpeg-static'); }

const setDiz = path.join(KOK, 'cikti', 'setler');
const tgDiz = path.join(KOK, 'cikti', 'telegram');
const kayitYol = path.join(setDiz, 'telegram.json');
const kayit = fs.existsSync(kayitYol) ? JSON.parse(fs.readFileSync(kayitYol, 'utf8')) : {};
const setler = JSON.parse(fs.readFileSync(path.join(setDiz, 'setler.json'), 'utf8')).filter(s => !s.raf && (!yalniz || s.slug === yalniz));

/** Animasyonlu WebP → WebM (VP9+alfa). Döner: { bayt, kare, fps, saniye }. */
async function webmUret(kaynak, hedef) {
  const m = await sharp(kaynak, { animated: true }).metadata();
  const kareSayisi = m.pages || 1;
  const gecikmeler = (m.delay && m.delay.length ? m.delay : new Array(kareSayisi).fill(100)).map(d => Math.max(20, d || 100));
  const toplamMs = gecikmeler.reduce((a, b) => a + b, 0);
  // Kare seçimi: 3 sn × 30 fps = en çok 90 kare. Fazlası eşit aralıkla seyreltilir.
  let secili = [...Array(kareSayisi).keys()];
  if (secili.length > AZAMI_SN * AZAMI_FPS) {
    const adim = secili.length / (AZAMI_SN * AZAMI_FPS);
    secili = Array.from({ length: AZAMI_SN * AZAMI_FPS }, (_, i) => Math.floor(i * adim));
  }
  const saniye = Math.min(AZAMI_SN, toplamMs / 1000);
  const fps = Math.min(AZAMI_FPS, Math.max(1, secili.length / Math.max(saniye, 0.1)));

  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'stickky-tg-'));
  try {
    for (const [i, sayfa] of secili.entries()) {
      await sharp(kaynak, { page: sayfa, pages: 1 })
        .resize(KENAR, KENAR, { fit: 'inside' })
        .png().toFile(path.join(gecici, String(i).padStart(3, '0') + '.png'));
    }
    const olcek = `scale=w=${KENAR}:h=${KENAR}:force_original_aspect_ratio=decrease:flags=lanczos,pad=ceil(iw/2)*2:ceil(ih/2)*2`;
    let bayt = Infinity;
    for (const [crf, bitHizi] of [[32, '400k'], [38, '250k'], [44, '160k'], [50, '100k']]) {
      execFileSync(ffmpeg, [
        '-y', '-framerate', fps.toFixed(3), '-i', path.join(gecici, '%03d.png'),
        '-vf', olcek, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
        '-crf', String(crf), '-b:v', bitHizi, '-an', '-row-mt', '1', hedef,
      ], { stdio: 'ignore' });
      bayt = fs.statSync(hedef).size;
      if (bayt <= AZAMI_BAYT) break;
    }
    if (bayt > AZAMI_BAYT) throw new Error(`${path.basename(kaynak)}: en düşük kalitede bile ${Math.round(bayt / 1024)} KB`);
    return { bayt, kare: secili.length, fps: Number(fps.toFixed(2)), saniye: Number((secili.length / fps).toFixed(2)) };
  } finally {
    fs.rmSync(gecici, { recursive: true, force: true });
  }
}

async function donustur(s) {
  const hedefDiz = path.join(tgDiz, s.slug);
  fs.mkdirSync(hedefDiz, { recursive: true });
  const raporYol = path.join(hedefDiz, 'rapor.json');
  const eski = fs.existsSync(raporYol) ? JSON.parse(fs.readFileSync(raporYol, 'utf8')) : { dosyalar: [] };
  const dosyalar = [];
  let yeni = 0;
  for (const f of s.dosyalar) {
    const kaynak = path.join(setDiz, s.slug, f.dosya);
    const ad = f.dosya.replace(/\.webp$/, '.webm');
    const hedef = path.join(hedefDiz, ad);
    const onceki = eski.dosyalar.find(d => d.dosya === ad);
    const emoji = temalar.emoji(s.tema);
    if (onceki && fs.existsSync(hedef) && fs.statSync(hedef).mtimeMs >= fs.statSync(kaynak).mtimeMs) { dosyalar.push({ ...onceki, emoji }); continue; }
    try {
      const r = await webmUret(kaynak, hedef);
      dosyalar.push({ dosya: ad, emoji, ...r });
      yeni++;
    } catch (e) {
      console.log(`  ! ${s.slug}/${f.dosya}: ${e.message}`);
      fs.rmSync(hedef, { force: true });
    }
  }
  fs.writeFileSync(raporYol, JSON.stringify({ slug: s.slug, ad: s.ad, dosyalar }, null, 1));
  return { dosyalar, yeni };
}

(async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const sahip = process.env.TELEGRAM_SAHIP_ID || '';
  let donusen = 0, kurulan = 0, atlanan = 0;
  for (const s of setler) {
    const d = await donustur(s);
    donusen += d.yeni;
    console.log(`${s.slug.padEnd(34)} ${String(d.dosyalar.length).padStart(3)}/${s.dosyalar.length} webm${d.yeni ? ` (+${d.yeni})` : ''}`);
    if (yalnizDonustur) continue;
    if (kayit[s.slug] && kayit[s.slug].link) { atlanan++; continue; }
    if (!token || !sahip) continue;
    if (d.dosyalar.length < 1) { console.log(`  ! ${s.slug}: yayınlanacak webm yok`); continue; }
    if (kuru) { console.log(`  (kuru) ${s.slug} → set kurulacaktı`); continue; }
    const ek = crypto.randomBytes(3).toString('hex');
    const r = await telegram.setKur({ token, botKullaniciAdi: BOT_ADI, aliciKullaniciId: sahip, setAdi: `stickky_${s.slug}_${ek}`, baslik: `${s.ad} · stickky`, klasor: path.join(tgDiz, s.slug) });
    kayit[s.slug] = { setAdi: r.setAdi, link: r.link, sticker: d.dosyalar.length, tarih: new Date().toISOString() };
    fs.writeFileSync(kayitYol, JSON.stringify(kayit, null, 1));
    kurulan++;
    console.log(`  ✓ ${r.link}`);
  }
  console.log(`\n${setler.length} set · ${donusen} webm üretildi · ${kurulan} Telegram seti kuruldu · ${atlanan} zaten vardı${!token || !sahip ? ' · TOKEN/SAHİP yok, yayın atlandı' : ''}`);
})().catch(e => { console.error(e); process.exit(1); });
