'use strict';
/**
 * Telegram Bot API teslimat modülü.
 *
 * Alıcı "Telegram'a ekle" dediğinde bot alıcı adına set oluşturur ve
 * t.me/addstickers/<setAdi> linki döner — gerçek tek tık bu.
 *
 * Token yoksa "kuru çalışma" yapar: ne yapacağını adım adım döndürür ama
 * hiçbir istek atmaz. Böylece boru hattı tokensız da test edilir.
 *
 * Kurallar (Bot API):
 *  - Set adı 1-64 karakter, harfle başlar, yalnız a-z0-9 ve alt çizgi,
 *    "_by_<botKullaniciAdi>" ile bitmek ZORUNDA.
 *  - createNewStickerSet: user_id, name, title, stickers[InputSticker]
 *  - InputSticker: sticker (dosya), format ('static'|'video'), emoji_list
 *  - Tek istekte 1 sticker + ardından addStickerToSet en sağlam yol.
 */

const fs = require('fs');
const path = require('path');

const API = 'https://api.telegram.org';

function setAdiUret(setAdi, botKullaniciAdi) {
  const govde = setAdi.toLowerCase().replace(/[^a-z0-9_]+/g, '_')
    .replace(/^[^a-z]+/, '').replace(/_+/g, '_').slice(0, 40) || 'set';
  return govde + '_by_' + botKullaniciAdi;
}

async function istek(token, metot, form) {
  const cevap = await fetch(`${API}/bot${token}/${metot}`, { method: 'POST', body: form });
  const veri = await cevap.json();
  if (!veri.ok) throw new Error(`${metot}: ${veri.description || cevap.status}`);
  return veri.result;
}

function stickerForm(alanlar, dosyaYolu, format, emoji) {
  const form = new FormData();
  for (const [k, v] of Object.entries(alanlar)) form.append(k, String(v));
  const veri = fs.readFileSync(dosyaYolu);
  const dosyaAdi = path.basename(dosyaYolu);
  form.append('sticker', JSON.stringify({
    sticker: 'attach://' + dosyaAdi,
    format,
    emoji_list: [emoji || '🙂']
  }));
  form.append(dosyaAdi, new Blob([veri]), dosyaAdi);
  return form;
}

/**
 * Bir klasördeki üretilmiş sticker'lardan (cikti/<set>/telegram/) set kurar.
 * @param {object} ayar { token, botKullaniciAdi, aliciKullaniciId, setAdi, baslik, klasor }
 * @returns {object} { link, setAdi } ya da kuru çalışmada { kuru: true, adimlar }
 */
/**
 * Yüklenecek dosyaların TEK gerçek kaynağı üretim raporudur (rapor.json):
 * klasörde önceki, daha kalabalık bir üretimden artakalan dosyalar olabilir
 * ve readdir onları da yükler — setten çıkarılmış üye yayına sızardı.
 * Rapor yoksa (elle hazırlanmış klasör) readdir'e düşülür.
 */
function uretilenler(klasor) {
  try {
    const rapor = JSON.parse(fs.readFileSync(path.join(klasor, 'rapor.json'), 'utf8'));
    const kayitli = (rapor.dosyalar || [])
      .filter(d => fs.existsSync(path.join(klasor, d.dosya)));
    if (kayitli.length) {
      return kayitli.map(d => ({ dosya: d.dosya, emoji: d.emoji || '🙂' }));
    }
  } catch {}
  return fs.readdirSync(klasor)
    .filter(d => d.endsWith('.webp') || d.endsWith('.webm')).sort()
    .map(d => ({ dosya: d, emoji: '🙂' }));
}

async function setKur(ayar) {
  const dosyalar = uretilenler(ayar.klasor);
  if (!dosyalar.length) throw new Error('klasörde üretilmiş sticker yok: ' + ayar.klasor);

  const setAdi = setAdiUret(ayar.setAdi, ayar.botKullaniciAdi || 'BOT');
  const adimlar = dosyalar.map((d, i) => ({
    metot: i === 0 ? 'createNewStickerSet' : 'addStickerToSet',
    dosya: d.dosya,
    format: d.dosya.endsWith('.webm') ? 'video' : 'static',
    emoji: d.emoji
  }));

  if (!ayar.token) {
    return {
      kuru: true, setAdi,
      link: 'https://t.me/addstickers/' + setAdi,
      adimlar,
      not: 'Token verilmedi — istek atılmadı. TELEGRAM_BOT_TOKEN ortam değişkeniyle gerçek çalışır.'
    };
  }

  for (const [i, adim] of adimlar.entries()) {
    const alanlar = { user_id: ayar.aliciKullaniciId, name: setAdi };
    if (adim.metot === 'createNewStickerSet') alanlar.title = ayar.baslik || ayar.setAdi;
    const form = stickerForm(alanlar, path.join(ayar.klasor, adim.dosya), adim.format, adim.emoji);
    await istek(ayar.token, adim.metot, form);
    adim.sonuc = 'tamam';
    // Bot API sınır aşımına saygı: art arda yüklemede kısa soluk.
    if (i < adimlar.length - 1) await new Promise(r => setTimeout(r, 350));
  }

  return { setAdi, link: 'https://t.me/addstickers/' + setAdi, adimlar };
}

