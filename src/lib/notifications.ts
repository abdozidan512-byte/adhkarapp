import { useEffect, useState } from "react";
import type { LocalNotificationSchema } from "@capacitor/local-notifications";
import { getSetting } from "./db";
import { fetchPrayerTimes, getUserCoords, prayerArabic, type PrayerName } from "./prayer";

const STORAGE_KEY = "notifications-enabled";
const SCHEDULED_KEY = "notif-scheduled-until";
const SCHEDULED_COUNT_KEY = "notif-scheduled-count";
const SCHEDULED_MODE_KEY = "notif-scheduled-mode";
const TYPES_KEY = "notif-types";
const BACKGROUND_SCHEDULE_DAYS = 30;
const MIN_PENDING_NATIVE_NOTIFICATIONS = 20;
const NATIVE_CHANNEL_ID = "noor-daily-reminders";
const NATIVE_CHUNK_SIZE = 64;
const WEB_NOTIFICATION_ICON = "/icon-512.png";
const NOTIFICATION_GROUP = "noor-reminders";

type NativeNotifications = typeof import("@capacitor/local-notifications").LocalNotifications;

type NotificationJob = {
  date: Date;
  title: string;
  body: string;
  lines?: string[];
};

export type NotificationDeliveryMode = "native" | "web-background" | "web-open" | "unsupported";

export type NotificationStatus = {
  mode: NotificationDeliveryMode;
  scheduledCount: number;
  scheduledUntil: string | null;
  canWakePhone: boolean;
};

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

async function getNativeNotifications(): Promise<NativeNotifications | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    return LocalNotifications;
  } catch {
    return null;
  }
}

async function ensureNativeChannel(LocalNotifications: NativeNotifications) {
  await LocalNotifications.createChannel({
    id: NATIVE_CHANNEL_ID,
    name: "تذكيرات نور اليومية",
    description: "مواقيت الصلاة وأذكار الصباح والمساء",
    importance: 5,
    visibility: 1,
    lights: true,
    lightColor: "#1a3d2e",
    vibration: true,
  }).catch(() => undefined);
}

async function ensureExactAlarmSetting(LocalNotifications: NativeNotifications, promptUser: boolean) {
  try {
    const status = await LocalNotifications.checkExactNotificationSetting();
    if (status.exact_alarm !== "granted" && promptUser) {
      await LocalNotifications.changeExactNotificationSetting().catch(() => undefined);
    }
  } catch {}
}

async function ensureNativeReady(promptExactAlarm: boolean): Promise<NativeNotifications | null> {
  const LocalNotifications = await getNativeNotifications();
  if (!LocalNotifications) return null;

  let permission = await LocalNotifications.checkPermissions().catch(() => null);
  if (permission?.display !== "granted") {
    permission = await LocalNotifications.requestPermissions().catch(() => null);
  }
  if (permission?.display !== "granted") return null;

  await ensureNativeChannel(LocalNotifications);
  await ensureExactAlarmSetting(LocalNotifications, promptExactAlarm);
  return LocalNotifications;
}

async function getServiceWorkerRegistration() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    await navigator.serviceWorker.register("/sw.js");
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

function getScheduleKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatNotificationTime(date: Date) {
  return new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit" }).format(date);
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function buildPrayerDate(time: string, baseDate: Date) {
  const match = time.match(/(\d{1,2}):(\d{2})/);
  const next = new Date(baseDate);
  if (!match) return new Date(Number.NaN);
  next.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return next;
}

function pushJob(jobs: NotificationJob[], date: Date, title: string, body: string, lines?: string[]) {
  if (Number.isFinite(date.getTime())) {
    jobs.push({ date, title, body, lines });
  }
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

export async function getNotificationStatus(): Promise<NotificationStatus> {
  const scheduledUntil = typeof localStorage !== "undefined" ? localStorage.getItem(SCHEDULED_KEY) : null;
  const scheduledCount = typeof localStorage !== "undefined" ? Number(localStorage.getItem(SCHEDULED_COUNT_KEY) ?? 0) : 0;
  const savedMode = typeof localStorage !== "undefined" ? (localStorage.getItem(SCHEDULED_MODE_KEY) as NotificationDeliveryMode | null) : null;
  const native = await getNativeNotifications();

  if (native) {
    const permission = await native.checkPermissions().catch(() => null);
    if (permission?.display === "granted") {
      return { mode: "native", scheduledCount, scheduledUntil, canWakePhone: true };
    }
  }

  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return { mode: "unsupported", scheduledCount, scheduledUntil, canWakePhone: false };
  }

  const mode: NotificationDeliveryMode = supportsTimestampTrigger() ? "web-background" : "web-open";
  return { mode: savedMode ?? mode, scheduledCount, scheduledUntil, canWakePhone: mode === "web-background" };
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabledState] = useState(false);
  const [types, setTypesState] = useState<NotifTypes>(defaultNotifTypes);
  const [status, setStatus] = useState<NotificationStatus>({
    mode: "unsupported",
    scheduledCount: 0,
    scheduledUntil: null,
    canWakePhone: false,
  });

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
    setEnabledState(localStorage.getItem(STORAGE_KEY) === "1");
    setTypesState(loadTypes());
    getNotificationStatus().then(setStatus).catch(() => undefined);
  }, []);

  async function refreshStatus() {
    const next = await getNotificationStatus();
    setStatus(next);
    return next;
  }

  async function requestPermission() {
    const native = await ensureNativeReady(true);
    if (native) {
      setPermission("granted");
      await refreshStatus();
      return true;
    }

    if (typeof Notification === "undefined") return false;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") await getServiceWorkerRegistration();
    await refreshStatus();
    return p === "granted";
  }

  function setEnabled(v: boolean) {
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    setEnabledState(v);
    if (!v) void clearAllScheduledNotifications();
    void refreshStatus();
  }

  function setType(type: NotifType, value: boolean) {
    const next = { ...types, [type]: value };
    setTypesState(next);
    saveTypes(next);
  }

  async function scheduleAll(reminderMin?: number) {
    const next = await scheduleAllNotifications(reminderMin);
    await refreshStatus();
    return next;
  }

  return {
    permission,
    requestPermission,
    enabled,
    setEnabled,
    types,
    setType,
    status,
    refreshStatus,
    scheduleAll,
    testNotification,
  };
}

function clearScheduled() {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
}

export async function clearAllScheduledNotifications() {
  clearScheduled();
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(SCHEDULED_KEY);
    localStorage.removeItem(SCHEDULED_COUNT_KEY);
    localStorage.removeItem(SCHEDULED_MODE_KEY);
  }

  const native = await getNativeNotifications();
  if (native) {
    const pending = await native.getPending().catch(() => ({ notifications: [] }));
    if (pending.notifications.length > 0) {
      await native.cancel({ notifications: pending.notifications }).catch(() => undefined);
    }
    return;
  }

  if ("serviceWorker" in navigator) {
    const reg = await getServiceWorkerRegistration();
    const existing = await reg?.getNotifications({ includeTriggered: false } as any).catch(() => []);
    existing?.forEach((n) => n.close());
  }
}

async function showNotificationNow(title: string, body: string, lines?: string[]) {
  const native = await ensureNativeReady(false);
  if (native) {
    await native.schedule({
      notifications: [
        {
          id: createNotificationId({ date: new Date(), title, body }),
          title,
          body,
          largeBody: lines?.join("\n") ?? body,
          summaryText: "نور",
          inboxList: lines,
          channelId: NATIVE_CHANNEL_ID,
          smallIcon: "ic_stat_icon",
          largeIcon: "ic_launcher",
          iconColor: "#1a3d2e",
          autoCancel: true,
          group: NOTIFICATION_GROUP,
          schedule: { at: new Date(Date.now() + 100), allowWhileIdle: true },
        },
      ],
    });
    return;
  }

  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  if ("serviceWorker" in navigator) {
    try {
      const reg = await getServiceWorkerRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: WEB_NOTIFICATION_ICON,
          image: WEB_NOTIFICATION_ICON,
          tag: title,
          renotify: true,
          vibrate: [200, 100, 200],
          requireInteraction: true,
          data: { url: "/" },
        } as any);
        return;
      }
    } catch {}
  }

  try {
    new Notification(title, { body, icon: WEB_NOTIFICATION_ICON, tag: title, requireInteraction: true });
  } catch {}
}

