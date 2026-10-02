'use strict';
/**
 * SET İÇİ CÜMLE TEKRARINI ÇEŞİTLENDİR.
 * "working" yedi kez yan yana görünen bir set ucuz duruyor. Aynı cümlenin
 * ikinci ve sonraki örneklerine varyant cümle atanır; varyantı olmayan
 * cümle yazısız bırakılır (kare atılmaz).
 *
 *   node arac/cumle-cesitle.js            → plan yazar (arac/planlar/varyant-1.json)
 *   node arac/deneme-set.js --plan arac/planlar/varyant-1.json --cikti cikti/varyant-1
 *   node arac/cumle-cesitle.js --uygula --dizin varyant-1   → üretilenleri havuza işler
 */
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const uygula = argv.includes('--uygula');
const di = argv.indexOf('--dizin');
const varyantDiz = di >= 0 ? argv[di + 1] : 'varyant-1';   // hangi üretim klasörü işlenecek
const havuzDiz = path.join(KOK, 'cikti', 'havuz');
const setDiz = path.join(KOK, 'cikti', 'setler');
const planYol = path.join(KOK, 'arac', 'planlar', 'varyant-1.json');
const esYol = path.join(KOK, 'veri', 'varyant-eslesme.json');

const VARYANT = {
  'working': ['still working', 'wfh', 'on it', 'in a meeting', 'deadline', '9 to 5'],
  'what': ['WHAT', 'wait what', 'come again', 'say what', 'hold on', 'huh??'],
  'aaaa': ['AAAAA', 'screaming', 'NOOO', 'HELP', 'aaah'],
  ':(': ['im sad', 'sadge', ':((', 'not ok', 'rough day'],
  'excellent': ['perfect', 'as planned', 'we move', 'noted', 'yes... yes'],
  'say it again': ['say that again', 'one more time', 'repeat that', 'excuse me?'],
  'huh': ['huh?', 'come again', 'wait what', '??'],
  'yes': ['YES', 'yep', 'absolutely', 'say less', 'bet'],
  'mwah': ['muah', 'kiss', 'love u', 'xoxo'],
  'chilling': ['chill', 'relaxing', 'doing nothing', 'vibing'],
  'pls': ['pretty please', 'cmon', 'im begging'],
  'please': ['pls', 'pretty please', 'im begging'],
  'lol': ['lmao', 'LMAOO', 'im crying'],
  'haha': ['hahaha', 'HAHA', 'lmao'],
  'lmao': ['LMAOO', 'lol', 'dead'],
  'hahaha': ['HAHAHA', 'haha', 'lol'],
  ':)': ['hehe', 'all good', 'happy'],
  'morning': ['good morning', 'gm', 'rise and shine'],
  'hello?': ['hi?', 'u there?', 'anyone?'],
  'typing': ['typing...', 'drafting', 'one sec'],
  'waiting': ['still waiting', 'im waiting', 'any day now'],
  'sorry': ['my bad', 'sorry sorry', 'apologies'],
  'oops': ['my bad', 'welp', 'uh oh'],
  'hiding': ['nope', 'not here', 'invisible'],
  'mine': ['all mine', 'dont touch', 'got it'],
  'nom': ['nom nom', 'yum', 'eating'],
  'no.': ['nope', 'absolutely not', 'nah'],
  'ok ok': ['fine', 'alright', 'ok ok ok'],
  'victory': ['W', 'we won', 'lets go'],
  'wow': ['woah', 'damn', 'no way'],
  'square up': ['fight me', 'throw hands', 'come here'],
  'i see you': ['i saw that', 'watching u', 'eyes on you'],
  'uh oh': ['uh oh...', 'not good'],
  'ew': ['ewww', 'gross'],
  'calculating': ['doing the math', 'let me count', 'hold on'],
  'actually': ['um actually', 'technically'],
  'hmm': ['hmmm', 'suspicious', 'thinking'],
  'you get a ___': ['everybody gets one', 'you get one too'],
  'thank you': ['ty', 'thanks!', 'appreciate it'],
  'waaa': ['WAAA', 'crying', 'sobbing'],
  'hm?': ['hm', 'mm?'],
  'why so serious': ['why so serious?'],
  'im done': ['done', 'thats it', 'i quit'],
  'sigh': ['*sigh*', 'ugh'],
};

if (!uygula) {
  const setler = JSON.parse(fs.readFileSync(path.join(setDiz, 'setler.json'), 'utf8'));
  const plan = [], eslesme = [];
  for (const s of setler) {
    const gorulen = new Map();
    for (const f of s.dosyalar) {
      const m = String(f.metin || '').trim();
      if (!m) continue;
      const k = m.toLowerCase();
      const n = (gorulen.get(k) || 0) + 1;
      gorulen.set(k, n);
      if (n === 1) continue;                       // ilki kalsın
      const liste = VARYANT[k] || [];
      const yeni = liste[(n - 2) % Math.max(1, liste.length)] || '';
      const kirp = f.kanal === 'guestEmma' ? { alt: 0.28 } : f.kanal === 'taviitoo_bv' ? { alt: 0.16 } : null;
      plan.push(kirp ? { kanal: f.kanal, no: f.no, metin: yeni, kirp } : { kanal: f.kanal, no: f.no, metin: yeni });
      eslesme.push({ kanal: f.kanal, no: f.no, eski: m, yeni, set: s.slug });
    }
  }
  fs.mkdirSync(path.dirname(esYol), { recursive: true });
  fs.writeFileSync(planYol, JSON.stringify(plan, null, 1));
  fs.writeFileSync(esYol, JSON.stringify(eslesme, null, 1));
  console.log(`${plan.length} kare çeşitlendirilecek (${plan.filter(p => p.metin).length} varyant, ${plan.filter(p => !p.metin).length} yazısız)`);
  const ornek = eslesme.filter(e => e.yeni).slice(0, 12);
  for (const e of ornek) console.log(`  ${e.set.padEnd(18)} "${e.eski}" → "${e.yeni}"`);
} else {
  const eslesme = JSON.parse(fs.readFileSync(esYol, 'utf8'));
  const yeni = JSON.parse(fs.readFileSync(path.join(KOK, 'cikti', varyantDiz, 'kayit.json'), 'utf8'));
  const kayit = JSON.parse(fs.readFileSync(path.join(havuzDiz, 'kayit.json'), 'utf8'));
  let n = 0;
  for (const y of yeni) {
    const hedef = kayit.find(k => k.kanal === y.kanal && k.no === y.no);
    if (!hedef) continue;
    fs.copyFileSync(path.join(KOK, 'cikti', varyantDiz, y.ad + '.webp'), path.join(havuzDiz, hedef.ad + '.webp'));
    hedef.metin = y.metin; hedef.kb = y.kb; hedef.kare = y.kare;
    n++;
  }
  fs.writeFileSync(path.join(havuzDiz, 'kayit.json'), JSON.stringify(kayit, null, 1));
  console.log(`${n} kare havuzda güncellendi (${eslesme.length} planlanmıştı)`);
}
