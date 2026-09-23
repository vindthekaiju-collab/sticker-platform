'use strict';
/**
 * Üretilen havuzu (cikti/havuz) SATILABİLİR SETLERE böler.
 *
 *   node arac/set-kur.js [--havuz cikti/havuz] [--hedef cikti/setler] [--boy 30]
 *
 * Üç iş yapar:
 *  1. TEKRAR AYIKLAMA — aynı kanaldan aynı cümleli/aynı başlıklı kareler
 *     (Elgatitolover'ın altı "pls" karesi gibi) en çok ikiye iner.
 *  2. AİLE EŞLEME — 300'den çok duygu etiketi 16 satılabilir temaya iner.
 *     Eşleşmeyen kare cümlesinden ve mekanizmasından tahmin edilir; o da
 *     tutmazsa "Mixed Reactions" setine gider (çöpe atılmaz).
 *  3. SET BÖLME — her aile 30'luk setlere bölünür (WhatsApp sınırı),
 *     set içinde kanal çeşitliliği için sıra harmanlanır.
 *
 * Çıktı: <hedef>/<slug>/NN.webp + index.html, <hedef>/index.html (tüm setler),
 *        <hedef>/setler.json (ad, tema, üyeler, kapak).
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const sec = (ad, v) => { const i = argv.indexOf(ad); return i >= 0 ? argv[i + 1] : v; };
const havuzDiz = path.resolve(sec('--havuz', path.join(KOK, 'cikti', 'havuz')));
const hedefDiz = path.resolve(sec('--hedef', path.join(KOK, 'cikti', 'setler')));
const BOY = Number(sec('--boy', 30));
const kacar = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const kayit = JSON.parse(fs.readFileSync(path.join(havuzDiz, 'kayit.json'), 'utf8'));
const secim = JSON.parse(fs.readFileSync(path.join(KOK, 'veri', 'giphy', 'kesif', 'secim2.json'), 'utf8'));
const bilgi = new Map();
for (const s of secim) { const a = s.kanal + '#' + s.no; if (!bilgi.has(a)) bilgi.set(a, s); }

/** Aile tanımları: ad, açıklama, duygu desenleri, cümle desenleri. */
const AILELER = [
  { slug: 'side-eye', ad: 'Side Eye Season', desc: 'the look that says everything',
    duygu: /yan bakış|yargı|şüphe|küçümseme|bakış|boş bakış|etkilenmemiş|umursamaz|bıkkın|sıkılmış|inanamama/,
    cumle: /side eye|judging|really|this you|sus|hmm\?|excuse me|seriously/i, baslik: /judging|side ?eye|unimpressed|eyeroll|eye roll|smirk|suspicious|stare|glare|disbelief|uh huh|if you say so/i },
  { slug: 'say-it-again', ad: 'Say It Again', desc: 'small creature, big threat',
    duygu: /tehdit|öfke|öfke dişleri|kavga|tokat|soğuk|manyak öfke|protesto/,
    cumle: /say it again|square up|shut up|back off|come here|fight me|get out|i see you/i, baslik: /angry|mad|rage|furious|threat|slap|punch|fight|hiss|growl|scream at|yell/i },
  { slug: 'dead-inside', ad: 'Dead Inside', desc: 'running on zero',
    duygu: /tükenmiş|uyku|tembellik|boşluk|rahat|iç çekiş|baş ağrısı|sabır/,
    cumle: /im done|done|dead inside|sigh|zzz|monday|sleep|tired|nap|exhaust/i, baslik: /tired|sleep|nap|lazy|bored|exhaust|dead inside|sigh|monday|burnout|zzz|chill/i },
  { slug: 'crying-rights', ad: 'Crying Rights', desc: 'feelings, loudly',
    duygu: /ağlama|üzgün|yalvarma|dokunaklı|özlem|somurtma|hayal kırıklığı|kalp kırık/,
    cumle: /crying|please|miss you|sorry|pls|im fine|hurt|sad/i, baslik: /cry|crying|sad|tears|sob|miss you|heartbroken|pout|disappoint|please|beg/i },
  { slug: 'caught-in-4k', ad: 'Caught in 4K', desc: 'the moment it clicks',
    duygu: /şok|dehşet|şaşkın|korku|gergin|yakalanmış|panik|çığlık|gasp/,
    cumle: /what|wait|huh|oh no|uh oh|caught|omg|no way|aaaa/i, baslik: /shock|shocked|surprise|gasp|scared|panic|wtf|what the|confused|huh|caught|busted|oh no|uh oh|jaw drop/i },
  { slug: 'not-funny', ad: 'Not Funny Did Not Laugh', desc: 'laughing at you, not with you',
    duygu: /kahkaha|alay|gülmeyi bastıran|alkış|troll/,
    cumle: /lol|lmao|haha|hehe|bravo|not funny|chuckle/i, baslik: /laugh|lol|lmao|haha|chuckle|giggle|clap|applaud|funny/i },
  { slug: 'unhinged', ad: 'Unhinged Hours', desc: 'no thoughts, only chaos',
    duygu: /manyak|tuhaf|absürt|cringe|kaos|freaky|goofy|uncanny/,
    cumle: /freaky|cursed|yikes|ew|bruh|goofy/i, baslik: /cursed|weird|goofy|freak|crazy|insane|uncanny|drool|tongue|derp|silly|troll/i },
  { slug: 'big-brain', ad: 'Big Brain Moment', desc: 'thinking about it',
    duygu: /düşünüyor|hesaplıyor|plan|sinsi|ukala|merak/,
    cumle: /hmm|thinking|actually|calculating|lemme think|big brain|excellent/i, baslik: /think|thinking|calculate|math|plot|scheme|nerd|smart|brain|hmm/i },
  { slug: 'hard-no', ad: 'Respectfully No', desc: 'yes, no, and absolutely not',
    duygu: /ret|onay|evet|hayır|kabullenme|teslim/,
    cumle: /^no|nah|nope|denied|yes|ok\b|agreed|deal|not today|whatever/i, baslik: /\bno\b|nope|denied|refus|reject|yes|agree|approve|nod|whatever|bye|peace out/i },
  { slug: 'certified-sigma', ad: 'Certified Sigma', desc: 'built different',
    duygu: /kibir|zafer|coşku|flex|havalı|kutlama|gurur|sevinç/,
    cumle: /im him|sigma|lets go|victory|rich|cool|type shii|goat|peak/i, baslik: /flex|win|victory|celebrate|rich|money|boss|cool|proud|swag|confident|excited|hype/i },
  { slug: 'soft-hours', ad: 'Soft Hours', desc: 'for the people you like',
    duygu: /sevgi|öpücük|masum|utangaç|tuhaf sevimli|mutlu|selam|teşekkür|keyif/,
    cumle: /love|mwah|hi\b|hello|thank|cute|hug|good night|morning/i, baslik: /love|kiss|hug|cute|sweet|hello|hi\b|thank|wave|blush|shy|flirt|wink|heart/i },
  { slug: 'work-mode', ad: 'Work Mode', desc: 'sent from my desk',
    duygu: /çalışıyor|ofis|sabah|bekleme|sabırsız/,
    cumle: /working|typing|meeting|waiting|coffee|deadline|3am/i, baslik: /work|working|laptop|computer|office|typing|coffee|study|meeting|waiting|late/i },
  { slug: 'tea-time', ad: 'Tea Time', desc: 'the drama is delicious',
    duygu: /dedikodu|drama|izliyor|cömertlik/,
    cumle: /tea|drama|popcorn|gossip|you get a/i, baslik: /tea|drama|gossip|popcorn|jealous|watching|you get a/i },
  { slug: 'dance-floor', ad: 'Dance Floor', desc: 'it moves, therefore it vibes',
    duygu: /dans|müzik|coşku dans|spin/,
    cumle: /dance|vibing|spin|party/i, baslik: /danc|vibe|vibing|party|spin|twerk|groove|music/i },
  { slug: 'canon-classics', ad: 'Canon Classics', desc: 'the ones everyone already knows',
    duygu: /doge|troll|emoji|emote|rage/,
    cumle: /wow|u mad|o7|doge|troll/i, baslik: /doge|shiba|troll|wojak|pepe|shrek|sonic|skeleton|llama|alpaca|bateman|american psycho|math lady|blinking|monkey puppet|rage|meme man|gigachad|emoji|emote|stonks|success kid|disaster girl|harold/i },
  { slug: 'oops', ad: 'Oops My Bad', desc: 'caught, guilty, moving on',
    duygu: /utanç|suçlu|facepalm|pişman|zorla gülüş|saklanma|yakalanmış|oops/,
    cumle: /sorry|oops|my bad|i can explain|guilty|awkward/i,
    baslik: /sorry|oops|guilty|awkward|facepalm|wince|cringe|embarrass|hide/i },
  { slug: 'snack-time', ad: 'Snack Time', desc: 'eating is an emotion',
    duygu: /keyif|yeme|salya|aç|iştah|pankekli/,
    cumle: /nom|yum|mine|sip|snack|hungry|eat/i,
    baslik: /eat|eating|food|snack|burger|pizza|cake|drink|lick|munch|bite|hungry/i },
];
const KARISIK = { slug: 'mixed-reactions', ad: 'Mixed Reactions', desc: 'the everything drawer' };

