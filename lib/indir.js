'use strict';
/**
 * Aday medyasını kaynağından indirir ve veri/medya/ altına koyar.
 * Alıcıya giden dosya hiçbir zaman kaynak URL'den değil bu kopyadan üretilir
 * (tasarım §3: teslim edilen dosya kendi havuzumuzdan çıkar).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const depo = require('./depo');

const AZAMI_BAYT = 25 * 1024 * 1024;
const AZAMI_YONLENDIRME = 5;

const UZANTI = {
  'image/gif': '.gif',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
  'video/mp4': '.mp4',
  'video/webm': '.webm'
};

function getir(url, kalanYonlendirme) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch { return reject(new Error('bozuk URL: ' + url)); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return reject(new Error('desteklenmeyen protokol: ' + u.protocol));
    }
    const mod = u.protocol === 'https:' ? https : http;
    const istek = mod.get(u, { headers: { 'User-Agent': 'sticker-platform/0.1' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (kalanYonlendirme <= 0) return reject(new Error('çok fazla yönlendirme'));
        return resolve(getir(new URL(res.headers.location, u).href, kalanYonlendirme - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ': ' + url));
      }
      const parcalar = [];
      let toplam = 0;
      res.on('data', p => {
        toplam += p.length;
        if (toplam > AZAMI_BAYT) {
          istek.destroy();
          return reject(new Error('dosya çok büyük (>25MB)'));
        }
        parcalar.push(p);
      });
      res.on('end', () => resolve({
        veri: Buffer.concat(parcalar),
        tur: (res.headers['content-type'] || '').split(';')[0].trim()
      }));
      res.on('error', reject);
    });
    istek.on('error', reject);
    istek.setTimeout(30000, () => {
      istek.destroy();
      reject(new Error('zaman aşımı: ' + url));
    });
  });
}

async function adayIndir(adayId) {
  const aday = depo.adayBul(adayId);
  if (!aday) throw new Error('aday yok: ' + adayId);
  if (aday.durum === 'indirildi' && aday.dosya &&
      fs.existsSync(path.join(depo.KOK, aday.dosya))) {
    return aday; // zaten diskte
  }
  try {
    const { veri, tur } = await getir(aday.medyaUrl, AZAMI_YONLENDIRME);
    let uzanti = UZANTI[tur];
    if (!uzanti) {
      // İçerik türü söylemiyorsa URL'nin uzantısına düş.
      const m = new URL(aday.medyaUrl).pathname.match(/\.(gif|png|webp|jpe?g|mp4|webm)$/i);
      uzanti = m ? '.' + m[1].toLowerCase().replace('jpeg', 'jpg') : '.bin';
    }
    const gorece = path.join('veri', 'medya', aday.id + uzanti);
    const tam = path.join(depo.KOK, gorece);
    fs.mkdirSync(path.dirname(tam), { recursive: true });
    fs.writeFileSync(tam, veri);
    return depo.adayGuncelle(aday.id, { dosya: gorece.split(path.sep).join('/'), durum: 'indirildi', hata: null });
  } catch (e) {
    depo.adayGuncelle(aday.id, { durum: 'hata', hata: e.message });
    throw e;
  }
}

module.exports = { adayIndir, getir };
