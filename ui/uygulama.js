'use strict';
/* stickky atölye — arayüz. Sunucuyla düz JSON konuşur; çerçeve yok.
   Akış: havuz (topla) → set (seç) → üret → yayınla. */

const $ = s => document.querySelector(s);

const secim = new Set();
let havuz = [];
let setler = [];
let satisLinkleri = {};
let suzgec = '';

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

/* ---------- Bildirim (alert yerine) ---------- */

function bildir(metin, tur = 'iyi') {
  const el = document.createElement('div');
  el.className = 'bildirim ' + tur;
  el.innerHTML = `<span class="bildirim-im">${tur === 'hata' ? '⚠' : '✓'}</span><span>${kacar(metin)}</span>`;
  $('#bildirimler').appendChild(el);
  setTimeout(() => {
    el.classList.add('giden');
    setTimeout(() => el.remove(), 280);
  }, tur === 'hata' ? 6000 : 3200);
}

/* İşlem sarmalayıcı: düğmeyi kilitler, hatayı bildirime çevirir. */
async function calistir(dugme, is, basarili) {
  const eskiMetin = dugme && dugme.textContent;
  if (dugme) { dugme.disabled = true; dugme.textContent = '…'; }
  try {
    const sonuc = await is();
    if (basarili) bildir(typeof basarili === 'function' ? basarili(sonuc) : basarili);
    return sonuc;
  } catch (h) {
    bildir(h.message, 'hata');
  } finally {
    if (dugme) { dugme.disabled = false; dugme.textContent = eskiMetin; }
    yenile();
  }
}

/* ---------- Havuz ---------- */

function suzulmusHavuz() {
  if (!suzgec) return havuz;
  const q = suzgec.toLowerCase();
  return havuz.filter(a =>
    (a.kaynak || '').toLowerCase().includes(q) ||
    (a.etiketler || []).some(t => String(t).toLowerCase().includes(q)));
}

/* Aday hangi temaya ait? Toplarken son etiket tema olarak yazılıyor
   (ofis · tepki · sevimli …). Sabit liste tutmuyoruz: yeni tema eklenince
   kendiliğinden yeni başlık açılsın. */
function temaAdi(a) {
  const e = a.etiketler || [];
  return e.length ? e[e.length - 1] : 'etiketsiz';
}

function adayKarti(a) {
  return `
    <div class="aday${secim.has(a.id) ? ' secili' : ''}" data-id="${kacar(a.id)}"
         role="button" tabindex="0" aria-pressed="${secim.has(a.id)}">
      <div class="aday-gorsel">
        <img src="${kacar(onizlemeUrl(a))}" loading="lazy" alt="${kacar((a.etiketler || []).join(' '))}">
        <span class="aday-tik" aria-hidden="true"></span>
        <button class="aday-sil" data-is="sil" title="Havuzdan sil" aria-label="Havuzdan sil">✕</button>
      </div>
      <div class="aday-alt">
        <span class="aday-kaynak" title="${kacar((a.etiketler || []).join(', '))}">${kacar(a.kaynak)}</span>
        ${a.durum === 'hata' ? `<span class="aday-hata" title="${kacar(a.hata || '')}">⚠</span>` : ''}
        <button class="aday-emoji" data-is="emoji"
                title="Emoji — sticker araması bununla eşleşir">${kacar(a.emoji || '🙂')}</button>
      </div>
    </div>`;
}

