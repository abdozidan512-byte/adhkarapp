import { getSurah, saveSurah, saveAudio, getAudio } from "./db";
import { reciters, type ReciterId } from "@/data/surahs";

export type Ayah = { numberInSurah: number; text: string };

export async function fetchSurahText(surahNumber: number): Promise<Ayah[]> {
  const cached = await getSurah(surahNumber);
  if (cached) return cached.ayahs;

  const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/quran-uthmani`);
  const json = await res.json();
  const ayahs: Ayah[] = json.data.ayahs.map((a: any) => ({
    numberInSurah: a.numberInSurah,
    text: a.text,
  }));
  await saveSurah(surahNumber, ayahs);
  return ayahs;
}

// EveryAyah uses format: https://everyayah.com/data/{subfolder}/{surahNum:3}{ayahNum:3}.mp3
function pad3(n: number) {
  return String(n).padStart(3, "0");
}

export function getAyahAudioUrl(reciterId: ReciterId, surahNumber: number, ayah: number) {
  const reciter = reciters.find((r) => r.id === reciterId);
  if (!reciter) return "";
  return `https://everyayah.com/data/${reciter.subfolder}/${pad3(surahNumber)}${pad3(ayah)}.mp3`;
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
  const blob = await res.blob();
  await saveAudio(key, blob, reciterId, surahNumber, ayah);
  onProgress?.(100);
  return blob;
}

export async function downloadFullSurahAudio(
  reciterId: ReciterId,
  surahNumber: number,
  totalAyahs: number,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  for (let i = 1; i <= totalAyahs; i++) {
    await downloadAyahAudio(reciterId, surahNumber, i);
    onProgress?.(i, totalAyahs);
  }
}

export async function getAyahAudioBlob(reciterId: ReciterId, surahNumber: number, ayah: number): Promise<Blob | null> {
  const key = audioKey(reciterId, surahNumber, ayah);
  const cached = await getAudio(key);
  return cached?.blob ?? null;
}
