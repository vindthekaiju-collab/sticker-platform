'use strict';
/**
 * Yayındaki üç animasyonlu seti (Giphy dönemi) bu makinenin deposuna geri
 * yükler. Asıl veri MacBook'ta; burada yalnız site/setler.html (SETLER dizisi)
 * ve site/s/<id>/ dosyaları var. Bu betik onlardan depo kaydı kurar:
 *
 *   - set kimliği site/s/<id> klasör adıyla AYNI kalır (URL'ler bozulmasın)
 *   - üyeler: site/s/<id>/NN.webp → aday (dosya = o webp, durum indirildi)
 *   - emoji + başlık SETLER'den, Telegram linki panodan
 *
 * Böylece magaza.js yeniden üretildiğinde eski setler düşmez. Yalnız
 * depoda o kimlikle set yoksa çalışır; ikinci koşu hiçbir şey yapmaz.
 *
 *   node arac/eski-setleri-yukle.js
 */
const fs = require('fs');
const path = require('path');
const depo = require('../lib/depo');

const KOK = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(KOK, 'site', 'setler.html'), 'utf8');
const m = html.match(/const SETLER = (\[.*?\]);\r?\n/s);
if (!m) throw new Error('setler.html içinde SETLER bulunamadı');
const SETLER = JSON.parse(m[1]);

const setler = depo.setListe();
const havuz = depo.havuzListe();
let yeni = 0;

for (const s of SETLER) {
  const ilkYol = s.stickerlar[0] && s.stickerlar[0].yol;      // s/<id>/01.webp
  const id = ilkYol && ilkYol.split('/')[1];
  if (!id) continue;
  if (setler.find(x => x.id === id)) { console.log(`= ${s.ad} (${id}) zaten depoda`); continue; }

  const tg = (s.pano.match(/href=\\?"(https:\/\/t\.me\/addstickers\/[^"\\]+)/) || [])[1] || null;
  const uyeler = [];
  for (const st of s.stickerlar) {
    const dosya = path.join(KOK, 'site', st.yol);
    if (!fs.existsSync(dosya)) continue;
    const aday = {
      id: depo.kimlik(), kaynak: 'giphy', medyaUrl: 'site/' + st.yol, sayfaUrl: null,
      etiketler: [st.baslik].filter(Boolean), emoji: st.emoji || '🙂',
      eklenme: new Date().toISOString(),
      dosya: 'site/' + st.yol, durum: 'indirildi', hata: null,
      not: 'MacBook havuzundan yayına girmiş; burada yalnız yayın kopyası var'
    };
    havuz.push(aday);
    uyeler.push(aday.id);
  }
  setler.push({
    id, ad: s.ad, aciklama: s.aciklama || '', uyeler, tepsi: null,
    durum: 'yayinda', olusturan: 'elle', olusturulma: '2026-08-17T00:00:00.000Z',
    telegramUrl: tg, ciktilar: {}
  });
  yeni++;
  console.log(`+ ${s.ad} (${id}): ${uyeler.length} üye · telegram ${tg ? 'var' : 'yok'}`);
}

if (yeni) {
  fs.mkdirSync(depo.VERI, { recursive: true });
  fs.writeFileSync(path.join(depo.VERI, 'havuz.json'), JSON.stringify(havuz, null, 2));
  fs.writeFileSync(path.join(depo.VERI, 'setler.json'), JSON.stringify(setler, null, 2));
}
console.log(`${yeni} set yüklendi`);