function havuzCiz() {
  const kap = $('#havuz');
  const liste = suzulmusHavuz();
  $('#havuz-sayi').textContent = suzgec ? liste.length + '/' + havuz.length : havuz.length;

  if (!havuz.length) {
    kap.innerHTML = `
      <div class="bos">
        <span class="bos-im">🗂</span>
        <span class="bos-baslik">Havuz boş</span>
        <p>Chrome eklentisiyle Giphy veya Pinterest'te bir görselin üstüne gel,
           çıkan <b>＋ havuza</b> düğmesine bas. Ya da yukarıdaki kutuya doğrudan
           medya adresi yapıştır.</p>
      </div>`;
    return;
  }
  if (!liste.length) {
    kap.innerHTML = `<div class="bos">
      <span class="bos-im">🔍</span><span class="bos-baslik">Eşleşme yok</span>
      <p>“${kacar(suzgec)}” için havuzda aday bulunamadı.</p></div>`;
    return;
  }

  // Temaya göre öbekle; en kalabalık tema üstte.
  const obekler = new Map();
  for (const a of [...liste].reverse()) {
    const t = temaAdi(a);
    if (!obekler.has(t)) obekler.set(t, []);
    obekler.get(t).push(a);
  }
  const sirali = [...obekler.entries()].sort((x, y) => y[1].length - x[1].length);

  // Tek tema varsa başlık gürültü olur — düz ızgara çiz.
  if (sirali.length <= 1) {
    kap.innerHTML = `<div class="izgara">${liste.slice().reverse().map(adayKarti).join('')}</div>`;
    return;
  }

  kap.innerHTML = sirali.map(([tema, ogeler]) => {
    const hepsiSecili = ogeler.every(a => secim.has(a.id));
    return `
    <details class="obek" open data-tema="${kacar(tema)}">
      <summary>
        <span class="obek-ad">${kacar(tema)}</span>
        <span class="sayac">${ogeler.length}</span>
        <button type="button" class="obek-sec" data-tema-sec="${kacar(tema)}">
          ${hepsiSecili ? 'bırak' : 'hepsini seç'}
        </button>
      </summary>
      <div class="izgara">${ogeler.map(adayKarti).join('')}</div>
    </details>`;
  }).join('');
}

$('#havuz').addEventListener('click', e => {
  // Öbek başlığındaki "hepsini seç"
  const temaSec = e.target.dataset.temaSec;
  if (temaSec) {
    e.preventDefault();
    const ogeler = suzulmusHavuz().filter(a => temaAdi(a) === temaSec);
    const hepsi = ogeler.every(a => secim.has(a.id));
    ogeler.forEach(a => hepsi ? secim.delete(a.id) : secim.add(a.id));
    havuzCiz(); secimCiz();
    return;
  }
  const kart = e.target.closest('.aday');
  if (!kart) return;
  const id = kart.dataset.id;
  const is = e.target.dataset.is;
  if (is === 'sil') return adaySil(id, e.target);
  if (is === 'emoji') return emojiAc(e.target, id);
  secim.has(id) ? secim.delete(id) : secim.add(id);
  havuzCiz(); secimCiz();
});
$('#havuz').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const kart = e.target.closest('.aday');
  if (!kart) return;
  e.preventDefault();
  secim.has(kart.dataset.id) ? secim.delete(kart.dataset.id) : secim.add(kart.dataset.id);
  havuzCiz(); secimCiz();
});

function adaySil(id, dugme) {
  return calistir(dugme, async () => {
    await api('/api/aday/' + id + '/sil', {});
    secim.delete(id);
  }, 'Havuzdan silindi');
}

$('#havuz-ara').addEventListener('input', e => { suzgec = e.target.value.trim(); havuzCiz(); });
$('#tumunu-sec').addEventListener('click', () => {
  const liste = suzulmusHavuz();
  const hepsiSecili = liste.length && liste.every(a => secim.has(a.id));
  liste.forEach(a => hepsiSecili ? secim.delete(a.id) : secim.add(a.id));
  havuzCiz(); secimCiz();
});

/* ---------- Emoji seçici (prompt yerine) ---------- */

const EMOJILER = ['🙂','😂','🥲','😍','😎','🤔','😴','🤯','😭','😡','🙃','🤝',
                  '🔥','💀','✨','💯','👀','👍','👎','🙏','🎉','☕','💸','🧠',
                  '❤️','💔','⚡','🌙','🍀','🎯','📌','🚀'];
let emojiHedef = null;

function emojiAc(dugme, adayId) {
  const p = $('#emoji-secici');
  emojiHedef = adayId;
  $('#emoji-izgara').innerHTML = EMOJILER
    .map(e => `<button type="button" data-e="${kacar(e)}">${kacar(e)}</button>`).join('');
  p.classList.remove('gizli');
  const k = dugme.getBoundingClientRect();
  const genislik = 244;
  p.style.left = Math.max(8, Math.min(k.left + scrollX, scrollX + innerWidth - genislik - 8)) + 'px';
  p.style.top = (k.bottom + scrollY + 6) + 'px';
  $('#emoji-girdi').value = '';
}
function emojiKapat() { $('#emoji-secici').classList.add('gizli'); emojiHedef = null; }

