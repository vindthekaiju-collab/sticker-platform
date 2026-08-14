'use strict';
/**
 * Telegram bot — isteğe bağlı konfor adaptörü (^sp23, ^sp24).
 * Bağımsızlık ilkesi (tasarım §4.8): bot olmadan da her şey çalışır;
 * bot yalnız Telegram içi konforu ekler.
 *
 * Mimari iki parçaya ayrıldı ki tokensız da test edilebilsin:
 *  - islet(mesaj): SAF işleyici — gelen mesaj nesnesini alır, cevap metni
 *    döndürür. Ağ yok. Duman testi bunu sınar.
 *  - calistir(): getUpdates uzun-yoklama taşıyıcısı. TELEGRAM_BOT_TOKEN
 *    varsa sunucu açılışında başlar. DURUM: gerçek API ile DENENMEDİ
 *    (bu ortamdan api.telegram.org'a çıkış yok) — ilk canlı test
 *    kullanıcının makinesinde.
 *
 * Komutlar:
 *  /start             → tanıtım + komutlar
 *  /paket <token>     → satın alma token'ı doğrula, setin linklerini ver
 *  /trend <aboneNo>   → abonelik aktifse trend setinin linkini ver
 *
 * Bot ayarı: veri/bot.json → { trendSetLinki: "https://t.me/addstickers/..." }
 */

const fs = require('fs');
const path = require('path');
const depo = require('./depo');
const satis = require('./satis');
const abone = require('./abone');

const AYAR_DOSYA = path.join(depo.VERI, 'bot.json');
const API = 'https://api.telegram.org';

function ayar() {
  try { return JSON.parse(fs.readFileSync(AYAR_DOSYA, 'utf8')); }
  catch { return {}; }
}

/** Saf işleyici: Telegram update.message → cevap metni (ya da null). */
function islet(mesaj) {
  if (!mesaj || !mesaj.text) return null;
  const [komut, ...args] = mesaj.text.trim().split(/\s+/);

  if (komut === '/start') {
    return 'Merhaba! 🏭 Sticker atölyesinin botuyum.\n\n' +
      '/paket <kod> — satın aldığın setin linklerini al\n' +
      '/trend <abone-no> — Trend Paket aboneliğinle güncel seti al\n\n' +
      'Kodun, ödeme sonrası açılan sayfanın sonundaki /t/ kodudur.';
  }

  if (komut === '/paket') {
    const token = (args[0] || '').toLowerCase();
    if (!/^[a-f0-9]{16,32}$/.test(token)) {
      return 'Kod tanınmadı. Ödeme sonrası sayfandaki /t/ ile başlayan linkteki kodu yaz: /paket <kod>';
    }
    const kayit = satis.liste().find(k => k.token === token);
    if (!kayit) return 'Bu kod kayıtlarda yok. Sorun olduğunu düşünüyorsan satın alma sayfandan bize yaz.';
    const set = depo.setBul(kayit.setId);
    if (!set) return 'Setin kaydı bulunamadı — bize yaz, düzeltelim.';
    const satirlar = ['📦 ' + set.ad, '', 'Canlı paket sayfan: /t/' + token + ' (her zaman güncel)'];
    if (set.ciktilar && set.ciktilar.telegramYayin && set.ciktilar.telegramYayin.link) {
      satirlar.push('Telegram seti: ' + set.ciktilar.telegramYayin.link);
    } else {
      satirlar.push('Telegram seti henüz yayınlanmadı — hazır olunca buradan tekrar alabilirsin.');
    }
    return satirlar.join('\n');
  }

  if (komut === '/trend') {
    const aboneNo = args[0] || '';
    if (!aboneNo) return 'Abone numaranı ekle: /trend <abone-no> (ödeme e-postandaki abonelik numarası)';
    if (!abone.aktifMi(aboneNo)) {
      return 'Bu abonelik aktif görünmüyor. Yeni abone olduysan birkaç dakika sonra tekrar dene; sorun sürerse bize yaz.';
    }
    const a = ayar();
    return a.trendSetLinki
      ? '🔥 Güncel Trend Paket: ' + a.trendSetLinki + '\nSet kendiliğinden güncellenir — bir kez eklemen yeter.'
      : 'Trend seti şu an hazırlanıyor — çok yakında buradan alabileceksin.';
  }

  return 'Anlamadım. Komutlar için /start yaz.';
}

/* ---------- Canlı taşıyıcı (token ister) ---------- */

async function apiCagir(token, metot, govde) {
  const cevap = await fetch(`${API}/bot${token}/${metot}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(govde || {})
  });
  const veri = await cevap.json();
  if (!veri.ok) throw new Error(metot + ': ' + (veri.description || cevap.status));
  return veri.result;
}

async function calistir() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { kuru: true, not: 'TELEGRAM_BOT_TOKEN yok — bot uykuda' };
  let sonGuncelleme = 0;
  console.log('bot: uzun yoklama başladı');
  for (;;) {
    try {
      const guncellemeler = await apiCagir(token, 'getUpdates', {
        offset: sonGuncelleme + 1, timeout: 50, allowed_updates: ['message']
      });
      for (const g of guncellemeler) {
        sonGuncelleme = g.update_id;
        const cevap = islet(g.message);
        if (cevap && g.message && g.message.chat) {
          await apiCagir(token, 'sendMessage', { chat_id: g.message.chat.id, text: cevap });
        }
      }
    } catch (e) {
      console.error('bot hatası, 30sn sonra tekrar:', e.message);
      await new Promise(r => setTimeout(r, 30000));
    }
  }
}

module.exports = { islet, calistir, ayar };
