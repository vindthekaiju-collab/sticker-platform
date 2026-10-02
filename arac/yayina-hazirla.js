'use strict';
/**
 * Taslak setleri satışa hazırlar — tek komut, uçtan uca.
 *
 *   node arac/yayina-hazirla.js            → bütün taslak setler
 *   node arac/yayina-hazirla.js <setId>…   → yalnız verilenler
 *   --kuru                                 → ne yapacağını söyler, yapmaz
 *
 * Her set için:
 *   1. üç paket: telegram (webp) · wastickers · zip      (lib/uret)
 *   2. teslimat sayfası (cikti/<id>/teslimat.html)         (lib/teslimat)
 *   3. durum → yayinda
 * Sonra bir kez:
 *   4. site/setler.html + site/s/<id>/  yeniden üretilir  (lib/magaza)
 *   5. site/k/ küçük önizlemeler                           (arac/kucuk-onizleme)
 *   6. site/index.html #packs bölümü depodan yeniden kurulur (arac/anasayfa-perdeleri)
 *
 * Telegram paket LİNKİ bot ister (TELEGRAM_BOT_TOKEN); yoksa set Telegram'sız
 * yayınlanır — mağazada o kanal "yakında" görünür, WhatsApp ve ZIP çalışır.
 * Bot gelince lib/telegram.setKur ile eklenir, telegramUrl yazılır.
 *
 * Asgari: 3 üye (WhatsApp sınırı). Altındaki set atlanır, rapora düşer.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const depo = require('../lib/depo');
const uret = require('../lib/uret');
const teslimat = require('../lib/teslimat');
const magaza = require('../lib/magaza');
const sinirlar = require('../lib/sinirlar');

const KOK = path.join(__dirname, '..');
const arg = process.argv.slice(2);
const kuru = arg.includes('--kuru');
const secilen = arg.filter(a => !a.startsWith('--'));

async function setiHazirla(set) {
  const rapor = { id: set.id, ad: set.ad, uye: set.uyeler.length, paketler: {}, hatalar: [] };
  for (const hedef of ['telegram', 'wastickers', 'zip']) {
    try {
      const r = await uret.uret(set.id, hedef);
      rapor.paketler[hedef] = r.dosyalar.length;
      const sorun = (r.hatalar || []).filter(h => h.sonuc === 'hata');
      if (sorun.length) rapor.hatalar.push(...sorun.map(h => hedef + ': ' + h.neden));
    } catch (e) {
      rapor.hatalar.push(hedef + ': ' + e.message);
    }
  }
  try { teslimat.sayfaUret(set.id); } catch (e) { rapor.hatalar.push('teslimat: ' + e.message); }
  if (rapor.paketler.wastickers && rapor.paketler.zip) {
    depo.setGuncelle(set.id, { durum: 'yayinda' });
    rapor.durum = 'yayinda';
  } else {
    rapor.durum = 'taslak (paket eksik)';
  }
  return rapor;
}

(async () => {
  const hepsi = depo.setListe();
  const adaylar = hepsi.filter(s => secilen.length ? secilen.includes(s.id) : s.durum === 'taslak');
  const uygun = adaylar.filter(s => s.uyeler.length >= sinirlar.whatsapp.setAsgari);
  const kisa = adaylar.filter(s => s.uyeler.length < sinirlar.whatsapp.setAsgari);

  console.log(`${adaylar.length} set aday · ${uygun.length} uygun · ${kisa.length} kısa (<${sinirlar.whatsapp.setAsgari} üye)`);
  kisa.forEach(s => console.log(`  − ${s.ad} (${s.uyeler.length} üye) atlandı`));
  if (kuru) { uygun.forEach(s => console.log(`  ~ ${s.ad} (${s.uyeler.length} üye) hazırlanacak`)); return; }

  const raporlar = [];
  for (const s of uygun) {
    const r = await setiHazirla(s);
    raporlar.push(r);
    const p = r.paketler;
    console.log(`  ${r.durum === 'yayinda' ? '✓' : '×'} ${r.ad}: tg ${p.telegram ?? '-'} · wa ${p.wastickers ?? '-'} · zip ${p.zip ?? '-'} → ${r.durum}` +
      (r.hatalar.length ? `\n      ${r.hatalar.join('\n      ')}` : ''));
  }

  const m = magaza.sayfaUret();
  console.log(`mağaza: ${m.dosya} → ${m.set} set · ${m.sticker} sticker`);
  execFileSync(process.execPath, [path.join(KOK, 'arac', 'kucuk-onizleme.js')], { stdio: 'inherit' });
  execFileSync(process.execPath, [path.join(KOK, 'arac', 'anasayfa-perdeleri.js')], { stdio: 'inherit' });

  /* 6b. Kapak + listeleme kiti: yayındaki HER set için 1200×630 vitrin
     görseli (Gumroad/Paddle ürün kapağı, link önizlemesi) ve satış
     metni. yayin-kaydi/kapak/<id>.png + yayin-kaydi/listeleme.md.
     Kapak da kayıt gibi depoya girer: mağaza hesabı hangi makinede
     açılırsa açılsın kit elde olsun. */
  const fs = require('fs');
  const vitrin = require('../lib/vitrin');
  const yayinda = depo.setListe().filter(s => s.durum === 'yayinda' && s.uyeler.length);
  let kaynaklar = {};
  try { kaynaklar = JSON.parse(fs.readFileSync(path.join(depo.VERI, 'kaynaklar.json'), 'utf8')); } catch {}
  const kapakKlasor = path.join(KOK, 'yayin-kaydi', 'kapak');
  fs.mkdirSync(kapakKlasor, { recursive: true });
  const satirlar = ['# stickky — listing kit', '', `Generated ${new Date().toISOString().slice(0, 10)} · ${yayinda.length} packs · ${yayinda.reduce((t, s) => t + s.uyeler.length, 0)} stickers`, '',
    'Each pack: cover (1200×630), title, one-line description, sticker count, delivery files.',
    'Suggested price: $2.99 per pack (single purchase) — placeholder until pricing is decided.', ''];
  for (const s of yayinda) {
    try {
      const v = await vitrin.vitrinUret(s.id);
      fs.copyFileSync(depo.coz(v.dosya), path.join(kapakKlasor, s.id + '.png'));
    } catch (e) { console.log(`  kapak × ${s.ad}: ${e.message}`); }
    const wa = s.ciktilar && s.ciktilar.wastickers && s.ciktilar.wastickers.paket;
    const zipAd = s.ciktilar && s.ciktilar.zip && s.ciktilar.zip.paket;
    const kaynakTuru = s.uyeler.some(id => { const a = depo.adayBul(id); return a && a.kaynak === 'giphy'; })
      ? 'animated (Giphy-era, license not cleared for resale — review before listing)'
      : 'public domain / CC0 artwork, captions original (see kaynaklar.json)';
    satirlar.push(`## ${s.ad}`, '',
      `- id: \`${s.id}\``, `- cover: \`yayin-kaydi/kapak/${s.id}.png\``,
      `- description: ${s.aciklama || '—'}`, `- stickers: ${s.uyeler.length}`,
      `- files: ${wa ? '`' + wa + '`' : '—'} · ${zipAd ? '`' + zipAd + '`' : '—'} · Telegram ${s.telegramUrl ? s.telegramUrl : '(bot link pending)'}`,
      `- store page: https://stickky.xyz/setler#set-${yayinda.indexOf(s)}`,
      `- rights: ${kaynakTuru}`);
    // CC BY kaynaklar: mağaza sayfasına da atıf satırı konmalı.
    const atiflar = s.uyeler.map(id => kaynaklar[id]).filter(k => k && /cc[- ]by/i.test(k.lisans || ''));
    if (atiflar.length) {
      satirlar.push(`- attribution (${atiflar.length} CC BY sources, paste into the store page):`);
      for (const k of atiflar) satirlar.push(`    - "${k.baslik}" by ${k.sanatci || 'unknown'}, ${k.lisans}, ${k.sayfaUrl}`);
    }
    satirlar.push('');
  }
  fs.writeFileSync(path.join(KOK, 'yayin-kaydi', 'listeleme.md'), satirlar.join('\n'));
  console.log(`listeleme kiti: yayin-kaydi/listeleme.md + ${yayinda.length} kapak`);

  /* 7. Yayın kaydı: veri/ depoda yok (.gitignore, makineye özel). Ama hangi
     setin hangi sticker'dan, hangi kaynaktan, hangi lisansla yayına girdiği
     KAYBOLMAMALI — satışta "nereden geldi" sorusunun tek cevabı bu. Üç JSON
     yayin-kaydi/ altına kopyalanır ve commit'lenir. Başka makinede veri/ yoksa
     buradan geri kurulur. */
  const kayit = path.join(KOK, 'yayin-kaydi');
  fs.mkdirSync(kayit, { recursive: true });
  for (const ad of ['setler.json', 'havuz.json', 'kaynaklar.json']) {
    const kaynak = path.join(depo.VERI, ad);
    if (fs.existsSync(kaynak)) fs.copyFileSync(kaynak, path.join(kayit, ad));
  }
  console.log('yayın kaydı: yayin-kaydi/{setler,havuz,kaynaklar}.json');
})().catch(e => { console.error(e); process.exit(1); });
