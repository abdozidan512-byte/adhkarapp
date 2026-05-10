import { Fragment, type ReactNode } from "react";
import { getSetting, saveSetting } from "./db";

export type TajweedAyah = { numberInSurah: number; text: string };

const TAJWEED_RE = /\[([a-z])(?::\d+)?\[([^\]]*)\]/g;

// ===== ألوان التجويد (مطابقة لمصحف المدينة المنورة) =====
// أحمر: مد لازم ٦ حركات
// برتقالي: مد جائز ٢/٤/٦
// أصفر: مد واجب ٤/٥ حركات + مد حركتان
// أخضر: إخفاء + غنة + إقلاب
// أزرق: قلقلة + تفخيم
// رمادي فاتح: إدغام + ما لا يُلفظ
// ألوان مطلوبة من المستخدم:
// وردي غامق: مد ٦ حركات لزوماً
// وردي فاتح: مد واجب ٤ أو ٥ حركات
// برتقالي: مد ٢ أو ٤ أو ٦ جوازاً
// أصفر: مد حركتان (طبيعي)
// أخضر: إخفاء ومواقع الغُنّة
// رمادي: إدغام وما لا يُلفظ
// أزرق غامق: تفخيم
// أزرق فاتح: قلقلة
const COLOR_PINK_DARK = "#C71585";
const COLOR_PINK_LIGHT = "#FF8DC7";
const COLOR_ORANGE = "#FF7E1E";
const COLOR_YELLOW = "#E6C200";
const COLOR_GREEN = "#1AAE5A";
const COLOR_GRAY = "#A8A8A8";
const COLOR_BLUE_DARK = "#0B3D91";
const COLOR_BLUE_LIGHT = "#1E90FF";

export const tajweedColors: Record<string, { color: string; label: string }> = {
  m: { color: COLOR_PINK_DARK, label: "مد لازم ٦ حركات" },
  p: { color: COLOR_PINK_LIGHT, label: "مد واجب ٤ أو ٥ حركات" },
  o: { color: COLOR_PINK_LIGHT, label: "مد متصل / منفصل" },
  n: { color: COLOR_ORANGE, label: "مد ٢ أو ٤ أو ٦ جوازاً" },
  // أخضر — إخفاء ومواقع الغنة
  f: { color: COLOR_GREEN, label: "إخفاء" },
  c: { color: COLOR_GREEN, label: "إخفاء شفوي" },
  w: { color: COLOR_GREEN, label: "إقلاب" },
  g: { color: COLOR_GREEN, label: "غُنّة (حركتان)" },
  // أزرق فاتح — قلقلة
  q: { color: COLOR_BLUE_LIGHT, label: "قلقلة" },
  // رمادي — إدغام وما لا يُلفظ
  a: { color: COLOR_GRAY, label: "إدغام بغنة" },
  u: { color: COLOR_GRAY, label: "إدغام بلا غنة" },
  i: { color: COLOR_GRAY, label: "إدغام شفوي" },
  d: { color: COLOR_GRAY, label: "إدغام متجانسين" },
  b: { color: COLOR_GRAY, label: "إدغام متقاربين" },
  s: { color: COLOR_GRAY, label: "حرف لا يُلفظ" },
  l: { color: COLOR_GRAY, label: "لام شمسية" },
  h: { color: COLOR_GRAY, label: "همزة وصل" },
};

export const tajweedLegend: { color: string; label: string }[] = [
  { color: COLOR_PINK_DARK, label: "مد ٦ حركات لزوماً" },
  { color: COLOR_PINK_LIGHT, label: "مد واجب ٤ أو ٥ حركات" },
  { color: COLOR_ORANGE, label: "مد ٢ أو ٤ أو ٦ جوازاً" },
  { color: COLOR_YELLOW, label: "مد حركتان" },
  { color: COLOR_GREEN, label: "إخفاء ومواقع الغُنّة" },
  { color: COLOR_BLUE_DARK, label: "تفخيم" },
  { color: COLOR_BLUE_LIGHT, label: "قلقلة" },
  { color: COLOR_GRAY, label: "إدغام، وما لا يُلفظ" },
];