/**
 * Trend setini üretilmiş klasörle eşitle (^sp24).
 *
 * Mantık: klasördeki dosyalardan daha önce yüklenmemiş olanlar sete eklenir;
 * set azami boyutu aşarsa en eskiler silinir (Telegram sınırı: 120 statik /
 * 50 video). Yüklenenlerin kaydı veri/trend-durum.json'da tutulur.
 *
 * Token yoksa KURU ÇALIŞMA: ne yapılacakını plan olarak döndürür.
 * DURUM: canlı API ile DENENMEDİ — ilk gerçek koşu bot token'ıyla.
 *
 * Bilinen sınır: takip dosya ADIYLA yapılır (01.webp...). Trend seti hep
 * üye EKLENEREK büyütülmeli; üye çıkarılırsa numaralar kayar ve eşitleme
 * şaşar. Üye çıkarma gerekirse veri/trend-durum.json silinip set yeniden
 * kurulur (dönem devri).
 */
async function trendEsitle(ayarlar) {
  const durumDosya = path.join(__dirname, '..', 'veri', 'trend-durum.json');
  let durum = { setAdi: null, yuklenen: [] };
  try { durum = JSON.parse(fs.readFileSync(durumDosya, 'utf8')); } catch {}

  const dosyalar = uretilenler(ayarlar.klasor);
  const setAdi = durum.setAdi || setAdiUret(ayarlar.setAdi || 'trend', ayarlar.botKullaniciAdi || 'BOT');
  const azami = ayarlar.azami || 100;

  const emojiler = Object.fromEntries(dosyalar.map(d => [d.dosya, d.emoji]));
  const yeniler = dosyalar.map(d => d.dosya).filter(d => !durum.yuklenen.includes(d));
  const toplamSonrasi = durum.yuklenen.length + yeniler.length;
  const silinecekSayi = Math.max(0, toplamSonrasi - azami);

  const plan = {
    setAdi,
    setYeniMi: !durum.setAdi,
    eklenecek: yeniler,
    silinecekSayi,
    not: silinecekSayi > 0 ? 'en eski ' + silinecekSayi + ' sticker silinerek yer açılacak' : null
  };

  if (!ayarlar.token) {
    return { kuru: true, ...plan, link: 'https://t.me/addstickers/' + setAdi };
  }

  // Canlı: yeni set gerekiyorsa kur, sonra ekle, sonra taşanı sil.
  let kalanlar = [...yeniler];
  if (plan.setYeniMi && kalanlar.length) {
    const ilk = kalanlar.shift();
    const form = stickerForm(
      { user_id: ayarlar.kullaniciId, name: setAdi, title: ayarlar.baslik || 'Trend Paket' },
      path.join(ayarlar.klasor, ilk), ilk.endsWith('.webm') ? 'video' : 'static', emojiler[ilk]);
    await istek(ayarlar.token, 'createNewStickerSet', form);
    durum.yuklenen.push(ilk);
  }
  for (const dosya of kalanlar) {
    const form = stickerForm(
      { user_id: ayarlar.kullaniciId, name: setAdi },
      path.join(ayarlar.klasor, dosya), dosya.endsWith('.webm') ? 'video' : 'static', emojiler[dosya]);
    await istek(ayarlar.token, 'addStickerToSet', form);
    durum.yuklenen.push(dosya);
    await new Promise(r => setTimeout(r, 350));
  }
  if (silinecekSayi > 0) {
    const canliSet = await istek(ayarlar.token, 'getStickerSet',
      (() => { const f = new FormData(); f.append('name', setAdi); return f; })());
    for (const eski of canliSet.stickers.slice(0, silinecekSayi)) {
      const f = new FormData();
      f.append('sticker', eski.file_id);
      await istek(ayarlar.token, 'deleteStickerFromSet', f);
    }
    durum.yuklenen = durum.yuklenen.slice(silinecekSayi);
  }

  durum.setAdi = setAdi;
  fs.mkdirSync(path.dirname(durumDosya), { recursive: true });
  fs.writeFileSync(durumDosya, JSON.stringify(durum, null, 2));
  return { ...plan, link: 'https://t.me/addstickers/' + setAdi };
}

module.exports = { setKur, setAdiUret, trendEsitle };
