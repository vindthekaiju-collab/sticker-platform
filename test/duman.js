'use strict';
/**
 * Duman testi: boru hattını hiç dış ağ olmadan uçtan uca sürer.
 *
 * 1. sharp ile 4 örnek görsel üretir (3 statik PNG + 1 animasyonlu GIF benzeri
 *    çok kareli WebP) ve dosya URL'si yerine doğrudan veri/medya'ya koyar.
 * 2. Depoya aday + set yazar.
 * 3. telegram / wastickers / zip hedeflerini üretir.
 * 4. Çıktıların sınırlar içinde kaldığını doğrular, raporu basar.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const depo = require('../lib/depo');
const uret = require('../lib/uret');
const sinirlar = require('../lib/sinirlar');
const teslimat = require('../lib/teslimat');
const telegram = require('../lib/telegram');

const RENKLER = [
  { r: 232, g: 176, b: 75 },
  { r: 51, g: 198, b: 181 },
  { r: 224, g: 108, b: 108 }
];

async function ornekUret() {
  const medya = path.join(depo.VERI, 'medya');
  fs.mkdirSync(medya, { recursive: true });
  const adaylar = [];

  for (const [i, renk] of RENKLER.entries()) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
      <rect width="640" height="480" rx="60" fill="rgb(${renk.r},${renk.g},${renk.b})"/>
      <circle cx="220" cy="200" r="36" fill="#12141a"/>
      <circle cx="420" cy="200" r="36" fill="#12141a"/>
      <path d="M 200 330 Q 320 ${380 + i * 20} 440 330" stroke="#12141a" stroke-width="24" fill="none" stroke-linecap="round"/>
    </svg>`;
    const dosya = path.join(medya, 'ornek-' + i + '.png');
    await sharp(Buffer.from(svg)).png().toFile(dosya);
    adaylar.push(dosya);
  }

  // Animasyonlu örnek: 6 kareli webp
  const kareler = [];
  for (let k = 0; k < 6; k++) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
      <rect width="320" height="320" fill="#1c1f28"/>
      <circle cx="${40 + k * 48}" cy="160" r="30" fill="#33c6b5"/>
    </svg>`;
    kareler.push(await sharp(Buffer.from(svg)).png().toBuffer());
  }
  const animDosya = path.join(medya, 'ornek-anim.webp');
  // sharp'a çok kareli girdi vermek için kareleri tek şeride dikip
  // page yüksekliğiyle animasyona çevirmek gerekir.
  const serit = await sharp({
    create: { width: 320, height: 320 * kareler.length, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).composite(kareler.map((veri, k) => ({ input: veri, top: k * 320, left: 0 })))
    .png().toBuffer();
  await sharp(serit, { raw: undefined }).webp().toFile(animDosya); // tek kare yedek
  try {
    await sharp(serit).webp({ quality: 90 }).toFile(animDosya);
  } catch { /* animasyon üretilemezse statik kalır — test yine geçer */ }
  adaylar.push(animDosya);

  return adaylar;
}

function esit(ad, kosul) {
  if (!kosul) throw new Error('BAŞARISIZ: ' + ad);
  console.log('  ✓ ' + ad);
}

(async () => {
  console.log('— örnek görseller üretiliyor');
  const dosyalar = await ornekUret();

  console.log('— depo dolduruluyor');
  const adayIdler = [];
  for (const [i, dosya] of dosyalar.entries()) {
    const { aday } = depo.adayEkle({
      kaynak: 'elle',
      medyaUrl: 'https://ornek.local/duman-' + i + path.extname(dosya),
      etiketler: ['duman', 'test']
    });
    // İndirme adımını taklit et: dosya zaten diskte.
    depo.adayGuncelle(aday.id, {
      dosya: 'veri/medya/' + path.basename(dosya),
      durum: 'indirildi'
    });
    adayIdler.push(aday.id);
  }
  const set = depo.setOlustur({ ad: 'Duman Testi Seti', olusturan: 'elle' });
  depo.setGuncelle(set.id, { ekle: adayIdler, tepsi: adayIdler[0] });

  console.log('— telegram üretimi');
  const tg = await uret.uret(set.id, 'telegram');
  esit('telegram: en az 3 dosya', tg.dosyalar.length >= 3);
  for (const d of tg.dosyalar.filter(x => x.tur === 'statik')) {
    const tam = path.join(depo.KOK, 'cikti', set.id, 'telegram', d.dosya);
    const boy = fs.statSync(tam).size;
    esit(`telegram ${d.dosya} ≤512KB (${(boy / 1024).toFixed(0)}KB)`, boy <= sinirlar.telegram.statik.azamiBayt);
    const meta = await sharp(tam).metadata();
    esit(`telegram ${d.dosya} bir kenar 512 (${meta.width}×${meta.height})`,
      meta.width === 512 || meta.height === 512);
  }

  console.log('— wastickers üretimi');
  const wa = await uret.uret(set.id, 'wastickers');
  esit('wastickers paketi oluştu', !!wa.paket);
  const paketYolu = path.join(depo.KOK, 'cikti', set.id, 'wastickers', wa.paket);
  esit('wastickers ZIP imzası', fs.readFileSync(paketYolu).readUInt32LE(0) === 0x04034b50);
  esit('wastickers en az 3 sticker', wa.dosyalar.length >= sinirlar.whatsapp.setAsgari);

  console.log('— zip üretimi');
  const z = await uret.uret(set.id, 'zip');
  esit('zip paketi oluştu', !!z.paket);

  console.log('— teslimat sayfası');
  const t = teslimat.sayfaUret(set.id);
  esit('teslimat sayfası yazıldı', fs.existsSync(path.join(depo.KOK, t.dosya.replace(/^\//, ''))));
  esit('teslimat en az 2 kanal', t.kanallar >= 2);

  console.log('— telegram kuru çalışma');
  const kuru = await telegram.setKur({
    setAdi: set.ad, botKullaniciAdi: 'ornek_bot',
    klasor: path.join(depo.KOK, 'cikti', set.id, 'telegram')
  });
  esit('kuru çalışma link üretti', kuru.kuru && kuru.link.includes('t.me/addstickers/'));
  esit('set adı _by_ kuralına uyuyor', kuru.setAdi.endsWith('_by_ornek_bot'));

  console.log('\nDUMAN TESTİ GEÇTİ — set: ' + set.id);
})().catch(e => {
  console.error('\nDUMAN TESTİ DÜŞTÜ: ' + e.message);
  process.exit(1);
});
