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
const os = require('os');

// Test GERÇEK veri/ ve cikti/ klasörlerine dokunmaz — geçici bir köke yazar.
// Eskiden yazıyordu ve her koşu havuza dört sahte aday (renkli gülen suratlar)
// ile birkaç sahte set bırakıyordu; gerçek setlerle karışıyordu.
// Bu iki satır lib/* require'larından ÖNCE gelmeli: depo.js kökü yüklenirken
// bir kez okuyor.
const GECICI = fs.mkdtempSync(path.join(os.tmpdir(), 'stickky-test-'));
process.env.STICKKY_VERI = path.join(GECICI, 'veri');
process.env.STICKKY_CIKTI = path.join(GECICI, 'cikti');

const { execFileSync } = require('child_process');
const sharp = require('sharp');
const depo = require('../lib/depo');
const uret = require('../lib/uret');
const donusturLib = require('../lib/donustur');
const sinirlar = require('../lib/sinirlar');
const teslimat = require('../lib/teslimat');
const telegram = require('../lib/telegram');
const kurator = require('../lib/kurator');
const satis = require('../lib/satis');
const vitrin = require('../lib/vitrin');
const indirLib = require('../lib/indir');

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

  // Emoji akışı: ikinci adaya özel emoji ver, raporlara inmesini bekle.
  depo.adayGuncelle(adayIdler[1], { emoji: '🔥' });

  console.log('— telegram üretimi');
  const tg = await uret.uret(set.id, 'telegram');
  esit('telegram: en az 3 dosya', tg.dosyalar.length >= 3);
  for (const d of tg.dosyalar.filter(x => x.tur === 'statik')) {
    const tam = path.join(depo.CIKTI, set.id, 'telegram', d.dosya);
    const boy = fs.statSync(tam).size;
    esit(`telegram ${d.dosya} ≤512KB (${(boy / 1024).toFixed(0)}KB)`, boy <= sinirlar.telegram.statik.azamiBayt);
    const meta = await sharp(tam).metadata();
    esit(`telegram ${d.dosya} bir kenar 512 (${meta.width}×${meta.height})`,
      meta.width === 512 || meta.height === 512);
  }

  esit('emoji telegram raporuna indi',
    tg.dosyalar.some(d => d.emoji === '🔥') && tg.dosyalar.some(d => d.emoji === '🙂'));

  console.log('— wastickers üretimi');
  const wa = await uret.uret(set.id, 'wastickers');
  esit('wastickers paketi oluştu', !!wa.paket);
  esit('emoji wastickers raporuna indi', wa.dosyalar.some(d => d.emoji === '🔥'));
  const paketYolu = path.join(depo.CIKTI, set.id, 'wastickers', wa.paket);
  esit('wastickers ZIP imzası', fs.readFileSync(paketYolu).readUInt32LE(0) === 0x04034b50);
  esit('wastickers en az 3 sticker', wa.dosyalar.length >= sinirlar.whatsapp.setAsgari);

  console.log('— zip üretimi');
  const z = await uret.uret(set.id, 'zip');
  esit('zip paketi oluştu', !!z.paket);

  console.log('— teslimat sayfası');
  const t = teslimat.sayfaUret(set.id);
  esit('teslimat sayfası yazıldı', fs.existsSync(depo.coz(t.dosya)));
  esit('teslimat en az 2 kanal', t.kanallar >= 2);

  if (donusturLib.ffmpegVar()) {
    const video = tg.dosyalar.find(d => d.tur === 'video');
    esit('telegram animasyon → webm üretildi', !!video);
    if (video) {
      const boy = fs.statSync(path.join(depo.CIKTI, set.id, 'telegram', video.dosya)).size;
      esit(`telegram webm ≤256KB (${(boy / 1024).toFixed(0)}KB)`, boy <= sinirlar.telegram.video.azamiBayt);
    }
  }

  console.log('— küratör (kademe 2, havuzdan)');
  const { set: taslak, rapor } = await kurator.taslakSetYap({ kelimeler: 'duman, test' });
  esit('taslak set kuruldu, olusturan=ai', taslak.olusturan === 'ai' && taslak.durum === 'taslak');
  esit('taslakta en az 3 üye (' + taslak.uyeler.length + ')', taslak.uyeler.length >= 3);
  esit('rapor baraj bilgisi taşıyor', rapor.barajGecen >= taslak.uyeler.length);

  console.log('— vitrin görseli');
  const v = await vitrin.vitrinUret(set.id);
  const vitrinTam = depo.coz(v.dosya);
  const vitrinMeta = await sharp(vitrinTam).metadata();
  esit('vitrin 1200×630 PNG', vitrinMeta.width === 1200 && vitrinMeta.height === 630);

  console.log('— özel kapak (havuzdan seçilen)');
  depo.setGuncelle(set.id, { kapak: { tur: 'aday', adayId: adayIdler[1] } });
  const v2 = await vitrin.vitrinUret(set.id);
  esit('özel kapak kaynağı aday', v2.kaynak === 'aday');
  const v2meta = await sharp(depo.coz(v2.dosya)).metadata();
  esit('özel kapak 1200×630', v2meta.width === 1200 && v2meta.height === 630);
  depo.setGuncelle(set.id, { kapak: null });

  if (donusturLib.ffmpegVar()) {
    // 2026-08-16'da "Ofis Hayatı" setinde iki sessiz arıza çıktı; ikisi de
    // hata vermeden sticker kaybediyordu. Aşağısı ikisini de kilitler.

    console.log('— uzun animasyon: kare bütçesi (whatsapp)');
    const uzunGif = path.join(depo.VERI, 'medya', 'uzun-anim.gif');
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=0xe86c6c:s=360x360:d=14:r=20',
      '-vf', "drawbox=x='mod(t*120,300)':y=150:w=60:h=60:color=0x12141a:t=fill",
      '-pix_fmt', 'rgb24', uzunGif
    ]);
    const uzunMeta = await sharp(uzunGif).metadata();
    esit('örnek gerçekten uzun (' + uzunMeta.pages + ' kare)', uzunMeta.pages > 200);
    const wr = await donusturLib.whatsappAnimasyon(uzunGif);
    esit('uzun animasyon sınıra sığdırıldı (' + (wr.veri.length / 1024).toFixed(0) + 'KB)',
      wr.veri.length <= sinirlar.whatsapp.animasyonAzamiBayt);
    esit('sığdırmak için kare kırpıldı (' + wr.kare + '/' + wr.toplamKare + ')',
      wr.kare < wr.toplamKare);

    console.log('— vitrin: yalnız animasyonlu set');
    const animAday = depo.adayEkle({
      kaynak: 'elle', medyaUrl: 'https://ornek.local/uzun.gif', etiketler: ['duman']
    }).aday;
    depo.adayGuncelle(animAday.id, { dosya: 'veri/medya/uzun-anim.gif', durum: 'indirildi' });
    const animSet = depo.setOlustur({ ad: 'Duman Testi Seti', olusturan: 'elle' });
    depo.setGuncelle(animSet.id, { ekle: [animAday.id] });
    await uret.uret(animSet.id, 'telegram');
    const tgKlasor = path.join(depo.CIKTI, animSet.id, 'telegram');
    esit('animasyonlu sette statik .webp üretilmiyor',
      !fs.readdirSync(tgKlasor).some(f => f.endsWith('.webp')));
    const av = await vitrin.vitrinUret(animSet.id);   // eskiden burada düşüyordu
    const avMeta = await sharp(depo.coz(av.dosya)).metadata();
    esit('vitrin animasyonun ilk karesinden üretildi', avMeta.width === 1200 && avMeta.height === 630);
    esit('vitrin sayısı setin üye sayısı (ızgara örneği değil)', av.sticker === 1);

    console.log('— teslimat önizlemesi: yalnız animasyonlu set');
    // Asgari üye sayısı için sete iki statik üye daha kat.
    depo.setGuncelle(animSet.id, { ekle: adayIdler.slice(0, 2) });
    const wr2 = await uret.uret(animSet.id, 'wastickers');
    esit('wastickers tek tek dosyaları diske yazıyor',
      wr2.dosyalar.every(d => fs.existsSync(
        path.join(depo.CIKTI, animSet.id, 'wastickers', d.dosya))));
    const at = teslimat.sayfaUret(animSet.id);
    const govde = fs.readFileSync(depo.coz(at.dosya), 'utf8');
    const dugmeSayisi = (govde.match(/class="stk"/g) || []).length;
    // Eskiden 0 çıkıyordu: alıcı "bir sticker'a dokun" yazısını görüp
    // tek sticker göremiyordu.
    esit('önizleme ızgarası dolu (' + dugmeSayisi + ' düğme)',
      dugmeSayisi === wr2.dosyalar.length && dugmeSayisi > 0);
    esit('önizleme diskteki dosyalara işaret ediyor',
      /data-src="wastickers\/\d+\.webp"/.test(govde));
  }

  console.log('— satış linki + gumroad benzetimi');
  const elle = satis.tokenUret(set.id, 'elle');
  const acilis = satis.tokenAc(elle.token);
  esit('elle token teslimat sayfası döndürüyor', acilis && acilis.govde.includes(set.ad));
  esit('açılış sayacı işledi', satis.liste().find(k => k.token === elle.token).acilis === 1);

  fs.mkdirSync(depo.VERI, { recursive: true });
  fs.writeFileSync(path.join(depo.VERI, 'urunler.json'),
    JSON.stringify({ 'duman-urunu': set.id }));
  const g1 = satis.gumroadIsle({ product_permalink: 'duman-urunu', email: 'test@ornek.local' });
  esit('gumroad eşleşen ürün token üretti', g1.eslesme === true && !!g1.token);
  const g2 = satis.gumroadIsle({ product_permalink: 'bilinmeyen' });
  esit('gumroad bilinmeyen ürün 200/ok ama eşleşme yok', g2.ok === true && g2.eslesme === false);

  console.log('— paddle webhook benzetimi');
  const crypto = require('crypto');
  fs.writeFileSync(path.join(depo.VERI, 'urunler.json'),
    JSON.stringify({ 'duman-urunu': set.id, 'pro_duman123': set.id }));
  const paddleGovde = JSON.stringify({
    event_type: 'transaction.completed',
    data: { id: 'txn_test1', items: [{ price: { product_id: 'pro_duman123' } }] }
  });
  process.env.PADDLE_WEBHOOK_SECRET = 'test-sirri';
  const ts = '1755000000';
  const h1 = crypto.createHmac('sha256', 'test-sirri').update(ts + ':' + paddleGovde).digest('hex');
  const p1 = satis.paddleIsle(paddleGovde, `ts=${ts};h1=${h1}`);
  esit('paddle imzalı işlem token üretti', p1.eslesme === true && p1.imza === 'dogrulandi' && !!p1.token);
  let paddleRed = false;
  try { satis.paddleIsle(paddleGovde, `ts=${ts};h1=${'0'.repeat(64)}`); } catch { paddleRed = true; }
  esit('paddle bozuk imza reddedildi', paddleRed);
  const p2 = satis.paddleIsle(JSON.stringify({ event_type: 'invoice.paid', data: {} }),
    `ts=${ts};h1=${crypto.createHmac('sha256', 'test-sirri').update(ts + ':' + JSON.stringify({ event_type: 'invoice.paid', data: {} })).digest('hex')}`);
  esit('ilgisiz olay atlandı', p2.atlandi === 'invoice.paid');
  const abone = require('../lib/abone');
  const imzala = (govde) =>
    `ts=${ts};h1=${crypto.createHmac('sha256', 'test-sirri').update(ts + ':' + govde).digest('hex')}`;
  const aktifOlay = JSON.stringify({
    event_type: 'subscription.activated',
    data: { id: 'sub_duman1', customer_id: 'ctm_x' }
  });
  const a1 = satis.paddleIsle(aktifOlay, imzala(aktifOlay));
  esit('abonelik aktive edildi', a1.abonelik === 'sub_duman1' && abone.aktifMi('sub_duman1'));
  const iptalOlay = JSON.stringify({
    event_type: 'subscription.canceled',
    data: { id: 'sub_duman1' }
  });
  satis.paddleIsle(iptalOlay, imzala(iptalOlay));
  esit('abonelik iptali işlendi', !abone.aktifMi('sub_duman1'));
  delete process.env.PADDLE_WEBHOOK_SECRET;

  console.log('— indirme doğrulaması (kılık değiştirmiş dosya)');
  const sahte = path.join(depo.VERI, 'medya', 'sahte.gif');
  fs.writeFileSync(sahte, 'bu bir görsel değil, düz metin');
  let yakalandi = false;
  try { await indirLib.dogrula(sahte, '.gif'); } catch { yakalandi = true; }
  esit('görsel olmayan içerik reddedildi', yakalandi);
  esit('sahte dosya diskten silindi', !fs.existsSync(sahte));

  console.log('— canlı paket sayfası + mağaza');
  const canli = satis.tokenAc(elle.token);
  esit('canlı sayfada paylaşılabilir sticker ızgarası var', canli.govde.includes('class="stk"'));
  const magaza = require('../lib/magaza');
  depo.setGuncelle(set.id, { durum: 'yayinda' });
  const mg = magaza.sayfaUret();
  const magazaGovde = fs.readFileSync(path.join(depo.CIKTI, 'magaza.html'), 'utf8');
  esit('mağaza yayındaki seti listeliyor', mg.yayinda >= 1 && magazaGovde.includes(set.ad));
  esit('satış linki yokken "Yakında" görünüyor', magazaGovde.includes('Yakında'));
  depo.setGuncelle(set.id, { satisUrl: 'https://ornek.paddle.com/checkout/x' });
  magaza.sayfaUret();
  esit('satış linki bağlanınca düğme çıkıyor',
    fs.readFileSync(path.join(depo.CIKTI, 'magaza.html'), 'utf8').includes('Satın al'));

  console.log('— otonom küratör (izleme listesi)');
  const otonom = require('../lib/otonom');
  otonom.ekle('duman');
  const o1 = await otonom.calistir();
  esit('onay bekleyen taslak varken atlıyor',
    o1.sonuclar[0].atlandi === 'onay bekleyen taslak var');
  const bekleyenTaslakId = o1.sonuclar[0].setId;
  depo.setGuncelle(bekleyenTaslakId, { durum: 'onayli' });
  const o2 = await otonom.calistir();
  esit('taslak onaylanınca yeni taslak üretiyor', !!o2.sonuclar[0].setId);
  const yeniTaslak = depo.setBul(o2.sonuclar[0].setId);
  esit('otonom taslak: olusturan=ai, durum=taslak',
    yeniTaslak.olusturan === 'ai' && yeniTaslak.durum === 'taslak');
  otonom.sil('duman');

  console.log('— bot işleyicileri (saf, ağsız)');
  const bot = require('../lib/bot');
  esit('/start komutlar sayıyor', bot.islet({ text: '/start' }).includes('/paket'));
  esit('/paket geçerli token linki veriyor',
    bot.islet({ text: '/paket ' + elle.token }).includes('/t/' + elle.token));
  esit('/paket bozuk kod nazikçe reddediliyor',
    bot.islet({ text: '/paket kotu-kod' }).includes('tanınmadı'));
  abone.kaydet('sub_bot1', 'aktif');
  fs.writeFileSync(path.join(depo.VERI, 'bot.json'),
    JSON.stringify({ trendSetLinki: 'https://t.me/addstickers/ornek_trend' }));
  esit('/trend aktif aboneye link veriyor',
    bot.islet({ text: '/trend sub_bot1' }).includes('addstickers'));
  abone.kaydet('sub_bot1', 'iptal');
  esit('/trend iptal aboneyi reddediyor',
    bot.islet({ text: '/trend sub_bot1' }).includes('aktif görünmüyor'));

  console.log('— trend seti eşitleme (kuru çalışma)');
  const trendPlan = await telegram.trendEsitle({
    setAdi: 'trend', botKullaniciAdi: 'ornek_bot',
    klasor: path.join(depo.CIKTI, set.id, 'telegram')
  });
  esit('trend planı yeni set + eklemeler içeriyor',
    trendPlan.kuru && trendPlan.setYeniMi && trendPlan.eklenecek.length >= 3);

  console.log('— telegram kuru çalışma');
  const kuru = await telegram.setKur({
    setAdi: set.ad, botKullaniciAdi: 'ornek_bot',
    klasor: path.join(depo.CIKTI, set.id, 'telegram')
  });
  esit('kuru çalışma link üretti', kuru.kuru && kuru.link.includes('t.me/addstickers/'));
  esit('set adı _by_ kuralına uyuyor', kuru.setAdi.endsWith('_by_ornek_bot'));
  esit('kuru çalışma adımları emojiyi taşıyor', kuru.adimlar.some(a => a.emoji === '🔥'));

  // Eklenti kuralları tarayıcıda çalışır ama saf fonksiyonlar; vm ile
  // yüklenip ağsız sınanır. Gerekçe: 2026-08-16'da Giphy adres biçimini
  // değiştirdi (/media/v1.<jeton>/<kimlik>/) ve eski desen sessizce
  // 200px önizlemeye düştü — hata vermediği için fark edilmedi.
  console.log('— eklenti kuralları (tarayıcısız)');
  const vm = require('vm');
  const kuralYukle = (dosya, konum) => {
    const ctx = { window: {}, location: konum };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'eklenti', dosya), 'utf8'), ctx);
    return ctx.window.__havuzKurali;
  };

  const gKural = kuralYukle('giphy.js', { pathname: '/search/meme', search: '' });
  const yeniBicim = 'https://media3.giphy.com/media/v1.Y2lkPWFiYw/ACPNoXnjkdB0FGZG9U/200.webp';
  esit('giphy yeni biçimden kimliği çıkarıyor',
    gKural.medyaUrl({ src: yeniBicim }) === 'https://i.giphy.com/ACPNoXnjkdB0FGZG9U.gif');
  esit('giphy 200px önizlemeye düşmüyor',
    !gKural.medyaUrl({ src: yeniBicim }).includes('200.webp'));
  esit('giphy eski biçim hâlâ çalışıyor',
    gKural.medyaUrl({ src: 'https://media2.giphy.com/media/RXKCMLmch5W2Q/giphy.gif' })
      === 'https://i.giphy.com/RXKCMLmch5W2Q.gif');
  esit('giphy alakasız görseli tanımıyor',
    !gKural.uygunMu({ src: 'https://example.com/kedi.png' }));

  const pKural = kuralYukle('pinterest.js', { pathname: '/', search: '?q=meme' });
  esit('pinterest originals yükseltmesi',
    pKural.medyaUrl({ src: 'https://i.pinimg.com/236x/ab/cd/ef.jpg' })
      === 'https://i.pinimg.com/originals/ab/cd/ef.jpg');

  console.log('\nDUMAN TESTİ GEÇTİ — set: ' + set.id);
  // Geçici kök yalnız başarıda silinir; düşerse çıktılar incelensin diye durur.
  fs.rmSync(GECICI, { recursive: true, force: true });
})().catch(e => {
  console.error('\nDUMAN TESTİ DÜŞTÜ: ' + e.message);
  console.error('Geçici çıktılar duruyor: ' + GECICI);
  process.exit(1);
});
