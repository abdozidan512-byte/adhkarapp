import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface AzkarDB extends DBSchema {
  quran: {
    key: number; // surah number
    value: {
      number: number;
      ayahs: { numberInSurah: number; text: string; page?: number }[];
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
}

let dbPromise: Promise<IDBPDatabase<AzkarDB>> | null = null;

export function getDB() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB<AzkarDB>("azkar-app", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("quran")) db.createObjectStore("quran", { keyPath: "number" });
        if (!db.objectStoreNames.contains("prayerTimes")) db.createObjectStore("prayerTimes", { keyPath: "date" });
        if (!db.objectStoreNames.contains("audio")) db.createObjectStore("audio", { keyPath: "key" });
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
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

export async function saveSurah(number: number, ayahs: { numberInSurah: number; text: string }[]) {
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
  ayah: number;
  updatedAt: number;
};

export async function saveReadingProgress(p: ReadingProgress) {
  await saveSetting("reading-progress", p);
}

export async function getReadingProgress(): Promise<ReadingProgress | undefined> {
  return getSetting<ReadingProgress>("reading-progress");
}

