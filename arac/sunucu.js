'use strict';
/**
 * site/ için basit statik sunucu (önizleme).
 *   node arac/sunucu.js [port]
 * Python'un `http.server`'ı tek iş parçacıklı: 30 sticker'lık bir galeri
 * açılırken istekler sıraya girip yarısı boş kalıyordu (2026-09-23).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..', 'site');
const PORT = Number(process.argv[2] || 8765);
const TUR = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
  '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8',
};

http.createServer((istek, cevap) => {
  let yol = decodeURIComponent(istek.url.split('?')[0]);
  if (yol.endsWith('/')) yol += 'index.html';
  const tam = path.join(KOK, path.normalize(yol).replace(/^([\\/])+/, ''));
  if (!tam.startsWith(KOK)) { cevap.writeHead(403).end('403'); return; }
  fs.stat(tam, (e, st) => {
    if (e || !st.isFile()) { cevap.writeHead(404, { 'content-type': 'text/plain' }).end('404 ' + yol); return; }
    cevap.writeHead(200, {
      'content-type': TUR[path.extname(tam).toLowerCase()] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'no-cache',
    });
    fs.createReadStream(tam).pipe(cevap);
  });
}).listen(PORT, '127.0.0.1', () => console.log('http://127.0.0.1:' + PORT + '/ → ' + KOK));
