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
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const depo = require('../lib/depo');
const uret = require('../lib/uret');
const donusturLib = require('../lib/donustur');
const sinirlar = require('../lib/sinirlar');
const teslimat = require('../lib/teslimat');
const telegram = require('../lib/telegram');
const kurator = require('../lib/kurator');

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

  // Animasyonlu örnek: ffmpeg varsa gerçek çok kareli GIF; yoksa atlanır
  // (animasyon yolu o zaman kullanıcının makinesinde sınanır).
  if (donusturLib.ffmpegVar()) {
    const animDosya = path.join(medya, 'ornek-anim.gif');
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=0x33c6b5:s=400x300:d=2:r=15',
      '-vf', "drawbox=x='mod(t*150,340)':y=120:w=60:h=60:color=0x12141a:t=fill",
      '-pix_fmt', 'rgb24', animDosya
    ]);
    adaylar.push(animDosya);
  } else {
    console.log('  (ffmpeg yok — animasyon örneği atlandı)');
  }

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

  if (donusturLib.ffmpegVar()) {
    const video = tg.dosyalar.find(d => d.tur === 'video');
    esit('telegram animasyon → webm üretildi', !!video);
    if (video) {
      const boy = fs.statSync(path.join(depo.KOK, 'cikti', set.id, 'telegram', video.dosya)).size;
      esit(`telegram webm ≤256KB (${(boy / 1024).toFixed(0)}KB)`, boy <= sinirlar.telegram.video.azamiBayt);
    }
  }

  console.log('— küratör (kademe 2, havuzdan)');
  const { set: taslak, rapor } = await kurator.taslakSetYap({ kelimeler: 'duman, test' });
  esit('taslak set kuruldu, olusturan=ai', taslak.olusturan === 'ai' && taslak.durum === 'taslak');
  esit('taslakta en az 3 üye (' + taslak.uyeler.length + ')', taslak.uyeler.length >= 3);
  esit('rapor baraj bilgisi taşıyor', rapor.barajGecen >= taslak.uyeler.length);

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
