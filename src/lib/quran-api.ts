import { getSurah, saveSurah, saveAudio, getAudio } from "./db";
import { reciters, type ReciterId } from "@/data/surahs";

export type Ayah = { numberInSurah: number; text: string };

// أنماط البسملة المختلفة كما تردنا من المصادر (مع/بدون تشكيل وفراغات)
const BISMILLAH_PATTERNS = [
  /^\s*بِسْمِ\s+ٱللَّهِ\s+ٱلرَّحْمَٰنِ\s+ٱلرَّحِيمِ\s*/,
  /^\s*بِسْمِ\s+اللَّهِ\s+الرَّحْمَٰنِ\s+الرَّحِيمِ\s*/,
  /^\s*بِسْمِ\s+ٱللّٰهِ\s+ٱلرَّحْمٰنِ\s+ٱلرَّحِيمِ\s*/,
  /^\s*بسم\s+الله\s+الرحمن\s+الرحيم\s*/,
];

function stripLeadingBismillah(text: string): string {
  for (const re of BISMILLAH_PATTERNS) {
    if (re.test(text)) return text.replace(re, "").trim();
  }
  return text;
}

export async function fetchSurahText(surahNumber: number): Promise<Ayah[]> {
  const cached = await getSurah(surahNumber);
  if (cached) {
    // تنظيف الكاش القديم الذي قد يحتوي على بسملة مكررة في الآية الأولى
    if (surahNumber !== 1 && surahNumber !== 9 && cached.ayahs.length > 0) {
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
    // إزالة البسملة من بداية الآية الأولى لكل السور ما عدا الفاتحة (1) والتوبة (9)
    if (idx === 0 && surahNumber !== 1 && surahNumber !== 9) {
      text = stripLeadingBismillah(text);
    }
    return { numberInSurah: a.numberInSurah, text };
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
  if (reciter.mode === "surah" && "surahBaseUrl" in reciter) {
    return `${reciter.surahBaseUrl}${pad3(surahNumber)}.mp3`;
  }
  // للقراء "ayah" نوفر بديل من mp3quran للسورة الكاملة عبر السيرفرات الشهيرة
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
