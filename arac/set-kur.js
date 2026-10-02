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
 *  3. SET BÖLME — her aile ALT TEMALARA ayrılır (Side Eye → Sus / Unimpressed /
 *     Really?), her alt tema kendi adıyla bir set olur; 30'u aşan alt tema
 *     (WhatsApp sınırı) bölünür ve her parça en sık cümlesiyle adlanır.
 *     "Vol. 1 / Vol. 2" yok: kullanıcı 2026-10-02'de aynı adlı altı cildi
 *     "rahatsız olduğum tek şey" diye işaretledi. Set içinde kanal
 *     çeşitliliği için sıra harmanlanır.
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

/**
 * Aile tanımları: ad, açıklama, duygu desenleri, cümle desenleri.
 * `alt`: ailenin içindeki alt temalar — her biri KENDİ ADIYLA set olur. Sıra
 * önemli: ilk tutan kazanır, hiçbiri tutmazsa kare ailenin ana setine kalır
 * (ana setin adı ailenin adı). Alt tema üç kareden azsa ana sete katılır.
 * Desenler 2026-10-02'deki duygu/cümle dağılımından çıkarıldı (incele.js).
 */
const AILELER = [
  { slug: 'side-eye', ad: 'Side Eye Season', desc: 'the look that says everything', adlar: ['Side Eye Season', 'The Look'],
    duygu: /yan bakış|yargı|şüphe|küçümseme|bakış|boş bakış|etkilenmemiş|umursamaz|bıkkın|sıkılmış|inanamama/,
    cumle: /side eye|judging|really|this you|sus|hmm\?|excuse me|seriously/i, baslik: /judging|side ?eye|unimpressed|eyeroll|eye roll|smirk|suspicious|stare|glare|disbelief|uh huh|if you say so/i,
    alt: [
      { slug: 'sus', ad: 'That\'s Sus', desc: 'something is not adding up', adlar: ['That\'s Sus', 'Suspicious Activity'], duygu: /şüphe|yargı|sinsi/, cumle: /\bsus\b|hm+\??|ayo|excuse me|this you|tell me more/i },
      { slug: 'really', ad: 'Really?', desc: 'disbelief, with eyebrows', duygu: /inanamama|şaşkın/, cumle: /really|seriously|huh|boy\b/i },
      { slug: 'unimpressed', ad: 'Unimpressed', desc: 'not mad, just bored', adlar: ['Unimpressed', 'Whatever.'], duygu: /küçümseme|etkilenmemiş|umursamaz|boş bakış|bıkkın|sıkılmış/, cumle: /whatever|ok and|cool story|k\./i },
    ] },
  { slug: 'say-it-again', ad: 'Say It Again', desc: 'small creature, big threat', adlar: ['Say It Again', 'Say That Again'],
    duygu: /tehdit|öfke|öfke dişleri|kavga|tokat|soğuk|manyak öfke|protesto/,
    cumle: /say it again|square up|shut up|back off|come here|fight me|get out|i see you/i, baslik: /angry|mad|rage|furious|threat|slap|punch|fight|hiss|growl|scream at|yell/i,
    alt: [
      { slug: 'square-up', ad: 'Square Up', desc: 'the threat is real', duygu: /tehdit|kavga|gözetleme|tokat/, cumle: /square up|i see you|fight me|come here|back off|get out/i },
    ] },
  { slug: 'dead-inside', ad: 'Dead Inside', desc: 'running on zero', adlar: ['Dead Inside', 'I\'m Done'],
    duygu: /tükenmiş|uyku|tembellik|boşluk|rahat|iç çekiş|baş ağrısı|sabır/,
    cumle: /im done|done|dead inside|sigh|zzz|monday|sleep|tired|nap|exhaust/i, baslik: /tired|sleep|nap|lazy|bored|exhaust|dead inside|sigh|monday|burnout|zzz|chill/i,
    alt: [
      { slug: 'do-not-disturb', ad: 'Do Not Disturb', desc: 'horizontal and staying that way', duygu: /uyku|rahat|tembellik|huzur/, cumle: /zzz|goodnight|chilling|sleep|nap/i },
    ] },
  { slug: 'crying-rights', ad: 'Crying Rights', desc: 'feelings, loudly', adlar: ['Crying Rights', 'Sobbing Hours'],
    duygu: /ağlama|üzgün|yalvarma|dokunaklı|özlem|somurtma|hayal kırıklığı|kalp kırık/,
    cumle: /crying|please|miss you|sorry|pls|im fine|hurt|sad/i, baslik: /cry|crying|sad|tears|sob|miss you|heartbroken|pout|disappoint|please|beg/i,
    alt: [
      { slug: 'pretty-please', ad: 'Pretty Please', desc: 'begging, but make it cute', duygu: /yalvarma/, cumle: /pls|please|pretty please/i },
      { slug: 'im-fine', ad: 'I\'m Fine', desc: 'not fine', adlar: ['I\'m Fine', 'Left on Read'], duygu: /üzgün|hayal kırıklığı|özlem|somurtma|kalp kırık/, cumle: /im fine|left on read|miss you|:\(/i },
    ] },
  { slug: 'caught-in-4k', ad: 'Caught in 4K', desc: 'the moment it clicks', adlar: ['Caught in 4K', 'Jaw Drop', 'Oh No'],
    duygu: /şok|dehşet|şaşkın|korku|gergin|yakalanmış|panik|çığlık|gasp/,
    cumle: /what|wait|huh|oh no|uh oh|caught|omg|no way|aaaa/i, baslik: /shock|shocked|surprise|gasp|scared|panic|wtf|what the|confused|huh|caught|busted|oh no|uh oh|jaw drop/i,
    alt: [
      { slug: 'wait-what', ad: 'Wait, What?', desc: 'processing…', adlar: ['Wait, What?', 'Come Again?'], duygu: /şaşkın|kafa karış/, cumle: /^what|wait what|huh|come again|say what|wow/i },
      { slug: 'aaaaa', ad: 'AAAAA', desc: 'screaming internally and externally', adlar: ['AAAAA', 'NOOO'], duygu: /çığlık|korku|dehşet|panik/, cumle: /a{3,}|scream|oh no/i },
    ] },
  { slug: 'not-funny', ad: 'Not Funny Did Not Laugh', desc: 'laughing at you, not with you',
    duygu: /kahkaha|alay|gülmeyi bastıran|alkış|troll/,
    cumle: /lol|lmao|haha|hehe|bravo|not funny|chuckle/i, baslik: /laugh|lol|lmao|haha|chuckle|giggle|clap|applaud|funny/i,
    alt: [
      { slug: 'lmao', ad: 'LMAO', desc: 'actually laughing', duygu: /kahkaha/, cumle: /lol|lmao|haha|hehe/i },
      { slug: 'slow-clap', ad: 'Slow Clap', desc: 'bravo. truly.', duygu: /alkış|gülmeyi bastıran|alay|alaycı/, cumle: /bravo|you dont say|clap/i },
    ] },
  { slug: 'unhinged', ad: 'Unhinged Hours', desc: 'no thoughts, only chaos',
    duygu: /manyak|tuhaf|absürt|cringe|kaos|freaky|goofy|uncanny/,
    cumle: /freaky|cursed|yikes|ew|bruh|goofy/i, baslik: /cursed|weird|goofy|freak|crazy|insane|uncanny|drool|tongue|derp|silly|troll/i,
    alt: [
      { slug: 'ew', ad: 'Ew.', desc: 'visibly disgusted', duygu: /iğrenme|cringe/, cumle: /ew+|yikes|bleh|bruh/i },
    ] },
  { slug: 'big-brain', ad: 'Big Brain Moment', desc: 'thinking about it',
    duygu: /düşünüyor|hesaplıyor|plan|sinsi|ukala|merak/,
    cumle: /hmm|thinking|actually|calculating|lemme think|big brain|excellent/i, baslik: /think|thinking|calculate|math|plot|scheme|nerd|smart|brain|hmm/i },
  { slug: 'hard-no', ad: 'Respectfully No', desc: 'yes, no, and absolutely not', adlar: ['Respectfully No', 'Absolutely Not'],
    duygu: /ret|onay|evet|hayır|kabullenme|teslim/,
    cumle: /^no|nah|nope|denied|yes|ok\b|agreed|deal|not today|whatever/i, baslik: /\bno\b|nope|denied|refus|reject|yes|agree|approve|nod|whatever|bye|peace out/i,
    alt: [
      { slug: 'say-less', ad: 'Say Less', desc: 'yes, ok, deal', duygu: /onay|evet|teslim|kabullenme/, cumle: /^yes|^yeah|^ok|agreed|deal|sure|fine\b/i },
      { slug: 'peace-out', ad: 'Peace Out', desc: 'leaving the chat', duygu: /veda/, cumle: /bye|peace|later|gotta go/i },
    ] },
  { slug: 'certified-sigma', ad: 'Certified Sigma', desc: 'built different', adlar: ['Certified Sigma', 'Built Different'],
    duygu: /kibir|zafer|coşku|flex|havalı|kutlama|gurur|sevinç/,
    cumle: /im him|sigma|lets go|victory|rich|cool|type shii|goat|peak/i, baslik: /flex|win|victory|celebrate|rich|money|boss|cool|proud|swag|confident|excited|hype/i,
    alt: [
      { slug: 'lets-go', ad: 'LET\'S GO', desc: 'winning, loudly', duygu: /coşku|zafer|kutlama|sevinç/, cumle: /lets go|yes+|yeah|victory|we did it/i },
    ] },
  { slug: 'soft-hours', ad: 'Soft Hours', desc: 'for the people you like',
    duygu: /sevgi|öpücük|masum|utangaç|tuhaf sevimli|mutlu|selam|teşekkür|keyif/,
    cumle: /love|mwah|hi\b|hello|thank|cute|hug|good night|morning/i, baslik: /love|kiss|hug|cute|sweet|hello|hi\b|thank|wave|blush|shy|flirt|wink|heart/i,
    alt: [
      { slug: 'love-u', ad: 'Love U', desc: 'sent with a kiss', duygu: /sevgi|öpücük|aşk|flört/, cumle: /love|mwah|for you|kiss|hug/i },
      { slug: 'hi', ad: 'Hi :)', desc: 'small, warm, daily', duygu: /selam|teşekkür|mutlu|keyif/, cumle: /^hi\b|hello|thank|o7|morning|good night/i },
    ] },
  { slug: 'work-mode', ad: 'Work Mode', desc: 'sent from my desk',
    duygu: /çalışıyor|ofis|sabah|bekleme|sabırsız/,
    cumle: /working|typing|meeting|waiting|coffee|deadline|3am/i, baslik: /work|working|laptop|computer|office|typing|coffee|study|meeting|waiting|late/i },
  { slug: 'tea-time', ad: 'Tea Time', desc: 'the drama is delicious',
    duygu: /dedikodu|drama|izliyor|cömertlik/,
    cumle: /tea|drama|popcorn|gossip|you get a/i, baslik: /tea|drama|gossip|popcorn|jealous|watching|you get a/i },
  { slug: 'dance-floor', ad: 'Dance Floor', desc: 'it moves, therefore it vibes',
    duygu: /dans|müzik|coşku dans|spin/,
    cumle: /dance|vibing|spin|party/i, baslik: /danc|vibe|vibing|party|spin|twerk|groove|music/i },
  { slug: 'canon-classics', ad: 'Canon Classics', desc: 'the ones everyone already knows', adlar: ['Canon Classics', 'Internet Elders'],
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

const ALT_ASGARI = 8;   // daha küçüğü ana sete döner (3'lük "Peace Out" 2026-10-02'de ölçüldü)

/** Aile içinde alt tema: ilk tutan kazanır; tutmayan ailenin ana setine kalır. */
function altBul(u, aile) {
  const d = String(u.duygu || '').toLowerCase();
  const c = String(u.metin || '').trim();
  for (const a of aile.alt || []) if (a.duygu.test(d)) return a;
  for (const a of aile.alt || []) if (c && a.cumle.test(c)) return a;
  return null;
}

/** Kümeyi 30'a sığan parçalara böler; parça adı en sık cümlesinden gelir. */
function parcala(grup, BOY) {
  // SET İÇİ CÜMLE TEKRARI: dört "say it again" yan yana sete ucuz gösteriyor.
  // Aynı cümleli kareler ayrı parçalara dağıtılır (atılmaz): her karenin o
  // cümledeki kaçıncı örnek olduğu sayılır, sonra o sıraya göre kararlı dizilir.
  const harmanlanmis = harmanla(grup.uyeler);
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
  // sınırı 30. Küme kaç parçaya sığıyorsa o kadar parçaya EŞİT dağıtılır.
  const adet = Math.ceil(sirali.length / BOY);
  const parcaBoyu = Math.ceil(sirali.length / adet);
  const parcalar = [];
  for (let i = 0; i < adet; i++) {
    const uyeler = sirali.slice(i * parcaBoyu, (i + 1) * parcaBoyu);
    if (uyeler.length) parcalar.push(uyeler);
  }
  if (parcalar.length === 1) return [{ slug: grup.slug, ad: grup.ad, desc: grup.desc, uyeler: parcalar[0] }];
  // ADLANDIRMA: "Vol. N" yok. Önce tanımdaki yedek adlar (`adlar`: 'Side Eye
  // Season' → 'The Look'); yetmezse parçanın en sık cümlesi ('· "hm?"'). Cümle
  // başka parçada kullanıldıysa sonraki en sık cümle; hiç cümle kalmazsa sıra numarası.
  const kullanilan = new Set();
  return parcalar.map((uyeler, i) => {
    const hazir = (grup.adlar || [])[i];
    if (hazir) return { slug: i === 0 ? grup.slug : `${grup.slug}-${hazir.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, ad: hazir, desc: grup.desc, uyeler };
    const sayim = new Map();
    for (const u of uyeler) { const c = String(u.metin || '').trim(); if (c) sayim.set(c, (sayim.get(c) || 0) + 1); }
    const aday = [...sayim.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]).find(c => !kullanilan.has(c.toLowerCase()));
    if (aday) kullanilan.add(aday.toLowerCase());
    const etiket = aday ? `"${aday}"` : String(i + 1);
    const slugEk = aday ? aday.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || String(i + 1) : String(i + 1);
    return { slug: `${grup.slug}-${slugEk}`, ad: `${grup.ad} · ${etiket}`, desc: grup.desc, uyeler };
  });
}

fs.mkdirSync(hedefDiz, { recursive: true });
const setler = [];
for (const kova of kovalar.values()) {
  if (!kova.uyeler.length) continue;
  // Alt temalara dağıt; üç kareden az kalan alt tema ana sete geri döner.
  const gruplar = new Map([[kova.slug, { slug: kova.slug, ad: kova.ad, desc: kova.desc, adlar: kova.adlar, uyeler: [] }]]);
  for (const a of kova.alt || []) gruplar.set(a.slug, { slug: `${kova.slug}-${a.slug}`, ad: a.ad, desc: a.desc, adlar: a.adlar, uyeler: [] });
  for (const u of kova.uyeler) {
    const a = altBul(u, kova);
    gruplar.get(a ? a.slug : kova.slug).uyeler.push(u);
  }
  for (const [k, g] of gruplar) {
    if (k === kova.slug || g.uyeler.length >= ALT_ASGARI) continue;
    gruplar.get(kova.slug).uyeler.push(...g.uyeler);
    g.uyeler = [];
  }
  // Mixed Reactions RAFTA kalır: 200 karenin 124'ü duygu etiketsiz (2026-10-02
  // ölçümü); vitrine çıkmaz, galeride ayrı başlıkta görünür, veri atılmaz.
  const raf = kova.slug === KARISIK.slug;
  for (const g of gruplar.values()) {
    if (!g.uyeler.length) continue;
    for (const p of parcala(g, BOY)) setler.push({ ...p, tema: kova.slug, raf });
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

fs.writeFileSync(path.join(hedefDiz, 'setler.json'), JSON.stringify(setler.map(s => ({ slug: s.slug, ad: s.ad, desc: s.desc, tema: s.tema, raf: s.raf, adet: s.uyeler.length, dosyalar: s.dosyalar })), null, 1));

const vitrin = setler.filter(s => !s.raf), rafta = setler.filter(s => s.raf);
const satir = s => `<div class="s"><h2><a href="${s.slug}/index.html">${kacar(s.ad)}</a> <span style="color:#666;font-weight:400">${s.uyeler.length}</span></h2><p>${kacar(s.desc)}</p>
<div class="r">${s.dosyalar.slice(0, 14).map(f => `<img src="${s.slug}/${f.dosya}" loading="lazy" alt="">`).join('')}</div></div>`;
const ana = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>stickky · ${vitrin.length} set</title>
<style>body{margin:0;background:#0d0d0d;color:#eee;font:14px system-ui,sans-serif}
h1{padding:14px 16px;margin:0;font-size:19px;border-bottom:1px solid #333}h1.raf{color:#888;margin-top:24px}
.s{padding:14px 16px;border-bottom:1px solid #222}
.s h2{font-size:15px;margin:0 0 3px}.s h2 a{color:#ff2d87;text-decoration:none}.s p{margin:0 0 8px;color:#888;font-size:12px}
.r{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}
.r img{width:92px;height:92px;object-fit:contain;background:repeating-conic-gradient(#2a2a2a 0% 25%,#222 0% 50%) 50%/16px 16px;border-radius:9px;flex:0 0 auto}</style></head><body>
<h1>stickky · ${vitrin.length} set · ${vitrin.reduce((a, b) => a + b.uyeler.length, 0)} sticker</h1>
${vitrin.map(satir).join('')}
${rafta.length ? `<h1 class="raf">Rafta — vitrine çıkmaz · ${rafta.length} set · ${rafta.reduce((a, b) => a + b.uyeler.length, 0)} sticker</h1>${rafta.map(satir).join('')}` : ''}
</body></html>`;
fs.writeFileSync(path.join(hedefDiz, 'index.html'), ana);
console.log(`${vitrin.length} set · ${vitrin.reduce((a, b) => a + b.uyeler.length, 0)} sticker vitrin + ${rafta.length} set rafta (havuz ${kayit.length}, tekrar ayıklandı ${kayit.length - temiz.length}) → ${hedefDiz}`);
for (const s of setler) console.log(`  ${String(s.uyeler.length).padStart(3)} ${s.raf ? '[raf] ' : ''}${s.slug}  —  ${s.ad}`);