async function emojiKaydet(deger) {
  const id = emojiHedef;
  emojiKapat();
  if (!id || !deger) return;
  try { await api('/api/aday/' + id, { emoji: deger }); }
  catch (h) { bildir('Emoji kaydedilemedi: ' + h.message, 'hata'); }
  yenile();
}
$('#emoji-izgara').addEventListener('click', e => {
  if (e.target.dataset.e) emojiKaydet(e.target.dataset.e);
});
$('#emoji-elle').addEventListener('submit', e => {
  e.preventDefault();
  emojiKaydet($('#emoji-girdi').value.trim());
});
document.addEventListener('click', e => {
  if (!$('#emoji-secici').contains(e.target) && !e.target.closest('[data-is="emoji"]')) emojiKapat();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { emojiKapat(); document.querySelectorAll('.menu[open]').forEach(m => m.open = false); }
});

/* ---------- Seçim çubuğu ---------- */

function secimCiz() {
  const cubuk = $('#secim-cubugu');
  if (!secim.size) { cubuk.classList.add('gizli'); return; }
  cubuk.classList.remove('gizli');
  $('#secim-sayi').textContent = secim.size + ' seçili';
  const sec = $('#secim-hedef-set');
  const onceki = sec.value;
  sec.innerHTML = setler.length
    ? setler.map(s => `<option value="${kacar(s.id)}">${kacar(s.ad)}</option>`).join('')
    : '<option value="">önce bir set aç</option>';
  if (onceki && [...sec.options].some(o => o.value === onceki)) sec.value = onceki;
}

$('#secim-ekle').addEventListener('click', e => {
  const setId = $('#secim-hedef-set').value;
  if (!setId) return bildir('Önce bir set aç', 'hata');
  const adet = secim.size;
  calistir(e.target, async () => {
    await api('/api/set/' + setId, { ekle: [...secim] });
    secim.clear();
  }, adet + ' sticker sete eklendi');
});
$('#secim-birak').addEventListener('click', () => { secim.clear(); havuzCiz(); secimCiz(); });

/* ---------- Setler ---------- */

const HEDEF_AD = { telegram: 'Telegram', wastickers: 'WhatsApp', zip: 'ZIP' };
// Bundan çok üyesi olan setin şeridi kapalı açılır — 24 küçük görsel kartı
// devirip listeyi gezilemez hale getiriyordu.
const UYE_ESIK = 12;

function raporSatiri(set, hedef) {
  const r = set.ciktilar && set.ciktilar[hedef];
  if (!r) return '';
  const hatalar = (r.hatalar || []).filter(h => h.sonuc === 'hata').length;
  const uyarilar = (r.hatalar || []).filter(h => h.sonuc === 'uyari').length;
  return `<div class="rapor-satir">
    <span class="rapor-etiket">${kacar(HEDEF_AD[hedef] || hedef)}</span>
    <span>${r.dosyalar.length} sticker</span>
    ${r.paket ? `<a href="/cikti/${kacar(set.id)}/${kacar(hedef)}/${kacar(r.paket)}" download>${kacar(r.paket)} ↓</a>` : ''}
    ${hatalar ? `<span class="kotu">${hatalar} hata</span>` : ''}
    ${uyarilar ? `<span class="orta">${uyarilar} uyarı</span>` : ''}
  </div>`;
}

