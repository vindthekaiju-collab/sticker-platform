'use strict';
/**
 * Service worker: content script'ten gelen adayları sunucuya iletir.
 * Sunucu kapalıysa kuyruğa yazar (chrome.storage.local) ve sunucu
 * dönünce boşaltır — yürüyüşte toplanan hiçbir şey kaybolmaz.
 */

const SUNUCU = 'http://127.0.0.1:47411';

async function gonder(kayit) {
  const cevap = await fetch(SUNUCU + '/api/aday', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(kayit)
  });
  if (!cevap.ok) throw new Error('HTTP ' + cevap.status);
  return { veri: await cevap.json(), yeni: cevap.status === 201 };
}

async function kuyrugaYaz(kayit) {
  const { kuyruk = [] } = await chrome.storage.local.get('kuyruk');
  kuyruk.push({ ...kayit, kuyrukZamani: Date.now() });
  await chrome.storage.local.set({ kuyruk });
  return kuyruk.length;
}

async function kuyrukBosalt() {
  const { kuyruk = [] } = await chrome.storage.local.get('kuyruk');
  if (!kuyruk.length) return { gonderilen: 0, kalan: 0 };
  const kalanlar = [];
  let gonderilen = 0;
  for (const kayit of kuyruk) {
    try {
      await gonder(kayit);
      gonderilen++;
    } catch {
      kalanlar.push(kayit);
    }
  }
  await chrome.storage.local.set({ kuyruk: kalanlar });
  return { gonderilen, kalan: kalanlar.length };
}

chrome.runtime.onMessage.addListener((mesaj, gonderen, yanitla) => {
  if (mesaj.tip === 'aday') {
    gonder(mesaj.kayit)
      .then(({ veri, yeni }) => {
        kuyrukBosalt().catch(() => {});
        yanitla({ ok: true, yeni, id: veri.id });
      })
      .catch(async () => {
        const boy = await kuyrugaYaz(mesaj.kayit);
        yanitla({ ok: false, kuyruk: boy });
      });
    return true; // async yanıt
  }
  if (mesaj.tip === 'durum') {
    Promise.all([
      fetch(SUNUCU + '/api/health').then(r => r.ok).catch(() => false),
      chrome.storage.local.get('kuyruk')
    ]).then(([sunucu, { kuyruk = [] }]) => yanitla({ sunucu, kuyruk: kuyruk.length }));
    return true;
  }
  if (mesaj.tip === 'kuyruk-bosalt') {
    kuyrukBosalt().then(yanitla);
    return true;
  }
});