type Token = { char: string; tag?: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TAJWEED_RE.lastIndex = 0;
  while ((m = TAJWEED_RE.exec(text)) !== null) {
    for (let i = last; i < m.index; i++) tokens.push({ char: text[i] });
    for (const ch of m[2]) tokens.push({ char: ch, tag: m[1] });
    last = m.index + m[0].length;
  }
  for (let i = last; i < text.length; i++) tokens.push({ char: text[i] });
  return tokens;
}

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
function normalizeArabic(text: string): string {
  return text
    .replace(ARABIC_DIACRITICS, "")
    .replace(/\s+/g, "")
    .replace(/[ٱآإأ]/g, "ا")
    .replace(/ٰ/g, "");
}
const BISMILLAH_NORMALIZED = "بسماللهالرحمنالرحيم";

function stripBismillahTokens(tokens: Token[]): Token[] {
  let consumed = 0;
  let normalized = "";
  while (consumed < tokens.length && normalized.length < BISMILLAH_NORMALIZED.length) {
    consumed++;
    normalized = normalizeArabic(tokens.slice(0, consumed).map((t) => t.char).join(""));
    if (!BISMILLAH_NORMALIZED.startsWith(normalized)) return tokens;
  }
  if (normalized === BISMILLAH_NORMALIZED) {
    let i = consumed;
    while (i < tokens.length && /[\s\u0600-\u061F]/.test(tokens[i].char)) i++;
    return tokens.slice(i);
  }
  return tokens;
}

export function renderTajweed(text: string): ReactNode {
  const tokens = tokenize(text);
  // group consecutive same-tag
  const groups: { tag?: string; text: string }[] = [];
  for (const t of tokens) {
    const last = groups[groups.length - 1];
    if (last && last.tag === t.tag) last.text += t.char;
    else groups.push({ tag: t.tag, text: t.char });
  }
  return (
    <>
      {groups.map((g, i) => {
        const c = g.tag ? tajweedColors[g.tag] : undefined;
        if (!c) return <Fragment key={i}>{g.text}</Fragment>;
        return (
          <span key={i} style={{ color: c.color }}>
            {g.text}
          </span>
        );
      })}
    </>
  );
}

// ===== جلب نسخة التجويد للسورة =====
export async function fetchSurahTajweed(surahNumber: number): Promise<TajweedAyah[]> {
  const cacheKey = `tajweed-surah-${surahNumber}`;
  const cached = await getSetting<TajweedAyah[]>(cacheKey);
  if (cached && cached.length > 0) {
    return maybeStripBismillah(cached, surahNumber);
  }
  const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/quran-tajweed`);
  if (!res.ok) throw new Error("تعذّر تحميل نص التجويد");
  const json = await res.json();
  const ayahs: TajweedAyah[] = json.data.ayahs.map((a: any) => ({
    numberInSurah: a.numberInSurah,
    text: a.text as string,
  }));
  await saveSetting(cacheKey, ayahs);
  return maybeStripBismillah(ayahs, surahNumber);
}

function maybeStripBismillah(ayahs: TajweedAyah[], surahNumber: number): TajweedAyah[] {
  if (surahNumber === 1 || surahNumber === 9 || ayahs.length === 0) return ayahs;
  const tokens = tokenize(ayahs[0].text);
  const stripped = stripBismillahTokens(tokens);
  if (stripped.length === tokens.length) return ayahs;
  // rebuild text from tokens with tags
  let rebuilt = "";
  let curTag: string | undefined = undefined;
  for (const t of stripped) {
    if (t.tag !== curTag) {
      if (curTag) rebuilt += "]";
      if (t.tag) rebuilt += `[${t.tag}[`;
      curTag = t.tag;
    }
    rebuilt += t.char;
  }
  if (curTag) rebuilt += "]";
  return [{ ...ayahs[0], text: rebuilt }, ...ayahs.slice(1)];
}
