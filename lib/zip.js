'use strict';
/**
 * Asgari ZIP yazıcı — yalnızca "store" (sıkıştırmasız) girdiler.
 * WebP/PNG zaten sıkıştırılmış olduğundan deflate kazancı yok; bağımlılık
 * eklemek yerine biçimin kendisi yazıldı. .wastickers ve genel paket bunu
 * kullanır.
 */

const CRC_TABLO = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLO[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/**
 * girdiler: [{ ad: 'dosya.webp', veri: Buffer }]
 * Dönen: ZIP dosyasının tamamı tek Buffer.
 */
function zipYap(girdiler) {
  const yerel = [];
  const merkez = [];
  let konum = 0;

  for (const g of girdiler) {
    const adBuf = Buffer.from(g.ad, 'utf8');
    const crc = crc32(g.veri);
    const boy = g.veri.length;

    const yerelBaslik = Buffer.alloc(30);
    yerelBaslik.writeUInt32LE(0x04034b50, 0);  // imza
    yerelBaslik.writeUInt16LE(20, 4);          // sürüm
    yerelBaslik.writeUInt16LE(0x0800, 6);      // bayrak: UTF-8 adlar
    yerelBaslik.writeUInt16LE(0, 8);           // yöntem: store
    yerelBaslik.writeUInt16LE(0, 10);          // saat
    yerelBaslik.writeUInt16LE(0x21, 12);       // tarih (1980-01-01)
    yerelBaslik.writeUInt32LE(crc, 14);
    yerelBaslik.writeUInt32LE(boy, 18);
    yerelBaslik.writeUInt32LE(boy, 22);
    yerelBaslik.writeUInt16LE(adBuf.length, 26);
    yerelBaslik.writeUInt16LE(0, 28);

    yerel.push(yerelBaslik, adBuf, g.veri);

    const merkezKayit = Buffer.alloc(46);
    merkezKayit.writeUInt32LE(0x02014b50, 0);
    merkezKayit.writeUInt16LE(20, 4);
    merkezKayit.writeUInt16LE(20, 6);
    merkezKayit.writeUInt16LE(0x0800, 8);
    merkezKayit.writeUInt16LE(0, 10);
    merkezKayit.writeUInt16LE(0, 12);
    merkezKayit.writeUInt16LE(0x21, 14);
    merkezKayit.writeUInt32LE(crc, 16);
    merkezKayit.writeUInt32LE(boy, 20);
    merkezKayit.writeUInt32LE(boy, 24);
    merkezKayit.writeUInt16LE(adBuf.length, 28);
    merkezKayit.writeUInt32LE(0, 30); // ek alan + yorum + disk
    merkezKayit.writeUInt16LE(0, 36);
    merkezKayit.writeUInt32LE(0, 38);
    merkezKayit.writeUInt32LE(konum, 42);

    merkez.push(Buffer.concat([merkezKayit, adBuf]));
    konum += 30 + adBuf.length + boy;
  }

  const merkezBuf = Buffer.concat(merkez);
  const son = Buffer.alloc(22);
  son.writeUInt32LE(0x06054b50, 0);
  son.writeUInt16LE(0, 4);
  son.writeUInt16LE(0, 6);
  son.writeUInt16LE(girdiler.length, 8);
  son.writeUInt16LE(girdiler.length, 10);
  son.writeUInt32LE(merkezBuf.length, 12);
  son.writeUInt32LE(konum, 16);
  son.writeUInt16LE(0, 20);

  return Buffer.concat([...yerel, merkezBuf, son]);
}

module.exports = { zipYap, crc32 };