function aileBul(k, s) {
  const d = String(s.duygu || '').toLowerCase();
  const c = String(k.metin || '');
  for (const a of AILELER) if (a.duygu.test(d)) return a;
  for (const a of AILELER) if (c && a.cumle.test(c)) return a;
  const b = String(k.baslik || '');
  for (const a of AILELER) if (b && a.baslik && a.baslik.test(b)) return a;
  return KARISIK;
}

// 0) boş kare ayıklama (havuz-denetle.js ölçümü; orta kareye bakar) --------
const kaliteYol = path.join(havuzDiz, 'kalite.json');
const kalite = fs.existsSync(kaliteYol) ? JSON.parse(fs.readFileSync(kaliteYol, 'utf8')) : {};

// 1) tekrar ayıklama -------------------------------------------------------
const sayacCumle = new Map(), sayacBaslik = new Map();
const temiz = [];
for (const k of kayit) {
  if (kalite[k.ad] && kalite[k.ad].bos) continue;
  const metin = String(k.metin || '').trim().toLowerCase();
  // YAZISIZ kareler birbirinin tekrarı DEĞİLDİR: boş cümle anahtar olarak
  // kullanılınca bir kanalın bütün yazısız kareleri aynı sayılıyor ve havuzun
  // üçte ikisi siliniyordu (2026-09-23'te ölçüldü: 1.366 → 492).
  if (metin) {
    const c = k.kanal + '|' + metin;
    const n = (sayacCumle.get(c) || 0) + 1;
    sayacCumle.set(c, n);
    if (n > 2) continue;                   // aynı kanal + aynı cümle: en çok 2
  }
  const b = k.kanal + '|' + String(k.baslik || '').toLowerCase();
  const nb = (sayacBaslik.get(b) || 0) + 1;
  sayacBaslik.set(b, nb);
  if (String(k.baslik || '').trim() && nb > 3) continue;   // aynı başlık: en çok 3
  temiz.push(k);
}

