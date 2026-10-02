'use strict';
/**
 * Kasa Worker'ı ağsız sınama: KV ve fetch taklit edilir.
 *     node kasa/test.js
 */
const crypto = require('crypto');
const assert = require('assert');

(async () => {
  const { default: kasa, paddleImzaDogrula, baglantiImzala } = await import('./src/index.js');

  // KV taklidi
  const depo = new Map();
  const PAKET = {
    async get(k, tip) {
      if (!depo.has(k)) return null;
      const v = depo.get(k);
      if (tip === 'json') return JSON.parse(v);
      if (tip === 'stream') return new Blob([v]).stream();
      return v;
    },
    async put(k, v) { depo.set(k, v); },
  };
  depo.set('meta:side-eye', JSON.stringify({ ad: 'Side Eye Season', sticker: 29 }));
  depo.set('paket:side-eye.wastickers', Buffer.from('PK-sahte-wastickers'));
  depo.set('paket:side-eye.zip', Buffer.from('PK-sahte-zip'));

  const env = { PAKET, IMZA_SIRRI: 'imza-sirri', PADDLE_WEBHOOK_SECRET: 'wh-sirri', PADDLE_API_BASE: 'https://api.ornek', IZINLI_KOKENLER: 'https://stickky.xyz', BAGLANTI_OMRU_SN: '60' };
  const KOK = 'https://kasa.ornek';
  const istek = (yol, sec) => kasa.fetch(new Request(KOK + yol, sec), env);
  let gecti = 0;
  const esit = (ad, kosul) => { assert.ok(kosul, ad); gecti++; console.log('  ✓ ' + ad); };

  // 1) imza
  const ts = '1700000000';
  const govde = JSON.stringify({ event_type: 'transaction.completed', data: { id: 'txn_01abcdefghijklmnopqrstuvwx', status: 'completed', customer_id: 'ctm_x', custom_data: { slug: 'side-eye' } } });
  const h1 = crypto.createHmac('sha256', 'wh-sirri').update(ts + ':' + govde).digest('hex');
  esit('doğru imza geçer', await paddleImzaDogrula(govde, `ts=${ts};h1=${h1}`, 'wh-sirri'));
  esit('bozuk imza düşer', !(await paddleImzaDogrula(govde, `ts=${ts};h1=${'0'.repeat(64)}`, 'wh-sirri')));
  esit('sırsız imza düşer', !(await paddleImzaDogrula(govde, `ts=${ts};h1=${h1}`, '')));

  // 2) webhook
  let c = await istek('/webhook/paddle', { method: 'POST', body: govde, headers: { 'paddle-signature': `ts=${ts};h1=${'0'.repeat(64)}` } });
  esit('webhook bozuk imzayı 401 ile reddeder', c.status === 401);
  c = await istek('/webhook/paddle', { method: 'POST', body: govde, headers: { 'paddle-signature': `ts=${ts};h1=${h1}` } });
  esit('webhook işlemi KV\'ye yazar', c.status === 200 && depo.has('txn:txn_01abcdefghijklmnopqrstuvwx'));
  const ilgisiz = JSON.stringify({ event_type: 'subscription.activated', data: { id: 'sub_1' } });
  c = await istek('/webhook/paddle', { method: 'POST', body: ilgisiz, headers: { 'paddle-signature': `ts=${ts};h1=${crypto.createHmac('sha256', 'wh-sirri').update(ts + ':' + ilgisiz).digest('hex')}` } });
  esit('ilgisiz olay atlanır', (await c.json()).atlandi === 'subscription.activated');

  // 3) indir
  c = await istek('/indir?txn=bozuk');
  esit('bozuk işlem kimliği 400', c.status === 400);
  c = await istek('/indir?txn=txn_01zzzzzzzzzzzzzzzzzzzzzzzz');
  esit('bilinmeyen işlem (API anahtarı yok) 404', c.status === 404);
  c = await istek('/indir?txn=txn_01abcdefghijklmnopqrstuvwx', { headers: { origin: 'https://stickky.xyz' } });
  const sonuc = await c.json();
  esit('ödenmiş işlem bağlantı üretir', c.status === 200 && sonuc.ad === 'Side Eye Season' && /\/dosya\/side-eye\.wastickers\?exp=\d+&sig=[0-9a-f]{64}/.test(sonuc.wastickers));
  esit('CORS izinli kökene açılır', c.headers.get('access-control-allow-origin') === 'https://stickky.xyz');

  // 4) dosya
  const u = new URL(sonuc.zip);
  c = await istek(u.pathname + u.search);
  esit('imzalı bağlantı dosyayı verir', c.status === 200 && (await c.text()) === 'PK-sahte-zip' && /attachment; filename="side-eye.zip"/.test(c.headers.get('content-disposition')));
  u.searchParams.set('sig', '0'.repeat(64));
  c = await istek(u.pathname + u.search);
  esit('sahte imza 403', c.status === 403);
  const eski = `/dosya/side-eye.zip?exp=1&sig=${await baglantiImzala('imza-sirri', 'side-eye.zip', 1)}`;
  c = await istek(eski);
  esit('süresi dolmuş bağlantı 410', c.status === 410);
  c = await istek('/dosya/..%2F..%2Fetc.zip?exp=9999999999&sig=x');
  esit('yol dışı ad 404', c.status === 404);

  // 5) API yolu (webhook gelmemiş işlem) — fetch taklidi
  const gercekFetch = globalThis.fetch;
  globalThis.fetch = async (url, sec) => {
    assert.ok(String(url).startsWith('https://api.ornek/transactions/txn_01'), 'Paddle API adresi');
    assert.strictEqual(sec.headers.authorization, 'Bearer api-anahtar');
    return new Response(JSON.stringify({ data: { id: 'txn_01apiapiapiapiapiapiapiapi', status: 'paid', customer_id: 'ctm_y', custom_data: { slug: 'side-eye' } } }), { headers: { 'content-type': 'application/json' } });
  };
  env.PADDLE_API_KEY = 'api-anahtar';
  c = await istek('/indir?txn=txn_01apiapiapiapiapiapiapiapi');
  esit('API\'den doğrulanan işlem bağlantı üretir ve KV\'ye yazılır', c.status === 200 && depo.has('txn:txn_01apiapiapiapiapiapiapiapi'));
  globalThis.fetch = gercekFetch;

  console.log(`\nKASA TESTİ GEÇTİ — ${gecti} sınama`);
})().catch(e => { console.error('KASA TESTİ KALDI:', e.message); process.exit(1); });
