'use strict';
/* Atölye arayüzü. Sunucuyla düz JSON konuşur; çerçeve yok. */

const secim = new Set();
let havuz = [];
let setler = [];

const $ = s => document.querySelector(s);

async function api(yol, govde) {
  const r = await fetch(yol, govde
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) }
    : undefined);
  const veri = await r.json();
  if (!r.ok) throw new Error(veri.hata || r.status);
  return veri;
}

function onizlemeUrl(aday) {
  // İndirildiyse yerel kopya (kaynak site kapanırsa da çalışır), yoksa uzak URL.
  return aday.dosya ? '/medya/' + aday.dosya.split('/').pop() : aday.medyaUrl;
}

/* ---------- Havuz ---------- */

function havuzCiz() {
  const kap = $('#havuz');
  $('#havuz-sayi').textContent = havuz.length ? '· ' + havuz.length : '';
  if (!havuz.length) {
    kap.innerHTML = '<div class="bos">Havuz boş. Eklentiyle Giphy/Pinterest\'ten at ya da yukarıya URL yapıştır.</div>';
    return;
  }
  kap.innerHTML = '';
  for (const a of [...havuz].reverse()) {
    const el = document.createElement('div');
    el.className = 'aday' + (secim.has(a.id) ? ' secili' : '');
    el.innerHTML = `
      <img src="${onizlemeUrl(a)}" loading="lazy" alt="">
      <div class="alt">
        <span class="kaynak">${a.kaynak}</span>
        ${a.durum === 'hata' ? '<span class="hata-isareti" title="' + (a.hata || '') + '">⚠</span>' : ''}
      </div>
      <span class="sil" title="havuzdan sil">✕</span>`;
    el.addEventListener('click', e => {
      if (e.target.classList.contains('sil')) return adaySil(a.id);
      secim.has(a.id) ? secim.delete(a.id) : secim.add(a.id);
      havuzCiz(); secimCiz();
    });
    kap.appendChild(el);
  }
}

async function adaySil(id) {
  await api('/api/aday/' + id + '/sil', {});
  secim.delete(id);
  yenile();
}

/* ---------- Seçim çubuğu ---------- */

function secimCiz() {
  const cubuk = $('#secim-cubugu');
  if (!secim.size) { cubuk.classList.add('gizli'); return; }
  cubuk.classList.remove('gizli');
  $('#secim-sayi').textContent = secim.size + ' seçili';
  const sec = $('#secim-hedef-set');
  sec.innerHTML = setler.map(s => `<option value="${s.id}">${s.ad}</option>`).join('')
    || '<option value="">önce set aç</option>';
}

$('#secim-ekle').addEventListener('click', async () => {
  const setId = $('#secim-hedef-set').value;
  if (!setId) return;
  await api('/api/set/' + setId, { ekle: [...secim] });
  secim.clear();
  yenile();
});
$('#secim-birak').addEventListener('click', () => { secim.clear(); havuzCiz(); secimCiz(); });

/* ---------- Setler ---------- */

function raporSatiri(set, hedef) {
  const r = set.ciktilar && set.ciktilar[hedef];
  if (!r) return '';
  const temel = `${hedef}: ${r.dosyalar.length} sticker`;
  const paket = r.paket ? ` — <a href="/cikti/${set.id}/${hedef}/${r.paket}" download>${r.paket}</a>` : '';
  const hatalar = (r.hatalar || []).filter(h => h.sonuc === 'hata');
  const uyarilar = (r.hatalar || []).filter(h => h.sonuc === 'uyari');
  const ek = (hatalar.length ? ` <span class="hata-satir">· ${hatalar.length} hata</span>` : '')
    + (uyarilar.length ? ` · ${uyarilar.length} uyarı` : '');
  return `<div>${temel}${paket}${ek}</div>`;
}

