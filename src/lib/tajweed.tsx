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
export const tajweedColors: Record<string, { color: string; label: string }> = {
  m: { color: "#E60000", label: "مد لازم ٦ حركات" },          // أحمر
  n: { color: "#FF7E1E", label: "مد ٢ أو ٤ أو ٦ جوازاً" },     // برتقالي
  p: { color: "#DDAA1C", label: "مد واجب ٤ أو ٥ حركات" },      // أصفر ذهبي
  o: { color: "#DDAA1C", label: "مد متصل / منفصل" },           // أصفر ذهبي
  f: { color: "#1AAE5A", label: "إخفاء" },                     // أخضر
  c: { color: "#1AAE5A", label: "إخفاء شفوي" },                // أخضر
  w: { color: "#1AAE5A", label: "إقلاب" },                     // أخضر
  g: { color: "#1AAE5A", label: "غُنّة (حركتان)" },            // أخضر
  q: { color: "#1E90FF", label: "قلقلة" },                     // أزرق
  // إدغامات
  a: { color: "#A8A8A8", label: "إدغام بغنة" },                // رمادي فاتح
  u: { color: "#A8A8A8", label: "إدغام بلا غنة" },             // رمادي فاتح
  i: { color: "#A8A8A8", label: "إدغام شفوي" },                // رمادي فاتح
  d: { color: "#A8A8A8", label: "إدغام متجانسين" },            // رمادي فاتح
  b: { color: "#A8A8A8", label: "إدغام متقاربين" },            // رمادي فاتح
  // ما لا يُلفظ
  s: { color: "#A8A8A8", label: "حرف لا يُلفظ" },              // رمادي فاتح
  l: { color: "#A8A8A8", label: "لام شمسية" },                 // رمادي فاتح
  h: { color: "#A8A8A8", label: "همزة وصل" },                  // رمادي فاتح
};

// مجموعات لعرض المفتاح بشكل مختصر (مطابق لمصحف المدينة)
export const tajweedLegend: { color: string; label: string }[] = [
  { color: "#E60000", label: "مد ٦ حركات لزوماً" },
  { color: "#FF7E1E", label: "مد ٢ أو ٤ أو ٦ جوازاً" },
  { color: "#DDAA1C", label: "مد واجب ٤ أو ٥ حركات" },
  { color: "#1AAE5A", label: "إخفاء ومواقع الغُنّة (حركتان)" },
  { color: "#1E90FF", label: "قلقلة" },
  { color: "#A8A8A8", label: "إدغام، وما لا يُلفظ" },
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
