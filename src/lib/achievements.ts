// Achievements + Daily Missions system
// Persisted via getSetting/saveSetting (IndexedDB)

import { getSetting, saveSetting } from "./db";

export type AchievementId =
  // Tasbih milestones (made harder)
  | "tasbih-100"
  | "tasbih-1000"
  | "tasbih-10000"
  | "tasbih-33000"
  | "tasbih-100000"
  // Morning azkar repetitions
  | "azkar-morning-1"
  | "azkar-morning-7"
  | "azkar-morning-30"
  | "azkar-morning-100"
  // Evening azkar repetitions
  | "azkar-evening-1"
  | "azkar-evening-7"
  | "azkar-evening-30"
  | "azkar-evening-100"
  // Streaks
  | "azkar-streak-7"
  | "azkar-streak-30"
  | "azkar-streak-100"
  // Quran
  | "quran-page-1"
  | "quran-surah-1"
  | "quran-surah-10"
  | "quran-surah-30"
  | "quran-surah-60"
  // Khatamat
  | "khatma-1"
  | "khatma-2"
  | "khatma-3"
  | "khatma-5"
  // Missions
  | "missions-7"
  | "missions-30";

export type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  // Tasbih
  { id: "tasbih-100", title: "بداية الذكر", description: "100 تسبيحة" , icon: "📿" },
  { id: "tasbih-1000", title: "ألف تسبيحة", description: "1000 تسبيحة", icon: "✨" },
  { id: "tasbih-10000", title: "لسان رطب بالذكر", description: "10,000 تسبيحة", icon: "🌟" },
  { id: "tasbih-33000", title: "ذاكر مكثر", description: "33,000 تسبيحة", icon: "🏆" },
  { id: "tasbih-100000", title: "من الذاكرين كثيراً", description: "100,000 تسبيحة", icon: "👑" },
  // Morning
  { id: "azkar-morning-1", title: "صباح الذكر", description: "أكملت أذكار الصباح", icon: "🌅" },
  { id: "azkar-morning-7", title: "أسبوع صباحي", description: "أكملت أذكار الصباح 7 مرات", icon: "🌄" },
  { id: "azkar-morning-30", title: "شهر من الصباح", description: "30 مرة من أذكار الصباح", icon: "☀️" },
  { id: "azkar-morning-100", title: "مواظب على الصباح", description: "100 مرة من أذكار الصباح", icon: "🥇" },
  // Evening
  { id: "azkar-evening-1", title: "مساء الذكر", description: "أكملت أذكار المساء", icon: "🌙" },
  { id: "azkar-evening-7", title: "أسبوع مسائي", description: "أكملت أذكار المساء 7 مرات", icon: "🌒" },
  { id: "azkar-evening-30", title: "شهر من المساء", description: "30 مرة من أذكار المساء", icon: "🌌" },
  { id: "azkar-evening-100", title: "مواظب على المساء", description: "100 مرة من أذكار المساء", icon: "🥇" },
  // Streaks
  { id: "azkar-streak-7", title: "أسبوع متواصل", description: "7 أيام بلا انقطاع", icon: "🔥" },
  { id: "azkar-streak-30", title: "شهر متواصل", description: "30 يوماً بلا انقطاع", icon: "🔥" },
  { id: "azkar-streak-100", title: "مئة يوم", description: "100 يوم بلا انقطاع", icon: "💎" },
  // Quran
  { id: "quran-page-1", title: "أول صفحة", description: "قرأت أول صفحة من القرآن", icon: "📖" },
  { id: "quran-surah-1", title: "أول سورة", description: "أكملت قراءة سورة كاملة", icon: "📚" },
  { id: "quran-surah-10", title: "10 سور", description: "أكملت قراءة 10 سور", icon: "🎖️" },
  { id: "quran-surah-30", title: "30 سورة", description: "أكملت قراءة 30 سورة", icon: "🏅" },
  { id: "quran-surah-60", title: "60 سورة", description: "أكملت قراءة 60 سورة", icon: "🎗️" },
  // Khatamat
  { id: "khatma-1", title: "ختمة كاملة", description: "ختمت القرآن مرة", icon: "🕋" },
  { id: "khatma-2", title: "ختمتان", description: "ختمت القرآن مرتين", icon: "🌹" },
  { id: "khatma-3", title: "ثلاث ختمات", description: "ختمت القرآن 3 مرات", icon: "🌷" },
  { id: "khatma-5", title: "خمس ختمات", description: "ختمت القرآن 5 مرات", icon: "👑" },
  // Missions
  { id: "missions-7", title: "أسبوع من المهام", description: "أنجزت كل المهام 7 أيام", icon: "✅" },
  { id: "missions-30", title: "شهر من المهام", description: "أنجزت كل المهام 30 يوماً", icon: "🏵️" },
];