function setCiz() {
  const kap = $('#set-liste');
  $('#set-sayi').textContent = setler.length;

  if (!setler.length) {
    kap.innerHTML = `
      <div class="bos">
        <span class="bos-im">📦</span>
        <span class="bos-baslik">Henüz set yok</span>
        <p>Yukarıdan bir set aç, sonra havuzdan sticker seçip sete ekle.
           Bir Telegram seti tipik olarak 15-30 sticker taşır.</p>
      </div>`;
    return;
  }

  // Açık ⋯ menüleri ve açılmış üye şeritleri yeniden çizimde korunsun.
  const acikMenuler = new Set([...kap.querySelectorAll('.menu[open]')].map(m => m.dataset.setId));

  const setKarti = (s) => {
    const uyeler = s.uyeler.map(id => havuz.find(a => a.id === id)).filter(Boolean);
    const linkler = satisLinkleri[s.id] || [];
    return `
    <article class="set" data-set-id="${kacar(s.id)}">
      <div class="set-ust">
        <div>
          <div class="set-ad">${kacar(s.ad)}</div>
          <div class="set-rozetler">
            <span class="rozet d-${kacar(s.durum)}">${kacar(s.durum)}</span>
            <span class="rozet">${uyeler.length} sticker</span>
            <span class="rozet">${s.olusturan === 'ai' ? '🤖 küratör' : '✋ elle'}</span>
            ${s.kapak ? `<span class="rozet">kapak: ${kacar(s.kapak.tur)}</span>` : ''}
          </div>
        </div>
        <div class="set-denetim">
          <select data-is="durum" aria-label="Set durumu">
            ${['taslak', 'onayli', 'yayinda'].map(d =>
              `<option value="${d}"${s.durum === d ? ' selected' : ''}>${d}</option>`).join('')}
          </select>
          <details class="menu" data-set-id="${kacar(s.id)}"${acikMenuler.has(s.id) ? ' open' : ''}>
            <summary title="Daha fazla" aria-label="Daha fazla">⋯</summary>
            <div class="menu-govde">
              <button type="button" data-is="kapak-secili">Kapak: havuzda seçiliden</button>
              <button type="button" data-is="kapak-dosya">Kapak: bilgisayardan yükle</button>
              ${s.kapak ? '<button type="button" data-is="kapak-sifirla">Kapak: otomatiğe dön</button>' : ''}
              <button type="button" data-is="kapak-ai" disabled
                title="Görsel üretim API'si bağlanınca açılır — paralı servis, karar kullanıcının">Kapak: AI üret</button>
              <div class="menu-ayrac"></div>
              <button type="button" data-is="sil" class="tehlike">Seti sil</button>
            </div>
          </details>
        </div>
      </div>

      ${uyeler.length ? `
      <details class="set-uyeler-kap"${uyeler.length <= UYE_ESIK ? ' open' : ''}>
        <summary${uyeler.length <= UYE_ESIK ? ' hidden' : ''}>
          ${uyeler.length} sticker — <span class="ac-kapa">göster</span>
        </summary>
        <div class="set-uyeler">
          ${uyeler.map(a => `
            <span class="uye${s.tepsi === a.id ? ' tepsi' : ''}" data-id="${kacar(a.id)}">
              <span class="uye-kare" title="Tepsi ikonu yapmak için tıkla">
                <img src="${kacar(onizlemeUrl(a))}" loading="lazy" alt="">
              </span>
              ${s.tepsi === a.id ? '<span class="uye-tepsi-im">TEPSİ</span>' : ''}
              <button class="uye-cikar" data-is="cikar" title="Setten çıkar" aria-label="Setten çıkar">✕</button>
            </span>`).join('')}
        </div>
      </details>` : `
      <div style="padding:0 15px 13px">
        <div class="bos" style="padding:18px">
          <span class="bos-baslik">Bu set boş</span>
          <p>Havuzdan sticker seç, alttaki çubuktan bu sete ekle.</p>
        </div>
      </div>`}

      <div class="asama">
        <span class="asama-ad">1 · Üret</span>
        <div class="asama-sira">
          <button type="button" class="dugme kucuk" data-is="uret" data-hedef="telegram">Telegram</button>
          <button type="button" class="dugme kucuk" data-is="uret" data-hedef="wastickers">WhatsApp</button>
          <button type="button" class="dugme kucuk sessiz" data-is="uret" data-hedef="zip">ZIP</button>
        </div>
        ${(s.ciktilar && (s.ciktilar.telegram || s.ciktilar.wastickers || s.ciktilar.zip)) ? `
        <div class="rapor">
          ${raporSatiri(s, 'telegram')}${raporSatiri(s, 'wastickers')}${raporSatiri(s, 'zip')}
        </div>` : ''}
      </div>

      <div class="asama">
        <span class="asama-ad">2 · Yayınla</span>
        <div class="asama-sira">
          <button type="button" class="dugme kucuk sessiz" data-is="teslimat">Teslimat sayfası</button>
          <button type="button" class="dugme kucuk sessiz" data-is="vitrin">Vitrin görseli</button>
          <button type="button" class="dugme kucuk sessiz" data-is="satis-linki">Satış linki üret</button>
        </div>
        ${(s.ciktilar.teslimatSayfa || s.ciktilar.vitrin || linkler.length) ? `
        <div class="rapor">
          ${s.ciktilar.teslimatSayfa ? `<div class="rapor-satir"><span class="rapor-etiket">Teslimat</span>
            <a href="${kacar(s.ciktilar.teslimatSayfa)}" target="_blank" rel="noopener">sayfayı aç ↗</a></div>` : ''}
          ${s.ciktilar.vitrin ? `<div class="rapor-satir"><span class="rapor-etiket">Vitrin</span>
            <a href="${kacar(s.ciktilar.vitrin)}" target="_blank" rel="noopener">görseli aç ↗</a></div>` : ''}
          ${linkler.map(t => `<div class="rapor-satir"><span class="rapor-etiket">Satış</span>
            <a href="/t/${kacar(t.token)}" target="_blank" rel="noopener">/t/${kacar(t.token)}</a>
            <span>${kacar(t.acilis)} açılış · ${kacar(t.kaynak)}</span></div>`).join('')}
        </div>` : ''}
      </div>
    </article>`;
  };

  /* Setler duruma göre öbeklenir — panel akışın neresinde olduğunu göstersin.
     Sıra iş akışı sırası: üstünde çalışılan taslaklar en üstte. */
  const DURUMLAR = [
    { anahtar: 'taslak', ad: 'Taslak', not: 'üstünde çalışılıyor — yayına çıkmaz' },
    { anahtar: 'onayli', ad: 'Onaylı', not: 'içerik tamam, satışa hazırlanıyor' },
    { anahtar: 'yayinda', ad: 'Yayında', not: 'mağazada ve satış linkinde görünür' }
  ];
  const ters = [...setler].reverse();
  kap.innerHTML = DURUMLAR.map(d => {
    const grup = ters.filter(s => s.durum === d.anahtar);
    if (!grup.length) return '';
    return `
      <div class="set-obek">
        <div class="set-obek-ust">
          <h3>${d.ad}<span class="sayac">${grup.length}</span></h3>
          <span class="set-obek-not">${d.not}</span>
        </div>
        ${grup.map(setKarti).join('')}
      </div>`;
  }).join('');

  // Bilinmeyen bir durum varsa sessizce kaybolmasın.
  const bilinen = new Set(DURUMLAR.map(d => d.anahtar));
  const digerleri = ters.filter(s => !bilinen.has(s.durum));
  if (digerleri.length) {
    kap.innerHTML += `<div class="set-obek">
      <div class="set-obek-ust"><h3>Diğer<span class="sayac">${digerleri.length}</span></h3></div>
      ${digerleri.map(setKarti).join('')}</div>`;
  }
}

