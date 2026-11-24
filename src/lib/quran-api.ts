import { getSurah, saveSurah, saveAudio, getAudio, deleteAudio, getMushafPage, saveMushafPage, deleteMushafPage } from "./db";
import { reciters, surahs, type ReciterId } from "@/data/surahs";

const mushafPageDownloads = new Map<string, Promise<Blob>>();

export type Ayah = { numberInSurah: number; text: string; page?: number; juz?: number; surahNumber?: number };

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

let allQuranTextRequest: Promise<Ayah[]> | null = null;

/**
 * Returns the whole Quran in canonical Madani page order. It reuses the
 * per-surah IndexedDB cache when complete, otherwise fills it from one
 * Uthmani Quran response so the reader can keep page navigation continuous.
 */
export async function fetchAllQuranText(): Promise<Ayah[]> {
  if (allQuranTextRequest) return allQuranTextRequest;

  const request = (async () => {
    const cachedSurahs = await Promise.all(surahs.map((surah) => getSurah(surah.number)));
    const cacheIsComplete = cachedSurahs.every((cached, index) =>
      !!cached &&
      cached.ayahs.length === surahs[index].numberOfAyahs &&
      cached.ayahs.every((ayah) => Number.isInteger(ayah.page) && (ayah.page ?? 0) >= 1 && (ayah.page ?? 0) <= 604),
    );

    if (cacheIsComplete) {
      return cachedSurahs.flatMap((cached, index) =>
        cached!.ayahs.map((ayah) => ({ ...ayah, surahNumber: surahs[index].number })),
      );
    }

    const response = await fetch("https://api.alquran.cloud/v1/quran/quran-uthmani");
    if (!response.ok) throw new Error(`تعذّر تحميل بيانات المصحف: ${response.status}`);
    const json = await response.json();
    const sourceAyahs = json?.data?.ayahs;
    const expectedAyahCount = surahs.reduce((total, surah) => total + surah.numberOfAyahs, 0);
    if (!Array.isArray(sourceAyahs) || sourceAyahs.length !== expectedAyahCount) {
      throw new Error("بيانات صفحات المصحف غير مكتملة.");
    }

    const grouped: Ayah[][] = surahs.map(() => []);
    for (const sourceAyah of sourceAyahs) {
      const surahNumber = Number(sourceAyah?.surah?.number);
      const numberInSurah = Number(sourceAyah?.numberInSurah);
      const page = Number(sourceAyah?.page);
      const target = grouped[surahNumber - 1];
      if (
        !target ||
        !Number.isInteger(numberInSurah) ||
        numberInSurah < 1 ||
        !Number.isInteger(page) ||
        page < 1 ||
        page > 604 ||
        typeof sourceAyah?.text !== "string"
      ) {
        throw new Error("بيانات آيات المصحف غير صالحة.");
      }
      const surah = surahs[surahNumber - 1];
      const text = numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9
        ? stripLeadingBismillah(sourceAyah.text)
        : sourceAyah.text;
      target.push({
        numberInSurah,
        text,
        page,
        juz: Number(sourceAyah.juz) || undefined,
        surahNumber,
      });
    }

    if (grouped.some((items, index) =>
      items.length !== surahs[index].numberOfAyahs ||
      items.some((ayah, ayahIndex) => ayah.numberInSurah !== ayahIndex + 1),
    )) {
      throw new Error("تعذّر التحقق من اكتمال آيات السور.");
    }

    for (let index = 0; index < grouped.length; index++) {
      const surahNumber = surahs[index].number;
      const cachedAyahs = grouped[index].map(({ surahNumber: _surahNumber, ...ayah }) => ayah);
      await saveSurah(surahNumber, cachedAyahs);
    }
    return grouped.flat();
  })();

  allQuranTextRequest = request;
  try {
    return await request;
  } catch (error) {
    if (allQuranTextRequest === request) allQuranTextRequest = null;
    throw error;
  }
}

