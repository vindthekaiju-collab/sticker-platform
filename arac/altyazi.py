#!/usr/bin/env python3
"""Ham GIF + Türkçe altyazı → altyazılı GIF.

Stil arpecx'ten alındı: beyaz kalın yazı, siyah kontur, altta ortalanmış.
Cümle bizim; görüntü ham kaynaktan. Yazı uzunluğuna göre punto küçülür,
çok uzunsa iki satıra bölünür — taşan yazı en sık görülen kusurdu.
"""
import json, os, subprocess, sys

# --- Eşleşme denetimi -------------------------------------------------------
#
# Kullanıcı bulgusu (2026-08-17): "yazılar ile görsellerin uyumunu sağlayan
# hâlâ bir şey yok". Doğruydu — 18 eşleşmenin ~dörtte biri düşüyordu. En net
# örnek: yalvaran gözlü bir pug'a "ur free trial of my patience has expired".
#
# İki kök sebep vardı: (1) altyazıyı 155px kontak karesinden yazmak — o boyutta
# sert bakış ile goofy ayırt edilmiyor; (2) önce cümleyi yazıp sonra görsel
# aramak — elde cümle olunca uymayan görsel zorlanıyor.
#
# Kural metinde kalırsa unutulur (bkz. beyin: "hookla-garanti"). Bu yüzden
# renderer'a gömüldü: her satır ifadesini ve cümle ailesini bildirmek zorunda,
# uymayan eşleşme ÜRETİLMEZ.

IFADELER = {"sert", "kustah", "bos", "saskin", "mahzun", "goofy", "uykulu", "enerjik"}

# Cümle ailesi -> o aileyi taşıyabilen ifadeler
AILELER = {
    "tehdit":     {"sert", "bos"},                # "u have three seconds" — boş bakışla da olur
    "kurumsal":   {"sert", "kustah", "bos"},      # "i am escalating this"
    "tersmantik": {"bos", "kustah"},              # "nobody can betray u..."
    "absurt":     {"goofy", "saskin"},            # "i have no thoughts"
    "mahzun":     {"mahzun", "uykulu"},           # "i was told there would be respect"
    "kustah":     {"kustah", "sert", "bos"},      # "im built different"
}


def denetle(plan):
    """Eşleşme kurallarını uygula. Hata listesi döner; boşsa temiz."""
    hatalar = []
    for i, p in enumerate(plan, 1):
        ifade, aile = p.get("ifade"), p.get("aile")
        if ifade not in IFADELER:
            hatalar.append(f"{i}. satır: ifade eksik/geçersiz ({ifade!r}) — {sorted(IFADELER)}")
            continue
        if aile not in AILELER:
            hatalar.append(f"{i}. satır: aile eksik/geçersiz ({aile!r}) — {sorted(AILELER)}")
            continue
        if ifade not in AILELER[aile]:
            hatalar.append(
                f"{i}. satır REDDEDİLDİ: “{p['metin']}” ({aile}) ifadesi {ifade} olan "
                f"görselde durmaz — bu aile yalnız {sorted(AILELER[aile])} kabul eder")
    return hatalar


GENISLIK = 400
UST_PAY = 16
FPS = 12          # 25MB kaynak WhatsApp dönüşümünü 14 dakikaya çıkarıyordu
AZAMI_SN = 6      # sticker zaten 10sn üstünü oynatmıyor
FONT = "font.ttf"          # boşluksuz kopya: ffmpeg filtre dizgisinde boşluk yolu böler
ALT_PAY = 18


def kacar(s):
    """drawtext dizgisinde özel anlamı olan karakterler."""
    return (s.replace("\\", r"\\").replace(":", r"\:")
             .replace("'", r"’").replace("%", r"\%"))


def bol(metin, azami=30):
    """Uzun cümleyi iki satıra dengeli böl."""
    if len(metin) <= azami:
        return [metin]
    kelime = metin.split()
    en_iyi, fark = None, 10**9
    for i in range(1, len(kelime)):
        a, b = " ".join(kelime[:i]), " ".join(kelime[i:])
        if max(len(a), len(b)) > azami + 6:
            continue
        if abs(len(a) - len(b)) < fark:
            fark, en_iyi = abs(len(a) - len(b)), (a, b)
    return list(en_iyi) if en_iyi else [metin]


def bant_betigi():
    """bant-olc.js'yi bul. Betik lib/donustur'a göreli require ettiği için
    DEPO İÇİNDEKİ kopya çalıştırılmalı; yanına kopyalanan sürüm kırılıyor."""
    yanim = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bant-olc.js")
    adaylar = [yanim, os.path.expanduser("~/sticker-platform/arac/bant-olc.js")]
    for a in adaylar:
        if os.path.exists(os.path.join(os.path.dirname(a), "..", "lib", "donustur.js")):
            return a
    return None