$('#set-liste').addEventListener('click', e => {
  const kart = e.target.closest('.set');
  if (!kart) return;
  const s = setler.find(x => x.id === kart.dataset.setId);
  if (!s) return;
  const is = e.target.dataset.is;

  // üye şeridi
  const uye = e.target.closest('.uye');
  if (uye && !is) {
    return calistir(null, () => api('/api/set/' + s.id, { tepsi: uye.dataset.id }), 'Tepsi ikonu seçildi');
  }
  if (is === 'cikar') {
    return calistir(null, () => api('/api/set/' + s.id, { cikar: [uye.dataset.id] }), 'Setten çıkarıldı');
  }
  if (!is) return;

  const d = e.target;
  if (is === 'uret') {
    const hedef = d.dataset.hedef;
    // /uret raporun kendisini döner: { dosyalar, paket, hatalar }
    return calistir(d, () => api(`/api/set/${s.id}/uret`, { hedef }), r => {
      const hata = (r.hatalar || []).filter(h => h.sonuc === 'hata').length;
      return `${HEDEF_AD[hedef]}: ${(r.dosyalar || []).length} sticker üretildi`
        + (hata ? ` · ${hata} hata` : '');
    });
  }
  if (is === 'teslimat') {
    return calistir(d, async () => {
      const sonuc = await api(`/api/set/${s.id}/teslimat`, {});
      await api('/api/set/' + s.id, { ciktilar: { teslimatSayfa: sonuc.dosya } });
    }, 'Teslimat sayfası hazır');
  }
  if (is === 'vitrin') return calistir(d, () => api(`/api/set/${s.id}/vitrin`, {}), 'Vitrin görseli üretildi');
  if (is === 'satis-linki') return calistir(d, () => api(`/api/set/${s.id}/satis-linki`, {}), 'Satış linki üretildi');
  if (is === 'kapak-secili') {
    kart.querySelector('.menu').open = false;
    if (!secim.size) return bildir('Önce havuzdan bir görsel seç', 'hata');
    return calistir(null, () => api(`/api/set/${s.id}/kapak`, { adayId: [...secim][0] }), 'Kapak ayarlandı');
  }
  if (is === 'kapak-sifirla') {
    kart.querySelector('.menu').open = false;
    return calistir(null, () => api(`/api/set/${s.id}/kapak`, { sifirla: true }), 'Kapak otomatiğe döndü');
  }
  if (is === 'kapak-dosya') {
    kart.querySelector('.menu').open = false;
    const girdi = $('#kapak-dosya-girdi');
    girdi.dataset.setId = s.id;
    girdi.click();
    return;
  }
  if (is === 'sil') {
    kart.querySelector('.menu').open = false;
    if (!confirm(`"${s.ad}" seti silinsin mi? Bu geri alınamaz.`)) return;
    return calistir(null, () => api(`/api/set/${s.id}/sil`, {}), 'Set silindi');
  }
});