function createNotificationId(job: NotificationJob) {
  let hash = Math.floor(job.date.getTime() / 60000);
  const text = `${job.title}|${job.body}`;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 2147483000) + 1;
}

function toNativeNotification(job: NotificationJob): LocalNotificationSchema {
  return {
    id: createNotificationId(job),
    title: job.title,
    body: job.body,
    largeBody: job.body,
    summaryText: "نور",
    channelId: NATIVE_CHANNEL_ID,
    smallIcon: "ic_stat_icon",
    iconColor: "#1a3d2e",
    autoCancel: true,
    schedule: { at: job.date, allowWhileIdle: true },
  };
}

async function scheduleNativeBatch(jobs: NotificationJob[], LocalNotifications: NativeNotifications) {
  if (jobs.length === 0) return;
  await ensureNativeChannel(LocalNotifications);
  const notifications = jobs.map(toNativeNotification);

  for (let i = 0; i < notifications.length; i += NATIVE_CHUNK_SIZE) {
    const chunk = notifications.slice(i, i + NATIVE_CHUNK_SIZE);
    try {
      await LocalNotifications.schedule({ notifications: chunk });
    } catch {
      await LocalNotifications.schedule({
        notifications: chunk.map((notification) => ({
          ...notification,
          schedule: notification.schedule ? { ...notification.schedule, allowWhileIdle: false } : notification.schedule,
        })),
      });
    }
  }
}

type ScheduleResult = "native" | "trigger" | "timeout" | "skipped";

export async function scheduleAllNotifications(reminderMin = 15) {
  if (typeof window === "undefined") return;

  const native = await ensureNativeReady(false);
  const isNative = Boolean(native);

  if (!isNative && (typeof Notification === "undefined" || Notification.permission !== "granted")) return;
  clearScheduled();

  if (native) {
    const pending = await native.getPending().catch(() => ({ notifications: [] }));
    if (pending.notifications.length > 0) {
      await native.cancel({ notifications: pending.notifications }).catch(() => undefined);
    }
  } else if ("serviceWorker" in navigator) {
    try {
      const reg = await getServiceWorkerRegistration();
      if (reg) {
        const existing = await reg.getNotifications({ includeTriggered: false } as any);
        existing.forEach((n) => n.close());
      }
    } catch {}
  }

  const types = loadTypes();

  try {
    const coords = await getUserCoords();
    const today = new Date();
    const supportsBackgroundScheduling = isNative || supportsTimestampTrigger();
    const daysToSchedule = supportsBackgroundScheduling ? BACKGROUND_SCHEDULE_DAYS : 1;
    const jobs: NotificationJob[] = [];
    const order: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

    for (let dayOffset = 0; dayOffset < daysToSchedule; dayOffset += 1) {
      const scheduleDate = addDays(today, dayOffset);
      const timings = await fetchPrayerTimes(coords, scheduleDate);

      order.forEach((name) => {
        const prayerDate = buildPrayerDate(timings[name], scheduleDate);

        if (types.prayerReminder) {
          const remTime = new Date(prayerDate.getTime() - reminderMin * 60 * 1000);
          pushJob(jobs, remTime, `🕌 تذكير: ${prayerArabic[name]}`, `بقي ${reminderMin} دقيقة على ${prayerArabic[name]}`);
        }

        if (types.prayerTime) {
          pushJob(jobs, prayerDate, `🕌 حان وقت ${prayerArabic[name]}`, "حيّ على الصلاة، حيّ على الفلاح");
        }

        if (types.afterPrayer) {
          const after = new Date(prayerDate.getTime() + 5 * 60 * 1000);
          pushJob(jobs, after, "✨ أذكار بعد الصلاة", "لا تنسَ أذكار ما بعد الصلاة");
        }
      });

      if (types.morning) {
        const morning = new Date(buildPrayerDate(timings.Fajr, scheduleDate).getTime() + 30 * 60 * 1000);
        pushJob(jobs, morning, "🌅 أذكار الصباح", "ابدأ يومك بذكر الله");
      }

      if (types.evening) {
        const evening = buildPrayerDate(timings.Asr, scheduleDate);
        pushJob(jobs, evening, "🌙 أذكار المساء", "اختم نهارك بذكر الله");
      }
    }

    const futureJobs = jobs.filter((job) => job.date.getTime() > Date.now() + 500);
    let results: ScheduleResult[] = [];

    if (native) {
      await scheduleNativeBatch(futureJobs, native);
      results = futureJobs.map(() => "native");
    } else {
      results = await Promise.all(futureJobs.map((job) => scheduleAt(job.date, job.title, job.body)));
    }

    localStorage.setItem(SCHEDULED_KEY, getScheduleKey(addDays(today, daysToSchedule - 1)));
    localStorage.setItem(SCHEDULED_COUNT_KEY, String(futureJobs.length));
    if (results.some((result) => result !== "skipped")) {
      console.info("Notifications scheduled", results.length, results[0]);
    }
  } catch (e) {
    console.error("Failed to schedule notifications", e);
  }
}