export async function fetchSurahText(surahNumber: number, signal?: AbortSignal): Promise<Ayah[]> {
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

  const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/quran-uthmani`, { signal });
  if (!res.ok) throw new Error(`تعذّر تحميل نص السورة: ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json?.data?.ayahs)) throw new Error("استجابة نص القرآن غير مكتملة.");
  const ayahs: Ayah[] = json.data.ayahs.map((a: any, idx: number) => {
    let text: string = a.text;
    if (idx === 0 && shouldStrip) {
      text = stripLeadingBismillah(text);
    }
    return { numberInSurah: a.numberInSurah, text, page: a.page, juz: a.juz };
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

async function assertAudioBlob(blob: Blob, contentType = "") {
  if (blob.size < 1024 || /text\/html|application\/json/i.test(contentType)) {
    throw new Error("الملف المستلم ليس تسجيلًا صوتيًا صالحًا.");
  }
  const prefix = new TextDecoder().decode(await blob.slice(0, 80).arrayBuffer()).trimStart().toLowerCase();
  if (prefix.startsWith("<!doctype html") || prefix.startsWith("<html") || prefix.startsWith("{\"error")) {
    throw new Error("أعاد مصدر الصوت صفحة خطأ بدل التسجيل.");
  }
}

async function assertMushafImageBlob(blob: Blob, verifyDecode = true) {
  if (blob.size < 8_000) throw new Error("ملف صفحة المصحف ناقص أو تالف.");
  const signature = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
  const endSignature = new Uint8Array(await blob.slice(-2).arrayBuffer());
  if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff || endSignature[0] !== 0xff || endSignature[1] !== 0xd9) {
    throw new Error("تنسيق صفحة المصحف غير مكتمل.");
  }
  if (!verifyDecode) return;
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    const valid = bitmap.width >= 400 && bitmap.height >= 600;
    bitmap.close();
    if (!valid) throw new Error("أبعاد صفحة المصحف غير مكتملة.");
    return;
  }
  const imageUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();
    if (image.naturalWidth < 400 || image.naturalHeight < 600) throw new Error("أبعاد صفحة المصحف غير مكتملة.");
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function downloadAyahAudio(
  reciterId: ReciterId,
  surahNumber: number,
  ayah: number,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const key = audioKey(reciterId, surahNumber, ayah);
  const cached = await getAudio(key);
  if (cached) {
    try {
      await assertAudioBlob(cached.blob);
      onProgress?.(100);
      return cached.blob;
    } catch {
      await deleteAudio(key);
    }
  }
  const url = getAyahAudioUrl(reciterId, surahNumber, ayah);
  if (!url) throw new Error("هذا القارئ غير متاح آية بآية");
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
  const blob = await res.blob();
  await assertAudioBlob(blob, res.headers.get("content-type") ?? "");
  await saveAudio(key, blob, reciterId, surahNumber, ayah);
  onProgress?.(100);
  return blob;
}

// تحميل سورة كاملة كملف واحد
export async function downloadFullSurah(
  reciterId: ReciterId,
  surahNumber: number,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const key = audioKey(reciterId, surahNumber);
  const cached = await getAudio(key);
  if (cached) {
    try {
      await assertAudioBlob(cached.blob);
      onProgress?.(100);
      return cached.blob;
    } catch {
      await deleteAudio(key);
    }
  }
  const url = getFullSurahAudioUrl(reciterId, surahNumber);
  if (!url) throw new Error("لا يوجد رابط لهذه السورة");
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  if (/text\/html|application\/json/i.test(contentType)) throw new Error("أعاد مصدر الصوت صفحة خطأ بدل التسجيل.");
  const reader = res.body?.getReader();
  const total = Number(res.headers.get("content-length") || 0);
  if (!reader) {
    const blob = await res.blob();
    await assertAudioBlob(blob, contentType);
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
  await assertAudioBlob(blob, contentType);
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

export type MushafPageMode = "tajweed" | "clear";

const TAJWEED_MUSHAF_EDITION = "easyquran-hafs-1f8a59b8";
const TAJWEED_MUSHAF_REVISION = "1f8a59b8b11e9ecfa859971a5dcfb326679757b3";
const CLEAR_MUSHAF_EDITION = "quranhub-hafs-wasat-v1";

export function getMushafPageImageUrl(page: number, mode: MushafPageMode = "tajweed") {
  if (!Number.isInteger(page) || page < 1 || page > 604) {
    throw new RangeError("Mushaf page must be between 1 and 604");
  }
  if (mode === "tajweed") {
    return `https://raw.githubusercontent.com/jahedev/tajweed-quran-pages/${TAJWEED_MUSHAF_REVISION}/hafs/tajweed-${pad3(page)}.jpg`;
  }
  return `https://raw.githubusercontent.com/QuranHub/quran-pages-images/main/kfgqpc/hafs-wasat/${page}.jpg`;
}

export async function downloadMushafPage(
  page: number,
  mode: MushafPageMode = "tajweed",
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
  verifyCached = false,
): Promise<Blob> {
  const key = `${mode}-${page}`;
  let request = mushafPageDownloads.get(key);
  if (!request) {
    request = (async () => {
      const cached = await getMushafPage(page, mode);
      const edition = mode === "tajweed" ? TAJWEED_MUSHAF_EDITION : CLEAR_MUSHAF_EDITION;
      if (cached?.blob && (mode === "clear" || cached.edition === edition)) {
        try {
          await assertMushafImageBlob(cached.blob, verifyCached);
          return cached.blob;
        } catch {
          await deleteMushafPage(page, mode);
        }
      }
      try {
        const response = await fetch(getMushafPageImageUrl(page, mode), { signal });
        if (!response.ok) throw new Error(`تعذّر تنزيل صفحة المصحف ${page}: ${response.status}`);
        const blob = await response.blob();
        await assertMushafImageBlob(blob);
        await saveMushafPage(page, mode, blob, edition);
        return blob;
      } catch (error) {
        // Never mix an outdated Tajweed edition into the current set of pages.
        // The standard Mushaf remains reusable because its edition has not changed.
        if (cached?.blob && !signal?.aborted && (mode === "clear" || cached.edition === edition)) return cached.blob;
        throw error;
      }
    })();
    mushafPageDownloads.set(key, request);
  }

  try {
    const blob = await request;
    onProgress?.(100);
    return blob;
  } finally {
    if (mushafPageDownloads.get(key) === request) mushafPageDownloads.delete(key);
  }
}