// 2) aile eşleme -----------------------------------------------------------
const kovalar = new Map();
for (const a of [...AILELER, KARISIK]) kovalar.set(a.slug, { ...a, uyeler: [] });
for (const k of temiz) {
  const s = bilgi.get(k.kanal + '#' + k.no) || {};
  const a = aileBul(k, s);
  kovalar.get(a.slug).uyeler.push({ ...k, duygu: s.duygu || '', mek: (s.mek || []).join(' '), seffaf: !!s.sticker });
}

// 3) set bölme (kanal çeşitliliği için harmanla) ----------------------------
function harmanla(uyeler) {
  const kanalSira = new Map();
  for (const u of uyeler) {
    if (!kanalSira.has(u.kanal)) kanalSira.set(u.kanal, []);
    kanalSira.get(u.kanal).push(u);
  }
  const kuyruklar = [...kanalSira.values()].sort((a, b) => b.length - a.length);
  const cikti = [];
  let kaldi = true;
  while (kaldi) {
    kaldi = false;
    for (const q of kuyruklar) if (q.length) { cikti.push(q.shift()); kaldi = true; }
  }
  return cikti;
}

fs.mkdirSync(hedefDiz, { recursive: true });
const setler = [];
for (const kova of kovalar.values()) {
  if (!kova.uyeler.length) continue;
  // SET İÇİ CÜMLE TEKRARI: dört "say it again" yan yana sete ucuz gösteriyor.
  // Aynı cümleli kareler ayrı ciltlere dağıtılır (atılmaz): her karenin o
  // cümledeki kaçıncı örnek olduğu sayılır, sonra o sıraya göre kararlı dizilir.
  const harmanlanmis = harmanla(kova.uyeler);
  const sayac = new Map();
  for (const u of harmanlanmis) {
    const c = String(u.metin || '').trim().toLowerCase();
    if (!c) { u._sira = 0; continue; }
    const n = (sayac.get(c) || 0) + 1;
    sayac.set(c, n);
    u._sira = n - 1;
  }
  const sirali = harmanlanmis
    .map((u, i) => ({ u, i }))
    .sort((a, b) => (a.u._sira - b.u._sira) || (a.i - b.i))
    .map(x => x.u);
  // EŞİT BÖLME: artanı bir öncekine eklemek 37'lik set üretiyordu; WhatsApp
  // sınırı 30. Aile kaç cilde sığıyorsa o kadar cilde EŞİT dağıtılır.
  const adet = Math.ceil(sirali.length / BOY);
  const ciltBoyu = Math.ceil(sirali.length / adet);
  for (let i = 0; i < adet; i++) {
    const uyeler = sirali.slice(i * ciltBoyu, (i + 1) * ciltBoyu);
    if (!uyeler.length) continue;
    const slug = adet > 1 ? `${kova.slug}-${i + 1}` : kova.slug;
    setler.push({ slug, ad: adet > 1 ? `${kova.ad} Vol. ${i + 1}` : kova.ad, desc: kova.desc, tema: kova.slug, uyeler });
  }
}