async function scheduleAt(date: Date, title: string, body: string): Promise<ScheduleResult> {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "skipped";

  const triggered = await scheduleViaTrigger(date, title, body);
  if (triggered) return "trigger";

  if (ms > 24 * 60 * 60 * 1000) return "skipped";
  const id = window.setTimeout(() => showNotificationNow(title, body), ms);
  timers.push(id);
  return "timeout";
}

async function scheduleViaTrigger(date: Date, title: string, body: string): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  if (typeof (window as any).TimestampTrigger === "undefined") return false;
  try {
    const reg = await getServiceWorkerRegistration();
    if (!reg) return false;
    await reg.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: `${title}-${date.getTime()}`,
      showTrigger: new (window as any).TimestampTrigger(date.getTime()),
      vibrate: [200, 100, 200],
      requireInteraction: true,
    } as any);
    return true;
  } catch (e) {
    console.warn("TimestampTrigger failed:", e);
    return false;
  }
}

export async function testNotification() {
  await showNotificationNow("🔔 اختبار الإشعار", "إشعارات نور تعمل بنجاح، بارك الله فيك");
}

export async function ensureDailySchedule(reminderMin = 15) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(STORAGE_KEY) !== "1") return;

  const native = await getNativeNotifications();
  const isNative = Boolean(native);

  if (native) {
    const permissions = await native.checkPermissions().catch(() => null);
    if (permissions?.display !== "granted") return;
    await ensureNativeChannel(native);
    await ensureExactAlarmSetting(native, false);
  } else if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  const savedReminderMin = await getReminderMinutes(reminderMin);
  const last = localStorage.getItem(SCHEDULED_KEY);
  const scheduledUntil = getScheduleKey(
    addDays(new Date(), isNative || supportsTimestampTrigger() ? BACKGROUND_SCHEDULE_DAYS - 1 : 0)
  );
  const needsFreshSchedule = !isNative && !supportsTimestampTrigger();
  const nativePending = native ? await native.getPending().catch(() => ({ notifications: [] })) : null;
  const nativeScheduleMissing = Boolean(native && nativePending && nativePending.notifications.length < MIN_PENDING_NATIVE_NOTIFICATIONS);

  if (needsFreshSchedule || nativeScheduleMissing || last !== scheduledUntil) {
    await scheduleAllNotifications(savedReminderMin);
  }
}
