import { getPrayerTimes, savePrayerTimes, getSetting, saveSetting } from "./db";

export type PrayerName = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export const prayerArabic: Record<PrayerName, string> = {
  Fajr: "الفجر",
  Sunrise: "الشروق",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

export type Coords = { lat: number; lng: number };

export async function getUserCoords(): Promise<Coords> {
  const cached = await getSetting<Coords>("coords");
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(cached ?? { lat: 21.4225, lng: 39.8262 }); // Mecca fallback
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        await saveSetting("coords", coords);
        resolve(coords);
      },
      () => resolve(cached ?? { lat: 21.4225, lng: 39.8262 }),
      { timeout: 8000, maximumAge: 60 * 60 * 1000 }
    );
  });
}

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function fetchPrayerTimes(coords: Coords, date = new Date()) {
  const key = todayKey(date);
  const cached = await getPrayerTimes(key);
  if (cached && cached.lat === coords.lat && cached.lng === coords.lng) {
    return cached.timings;
  }

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();

  try {
    const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${coords.lat}&longitude=${coords.lng}&method=4`;
    const res = await fetch(url);
    const json = await res.json();
    const timings = json.data.timings as Record<string, string>;
    await savePrayerTimes(key, coords.lat, coords.lng, timings);
    return timings;
  } catch (e) {
    if (cached) return cached.timings;
    throw e;
  }
}

function parseTime(timeStr: string, base = new Date()): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

export type PrayerStatus = {
  current?: { name: PrayerName; time: Date; elapsedMs: number };
  next: { name: PrayerName; time: Date; remainingMs: number };
  all: { name: PrayerName; time: Date }[];
};

export function computePrayerStatus(timings: Record<string, string>, now = new Date()): PrayerStatus {
  const order: PrayerName[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const all = order.map((name) => ({ name, time: parseTime(timings[name], now) }));

  let next = all.find((p) => p.time.getTime() > now.getTime());
  if (!next) {
    // After Isha, next is tomorrow's Fajr
    const t = parseTime(timings.Fajr, now);
    t.setDate(t.getDate() + 1);
    next = { name: "Fajr", time: t };
  }

  // Current = the most recent prayer that started, only if within 30 min window
  const passed = [...all].reverse().find((p) => p.time.getTime() <= now.getTime());
  let current;
  if (passed) {
    const elapsedMs = now.getTime() - passed.time.getTime();
    if (elapsedMs <= 30 * 60 * 1000) {
      current = { name: passed.name, time: passed.time, elapsedMs };
    }
  }

  return {
    current,
    next: { name: next.name, time: next.time, remainingMs: next.time.getTime() - now.getTime() },
    all,
  };
}

export function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
}

export function formatTimeArabic(date: Date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}
