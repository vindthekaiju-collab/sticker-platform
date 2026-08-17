'use strict';
/**
 * Klibin üst ve alt bandı ne kadar "dolu"? Altyazıyı boş olana koymak için.
 *
 * NEDEN: Kaynak kliplerin bir kısmında zaten yazı var (kaynağın kendi
 * altyazısı, kanal filigranı, meme metni). Üstüne bizim yazımızı basınca
 * iki metin üst üste biniyor ve çirkin duruyor — kullanıcı bulgusu,
 * 2026-08-17.
 *
 * ÖLÇÜ: yatay kenar enerjisi. Yazı bandı, düz görüntüye göre belirgin
 * biçimde daha hareketli. Ölçüldü: kaynağında altyazı olan bir klipte
 * alt/üst oranı 4.6; temiz kliplerde 1.0-1.2.
 *
 * "Yazı mı yoksa kalabalık görüntü mü" ayrımını YAPMIYOR — gerek de yok:
 * amaç altyazıyı sakin banda koymak, sebebi ne olursa olsun.
 *
 * Kullanım:  node arac/bant-olc.js <dosya> [<dosya> ...]
 * Çıktı   :  {"<dosya>":{"ust":..,"alt":..,"tum":..,"oneri":"ust|alt","riskli":bool}}
 */

const sharp = require('sharp');
const donustur = require('../lib/donustur');

const BANT = 0.24;      // üst/alt bandın yüksekliğe oranı — yazı buraya konuyor
const RISK_KAT = 1.45;  // iki bant da kareden bu kadar hareketliyse klip riskli

async function olc(dosya) {
  const sayfa = await donustur.temsiliKare(dosya);
  const { data, info } = await sharp(dosya, { page: sayfa })
    .greyscale().resize(240, null, { fit: 'inside' })
    .raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  const enerji = (y0, y1) => {
    let toplam = 0, n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 1; x < W; x++) {
        toplam += Math.abs(data[y * W + x] - data[y * W + x - 1]);
        n++;
      }
    }
    return n ? toplam / n : 0;
  };

  const ust = enerji(0, Math.max(1, Math.floor(H * BANT)));
  const alt = enerji(Math.floor(H * (1 - BANT)), H);
  const tum = enerji(0, H) || 1;

  return {
    ust: +ust.toFixed(2), alt: +alt.toFixed(2), tum: +tum.toFixed(2),
    // Sakin bant tercih edilir ama yalnız fark BELİRGİNSE taşınır: kıl payı
    // farkta üste geçmek seti tutarsız gösteriyor. Alt varsayılan yer.
    oneri: ust < alt * 0.70 ? 'ust' : 'alt',
    riskli: Math.min(ust, alt) > tum * RISK_KAT
  };
}

(async () => {
  const sonuc = {};
  for (const d of process.argv.slice(2)) {
    try { sonuc[d] = await olc(d); }
    catch (e) { sonuc[d] = { hata: e.message }; }
  }
  process.stdout.write(JSON.stringify(sonuc));
})();
