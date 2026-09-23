'use strict';
/**
 * Bir inceleme dosyasının BELİRLİ BÖLÜMÜNDEN üretim planı çıkarır.
 * (Tüm dosyayı yeniden okumak eski numaralandırmaya dayandığı için riskli;
 *  bu araç yalnız istenen başlıktan sonrasını okur.)
 *
 *   node arac/inceleme-plan.js --dosya veri/giphy/inceleme2/_sahipsiz2.md \
 *        --baslik "Ek: atlanan sayfaların taranması" --kanal _sahipsiz2 \
 *        --cikti arac/planlar/ek-1.json
 *
 * Satır biçimi: | no(lar) | başlık | duygu | mekanizma | cümle | kullanım |
 * Yalnız ✅ satırları alınır; cümle hücresi tırnak/not içeriyorsa temizlenir.
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const dosya = path.resolve(sec('--dosya', ''));
const baslik = sec('--baslik', '');
const kanal = sec('--kanal', '');
const cikti = path.resolve(sec('--cikti', path.join(KOK, 'arac', 'planlar', 'ek-1.json')));

const metin = fs.readFileSync(dosya, 'utf8');
const bas = baslik ? metin.indexOf(baslik) : 0;
if (bas < 0) { console.error('başlık bulunamadı: ' + baslik); process.exit(1); }
const TR = /[\u015f\u011f\u0131\u00f6\u00fc\u00e7\u015e\u011e\u0130\u00d6\u00dc\u00c7]/;

function cumleTemizle(h) {
  let t = String(h || '').trim();
  if (/yazısız/i.test(t)) return '';
  if (TR.test(t)) return '';
  if (/\bmetin\b|\btabela\b/i.test(t)) return '';
  if (/^[:;][()DPo3]$/i.test(t)) return t;
  if (/^\[[a-z ]+\]$/i.test(t)) return t;
  t = t.split(/["']\s*\/|\s*\(/)[0].trim();
  t = t.replace(/^["'\\]+/, '').replace(/["'\\]+$/, '').trim();
  if (t === '\u2026' || t === '...' || t === '—') return '';
  return t.length > 32 ? '' : t;
}

const plan = [];
for (const satir of metin.slice(bas).split('\n')) {
  if (!/^\| *[\d,\- ]+ *\|/.test(satir) || !/✅/.test(satir)) continue;
  const h = satir.split('|').map(s => s.trim());
  const nolar = [];
  for (const p of h[1].split(',')) {
    const m = p.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    for (let i = Number(m[1]); i <= Number(m[2] || m[1]); i++) nolar.push(i);
  }
  const cumle = cumleTemizle(h[5]);
  for (const no of nolar) plan.push({ kanal, no, metin: cumle });
}
fs.mkdirSync(path.dirname(cikti), { recursive: true });
fs.writeFileSync(cikti, JSON.stringify(plan, null, 1));
console.log(`${plan.length} satır (${plan.filter(p => p.metin).length} cümleli) → ${cikti}`);
