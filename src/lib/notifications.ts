import { useEffect, useState } from "react";
import { getSetting } from "./db";
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

function supportsTimestampTrigger() {
  return typeof window !== "undefined" && typeof (window as any).TimestampTrigger !== "undefined";
}

async function getReminderMinutes(fallback = 15) {
  return (await getSetting<number>("reminderMin")) ?? fallback;
}

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
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const res = await LocalNotifications.requestPermissions();
        const granted = res.display === "granted";
        setPermission(granted ? "granted" : "denied");
        return granted;
      }
    } catch {}
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
    testNotification,
  };
}

function clearScheduled() {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
}

// إشعار فوري — يستخدم Service Worker إن أمكن (أفضل لأنه يعمل حتى لو أُغلقت نافذة التطبيق)
async function showNotificationNow(title: string, body: string) {
  // Capacitor (APK)
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 2147483647),
            title,
            body,
            schedule: { at: new Date(Date.now() + 100) },
          },
        ],
      });
      return;
    }
  } catch {}

  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  // PWA: استخدم SW إن أمكن
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: title,
        vibrate: [200, 100, 200],
      } as any);
      return;
    } catch {}
  }

  try {
    new Notification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: title });
  } catch {}
}

// جدولة أصلية على Capacitor
async function scheduleNative(date: Date, title: string, body: string): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return false;
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 2147483647),
          title,
          body,
          schedule: { at: date, allowWhileIdle: true },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

// جدولة عبر Notification Triggers API (Chrome على Android — تعمل حتى لو أُغلق التطبيق)
async function scheduleViaTrigger(date: Date, title: string, body: string): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  if (typeof (window as any).TimestampTrigger === "undefined") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: `${title}-${date.getTime()}`,
      showTrigger: new (window as any).TimestampTrigger(date.getTime()),
      vibrate: [200, 100, 200],
    } as any);
    return true;
  } catch (e) {
    console.warn("TimestampTrigger failed:", e);
    return false;
  }
}

type ScheduleResult = "native" | "trigger" | "timeout" | "skipped";

export async function scheduleAllNotifications(reminderMin = 15) {
  if (typeof window === "undefined") return;

  let isNative = false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    isNative = Capacitor.isNativePlatform();
    if (isNative) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
    }
  } catch {}

  if (!isNative && (typeof Notification === "undefined" || Notification.permission !== "granted")) return;
  clearScheduled();

  // امسح إشعارات SW المجدولة سابقاً
  if (!isNative && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.getNotifications({ includeTriggered: false } as any);
      existing.forEach((n) => n.close());
    } catch {}
  }

  const types = loadTypes();

  try {
    const coords = await getUserCoords();
    const timings = await fetchPrayerTimes(coords);
    const today = new Date();

    const jobs: Promise<ScheduleResult>[] = [];
    const order: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    order.forEach((name) => {
      const [h, m] = timings[name].split(":").map(Number);
      const prayerDate = new Date(today);
      prayerDate.setHours(h, m, 0, 0);

      if (types.prayerReminder) {
        const remTime = new Date(prayerDate.getTime() - reminderMin * 60 * 1000);
        jobs.push(
          scheduleAt(
            remTime,
            `🕌 تذكير: ${prayerArabic[name]}`,
            `بقي ${reminderMin} دقيقة على ${prayerArabic[name]}`
          )
        );
      }

      if (types.prayerTime) {
        jobs.push(scheduleAt(prayerDate, `🕌 حان وقت ${prayerArabic[name]}`, "حيّ على الصلاة، حيّ على الفلاح"));
      }

      if (types.afterPrayer) {
        const after = new Date(prayerDate.getTime() + 5 * 60 * 1000);
        jobs.push(scheduleAt(after, "✨ أذكار بعد الصلاة", "لا تنسَ أذكار ما بعد الصلاة"));
      }
    });

    if (types.morning) {
      const [fh, fm] = timings.Fajr.split(":").map(Number);
      const morning = new Date(today);
      morning.setHours(fh, fm + 30, 0, 0);
      jobs.push(scheduleAt(morning, "🌅 أذكار الصباح", "ابدأ يومك بذكر الله"));
    }

    if (types.evening) {
      const [ah, am] = timings.Asr.split(":").map(Number);
      const evening = new Date(today);
      evening.setHours(ah, am, 0, 0);
      jobs.push(scheduleAt(evening, "🌙 أذكار المساء", "اختم نهارك بذكر الله"));
    }

    const results = await Promise.all(jobs);

    localStorage.setItem(SCHEDULED_KEY, today.toDateString());
    if (results.some((result) => result !== "skipped")) {
      console.info("Notifications scheduled", results);
    }
  } catch (e) {
    console.error("Failed to schedule notifications", e);
  }
}

async function scheduleAt(date: Date, title: string, body: string): Promise<ScheduleResult> {
  const ms = date.getTime() - Date.now();
  if (ms <= 0 || ms > 24 * 60 * 60 * 1000) return "skipped";
  // 1) جرّب Capacitor (APK) أولاً
  const native = await scheduleNative(date, title, body);
  if (native) return "native";
  // 2) جرّب Notification Triggers (Chrome Android — يعمل بدون فتح التطبيق)
  const triggered = await scheduleViaTrigger(date, title, body);
  if (triggered) return "trigger";
  // 3) احتياط: setTimeout (يعمل فقط ما دام التطبيق مفتوحاً)
  const id = window.setTimeout(() => showNotificationNow(title, body), ms);
  timers.push(id);
  return "timeout";
}

// إشعار اختبار فوري — للتحقق من أن الإشعارات تعمل
export async function testNotification() {
  await showNotificationNow("🔔 اختبار الإشعار", "إشعارات نور تعمل بنجاح، بارك الله فيك");
}

export async function ensureDailySchedule(reminderMin = 15) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(STORAGE_KEY) !== "1") return;
  let isNative = false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    isNative = Capacitor.isNativePlatform();
  } catch {}
  if (!isNative && (typeof Notification === "undefined" || Notification.permission !== "granted")) return;
  const savedReminderMin = await getReminderMinutes(reminderMin);
  const last = localStorage.getItem(SCHEDULED_KEY);
  const needsFreshSchedule = !isNative && !supportsTimestampTrigger();
  if (needsFreshSchedule || last !== new Date().toDateString()) {
    await scheduleAllNotifications(savedReminderMin);
  }
}
