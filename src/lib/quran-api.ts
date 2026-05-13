import { getSurah, saveSurah, saveAudio, getAudio } from "./db";
import { reciters, type ReciterId } from "@/data/surahs";

export type Ayah = { numberInSurah: number; text: string; page?: number; juz?: number };

// إزالة البسملة من بداية الآية الأولى لأي سورة
// نطبّق المطابقة على النص بعد تجريد التشكيل والمسافات حتى نتعامل مع كل المصادر
const BISMILLAH_NORMALIZED = "بسماللهالرحمنالرحيم";

// محارف التشكيل العربي + التطويل
const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

function normalizeArabic(text: string): string {
  return text
    .replace(ARABIC_DIACRITICS, "")
    .replace(/\s+/g, "")
    // توحيد ألف الوصل والمد مع الألف العادية
    .replace(/[ٱآإأ]/g, "ا")
    // توحيد رسم "الله"
    .replace(/ٰ/g, "");
}

function stripLeadingBismillah(text: string): string {
  // نمشي حرفاً بحرف على النص الأصلي ونحاول نطابق البسملة المُطبَّعة
  let consumed = 0;
  let normalizedSoFar = "";
  while (consumed < text.length && normalizedSoFar.length < BISMILLAH_NORMALIZED.length) {
    consumed++;
    normalizedSoFar = normalizeArabic(text.slice(0, consumed));
    if (!BISMILLAH_NORMALIZED.startsWith(normalizedSoFar)) {
      // لا تبدأ ببسملة
      return text;
    }
  }
  if (normalizedSoFar === BISMILLAH_NORMALIZED) {
    return text.slice(consumed).replace(/^[\s\u0600-\u061F]+/, "").trim();
  }
  return text;
}

export async function fetchSurahText(surahNumber: number): Promise<Ayah[]> {
  const shouldStrip = surahNumber !== 1 && surahNumber !== 9;

  const cached = await getSurah(surahNumber);
  // Only use cache if it already includes the Mushaf page numbers
  const cacheHasPages = cached?.ayahs?.length && cached.ayahs.every((a: any) => typeof a.page === "number");
  if (cached && cacheHasPages) {
    if (shouldStrip && cached.ayahs.length > 0) {
      const first = cached.ayahs[0];
      const cleaned = stripLeadingBismillah(first.text);
      if (cleaned !== first.text) {
        cached.ayahs[0] = { ...first, text: cleaned };
        await saveSurah(surahNumber, cached.ayahs);
      }
    }
    return cached.ayahs;
  }

  const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/quran-uthmani`);
  const json = await res.json();
  const ayahs: Ayah[] = json.data.ayahs.map((a: any, idx: number) => {
    let text: string = a.text;
    if (idx === 0 && shouldStrip) {
      text = stripLeadingBismillah(text);
    }
    return { numberInSurah: a.numberInSurah, text, page: a.page };
  });
  await saveSurah(surahNumber, ayahs);
  return ayahs;
}

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

export function getReciter(reciterId: ReciterId) {
  return reciters.find((r) => r.id === reciterId);
}

// آية بآية (everyayah)
export function getAyahAudioUrl(reciterId: ReciterId, surahNumber: number, ayah: number) {
  const reciter = getReciter(reciterId);
  if (!reciter || reciter.mode !== "ayah" || !("subfolder" in reciter)) return "";
  return `https://everyayah.com/data/${reciter.subfolder}/${pad3(surahNumber)}${pad3(ayah)}.mp3`;
}

// سورة كاملة (mp3quran)
export function getFullSurahAudioUrl(reciterId: ReciterId, surahNumber: number) {
  const reciter = getReciter(reciterId);
  if (!reciter) return "";
  // إذا كان للقارئ surahBaseUrl نستخدمه مباشرة
  if ("surahBaseUrl" in reciter && reciter.surahBaseUrl) {
    return `${reciter.surahBaseUrl}${pad3(surahNumber)}.mp3`;
  }
  // بديل من mp3quran للقراء بدون surahBaseUrl
  if (reciterId === "ar.yasser") return `https://server11.mp3quran.net/yasser/${pad3(surahNumber)}.mp3`;
  if (reciterId === "ar.maher") return `https://server12.mp3quran.net/maher/${pad3(surahNumber)}.mp3`;
  return "";
}

export function audioKey(reciterId: string, surahNumber: number, ayah?: number) {
  return ayah !== undefined ? `${reciterId}-${surahNumber}-${ayah}` : `${reciterId}-${surahNumber}`;
}

export async function downloadAyahAudio(
  reciterId: ReciterId,
  surahNumber: number,
  ayah: number,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const key = audioKey(reciterId, surahNumber, ayah);
  const cached = await getAudio(key);
  if (cached) {
    onProgress?.(100);
    return cached.blob;
  }
  const url = getAyahAudioUrl(reciterId, surahNumber, ayah);
  if (!url) throw new Error("هذا القارئ غير متاح آية بآية");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
  const blob = await res.blob();
  await saveAudio(key, blob, reciterId, surahNumber, ayah);
  onProgress?.(100);
  return blob;
}

// تحميل سورة كاملة كملف واحد
export async function downloadFullSurah(
  reciterId: ReciterId,
  surahNumber: number,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const key = audioKey(reciterId, surahNumber);
  const cached = await getAudio(key);
  if (cached) {
    onProgress?.(100);
    return cached.blob;
  }
  const url = getFullSurahAudioUrl(reciterId, surahNumber);
  if (!url) throw new Error("لا يوجد رابط لهذه السورة");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const reader = res.body?.getReader();
  const total = Number(res.headers.get("content-length") || 0);
  if (!reader) {
    const blob = await res.blob();
    await saveAudio(key, blob, reciterId, surahNumber);
    onProgress?.(100);
    return blob;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress?.(Math.round((received / total) * 100));
  }
  const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
  await saveAudio(key, blob, reciterId, surahNumber);
  onProgress?.(100);
  return blob;
}

export async function getAyahAudioBlob(reciterId: ReciterId, surahNumber: number, ayah: number): Promise<Blob | null> {
  const key = audioKey(reciterId, surahNumber, ayah);
  const cached = await getAudio(key);
  return cached?.blob ?? null;
}

export async function getFullSurahBlob(reciterId: ReciterId, surahNumber: number): Promise<Blob | null> {
  const key = audioKey(reciterId, surahNumber);
  const cached = await getAudio(key);
  return cached?.blob ?? null;
}