function setCiz() {
  const kap = $('#set-liste');
  if (!setler.length) {
    kap.innerHTML = '<div class="bos">Henüz set yok.</div>';
    return;
  }
  kap.innerHTML = '';
  for (const s of [...setler].reverse()) {
    const uyeler = s.uyeler.map(id => havuz.find(a => a.id === id)).filter(Boolean);
    const el = document.createElement('div');
    el.className = 'set';
    el.innerHTML = `
      <div class="set-ust">
        <b>${s.ad}</b>
        <span class="rozet ${s.durum}">${s.durum}</span>
        <span class="rozet">${uyeler.length} üye</span>
        <span class="rozet">${s.olusturan}</span>
      </div>
      <div class="set-uyeler">
        ${uyeler.map(a => `
          <span class="uye ${s.tepsi === a.id ? 'tepsi' : ''}" data-id="${a.id}" title="tepsi ikonu yapmak için tıkla">
            <img src="${onizlemeUrl(a)}" loading="lazy">
            <span class="cikar" title="setten çıkar">✕</span>
          </span>`).join('')}
      </div>
      <div class="set-alt">
        <button class="kucuk" data-is="uret" data-hedef="telegram">Telegram üret</button>
        <button class="kucuk" data-is="uret" data-hedef="wastickers">WhatsApp üret</button>
        <button class="kucuk" data-is="uret" data-hedef="zip">ZIP üret</button>
        <button class="kucuk ikincil" data-is="teslimat">Teslimat sayfası</button>
        <select class="kucuk" data-is="durum">
          ${['taslak', 'onayli', 'yayinda'].map(d =>
            `<option value="${d}" ${s.durum === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
        <button class="kucuk ikincil" data-is="sil">Sil</button>
      </div>
      <div class="set-rapor">
        ${raporSatiri(s, 'telegram')}${raporSatiri(s, 'wastickers')}${raporSatiri(s, 'zip')}
        ${s.ciktilar.teslimatSayfa ? `<div><a href="${s.ciktilar.teslimatSayfa}" target="_blank">teslimat sayfası ↗</a></div>` : ''}
      </div>`;

    el.querySelector('.set-uyeler').addEventListener('click', async e => {
      const uye = e.target.closest('.uye');
      if (!uye) return;
      if (e.target.classList.contains('cikar')) {
        await api('/api/set/' + s.id, { cikar: [uye.dataset.id] });
      } else {
        await api('/api/set/' + s.id, { tepsi: uye.dataset.id });
      }
      yenile();
    });

    el.querySelector('.set-alt').addEventListener('click', async e => {
      const is = e.target.dataset.is;
      if (!is) return;
      try {
        if (is === 'uret') {
          e.target.disabled = true;
          e.target.textContent = 'üretiliyor…';
          await api(`/api/set/${s.id}/uret`, { hedef: e.target.dataset.hedef });
        }
        if (is === 'teslimat') {
          const sonuc = await api(`/api/set/${s.id}/teslimat`, {});
          await api('/api/set/' + s.id, { ciktilar: { teslimatSayfa: sonuc.dosya } });
        }
        if (is === 'sil' && confirm(`"${s.ad}" silinsin mi?`)) {
          await api(`/api/set/${s.id}/sil`, {});
        }
      } catch (h) {
        alert('Hata: ' + h.message);
      }
      yenile();
    });
    el.querySelector('[data-is="durum"]').addEventListener('change', async e => {
      await api('/api/set/' + s.id, { durum: e.target.value });
      yenile();
    });

    kap.appendChild(el);
  }
}

/* ---------- Formlar ---------- */

$('#elle-ekle').addEventListener('submit', async e => {
  e.preventDefault();
  const etiketler = $('#elle-etiket').value.split(',').map(t => t.trim()).filter(Boolean);
  await api('/api/aday', { kaynak: 'elle', medyaUrl: $('#elle-url').value, etiketler });
  e.target.reset();
  setTimeout(yenile, 600); // indirme arka planda başlar, kısa bekle
});

$('#set-ac').addEventListener('submit', async e => {
  e.preventDefault();
  await api('/api/set', { ad: $('#set-ad').value });
  e.target.reset();
  yenile();
});

$('#ai-taslak').addEventListener('submit', async e => {
  e.preventDefault();
  const sonucEl = $('#ai-sonuc');
  sonucEl.className = 'ai-sonuc';
  sonucEl.textContent = 'küratör çalışıyor…';
  try {
    const { set, rapor } = await api('/api/kurator', { kelimeler: $('#ai-kelimeler').value });
    const giphyNot = rapor.giphy.durum === 'anahtar-yok'
      ? 'yalnız havuz (GIPHY_API_KEY yok)'
      : 'giphy +' + rapor.giphy.eklenen;
    sonucEl.textContent =
      `"${set.ad}" kuruldu: ${rapor.alinan} üye · baraj geçen ${rapor.barajGecen}/${rapor.degerlendirilen} · ${giphyNot}`;
    e.target.reset();
  } catch (h) {
    sonucEl.className = 'ai-sonuc hata';
    sonucEl.textContent = h.message;
  }
  yenile();
});

/* ---------- Döngü ---------- */

async function yenile() {
  [havuz, setler] = await Promise.all([api('/api/aday'), api('/api/set')]);
  const durum = await api('/api/durum');
  $('#durum').innerHTML =
    `havuz ${durum.havuz} · indirilen ${durum.indirilen} · set ${durum.setler}` +
    (durum.ffmpeg ? '' : ' · <span class="kotu">ffmpeg yok (Telegram animasyon kapalı)</span>');
  havuzCiz(); setCiz(); secimCiz();
}

yenile();
setInterval(yenile, 5000);