for (const s of setler) {
  const d = path.join(hedefDiz, s.slug);
  fs.mkdirSync(d, { recursive: true });
  s.dosyalar = [];
  for (const [i, u] of s.uyeler.entries()) {
    const ad = String(i + 1).padStart(2, '0') + '.webp';
    fs.copyFileSync(path.join(havuzDiz, u.ad + '.webp'), path.join(d, ad));
    s.dosyalar.push({ dosya: ad, metin: u.metin, kanal: u.kanal, no: u.no, duygu: u.duygu, mek: u.mek, kb: u.kb, kare: u.kare });
  }
  fs.writeFileSync(path.join(d, 'index.html'), `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${kacar(s.ad)} (${s.uyeler.length})</title>
<style>body{margin:0;background:#0d0d0d;color:#eee;font:14px system-ui,sans-serif}h1{padding:14px 16px;margin:0;font-size:18px;border-bottom:1px solid #333}h1 small{color:#888;font-weight:400}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:9px;padding:13px}
.k{background:#1b1b1b;border-radius:11px;overflow:hidden}.k .r{background:repeating-conic-gradient(#2a2a2a 0% 25%,#222 0% 50%) 50%/20px 20px;aspect-ratio:1}
.k img{width:100%;height:100%;object-fit:contain}.k .m{padding:6px 8px;font-size:11px;color:#aaa}.k .m b{color:#fff;display:block;font-size:12px}</style></head><body>
<h1>${kacar(s.ad)} <small>— ${kacar(s.desc)} · ${s.uyeler.length} sticker</small></h1>
<div class="g">${s.dosyalar.map(f => `<div class="k"><div class="r"><img src="${f.dosya}" loading="lazy" alt=""></div><div class="m"><b>${kacar(f.metin) || '—'}</b>${kacar(f.duygu)} · ${kacar(f.mek)}</div></div>`).join('')}</div></body></html>`);
}

fs.writeFileSync(path.join(hedefDiz, 'setler.json'), JSON.stringify(setler.map(s => ({ slug: s.slug, ad: s.ad, desc: s.desc, tema: s.tema, adet: s.uyeler.length, dosyalar: s.dosyalar })), null, 1));

const ana = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>stickky · ${setler.length} set</title>
<style>body{margin:0;background:#0d0d0d;color:#eee;font:14px system-ui,sans-serif}
h1{padding:14px 16px;margin:0;font-size:19px;border-bottom:1px solid #333}
.s{padding:14px 16px;border-bottom:1px solid #222}
.s h2{font-size:15px;margin:0 0 3px}.s h2 a{color:#ff2d87;text-decoration:none}.s p{margin:0 0 8px;color:#888;font-size:12px}
.r{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}
.r img{width:92px;height:92px;object-fit:contain;background:repeating-conic-gradient(#2a2a2a 0% 25%,#222 0% 50%) 50%/16px 16px;border-radius:9px;flex:0 0 auto}</style></head><body>
<h1>stickky · ${setler.length} set · ${setler.reduce((a, b) => a + b.uyeler.length, 0)} sticker</h1>
${setler.map(s => `<div class="s"><h2><a href="${s.slug}/index.html">${kacar(s.ad)}</a> <span style="color:#666;font-weight:400">${s.uyeler.length}</span></h2><p>${kacar(s.desc)}</p>
<div class="r">${s.dosyalar.slice(0, 14).map(f => `<img src="${s.slug}/${f.dosya}" loading="lazy" alt="">`).join('')}</div></div>`).join('')}
</body></html>`;
fs.writeFileSync(path.join(hedefDiz, 'index.html'), ana);
console.log(`${setler.length} set · ${setler.reduce((a, b) => a + b.uyeler.length, 0)} sticker (havuz ${kayit.length}, tekrar ayıklandı ${kayit.length - temiz.length}) → ${hedefDiz}`);
for (const s of setler) console.log(`  ${String(s.uyeler.length).padStart(3)} ${s.slug}`);
