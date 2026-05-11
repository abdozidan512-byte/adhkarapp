// Lightweight achievements / rewards system
// Persisted in IndexedDB via getSetting/saveSetting

import { getSetting, saveSetting } from "./db";

export type AchievementId =
  | "tasbih-100"
  | "tasbih-500"
  | "tasbih-1000"
  | "tasbih-5000"
  | "tasbih-10000"
  | "azkar-morning-1"
  | "azkar-evening-1"
  | "azkar-streak-7"
  | "quran-page-1"
  | "quran-surah-1"
  | "quran-surah-10";

export type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
  threshold?: number;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: "tasbih-100", title: "بداية الذكر", description: "أكملت 100 تسبيحة", icon: "📿", threshold: 100 },
  { id: "tasbih-500", title: "ذاكر مواظب", description: "أكملت 500 تسبيحة", icon: "✨", threshold: 500 },
  { id: "tasbih-1000", title: "ألف تسبيحة", description: "أكملت 1000 تسبيحة", icon: "🌟", threshold: 1000 },
  { id: "tasbih-5000", title: "لسان رطب بالذكر", description: "أكملت 5000 تسبيحة", icon: "🏆", threshold: 5000 },
  { id: "tasbih-10000", title: "من الذاكرين كثيراً", description: "أكملت 10000 تسبيحة", icon: "👑", threshold: 10000 },
  { id: "azkar-morning-1", title: "صباح الذكر", description: "قرأت أذكار الصباح", icon: "🌅" },
  { id: "azkar-evening-1", title: "مساء الذكر", description: "قرأت أذكار المساء", icon: "🌙" },
  { id: "azkar-streak-7", title: "أسبوع من الذكر", description: "7 أيام متتالية من الأذكار", icon: "🔥" },
  { id: "quran-page-1", title: "أول صفحة", description: "قرأت أول صفحة من القرآن", icon: "📖" },
  { id: "quran-surah-1", title: "أول سورة", description: "أكملت قراءة سورة كاملة", icon: "📚" },
  { id: "quran-surah-10", title: "10 سور", description: "أكملت قراءة 10 سور", icon: "🎖️" },
];

export type Stats = {
  totalTasbih: number;
  completedSurahs: number;
  azkarStreak: number;
  lastAzkarDate: string | null;
  unlocked: AchievementId[];
};

const KEY = "achievements-stats-v1";

export async function getStats(): Promise<Stats> {
  const s = await getSetting<Stats>(KEY);
  return (
    s ?? {
      totalTasbih: 0,
      completedSurahs: 0,
      azkarStreak: 0,
      lastAzkarDate: null,
      unlocked: [],
    }
  );
}

async function saveStats(s: Stats) {
  await saveSetting(KEY, s);
}

type UnlockListener = (a: Achievement) => void;
const listeners = new Set<UnlockListener>();
export function onAchievementUnlocked(fn: UnlockListener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify(a: Achievement) {
  listeners.forEach((l) => {
    try {
      l(a);
    } catch {}
  });
}

async function unlock(stats: Stats, ids: AchievementId[]): Promise<Stats> {
  const newly = ids.filter((id) => !stats.unlocked.includes(id));
  if (!newly.length) return stats;
  stats.unlocked = [...stats.unlocked, ...newly];
  for (const id of newly) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) notify(a);
  }
  return stats;
}

export async function recordTasbih(delta = 1) {
  const stats = await getStats();
  stats.totalTasbih += delta;
  const milestones: Array<[AchievementId, number]> = [
    ["tasbih-100", 100],
    ["tasbih-500", 500],
    ["tasbih-1000", 1000],
    ["tasbih-5000", 5000],
    ["tasbih-10000", 10000],
  ];
  const earned = milestones.filter(([, t]) => stats.totalTasbih >= t).map(([id]) => id);
  await unlock(stats, earned);
  await saveStats(stats);
  return stats;
}

export async function recordAzkarSession(kind: "morning" | "evening" | "other") {
  const stats = await getStats();
  const today = new Date().toISOString().slice(0, 10);
  if (stats.lastAzkarDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    stats.azkarStreak = stats.lastAzkarDate === yesterday ? stats.azkarStreak + 1 : 1;
    stats.lastAzkarDate = today;
  }
  const earned: AchievementId[] = [];
  if (kind === "morning") earned.push("azkar-morning-1");
  if (kind === "evening") earned.push("azkar-evening-1");
  if (stats.azkarStreak >= 7) earned.push("azkar-streak-7");
  await unlock(stats, earned);
  await saveStats(stats);
  return stats;
}

export async function recordSurahCompleted() {
  const stats = await getStats();
  stats.completedSurahs += 1;
  const earned: AchievementId[] = ["quran-surah-1"];
  if (stats.completedSurahs >= 10) earned.push("quran-surah-10");
  await unlock(stats, earned);
  await saveStats(stats);
  return stats;
}

export async function recordQuranPageRead() {
  const stats = await getStats();
  await unlock(stats, ["quran-page-1"]);
  await saveStats(stats);
}
