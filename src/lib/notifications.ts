import { useEffect, useState } from "react";
import { fetchPrayerTimes, getUserCoords, prayerArabic, type PrayerName } from "./prayer";

const STORAGE_KEY = "notifications-enabled";
const SCHEDULED_KEY = "notif-scheduled-day";
const TYPES_KEY = "notif-types";

export type NotifType =
  | "prayerReminder"
  | "prayerTime"
  | "afterPrayer"
  | "morning"
  | "evening";

export type NotifTypes = Record<NotifType, boolean>;

export const defaultNotifTypes: NotifTypes = {
  prayerReminder: true,
  prayerTime: true,
  afterPrayer: true,
  morning: true,
  evening: true,
};

export const notifTypeLabels: Record<NotifType, { title: string; subtitle: string }> = {
  prayerReminder: { title: "تذكير قبل الصلاة", subtitle: "قبل دخول وقت الصلاة بدقائق" },
  prayerTime: { title: "حان وقت الصلاة", subtitle: "عند دخول وقت كل صلاة" },
  afterPrayer: { title: "أذكار بعد الصلاة", subtitle: "تذكير بعد الصلاة بـ 5 دقائق" },
  morning: { title: "أذكار الصباح", subtitle: "بعد الفجر بنصف ساعة" },
  evening: { title: "أذكار المساء", subtitle: "عند دخول العصر" },
};

let timers: number[] = [];

function loadTypes(): NotifTypes {
  if (typeof localStorage === "undefined") return defaultNotifTypes;
  try {
    const raw = localStorage.getItem(TYPES_KEY);
    if (!raw) return defaultNotifTypes;
    return { ...defaultNotifTypes, ...JSON.parse(raw) };
  } catch {
    return defaultNotifTypes;
  }
}

function saveTypes(t: NotifTypes) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TYPES_KEY, JSON.stringify(t));
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabledState] = useState(false);
  const [types, setTypesState] = useState<NotifTypes>(defaultNotifTypes);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
    setEnabledState(localStorage.getItem(STORAGE_KEY) === "1");
    setTypesState(loadTypes());
  }, []);

  async function requestPermission() {
    if (typeof Notification === "undefined") return false;
    const p = await Notification.requestPermission();
    setPermission(p);
    return p === "granted";
  }

  function setEnabled(v: boolean) {
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    setEnabledState(v);
    if (!v) clearScheduled();
  }

  function setType(type: NotifType, value: boolean) {
    const next = { ...types, [type]: value };
    setTypesState(next);
    saveTypes(next);
  }

  return {
    permission,
    requestPermission,
    enabled,
    setEnabled,
    types,
    setType,
    scheduleAll: scheduleAllNotifications,
  };
}

function clearScheduled() {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
}

function notify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: title,
    });
  } catch {}
}

export async function scheduleAllNotifications(reminderMin = 15) {
  if (typeof window === "undefined") return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  clearScheduled();

  const types = loadTypes();

  try {
    const coords = await getUserCoords();
    const timings = await fetchPrayerTimes(coords);
    const today = new Date();

    const order: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    order.forEach((name) => {
      const [h, m] = timings[name].split(":").map(Number);
      const prayerDate = new Date(today);
      prayerDate.setHours(h, m, 0, 0);

      if (types.prayerReminder) {
        const remTime = new Date(prayerDate.getTime() - reminderMin * 60 * 1000);
        scheduleAt(
          remTime,
          `🕌 تذكير: ${prayerArabic[name]}`,
          `بقي ${reminderMin} دقيقة على ${prayerArabic[name]}`
        );
      }

      if (types.prayerTime) {
        scheduleAt(prayerDate, `🕌 حان وقت ${prayerArabic[name]}`, "حيّ على الصلاة، حيّ على الفلاح");
      }

      if (types.afterPrayer) {
        const after = new Date(prayerDate.getTime() + 5 * 60 * 1000);
        scheduleAt(after, "✨ أذكار بعد الصلاة", "لا تنسَ أذكار ما بعد الصلاة");
      }
    });

    if (types.morning) {
      const [fh, fm] = timings.Fajr.split(":").map(Number);
      const morning = new Date(today);
      morning.setHours(fh, fm + 30, 0, 0);
      scheduleAt(morning, "🌅 أذكار الصباح", "ابدأ يومك بذكر الله");
    }

    if (types.evening) {
      const [ah, am] = timings.Asr.split(":").map(Number);
      const evening = new Date(today);
      evening.setHours(ah, am, 0, 0);
      scheduleAt(evening, "🌙 أذكار المساء", "اختم نهارك بذكر الله");
    }

    localStorage.setItem(SCHEDULED_KEY, today.toDateString());
  } catch (e) {
    console.error("Failed to schedule notifications", e);
  }
}

function scheduleAt(date: Date, title: string, body: string) {
  const ms = date.getTime() - Date.now();
  if (ms <= 0 || ms > 24 * 60 * 60 * 1000) return;
  const id = window.setTimeout(() => notify(title, body), ms);
  timers.push(id);
}

export function ensureDailySchedule(reminderMin = 15) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(STORAGE_KEY) !== "1") return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const last = localStorage.getItem(SCHEDULED_KEY);
  if (last !== new Date().toDateString()) {
    scheduleAllNotifications(reminderMin);
  }
}