// ===== Stats =====
export type Stats = {
  totalTasbih: number;
  completedSurahs: number;
  khatmaCount: number;
  morningCount: number;
  eveningCount: number;
  azkarStreak: number;
  lastAzkarDate: string | null;
  missionsStreak: number;
  lastMissionsDate: string | null;
  unlocked: AchievementId[];
};

const KEY = "achievements-stats-v2";

export async function getStats(): Promise<Stats> {
  const s = await getSetting<Stats>(KEY);
  return (
    s ?? {
      totalTasbih: 0,
      completedSurahs: 0,
      khatmaCount: 0,
      morningCount: 0,
      eveningCount: 0,
      azkarStreak: 0,
      lastAzkarDate: null,
      missionsStreak: 0,
      lastMissionsDate: null,
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
    try { l(a); } catch {}
  });
}
async function unlock(stats: Stats, ids: AchievementId[]) {
  const newly = ids.filter((id) => !stats.unlocked.includes(id));
  if (!newly.length) return;
  stats.unlocked = [...stats.unlocked, ...newly];
  for (const id of newly) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) notify(a);
  }
}

function bumpStreak(prev: string | null, today: string, streak: number) {
  if (prev === today) return streak;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return prev === yesterday ? streak + 1 : 1;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function recordTasbih(delta = 1) {
  const stats = await getStats();
  stats.totalTasbih += delta;
  const earned: AchievementId[] = [];
  for (const [id, t] of [
    ["tasbih-100", 100],
    ["tasbih-1000", 1000],
    ["tasbih-10000", 10000],
    ["tasbih-33000", 33000],
    ["tasbih-100000", 100000],
  ] as const) {
    if (stats.totalTasbih >= t) earned.push(id);
  }
  await unlock(stats, earned);
  await saveStats(stats);
  // Mission: tasbih 100 today
  await checkTasbihMission();
}

export async function recordAzkarSection(sectionId: string) {
  const kind: "morning" | "evening" | "other" =
    /morning|sabah|الصباح/i.test(sectionId) ? "morning" :
    /evening|masaa|المساء/i.test(sectionId) ? "evening" : "other";
  const stats = await getStats();
  const t = today();
  if (stats.lastAzkarDate !== t) {
    stats.azkarStreak = bumpStreak(stats.lastAzkarDate, t, stats.azkarStreak);
    stats.lastAzkarDate = t;
  }
  const earned: AchievementId[] = [];
  if (kind === "morning") {
    stats.morningCount += 1;
    if (stats.morningCount >= 1) earned.push("azkar-morning-1");
    if (stats.morningCount >= 7) earned.push("azkar-morning-7");
    if (stats.morningCount >= 30) earned.push("azkar-morning-30");
    if (stats.morningCount >= 100) earned.push("azkar-morning-100");
  }
  if (kind === "evening") {
    stats.eveningCount += 1;
    if (stats.eveningCount >= 1) earned.push("azkar-evening-1");
    if (stats.eveningCount >= 7) earned.push("azkar-evening-7");
    if (stats.eveningCount >= 30) earned.push("azkar-evening-30");
    if (stats.eveningCount >= 100) earned.push("azkar-evening-100");
  }
  if (stats.azkarStreak >= 7) earned.push("azkar-streak-7");
  if (stats.azkarStreak >= 30) earned.push("azkar-streak-30");
  if (stats.azkarStreak >= 100) earned.push("azkar-streak-100");
  await unlock(stats, earned);
  await saveStats(stats);
  // Mark mission
  if (kind === "morning") await markMission("morning");
  if (kind === "evening") await markMission("evening");
}

export async function recordSurahCompleted() {
  const stats = await getStats();
  stats.completedSurahs += 1;
  const earned: AchievementId[] = ["quran-surah-1"];
  if (stats.completedSurahs >= 10) earned.push("quran-surah-10");
  if (stats.completedSurahs >= 30) earned.push("quran-surah-30");
  if (stats.completedSurahs >= 60) earned.push("quran-surah-60");
  // Khatma: every 114 surahs
  const newKhatma = Math.floor(stats.completedSurahs / 114);
  if (newKhatma > stats.khatmaCount) {
    stats.khatmaCount = newKhatma;
  }
  if (stats.khatmaCount >= 1) earned.push("khatma-1");
  if (stats.khatmaCount >= 2) earned.push("khatma-2");
  if (stats.khatmaCount >= 3) earned.push("khatma-3");
  if (stats.khatmaCount >= 5) earned.push("khatma-5");
  await unlock(stats, earned);
  await saveStats(stats);
}

export async function recordQuranPageRead() {
  const stats = await getStats();
  await unlock(stats, ["quran-page-1"]);
  await saveStats(stats);
  await markMission("quran");
}

// ===== Daily Missions =====
export type MissionId = "morning" | "evening" | "quran" | "tasbih" | "daily";

export type Mission = {
  id: MissionId;
  title: string;
  description: string;
  icon: string;
};

// Rotating "ذكر اليوم" pool
const DAILY_DHIKRS = [
  "سبحان الله وبحمده",
  "لا إله إلا الله",
  "أستغفر الله العظيم وأتوب إليه",
  "اللهم صلِّ على محمد",
  "سبحان الله العظيم",
  "لا حول ولا قوة إلا بالله",
  "الحمد لله رب العالمين",
];

export function getTodaysDailyDhikr() {
  const day = Math.floor(Date.now() / 86400000);
  return DAILY_DHIKRS[day % DAILY_DHIKRS.length];
}

export function getMissionsList(): Mission[] {
  return [
    { id: "morning", title: "أذكار الصباح", description: "أكمل قراءة أذكار الصباح", icon: "🌅" },
    { id: "evening", title: "أذكار المساء", description: "أكمل قراءة أذكار المساء", icon: "🌙" },
    { id: "quran", title: "صفحة قرآن", description: "اقرأ صفحة من القرآن الكريم", icon: "📖" },
    { id: "tasbih", title: "100 تسبيحة", description: "سبّح اليوم 100 مرة", icon: "📿" },
    { id: "daily", title: `ذكر اليوم: ${getTodaysDailyDhikr()}`, description: "ردّد ذكر اليوم 33 مرة", icon: "✨" },
  ];
}

export type MissionsState = {
  date: string;
  done: Partial<Record<MissionId, boolean>>;
  tasbihToday: number;
  dailyDhikrCount: number;
};

const MKEY = "missions-state-v1";

export async function getMissionsState(): Promise<MissionsState> {
  const s = await getSetting<MissionsState>(MKEY);
  const t = today();
  if (!s || s.date !== t) {
    return { date: t, done: {}, tasbihToday: 0, dailyDhikrCount: 0 };
  }
  return s;
}

async function saveMissionsState(s: MissionsState) {
  await saveSetting(MKEY, s);
}

const missionListeners = new Set<() => void>();
export function onMissionsChanged(fn: () => void) {
  missionListeners.add(fn);
  return () => { missionListeners.delete(fn); };
}
function notifyMissions() {
  missionListeners.forEach((l) => { try { l(); } catch {} });
}

export async function markMission(id: MissionId) {
  const s = await getMissionsState();
  if (s.done[id]) return;
  s.done[id] = true;
  await saveMissionsState(s);
  notifyMissions();
  await checkAllMissionsDone(s);
}

async function checkTasbihMission() {
  const s = await getMissionsState();
  s.tasbihToday += 1;
  if (s.tasbihToday >= 100 && !s.done.tasbih) {
    s.done.tasbih = true;
  }
  await saveMissionsState(s);
  notifyMissions();
  if (s.done.tasbih) await checkAllMissionsDone(s);
}

export async function incrementDailyDhikr() {
  const s = await getMissionsState();
  s.dailyDhikrCount += 1;
  if (s.dailyDhikrCount >= 33 && !s.done.daily) {
    s.done.daily = true;
  }
  await saveMissionsState(s);
  notifyMissions();
  if (s.done.daily) await checkAllMissionsDone(s);
}

async function checkAllMissionsDone(s: MissionsState) {
  const list = getMissionsList();
  const allDone = list.every((m) => s.done[m.id]);
  if (!allDone) return;
  const stats = await getStats();
  const t = today();
  if (stats.lastMissionsDate !== t) {
    stats.missionsStreak = bumpStreak(stats.lastMissionsDate, t, stats.missionsStreak);
    stats.lastMissionsDate = t;
    const earned: AchievementId[] = [];
    if (stats.missionsStreak >= 7) earned.push("missions-7");
    if (stats.missionsStreak >= 30) earned.push("missions-30");
    await unlock(stats, earned);
    await saveStats(stats);
  }
}
