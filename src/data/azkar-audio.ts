// روابط mp3 لكل قسم أذكار من تسجيلات حصن المسلم على archive.org
// المصدر: https://archive.org/details/Husn_Muslim
// الصوت احترافي وواضح ومناسب للاستماع الكامل لكل قسم.

const BASE = "https://archive.org/download/Husn_Muslim";

export const azkarSectionAudio: Record<string, { url: string; label: string } | undefined> = {
  morning: { url: `${BASE}/028-.mp3`, label: "أذكار الصباح والمساء — حصن المسلم" },
  evening: { url: `${BASE}/028-.mp3`, label: "أذكار الصباح والمساء — حصن المسلم" },
  sleep: { url: `${BASE}/029.mp3`, label: "أذكار النوم — حصن المسلم" },
  prayer: { url: `${BASE}/026-.mp3`, label: "الأذكار بعد الصلاة — حصن المسلم" },
  travel: { url: `${BASE}/101.mp3`, label: "دعاء السفر — حصن المسلم" },
  home: { url: `${BASE}/012.mp3`, label: "أذكار دخول وخروج المنزل — حصن المسلم" },
  istisqa: undefined,
};