$('#set-liste').addEventListener('change', e => {
  if (e.target.dataset.is !== 'durum') return;
  const kart = e.target.closest('.set');
  calistir(null, () => api('/api/set/' + kart.dataset.setId, { durum: e.target.value }),
    'Durum: ' + e.target.value);
});

/* ---------- Formlar ---------- */

$('#elle-ekle').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  const etiketler = $('#elle-etiket').value.split(',').map(t => t.trim()).filter(Boolean);
  calistir(form.querySelector('button'), async () => {
    await api('/api/aday', { kaynak: 'elle', medyaUrl: $('#elle-url').value, etiketler });
    form.reset();
    // indirme arka planda başlar, kısa bekleyip tazele
    setTimeout(yenile, 900);
  }, 'Havuza eklendi — indiriliyor');
});

$('#set-ac').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  const ad = $('#set-ad').value;
  calistir(form.querySelector('button'), async () => {
    await api('/api/set', { ad });
    form.reset();
  }, `"${ad}" açıldı`);
});

$('#ai-taslak').addEventListener('submit', async e => {
  e.preventDefault();
  const sonucEl = $('#ai-sonuc');
  const dugme = e.target.querySelector('button');
  sonucEl.className = 'sonuc-satir';
  sonucEl.textContent = 'Küratör çalışıyor…';
  dugme.disabled = true;
  try {
    const { set, rapor } = await api('/api/kurator', { kelimeler: $('#ai-kelimeler').value });
    const giphyNot = rapor.giphy.durum === 'anahtar-yok'
      ? 'yalnız havuz (GIPHY_API_KEY tanımlı değil)'
      : 'giphy +' + rapor.giphy.eklenen;
    sonucEl.textContent =
      `"${set.ad}" kuruldu · ${rapor.alinan} üye · baraj geçen ${rapor.barajGecen}/${rapor.degerlendirilen} · ${giphyNot}`;
    e.target.reset();
    bildir('Taslak set kuruldu');
  } catch (h) {
    sonucEl.className = 'sonuc-satir hata';
    sonucEl.textContent = h.message;
  }
  dugme.disabled = false;
  yenile();
});

