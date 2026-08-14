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
async function setKur(ayar) {
  const dosyalar = fs.readdirSync(ayar.klasor)
    .filter(d => d.endsWith('.webp') || d.endsWith('.webm')).sort();
  if (!dosyalar.length) throw new Error('klasörde üretilmiş sticker yok: ' + ayar.klasor);

  const setAdi = setAdiUret(ayar.setAdi, ayar.botKullaniciAdi || 'BOT');
  const adimlar = dosyalar.map((d, i) => ({
    metot: i === 0 ? 'createNewStickerSet' : 'addStickerToSet',
    dosya: d,
    format: d.endsWith('.webm') ? 'video' : 'static'
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
    const form = stickerForm(alanlar, path.join(ayar.klasor, adim.dosya), adim.format);
    await istek(ayar.token, adim.metot, form);
    adim.sonuc = 'tamam';
    // Bot API sınır aşımına saygı: art arda yüklemede kısa soluk.
    if (i < adimlar.length - 1) await new Promise(r => setTimeout(r, 350));
  }

  return { setAdi, link: 'https://t.me/addstickers/' + setAdi, adimlar };
}

module.exports = { setKur, setAdiUret };
