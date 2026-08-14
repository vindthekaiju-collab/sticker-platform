'use strict';
/**
 * sticker-platform sunucusu — pano geleneğinde: bağımlılıksız, tek dosya yönlendirme.
 *
 * Uçlar
 *   GET  /                     → atölye arayüzü
 *   GET  /api/health           → {ok:true}
 *   GET  /api/durum            → sayaçlar (havuz, setler, ffmpeg)
 *   GET  /api/aday             → aday listesi
 *   POST /api/aday             → aday ekle {medyaUrl, sayfaUrl, etiketler, kaynak}
 *   POST /api/aday/:id/indir   → medyayı diske indir
 *   POST /api/aday/:id/sil     → adayı sil
 *   GET  /api/set              → set listesi
 *   POST /api/set              → set aç {ad, aciklama}
 *   POST /api/set/:id          → güncelle {ad, durum, tepsi, ekle:[], cikar:[]}
 *   POST /api/set/:id/sil      → sil
 *   POST /api/set/:id/uret     → {hedef:'telegram'|'wastickers'|'zip'}
 *   POST /api/set/:id/teslimat → teslimat sayfası üret
 *   GET  /medya/:dosya         → indirilen ham medya (önizleme)
 *   GET  /cikti/...            → üretilmiş paketler
 *
 * Yalnızca 127.0.0.1'i dinler. Eklenti service worker'dan konuşur;
 * yine de CORS başlıkları koyulur ki geliştirme sırasında sürpriz olmasın.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const depo = require('./lib/depo');
const indir = require('./lib/indir');
const uret = require('./lib/uret');
const donustur = require('./lib/donustur');
const teslimat = require('./lib/teslimat');
const kurator = require('./lib/kurator');
const satis = require('./lib/satis');
const vitrin = require('./lib/vitrin');
const magaza = require('./lib/magaza');

const PORT = Number(process.env.PORT || 47411);
const UI = path.join(__dirname, 'ui');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.jpg': 'image/jpeg', '.webm': 'video/webm', '.mp4': 'video/mp4',
  '.zip': 'application/zip', '.wastickers': 'application/zip'
};

function json(res, kod, veri) {
  const g = Buffer.from(JSON.stringify(veri), 'utf8');
  res.writeHead(kod, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': g.length,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(g);
}

function govdeOku(req) {
  return new Promise((resolve, reject) => {
    let g = '';
    req.on('data', c => {
      g += c;
      if (g.length > 1e6) { reject(new Error('gövde çok büyük')); req.destroy(); }
    });
    req.on('end', () => {
      try {
        // Gumroad webhook'u form-encoded gönderir; geri kalan her şey JSON.
        const tur = (req.headers['content-type'] || '').split(';')[0].trim();
        if (tur === 'application/x-www-form-urlencoded') {
          return resolve(Object.fromEntries(new URLSearchParams(g)));
        }
        resolve(g ? JSON.parse(g) : {});
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function dosyaSun(res, kok, gorece) {
  const tam = path.resolve(kok, gorece);
  if (!tam.startsWith(path.resolve(kok) + path.sep) && tam !== path.resolve(kok)) {
    return json(res, 403, { hata: 'yol dışarı çıkıyor' });
  }
  fs.readFile(tam, (e, veri) => {
    if (e) return json(res, 404, { hata: 'yok: ' + gorece });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(tam).toLowerCase()] || 'application/octet-stream',
      'Content-Length': veri.length,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(veri);
  });
}

const sunucu = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const yol = u.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    /* ---- arayüz ve dosyalar ---- */
    if (req.method === 'GET') {
      if (yol === '/') return dosyaSun(res, UI, 'index.html');
      if (yol.startsWith('/ui/')) return dosyaSun(res, UI, yol.slice(4));
      if (yol.startsWith('/medya/')) {
        return dosyaSun(res, path.join(__dirname, 'veri', 'medya'), decodeURIComponent(yol.slice(7)));
      }
      if (yol.startsWith('/cikti/')) {
        return dosyaSun(res, path.join(__dirname, 'cikti'), decodeURIComponent(yol.slice(7)));
      }
      if (yol === '/magaza') {
        magaza.sayfaUret();
        return dosyaSun(res, path.join(__dirname, 'cikti'), 'magaza.html');
      }
      if (yol === '/api/health') return json(res, 200, { ok: true });
      if (yol === '/api/durum') {
        const havuz = depo.havuzListe();
        return json(res, 200, {
          havuz: havuz.length,
          indirilen: havuz.filter(a => a.durum === 'indirildi').length,
          setler: depo.setListe().length,
          ffmpeg: donustur.ffmpegVar()
        });
      }
      if (yol === '/api/aday') return json(res, 200, depo.havuzListe());
      if (yol === '/api/set') return json(res, 200, depo.setListe());
      if (yol === '/api/teslimatlar') return json(res, 200, satis.liste());

      let mt;
      if ((mt = yol.match(/^\/t\/([a-f0-9]+)$/))) {
        const sonuc = satis.tokenAc(mt[1]);
        if (!sonuc) return json(res, 404, { hata: 'geçersiz teslimat linki' });
        const g = Buffer.from(sonuc.govde, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': g.length });
        return res.end(g);
      }
    }

    /* ---- yazma uçları ---- */
    if (req.method === 'POST') {
      if (yol === '/api/aday') {
        const g = await govdeOku(req);
        const { aday, yeni } = depo.adayEkle(g);
        // Eklenir eklenmez arka planda indirmeyi dene; sonuç kaydın durumuna işlenir.
        if (yeni) indir.adayIndir(aday.id).catch(() => {});
        return json(res, yeni ? 201 : 200, aday);
      }

      let m;
      if ((m = yol.match(/^\/api\/aday\/([a-f0-9]+)\/indir$/))) {
        const aday = await indir.adayIndir(m[1]);
        return json(res, 200, aday);
      }
      if ((m = yol.match(/^\/api\/aday\/([a-f0-9]+)\/sil$/))) {
        return json(res, 200, { silindi: depo.adaySil(m[1]) });
      }

      if (yol === '/api/set') {
        const g = await govdeOku(req);
        return json(res, 201, depo.setOlustur(g));
      }
      if (yol === '/api/kurator') {
        const g = await govdeOku(req);
        return json(res, 201, await kurator.taslakSetYap(g));
      }
      if ((m = yol.match(/^\/api\/set\/([a-f0-9]+)\/sil$/))) {
        return json(res, 200, { silindi: depo.setSil(m[1]) });
      }
      if ((m = yol.match(/^\/api\/set\/([a-f0-9]+)\/uret$/))) {
        const g = await govdeOku(req);
        const rapor = await uret.uret(m[1], g.hedef);
        return json(res, 200, rapor);
      }
      if ((m = yol.match(/^\/api\/set\/([a-f0-9]+)\/teslimat$/))) {
        return json(res, 200, teslimat.sayfaUret(m[1]));
      }
      if ((m = yol.match(/^\/api\/set\/([a-f0-9]+)\/satis-linki$/))) {
        const kayit = satis.tokenUret(m[1], 'elle');
        return json(res, 201, { token: kayit.token, url: '/t/' + kayit.token });
      }
      if ((m = yol.match(/^\/api\/set\/([a-f0-9]+)\/vitrin$/))) {
        return json(res, 200, await vitrin.vitrinUret(m[1]));
      }
      if ((m = yol.match(/^\/api\/set\/([a-f0-9]+)\/kapak$/))) {
        const g = await govdeOku(req);
        if (g.sifirla) {
          depo.setGuncelle(m[1], { kapak: null });
        } else {
          if (!depo.adayBul(g.adayId)) throw new Error('aday yok: ' + g.adayId);
          await indir.adayIndir(g.adayId).catch(() => {});
          depo.setGuncelle(m[1], { kapak: { tur: 'aday', adayId: g.adayId } });
        }
        return json(res, 200, await vitrin.vitrinUret(m[1]));
      }
      if ((m = yol.match(/^\/api\/set\/([a-f0-9]+)\/kapak-yukle$/))) {
        // Ham ikili gövde: bilgisayardan kapak yükleme. 10MB tavan.
        const setId = m[1];
        if (!depo.setBul(setId)) throw new Error('set yok: ' + setId);
        const tur = (req.headers['content-type'] || '').split(';')[0].trim();
        const uzanti = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }[tur];
        if (!uzanti) throw new Error('desteklenmeyen görsel türü: ' + tur);
        const parcalar = [];
        let toplam = 0;
        await new Promise((resolve, reject) => {
          req.on('data', p => {
            toplam += p.length;
            if (toplam > 10 * 1024 * 1024) { req.destroy(); return reject(new Error('dosya çok büyük (>10MB)')); }
            parcalar.push(p);
          });
          req.on('end', resolve);
          req.on('error', reject);
        });
        const gorece = 'veri/medya/kapak-' + setId + uzanti;
        fs.mkdirSync(path.join(__dirname, 'veri', 'medya'), { recursive: true });
        fs.writeFileSync(path.join(__dirname, gorece), Buffer.concat(parcalar));
        depo.setGuncelle(setId, { kapak: { tur: 'dosya', dosya: gorece } });
        return json(res, 200, await vitrin.vitrinUret(setId));
      }
      if (yol === '/api/webhook/gumroad') {
        const g = await govdeOku(req);
        return json(res, 200, satis.gumroadIsle(g));
      }
      if (yol === '/api/webhook/paddle') {
        // İmza ham gövde üzerinden hesaplanır — çözümlemeden önce oku.
        const ham = await new Promise((resolve, reject) => {
          let g = '';
          req.on('data', c => {
            g += c;
            if (g.length > 1e6) { reject(new Error('gövde çok büyük')); req.destroy(); }
          });
          req.on('end', () => resolve(g));
          req.on('error', reject);
        });
        return json(res, 200, satis.paddleIsle(ham, req.headers['paddle-signature']));
      }
      if ((m = yol.match(/^\/api\/set\/([a-f0-9]+)$/))) {
        const g = await govdeOku(req);
        return json(res, 200, depo.setGuncelle(m[1], g));
      }
    }

    return json(res, 404, { hata: 'uç yok: ' + req.method + ' ' + yol });
  } catch (e) {
    return json(res, 400, { hata: e.message });
  }
});

sunucu.listen(PORT, '127.0.0.1', () => {
  console.log('sticker-platform: http://127.0.0.1:' + PORT);
  console.log('ffmpeg: ' + (donustur.ffmpegVar() ? 'var' : 'YOK — Telegram video sticker üretilemez'));
});
