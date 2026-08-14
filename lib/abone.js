'use strict';
/**
 * Trend Paket abone kayıtları (^trend).
 *
 * Paddle abonelik webhook'ları buraya düşer: aktif abone listesi tek gerçek.
 * Bot (token gelince) bir kullanıcıya trend seti vermeden önce buradan
 * "aktif mi" diye sorar. Kayıt biçimi:
 *   { id: paddle subscription id, durum: 'aktif'|'iptal'|'donduruldu',
 *     musteriId, telegramKullanici: null|str, olusturulma, guncelleme }
 *
 * Telegram tarafının bilinen sınırı (tasarıma da yazıldı): set linkini almış
 * birini setten "çıkarmak" mümkün değil — Telegram seti herkese açık bir
 * varlıktır. Erişim denetimi set linkinde değil, linki dağıtan botta yapılır.
 */

const fs = require('fs');
const path = require('path');
const depo = require('./depo');

const DOSYA = path.join(depo.VERI, 'aboneler.json');

function liste() {
  try { return JSON.parse(fs.readFileSync(DOSYA, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}

function yaz(veri) {
  fs.mkdirSync(depo.VERI, { recursive: true });
  const gecici = DOSYA + '.tmp';
  fs.writeFileSync(gecici, JSON.stringify(veri, null, 2));
  fs.renameSync(gecici, DOSYA);
}

const DURUMLAR = { aktif: 'aktif', iptal: 'iptal', donduruldu: 'donduruldu' };

function kaydet(id, durum, musteriId) {
  if (!id) throw new Error('abonelik id yok');
  if (!DURUMLAR[durum]) throw new Error('geçersiz abone durumu: ' + durum);
  const kayitlar = liste();
  let kayit = kayitlar.find(k => k.id === id);
  if (!kayit) {
    kayit = {
      id, durum, musteriId: musteriId || null,
      telegramKullanici: null,
      olusturulma: new Date().toISOString(),
      guncelleme: new Date().toISOString()
    };
    kayitlar.push(kayit);
  } else {
    kayit.durum = durum;
    if (musteriId) kayit.musteriId = musteriId;
    kayit.guncelleme = new Date().toISOString();
  }
  yaz(kayitlar);
  return kayit;
}

function aktifMi(id) {
  const kayit = liste().find(k => k.id === id);
  return !!kayit && kayit.durum === 'aktif';
}

/** Paddle abonelik olayı → abone kaydı. paddleIsle buradan çağırır. */
function paddleOlayi(olay) {
  const veri = olay.data || {};
  const id = veri.id;
  const musteriId = veri.customer_id || null;
  const esleme = {
    'subscription.activated': 'aktif',
    'subscription.created': 'aktif',
    'subscription.resumed': 'aktif',
    'subscription.paused': 'donduruldu',
    'subscription.canceled': 'iptal'
  };
  const durum = esleme[olay.event_type];
  // Tanınmayan alt tür ya da kimliksiz gövde: sessiz atla (null) — webhook
  // 200 dönmeli, yoksa Paddle aynı bozuk olayı sonsuza dek tekrar dener.
  if (!durum || !id) return null;
  return kaydet(id, durum, musteriId);
}

module.exports = { liste, kaydet, aktifMi, paddleOlayi };