async function izlemeCiz() {
  try {
    const { liste } = await api('/api/izleme');
    $('#izleme-liste').innerHTML = liste.length
      ? liste.map(k => `
        <span class="cip">
          ${k.sonSonuc ? `<span class="cip-nokta" title="${kacar(k.sonSonuc)}"></span>` : ''}
          ${kacar(k.kelime)}
          <button type="button" class="cip-kaldir" data-kelime="${kacar(k.kelime)}"
                  title="Listeden çıkar" aria-label="Listeden çıkar">✕</button>
        </span>`).join('')
      : '<span class="ipucu" style="margin:0">Liste boş — otonom tarama uyuyor.</span>';
  } catch { /* sunucu kapalıysa sessiz geç */ }
}
$('#izleme-liste').addEventListener('click', e => {
  const kelime = e.target.dataset.kelime;
  if (!kelime) return;
  calistir(null, () => api('/api/izleme/sil', { kelime }), 'Listeden çıkarıldı').then(izlemeCiz);
});
$('#izleme-ekle').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  calistir(form.querySelector('button'), async () => {
    await api('/api/izleme', { kelime: $('#izleme-kelime').value });
    form.reset();
  }, 'İzleme listesine eklendi').then(izlemeCiz);
});
$('#otonom-simdi').addEventListener('click', async e => {
  const dugme = e.target;
  const sonucEl = $('#ai-sonuc');
  dugme.disabled = true;
  dugme.textContent = 'Taranıyor…';
  try {
    const r = await api('/api/otonom', {});
    sonucEl.className = 'sonuc-satir';
    sonucEl.textContent = r.sonuclar
      ? 'Otonom tarama — ' + r.sonuclar.map(s =>
          s.kelime + (s.setId ? ': taslak kuruldu' : ': ' + (s.atlandi || s.sonuc))).join(' · ')
      : JSON.stringify(r);
  } catch (h) {
    sonucEl.className = 'sonuc-satir hata';
    sonucEl.textContent = h.message;
  }
  dugme.disabled = false;
  dugme.textContent = 'Şimdi tara';
  yenile(); izlemeCiz();
});

$('#kapak-dosya-girdi').addEventListener('change', async e => {
  const dosya = e.target.files[0];
  const setId = e.target.dataset.setId;
  if (!dosya || !setId) return;
  try {
    const r = await fetch(`/api/set/${setId}/kapak-yukle`, {
      method: 'POST', headers: { 'Content-Type': dosya.type }, body: dosya
    });
    const veri = await r.json();
    if (!r.ok) throw new Error(veri.hata || r.status);
    bildir('Kapak yüklendi');
  } catch (h) {
    bildir('Kapak yüklenemedi: ' + h.message, 'hata');
  }
  e.target.value = '';
  yenile();
});

/* ---------- Döngü ---------- */

function olcerleriCiz(durum) {
  $('#olcerler').innerHTML =
    `<span class="olcer">havuz <b>${durum.havuz}</b></span>
     <span class="olcer">indirilen <b>${durum.indirilen}</b></span>
     <span class="olcer">set <b>${durum.setler}</b></span>` +
    (durum.ffmpeg ? '' :
      '<span class="olcer uyarili" title="Telegram video sticker üretimi kapalı">ffmpeg yok</span>');
}

async function yenile() {
  try {
    let teslimatlar, durum;
    [havuz, setler, teslimatlar, durum] = await Promise.all([
      api('/api/aday'), api('/api/set'), api('/api/teslimatlar'), api('/api/durum')
    ]);
    satisLinkleri = {};
    for (const t of teslimatlar) (satisLinkleri[t.setId] = satisLinkleri[t.setId] || []).push(t);
    olcerleriCiz(durum);
    havuzCiz(); setCiz(); secimCiz();
  } catch (h) {
    $('#olcerler').innerHTML = '<span class="olcer uyarili">sunucuya ulaşılamıyor</span>';
  }
}

/* Otomatik tazeleme kullanıcının elini kesmemeli: menü açıkken, emoji
   seçici duruyorken ya da bir alana yazarken atlanır. */
function otomatikYenile() {
  if (document.querySelector('.menu[open]')) return;
  if (!$('#emoji-secici').classList.contains('gizli')) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'SELECT')) return;
  yenile();
}

yenile();
izlemeCiz();
setInterval(otomatikYenile, 5000);
