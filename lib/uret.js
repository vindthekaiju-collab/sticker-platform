'use strict';
/**
 * Set düzeyinde üretim: bir seti alır, üyelerini indirir, istenen hedefin
 * paketini cikti/<setId>/ altına çıkarır ve sete rapor yazar.
 *
 * Hedefler: 'telegram' | 'wastickers' | 'zip'
 * Kısmi başarı gizlenmez: her üye için ne olduğu raporda tek tek durur.
 */

const fs = require('fs');
const path = require('path');
const depo = require('./depo');
const indir = require('./indir');
const donustur = require('./donustur');
const zip = require('./zip');
const sinirlar = require('./sinirlar');

/* Seyrek (neredeyse boş) üyeler için uyarı satırları. Hata değil: sticker
   üretiliyor, ama kullanıcı bilerek karar versin. */
function seyrekUyarilari(uyeler) {
  return uyeler
    .filter(u => u.sonuc === 'hazir' && typeof u.doluluk === 'number'
                 && u.doluluk < sinirlar.seyrekEsigi)
    .map(u => ({
      adayId: u.adayId, sonuc: 'uyari',
      neden: 'neredeyse boş görsel (%' + (u.doluluk * 100).toFixed(1) +
             ' dolu) — sohbette boş sticker gibi görünebilir'
    }));
}

function ciktiKlasoru(setId, hedef) {
  const k = path.join(depo.CIKTI, setId, hedef);
  fs.mkdirSync(k, { recursive: true });
  return k;
}

function guvenliAd(s) {
  return s.toLowerCase()
    .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİiI]/g, 'i')
    .replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'set';
}

async function uyeleriHazirla(set) {
  const uyeler = [];
  for (const adayId of set.uyeler) {
    const aday = depo.adayBul(adayId);
    if (!aday) { uyeler.push({ adayId, sonuc: 'hata', neden: 'aday silinmiş' }); continue; }
    try {
      const guncel = await indir.adayIndir(adayId);
      const tam = depo.coz(guncel.dosya);
      const bilgi = await donustur.girdiOku(tam);
      const doluluk = await donustur.doluluk(tam);
      uyeler.push({
        adayId, dosya: tam, animasyonlu: bilgi.animasyonlu, doluluk,
        emoji: guncel.emoji || '🙂', sonuc: 'hazir'
      });
    } catch (e) {
      uyeler.push({ adayId, sonuc: 'hata', neden: e.message });
    }
  }
  return uyeler;
}

async function telegramUret(set) {
  const klasor = ciktiKlasoru(set.id, 'telegram');
  const uyeler = await uyeleriHazirla(set);
  const rapor = { hedef: 'telegram', dosyalar: [], hatalar: seyrekUyarilari(uyeler), zaman: new Date().toISOString() };

  let sira = 0;
  for (const u of uyeler) {
    if (u.sonuc !== 'hazir') { rapor.hatalar.push(u); continue; }
    sira++;
    try {
      const emoji = u.emoji;
      if (u.animasyonlu) {
        const cikti = path.join(klasor, String(sira).padStart(2, '0') + '.webm');
        donustur.telegramVideo(u.dosya, cikti);
        rapor.dosyalar.push({ adayId: u.adayId, dosya: path.basename(cikti), tur: 'video', emoji });
      } else {
        const { veri } = await donustur.telegramStatik(u.dosya);
        const cikti = path.join(klasor, String(sira).padStart(2, '0') + '.webp');
        fs.writeFileSync(cikti, veri);
        rapor.dosyalar.push({ adayId: u.adayId, dosya: path.basename(cikti), tur: 'statik', emoji });
      }
    } catch (e) {
      rapor.hatalar.push({ adayId: u.adayId, sonuc: 'hata', neden: e.message });
    }
  }

  fs.writeFileSync(path.join(klasor, 'rapor.json'), JSON.stringify(rapor, null, 2));
  depo.setGuncelle(set.id, { ciktilar: { telegram: rapor } });
  return rapor;
}

