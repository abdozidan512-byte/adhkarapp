import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface AzkarDB extends DBSchema {
  quran: {
    key: number; // surah number
    value: {
      number: number;
      ayahs: { numberInSurah: number; text: string; page?: number; juz?: number }[];
    };
  };
  prayerTimes: {
    key: string; // YYYY-MM-DD
    value: {
      date: string;
      timings: Record<string, string>;
      lat: number;
      lng: number;
    };
  };
  audio: {
    key: string; // `${reciterId}-${surahNumber}` or `${reciterId}-${surahNumber}-${ayah}`
    value: {
      key: string;
      blob: Blob;
      size: number;
      reciterId: string;
      surahNumber: number;
      ayah?: number;
      cachedAt: number;
    };
  };
  settings: {
    key: string;
    value: any;
  };
  mushafPages: {
    key: string; // "tajweed-1" etc.
    value: { key: string; page: number; mode: "tajweed" | "clear"; blob: Blob; size: number; cachedAt: number; edition?: string };
  };
}

let dbPromise: Promise<IDBPDatabase<AzkarDB>> | null = null;

export function getDB() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB<AzkarDB>("azkar-app", 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("quran")) db.createObjectStore("quran", { keyPath: "number" });
        if (!db.objectStoreNames.contains("prayerTimes")) db.createObjectStore("prayerTimes", { keyPath: "date" });
        if (!db.objectStoreNames.contains("audio")) db.createObjectStore("audio", { keyPath: "key" });
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
        if (!db.objectStoreNames.contains("mushafPages")) db.createObjectStore("mushafPages", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export async function saveSetting(key: string, value: any) {
  const db = await getDB();
  if (!db) return;
  await db.put("settings", value, key);
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  if (!db) return undefined;
  return (await db.get("settings", key)) as T | undefined;
}

export async function saveSurah(number: number, ayahs: { numberInSurah: number; text: string; page?: number; juz?: number }[]) {
  const db = await getDB();
  if (!db) return;
  await db.put("quran", { number, ayahs });
}

export async function getSurah(number: number) {
  const db = await getDB();
  if (!db) return undefined;
  return db.get("quran", number);
}

export async function savePrayerTimes(date: string, lat: number, lng: number, timings: Record<string, string>) {
  const db = await getDB();
  if (!db) return;
  await db.put("prayerTimes", { date, timings, lat, lng });
}

export async function getPrayerTimes(date: string) {
  const db = await getDB();
  if (!db) return undefined;
  return db.get("prayerTimes", date);
}

export async function saveAudio(key: string, blob: Blob, reciterId: string, surahNumber: number, ayah?: number) {
  const db = await getDB();
  if (!db) return;
  await db.put("audio", { key, blob, size: blob.size, reciterId, surahNumber, ayah, cachedAt: Date.now() });
}

export async function getAudio(key: string) {
  const db = await getDB();
  if (!db) return undefined;
  return db.get("audio", key);
}

export async function listAudio() {
  const db = await getDB();
  if (!db) return [];
  return db.getAll("audio");
}

export async function deleteAudio(key: string) {
  const db = await getDB();
  if (!db) return;
  await db.delete("audio", key);
}

export async function getCachedAudioKeys(): Promise<Set<string>> {
  const db = await getDB();
  if (!db) return new Set();
  const keys = await db.getAllKeys("audio");
  return new Set(keys);
}

// ===== Reading progress (last-read tracker) =====
export type ReadingProgress = {
  surahNumber: number;
  surahName: string;
  page: number;
  totalPages: number;
  /** Marks page as a zero-based page in the full Mushaf, not a surah-local offset. */
  globalPage?: boolean;
  ayah: number;
  updatedAt: number;
};

export async function saveReadingProgress(p: ReadingProgress) {
  await saveSetting("reading-progress", p);
}

export async function getReadingProgress(): Promise<ReadingProgress | undefined> {
  return getSetting<ReadingProgress>("reading-progress");
}


export function mushafPageKey(page: number, mode: "tajweed" | "clear" = "tajweed") {
  return `${mode}-${page}`;
}

export async function getMushafPage(page: number, mode: "tajweed" | "clear" = "tajweed") {
  const db = await getDB();
  if (!db) return undefined;
  return db.get("mushafPages", mushafPageKey(page, mode));
}

export async function saveMushafPage(page: number, mode: "tajweed" | "clear", blob: Blob, edition?: string) {
  const db = await getDB();
  if (!db) return;
  const key = mushafPageKey(page, mode);
  await db.put("mushafPages", { key, page, mode, blob, size: blob.size, cachedAt: Date.now(), edition });
}

export async function deleteMushafPage(page: number, mode: "tajweed" | "clear") {
  const db = await getDB();
  if (!db) return;
  await db.delete("mushafPages", mushafPageKey(page, mode));
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number; persistent: boolean | null }> {
  if (typeof navigator === "undefined") return { usage: 0, quota: 0, persistent: null };
  const storage = (navigator as Navigator & { storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }>; persisted?: () => Promise<boolean> } }).storage;
  if (!storage) return { usage: 0, quota: 0, persistent: null };
  try {
    const [estimate, persistent] = await Promise.all([
      storage.estimate?.() ?? Promise.resolve({ usage: 0, quota: 0 }),
      storage.persisted?.() ?? Promise.resolve(null),
    ]);
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, persistent };
  } catch {
    return { usage: 0, quota: 0, persistent: null };
  }
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (typeof navigator === "undefined") return null;
  const storage = (navigator as Navigator & { storage?: { persist?: () => Promise<boolean> } }).storage;
  if (!storage?.persist) return null;
  try { return await storage.persist(); } catch { return false; }
}

export async function getCachedMushafPageKeys(): Promise<Set<string>> {
  const db = await getDB();
  if (!db) return new Set();
  return new Set(await db.getAllKeys("mushafPages"));
}

export async function getCachedSurahNumbers(): Promise<Set<number>> {
  const db = await getDB();
  if (!db) return new Set();
  return new Set((await db.getAllKeys("quran")).map(Number));
}
