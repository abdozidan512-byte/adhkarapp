import { getSetting, saveSetting } from "./db";

export type TafsirEdition = {
  id: string;
  name: string;
  shortName: string;
};

export const tafsirEditions: TafsirEdition[] = [
  { id: "ar.muyassar", name: "التفسير الميسر", shortName: "الميسر" },
  { id: "ar.jalalayn", name: "تفسير الجلالين", shortName: "الجلالين" },
  { id: "ar.qurtubi", name: "تفسير القرطبي", shortName: "القرطبي" },
  { id: "ar.miftah", name: "مفتاح للسعدي", shortName: "السعدي" },
];

export type TafsirAyah = { numberInSurah: number; text: string };

export async function fetchSurahTafsir(
  surahNumber: number,
  editionId: string
): Promise<TafsirAyah[]> {
  const cacheKey = `tafsir-${editionId}-${surahNumber}`;
  const cached = await getSetting<TafsirAyah[]>(cacheKey);
  if (cached && cached.length > 0) return cached;
  const res = await fetch(
    `https://api.alquran.cloud/v1/surah/${surahNumber}/${editionId}`
  );
  if (!res.ok) throw new Error("تعذّر تحميل التفسير");
  const json = await res.json();
  const ayahs: TafsirAyah[] = json.data.ayahs.map((a: any) => ({
    numberInSurah: a.numberInSurah,
    text: a.text as string,
  }));
  await saveSetting(cacheKey, ayahs);
  return ayahs;
}