async function wastickersUret(set) {
  const w = sinirlar.whatsapp;
  const klasor = ciktiKlasoru(set.id, 'wastickers');
  const uyeler = await uyeleriHazirla(set);
  const hazirlar = uyeler.filter(u => u.sonuc === 'hazir');
  const rapor = { hedef: 'wastickers', dosyalar: [], hatalar: [...uyeler.filter(u => u.sonuc !== 'hazir'), ...seyrekUyarilari(uyeler)], zaman: new Date().toISOString() };

  if (hazirlar.length < w.setAsgari) {
    throw new Error(`WhatsApp paketi en az ${w.setAsgari} sticker ister; hazır üye: ${hazirlar.length}`);
  }
  // Paket ya tümüyle statik ya tümüyle animasyonlu — karışıksa çoğunluğa uy,
  // azınlığı statikleştir (animasyonun ilk karesi) ve bunu raporda söyle.
  const animasyonluMu = hazirlar.filter(u => u.animasyonlu).length > hazirlar.length / 2;

  const girdiler = [];
  let sira = 0;
  for (const u of hazirlar.slice(0, w.setAzami)) {
    sira++;
    try {
      let sonuc;
      if (animasyonluMu && u.animasyonlu) {
        sonuc = await donustur.whatsappAnimasyon(u.dosya);
      } else {
        sonuc = await donustur.whatsappStatik(u.dosya);
        if (animasyonluMu && !u.animasyonlu) {
          rapor.hatalar.push({ adayId: u.adayId, sonuc: 'uyari', neden: 'animasyonlu pakette statik üye' });
        }
        if (!animasyonluMu && u.animasyonlu) {
          rapor.hatalar.push({ adayId: u.adayId, sonuc: 'uyari', neden: 'statik pakete ilk kare alındı' });
        }
      }
      const ad = String(sira).padStart(2, '0') + '.webp';
      girdiler.push({ ad, veri: sonuc.veri });
      /* Telegram hedefi tek tek dosyaları diske yazıyor, bu hedef yalnız
         paketi yazıyordu. Tutarsızlık teslimat sayfasında patladı: önizleme
         ızgarası bu webp'lere işaret ediyor ama dosyalar diskte yoktu, alıcı
         kırık görsel görüyordu (2026-08-16). Paket zaten bellekteki aynı
         veriden kuruluyor; diske yazmak kopya üretmiyor, sadece görünür
         kılıyor — hata ayıklamada da işe yarıyor. */
      fs.writeFileSync(path.join(klasor, ad), sonuc.veri);
      rapor.dosyalar.push({ adayId: u.adayId, dosya: ad, emoji: u.emoji });
    } catch (e) {
      rapor.hatalar.push({ adayId: u.adayId, sonuc: 'hata', neden: e.message });
    }
  }
  if (girdiler.length < w.setAsgari) {
    throw new Error('dönüşüm sonrası ' + girdiler.length + ' sticker kaldı; asgari ' + w.setAsgari);
  }

  // Tepsi ikonu: seçilmişse o üye, değilse ilk üye.
  const tepsiKaynak = (set.tepsi && hazirlar.find(u => u.adayId === set.tepsi)) || hazirlar[0];
  const tepsi = await donustur.tepsiUret(tepsiKaynak.dosya);
  girdiler.push({ ad: 'tray.png', veri: tepsi });

  /* .wastickers düzeni: Sticker Maker uygulamalarının geleneği —
     title.txt + author.txt + tray + webp'ler. DOĞRULANMADI (bkz. sinirlar.js);
     ilk telefonda içe aktarma testi bunu sınar. contents.json da eklenir:
     ileride kendi uygulamamız resmî WhatsApp düzenini bundan okur. */
  girdiler.push({ ad: 'title.txt', veri: Buffer.from(set.ad, 'utf8') });
  girdiler.push({ ad: 'author.txt', veri: Buffer.from('sticker-platform', 'utf8') });
  girdiler.push({
    ad: 'contents.json',
    veri: Buffer.from(JSON.stringify({
      identifier: set.id,
      name: set.ad,
      publisher: 'sticker-platform',
      tray_image_file: 'tray.png',
      animated_sticker_pack: animasyonluMu,
      stickers: rapor.dosyalar.map(d => ({ image_file: d.dosya, emojis: [d.emoji || '🙂'] }))
    }, null, 2), 'utf8')
  });

  const paket = zip.zipYap(girdiler);
  const dosyaAdi = guvenliAd(set.ad) + '.wastickers';
  fs.writeFileSync(path.join(klasor, dosyaAdi), paket);
  rapor.paket = dosyaAdi;
  rapor.animasyonlu = animasyonluMu;

  fs.writeFileSync(path.join(klasor, 'rapor.json'), JSON.stringify(rapor, null, 2));
  depo.setGuncelle(set.id, { ciktilar: { wastickers: rapor } });
  return rapor;
}

async function zipUret(set) {
  const klasor = ciktiKlasoru(set.id, 'zip');
  const uyeler = await uyeleriHazirla(set);
  const rapor = { hedef: 'zip', dosyalar: [], hatalar: seyrekUyarilari(uyeler), zaman: new Date().toISOString() };

  const girdiler = [];
  let sira = 0;
  for (const u of uyeler) {
    if (u.sonuc !== 'hazir') { rapor.hatalar.push(u); continue; }
    sira++;
    try {
      const { veri } = u.animasyonlu
        ? await donustur.whatsappAnimasyon(u.dosya)
        : await donustur.telegramStatik(u.dosya);
      const ad = String(sira).padStart(2, '0') + '.webp';
      girdiler.push({ ad, veri });
      rapor.dosyalar.push({ adayId: u.adayId, dosya: ad });
    } catch (e) {
      rapor.hatalar.push({ adayId: u.adayId, sonuc: 'hata', neden: e.message });
    }
  }
  girdiler.push({
    ad: 'OKU-BENI.txt',
    veri: Buffer.from(
      set.ad + '\n\nBu pakette ' + girdiler.length + ' sticker var (512px WebP).\n' +
      'Telegram: @Stickers botuna, WhatsApp: bir sticker maker uygulamasına yükleyin.\n', 'utf8')
  });

  const dosyaAdi = guvenliAd(set.ad) + '.zip';
  fs.writeFileSync(path.join(klasor, dosyaAdi), zip.zipYap(girdiler));
  rapor.paket = dosyaAdi;

  fs.writeFileSync(path.join(klasor, 'rapor.json'), JSON.stringify(rapor, null, 2));
  depo.setGuncelle(set.id, { ciktilar: { zip: rapor } });
  return rapor;
}

async function uret(setId, hedef) {
  const set = depo.setBul(setId);
  if (!set) throw new Error('set yok: ' + setId);
  if (!set.uyeler.length) throw new Error('set boş');
  if (hedef === 'telegram') return telegramUret(set);
  if (hedef === 'wastickers') return wastickersUret(set);
  if (hedef === 'zip') return zipUret(set);
  throw new Error('bilinmeyen hedef: ' + hedef);
}

module.exports = { uret, guvenliAd };
