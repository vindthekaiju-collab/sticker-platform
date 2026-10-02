'use strict';
/**
 * Vitrin paketlerini kasaya (KV) yükler — TOPLU.
 *     node kasa/yukle.js [--kuru] [--yalniz <slug>]
 *
 * Anahtarlar: paket:<slug>.wastickers, paket:<slug>.zip (ikili, base64 ile
 * taşınır), meta:<slug> (JSON: ad, desc, sticker, sha).
 *
 * Neden toplu: tek tek `kv key put` her dosyada npx+wrangler başlatıyor,
 * 94 dosya ≈ 90 dk sürüyordu (2026-10-02'de ölçüldü, 12 dosyada durduruldu).
 * `kv bulk put` bir JSON dosyasıyla yüzlerce çifti tek istekte alır; paketler
 * ~65 MB'lık (base64 sonrası ~87 MB) partilere bölünür.
 *
 * Yüklenenin kaydı yerelde: kasa/yuklenen.json (slug → sha). Aynı sha
 * yeniden yüklenmez (KV Free günde 1.000 yazma).
 * Raftaki setler yüklenmez. wrangler OAuth ile çalışır: env'deki
 * CLOUDFLARE_API_TOKEN KV'ye yetkisiz (makine tuzağı: `env -u`).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const kuru = argv.includes('--kuru');
const yalniz = argv.includes('--yalniz') ? argv[argv.indexOf('--yalniz') + 1] : null;
const PARTI_BAYT = 65 * 1024 * 1024;
const toml = fs.readFileSync(path.join(__dirname, 'wrangler.toml'), 'utf8');
const kvId = (toml.match(/^id\s*=\s*"([^"]+)"/m) || [])[1];
if (!kvId || kvId === 'KV_ID_BURAYA') { console.error('wrangler.toml içinde KV id yok — önce `wrangler kv namespace create PAKET`'); process.exit(1); }

const kayitYol = path.join(__dirname, 'yuklenen.json');
const yuklenen = fs.existsSync(kayitYol) ? JSON.parse(fs.readFileSync(kayitYol, 'utf8')) : {};
const ortam = { ...process.env };
delete ortam.CLOUDFLARE_API_TOKEN;
const sha = d => crypto.createHash('sha256').update(fs.readFileSync(d)).digest('hex').slice(0, 16);

const setler = JSON.parse(fs.readFileSync(path.join(KOK, 'cikti', 'setler', 'setler.json'), 'utf8')).filter(s => !s.raf && (!yalniz || s.slug === yalniz));
const rapor = JSON.parse(fs.readFileSync(path.join(KOK, 'cikti', 'paketler', 'rapor.json'), 'utf8'));
// Telegram set bağlantıları (arac/telegram-yayinla.js yazdı) → meta.telegram
const tgYol = path.join(KOK, 'cikti', 'setler', 'telegram.json');
const tg = fs.existsSync(tgYol) ? JSON.parse(fs.readFileSync(tgYol, 'utf8')) : {};

// 1) ne yüklenecek
const isler = [];   // { slug, meta, dosyalar:[{bicim, yol, bayt}] }
let atlanan = 0;
for (const s of setler) {
  const r = rapor.find(x => x.slug === s.slug) || {};
  const dosyalar = ['wastickers', 'zip'].map(b => ({ bicim: b, yol: path.join(KOK, 'cikti', 'paketler', `${s.slug}.${b}`) }));
  if (dosyalar.some(d => !fs.existsSync(d.yol))) { console.log(`  ! ${s.slug}: paket dosyası eksik, atlandı`); continue; }
  const meta = { ad: s.ad, desc: s.desc, sticker: r.sticker || s.adet, telegram: (tg[s.slug] && tg[s.slug].link) || null, sha: Object.fromEntries(dosyalar.map(d => [d.bicim, sha(d.yol)])) };
  const eski = yuklenen[s.slug];
  const degisen = dosyalar.filter(d => !eski || !eski.sha || eski.sha[d.bicim] !== meta.sha[d.bicim]).map(d => ({ ...d, bayt: fs.statSync(d.yol).size }));
  if (!degisen.length && eski && JSON.stringify(eski) === JSON.stringify(meta)) { atlanan++; continue; }
  isler.push({ slug: s.slug, meta, dosyalar: degisen });
}

// 2) partilere böl ve gönder
const partiler = [];
let parti = [], partiBayt = 0;
for (const is of isler) {
  const b = is.dosyalar.reduce((a, d) => a + d.bayt, 0);
  if (parti.length && partiBayt + b > PARTI_BAYT) { partiler.push(parti); parti = []; partiBayt = 0; }
  parti.push(is); partiBayt += b;
}
if (parti.length) partiler.push(parti);

const gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'stickky-kv-'));
let yazma = 0;
for (const [i, p] of partiler.entries()) {
  const ciftler = [];
  for (const is of p) {
    for (const d of is.dosyalar) {
      ciftler.push({ key: `paket:${is.slug}.${d.bicim}`, value: fs.readFileSync(d.yol).toString('base64'), base64: true });
    }
    ciftler.push({ key: `meta:${is.slug}`, value: JSON.stringify(is.meta) });
  }
  const dosya = path.join(gecici, `parti-${i + 1}.json`);
  fs.writeFileSync(dosya, JSON.stringify(ciftler));
  const mb = Math.round(fs.statSync(dosya).size / 1024 / 1024);
  console.log(`parti ${i + 1}/${partiler.length}: ${p.length} set · ${ciftler.length} çift · ${mb} MB${kuru ? ' (kuru)' : ''}`);
  if (!kuru) {
    execFileSync('npx', ['-y', 'wrangler', 'kv', 'bulk', 'put', dosya, '--namespace-id', kvId, '--remote'],
      { cwd: __dirname, env: ortam, stdio: 'inherit', shell: process.platform === 'win32' });
    for (const is of p) yuklenen[is.slug] = is.meta;
    fs.writeFileSync(kayitYol, JSON.stringify(yuklenen, null, 1));
  }
  yazma += ciftler.length;
  fs.rmSync(dosya, { force: true });
}
fs.rmSync(gecici, { recursive: true, force: true });
console.log(`${setler.length} set · ${isler.length} güncellendi · ${yazma} yazma${kuru ? ' (kuru)' : ''} · ${atlanan} atlandı`);
