'use strict';
/* Atölye arayüzü. Sunucuyla düz JSON konuşur; çerçeve yok. */

const secim = new Set();
let havuz = [];
let setler = [];
let satisLinkleri = {};

const $ = s => document.querySelector(s);

/* Dış metin veridir: kaynak sitelerden gelen etiket/URL/başlık HTML'e
   basılmadan önce her zaman kaçışlanır. */
function kacar(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
      <img src="${kacar(onizlemeUrl(a))}" loading="lazy" alt="">
      <div class="alt">
        <span class="kaynak">${kacar(a.kaynak)}</span>
        <span class="emoji" title="emojiyi değiştir (sticker araması bununla eşleşir)">${kacar(a.emoji || '🙂')}</span>
        ${a.durum === 'hata' ? '<span class="hata-isareti" title="' + kacar(a.hata || '') + '">⚠</span>' : ''}
      </div>
      <span class="sil" title="havuzdan sil">✕</span>`;
    el.addEventListener('click', async e => {
      if (e.target.classList.contains('sil')) return adaySil(a.id);
      if (e.target.classList.contains('emoji')) {
        const yeni = prompt('Bu sticker için emoji (sticker araması bununla eşleşir):', a.emoji || '🙂');
        if (yeni !== null) {
          try {
            await api('/api/aday/' + a.id, { emoji: yeni });
          } catch (h) {
            alert('Emoji kaydedilemedi: ' + h.message);
          }
          yenile();
        }
        return;
      }
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
  sec.innerHTML = setler.map(s => `<option value="${s.id}">${kacar(s.ad)}</option>`).join('')
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
        <b>${kacar(s.ad)}</b>
        <span class="rozet ${s.durum}">${s.durum}</span>
        <span class="rozet">${uyeler.length} üye</span>
        <span class="rozet">${s.olusturan}</span>
        ${s.kapak ? '<span class="rozet">kapak: ' + kacar(s.kapak.tur) + '</span>' : ''}
      </div>
      <div class="set-uyeler">
        ${uyeler.map(a => `
          <span class="uye ${s.tepsi === a.id ? 'tepsi' : ''}" data-id="${a.id}" title="tepsi ikonu yapmak için tıkla">
            <img src="${kacar(onizlemeUrl(a))}" loading="lazy">
            <span class="cikar" title="setten çıkar">✕</span>
          </span>`).join('')}
      </div>
      <div class="set-alt">
        <button class="kucuk" data-is="uret" data-hedef="telegram">Telegram üret</button>
        <button class="kucuk" data-is="uret" data-hedef="wastickers">WhatsApp üret</button>
        <button class="kucuk" data-is="uret" data-hedef="zip">ZIP üret</button>
        <button class="kucuk ikincil" data-is="teslimat">Teslimat sayfası</button>
        <button class="kucuk ikincil" data-is="vitrin">Vitrin görseli</button>
        <button class="kucuk ikincil" data-is="kapak-secili" title="havuzda seçili ilk görseli kapak yap">Kapak: seçiliden</button>
        <button class="kucuk ikincil" data-is="kapak-dosya" title="bilgisayardan görsel yükle">Kapak: dosyadan</button>
        ${s.kapak ? '<button class="kucuk ikincil" data-is="kapak-sifirla">Kapak: otomatik</button>' : ''}
        <button class="kucuk ikincil" data-is="kapak-ai" disabled title="Görsel üretim API'si bağlanınca açılır — paralı servis, karar kullanıcının (ofis/gorsel-uret.js emsali)">Kapak: AI üret</button>
        <button class="kucuk ikincil" data-is="satis-linki">Satış linki</button>
        <select class="kucuk" data-is="durum">
          ${['taslak', 'onayli', 'yayinda'].map(d =>
            `<option value="${d}" ${s.durum === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
        <button class="kucuk ikincil" data-is="sil">Sil</button>
      </div>
      <div class="set-rapor">
        ${raporSatiri(s, 'telegram')}${raporSatiri(s, 'wastickers')}${raporSatiri(s, 'zip')}
        ${s.ciktilar.teslimatSayfa ? `<div><a href="${s.ciktilar.teslimatSayfa}" target="_blank">teslimat sayfası ↗</a></div>` : ''}
        ${s.ciktilar.vitrin ? `<div><a href="${s.ciktilar.vitrin}" target="_blank">vitrin görseli ↗</a></div>` : ''}
        ${(satisLinkleri[s.id] || []).map(t => `<div>satış linki: <a href="/t/${t.token}" target="_blank">/t/${t.token}</a> · ${t.acilis} açılış · ${t.kaynak}</div>`).join('')}
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
        if (is === 'vitrin') {
          e.target.disabled = true;
          await api(`/api/set/${s.id}/vitrin`, {});
        }
        if (is === 'satis-linki') await api(`/api/set/${s.id}/satis-linki`, {});
        if (is === 'kapak-secili') {
          if (!secim.size) throw new Error('önce havuzdan bir görsel seç');
          await api(`/api/set/${s.id}/kapak`, { adayId: [...secim][0] });
        }
        if (is === 'kapak-sifirla') await api(`/api/set/${s.id}/kapak`, { sifirla: true });
        if (is === 'kapak-dosya') {
          const girdi = $('#kapak-dosya-girdi');
          girdi.dataset.setId = s.id;
          girdi.click();
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

async function izlemeCiz() {
  const { liste } = await api('/api/izleme');
  const kap = $('#izleme-liste');
  kap.innerHTML = liste.map(k => `
    <span class="cip">${kacar(k.kelime)}
      ${k.sonSonuc ? `<span class="sonuc" title="${kacar(k.sonSonuc)}">·</span>` : ''}
      <span class="kaldir" data-kelime="${kacar(k.kelime)}">✕</span>
    </span>`).join('');
}
$('#izleme-liste').addEventListener('click', async e => {
  const kelime = e.target.dataset.kelime;
  if (!kelime) return;
  await api('/api/izleme/sil', { kelime });
  izlemeCiz();
});
$('#izleme-ekle').addEventListener('submit', async e => {
  e.preventDefault();
  await api('/api/izleme', { kelime: $('#izleme-kelime').value });
  e.target.reset();
  izlemeCiz();
});
$('#otonom-simdi').addEventListener('click', async () => {
  const dugme = $('#otonom-simdi');
  dugme.disabled = true;
  dugme.textContent = 'tarıyor…';
  try {
    const r = await api('/api/otonom', {});
    $('#ai-sonuc').className = 'ai-sonuc';
    $('#ai-sonuc').textContent = r.sonuclar
      ? 'otonom tarama: ' + r.sonuclar.map(s => s.kelime + (s.setId ? '→taslak' : '·' + (s.atlandi || s.sonuc))).join(' | ')
      : JSON.stringify(r);
  } catch (h) {
    $('#ai-sonuc').className = 'ai-sonuc hata';
    $('#ai-sonuc').textContent = h.message;
  }
  dugme.disabled = false;
  dugme.textContent = 'Şimdi tara';
  yenile(); izlemeCiz();
});
izlemeCiz();

$('#kapak-dosya-girdi').addEventListener('change', async e => {
  const dosya = e.target.files[0];
  const setId = e.target.dataset.setId;
  if (!dosya || !setId) return;
  try {
    const r = await fetch(`/api/set/${setId}/kapak-yukle`, {
      method: 'POST',
      headers: { 'Content-Type': dosya.type },
      body: dosya
    });
    const veri = await r.json();
    if (!r.ok) throw new Error(veri.hata || r.status);
  } catch (h) {
    alert('Kapak yüklenemedi: ' + h.message);
  }
  e.target.value = '';
  yenile();
});

/* ---------- Döngü ---------- */

async function yenile() {
  let teslimatlar;
  [havuz, setler, teslimatlar] = await Promise.all([
    api('/api/aday'), api('/api/set'), api('/api/teslimatlar')
  ]);
  satisLinkleri = {};
  for (const t of teslimatlar) (satisLinkleri[t.setId] = satisLinkleri[t.setId] || []).push(t);
  const durum = await api('/api/durum');
  $('#durum').innerHTML =
    `havuz ${durum.havuz} · indirilen ${durum.indirilen} · set ${durum.setler}` +
    (durum.ffmpeg ? '' : ' · <span class="kotu">ffmpeg yok (Telegram animasyon kapalı)</span>');
  havuzCiz(); setCiz(); secimCiz();
}

yenile();
setInterval(yenile, 5000);