def bantlari_olc(kaynaklar):
    """Her klip için hangi bandın boş olduğunu ölç (arac/bant-olc.js).

    SESSİZ DÜŞMEZ. İlk sürümde betik yolu kırıkken fonksiyon boş sözlük
    döndürüyordu; ölçüm hiç çalışmadığı halde her altyazı varsayılan olarak
    alta yazılıyor ve kimse fark etmiyordu (2026-08-17).
    """
    if not kaynaklar:
        return {}
    betik = bant_betigi()
    if not betik:
        raise SystemExit("bant-olc.js bulunamadı — ölçüm yapılamıyor, üretim durduruldu")
    r = subprocess.run(["node", betik, *kaynaklar], capture_output=True, text=True, timeout=900)
    if r.returncode != 0 or not r.stdout.strip():
        raise SystemExit("bant ölçümü düştü: " + (r.stderr or "")[:200])
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        raise SystemExit("bant ölçümü bozuk JSON döndürdü")


def kirpma_filtresi(kirp):
    """Filigran kesme. kirp: {"ust":0,"alt":0.08,"sol":0,"sag":0} — oranlar.

    Üçüncü parti filigranları (© BarkPost, WorkBeaver, TRT1 …) köşede duruyor;
    satılık pakette başkasının reklamı olmaz. Yeni görsel aramak yerine kenarı
    kesmek hem hızlı hem kadrajı sıkılaştırıyor.
    """
    if not kirp:
        return None
    u, a = float(kirp.get("ust", 0)), float(kirp.get("alt", 0))
    so, sa = float(kirp.get("sol", 0)), float(kirp.get("sag", 0))
    if not any((u, a, so, sa)):
        return None
    return (f"crop=w=iw*{1 - so - sa:.4f}:h=ih*{1 - u - a:.4f}"
            f":x=iw*{so:.4f}:y=ih*{u:.4f}")


def uret(kaynak, metin, cikti, kirp=None, yer='alt'):
    satirlar = bol(metin)
    enUzun = max(len(s) for s in satirlar)
    punto = max(18, min(30, int(GENISLIK / (enUzun * 0.60))))
    satirYuk = int(punto * 1.25)
    çizimler = []
    for i, s in enumerate(satirlar):
        # Altyazı BOŞ banda konur; kaynağın kendi yazısıyla üst üste binmesin.
        if yer == "ust":
            y = f"{UST_PAY + i * satirYuk}"
        else:
            y = f"h-th-{ALT_PAY + (len(satirlar) - 1 - i) * satirYuk}"
        çizimler.append(
            f"drawtext=fontfile={FONT}:text='{kacar(s)}':fontcolor=white:"
            f"fontsize={punto}:borderw=3:bordercolor=black@0.92:"
            f"x=(w-text_w)/2:y={y}")
    # Palet üretimi kaliteyi korurken dosyayı küçültür; fps ve süre sınırı
    # asıl kazancı sağlıyor (kaynak 25MB → ~1MB).
    kirpma = kirpma_filtresi(kirp)
    vf = ((kirpma + "," if kirpma else "")
          + f"fps={FPS},scale={GENISLIK}:-2:flags=lanczos," + ",".join(çizimler)
          + ",split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer")
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", kaynak,
                        "-t", str(AZAMI_SN), "-vf", vf, cikti], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(cikti) or os.path.getsize(cikti) < 1000:
        return None, (r.stderr or "").strip()[:90]
    return os.path.getsize(cikti), None


def main():
    plan = json.load(open(sys.argv[1]))

    hatalar = denetle(plan)
    if hatalar:
        print("EŞLEŞME DENETİMİ DÜŞTÜ — hiçbir şey üretilmedi:\n")
        for h in hatalar:
            print("  ✗", h)
        print("\nİfadeyi 420px'te bak, öyle etiketle. Cümleyi ifadeye göre yaz.")
        sys.exit(1)

    os.makedirs("altyazili", exist_ok=True)

    kaynaklar = [f"ham/{p['kimlik']}.gif" for p in plan]
    bantlar = bantlari_olc(kaynaklar)

    ok = 0
    for p in plan:
        kaynak = f"ham/{p['kimlik']}.gif"
        cikti = f"altyazili/{p['kimlik']}.gif"
        b = bantlar.get(kaynak, {})
        # Plan açıkça yer belirtmişse ona uy; yoksa ölçüme.
        yer = p.get("yer") or b.get("oneri") or "alt"
        if b.get("riskli"):
            print(f"  ⚠ {p['kimlik'][:16]:18} iki bant da dolu "
                  f"(ust={b.get('ust')} alt={b.get('alt')} kare={b.get('tum')}) "
                  f"— altyazı kalabalığa binebilir")
        boyut, hata = uret(kaynak, p["metin"], cikti, p.get("kirp"), yer)
        if hata:
            print(f"  ✗ {p['kimlik'][:16]:18} {hata}")
        else:
            ok += 1
            isaret = "↑" if yer == "ust" else "↓"
            print(f"  ✓ {p['kimlik'][:16]:18} {isaret} {boyut//1024:>5}KB  “{p['metin']}”")
    print(f"\n{ok}/{len(plan)} üretildi")


if __name__ == "__main__":
    main()
