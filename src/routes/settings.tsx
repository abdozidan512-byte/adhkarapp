import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Moon, Sun, Smartphone, Trash2, HardDrive, Download, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useTheme } from "@/contexts/ThemeContext";
import { listAudio, deleteAudio, getSetting, saveSetting } from "@/lib/db";
import { useNotifications, notifTypeLabels, type NotifType } from "@/lib/notifications";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "الإعدادات — نور" }] }),
});

function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { permission, requestPermission, scheduleAll, enabled, setEnabled, types, setType, status, testNotification } = useNotifications();
  const [storage, setStorage] = useState<{ count: number; bytes: number }>({ count: 0, bytes: 0 });
  const [reminderMin, setReminderMin] = useState(15);

  async function refresh() {
    const list = await listAudio();
    setStorage({
      count: list.length,
      bytes: list.reduce((sum, a) => sum + a.size, 0),
    });
  }

  useEffect(() => {
    refresh();
    getSetting<number>("reminderMin").then((v) => v && setReminderMin(v));
  }, []);

  async function clearAudio() {
    if (!confirm("سيتم حذف جميع التلاوات المحملة. متأكد؟")) return;
    const list = await listAudio();
    await Promise.all(list.map((a) => deleteAudio(a.key)));
    refresh();
  }

  async function saveReminder(v: number) {
    setReminderMin(v);
    await saveSetting("reminderMin", v);
    if (enabled) await scheduleAll(v);
  }

  function toggleNotifType(type: NotifType) {
    setType(type, !types[type]);
    if (enabled) {
      // Re-schedule with new prefs
      setTimeout(() => {
        scheduleAll(reminderMin).catch(() => undefined);
      }, 50);
    }
  }

  async function toggleNotifications() {
    if (!enabled) {
      const granted = await requestPermission();
      if (granted) {
        setEnabled(true);
        await scheduleAll(reminderMin);
      }
    } else {
      setEnabled(false);
    }
  }

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="خصص تجربتك" />
      <div className="space-y-3 px-4 py-4">
        {/* Theme */}
        <SettingRow
          icon={theme === "dark" ? Moon : Sun}
          title="المظهر"
          subtitle={theme === "dark" ? "داكن" : "فاتح"}
          action={
            <button
              onClick={toggleTheme}
              className="rounded-full px-4 py-1.5 text-xs font-bold"
              style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
            >
              تبديل
            </button>
          }
        />

        {/* Notifications */}
        <SettingRow
          icon={Bell}
          title="الإشعارات"
          subtitle={
            permission === "denied"
              ? "مرفوضة من المتصفح/الجوال"
              : enabled
              ? "مُفعّلة"
              : "مُعطّلة"
          }
          action={
            <button
              onClick={toggleNotifications}
              disabled={permission === "denied"}
              className="rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-50"
              style={{
                background: enabled ? "var(--gradient-gold)" : "var(--gradient-primary)",
                color: enabled ? "var(--gold-foreground)" : "var(--primary-foreground)",
              }}
            >
              {enabled ? "تعطيل" : "تفعيل"}
            </button>
          }
        />

        {enabled && (
          <div
            className="space-y-4 rounded-2xl border p-4 text-sm"
            style={{ background: "var(--gradient-card)" }}
          >
            <NotificationStatusCard
              mode={status.mode}
              scheduledCount={status.scheduledCount}
              scheduledUntil={status.scheduledUntil}
            />

            <div>
              <p className="mb-2 font-bold">⏱️ مدة التذكير قبل الصلاة</p>
              <div className="flex gap-2">
                {[5, 10, 15, 30].map((v) => (
                  <button
                    key={v}
                    onClick={() => saveReminder(v)}
                    className="flex-1 rounded-xl border py-2 text-xs font-bold transition-all"
                    style={{
                      background: reminderMin === v ? "var(--gradient-gold)" : "transparent",
                      color: reminderMin === v ? "var(--gold-foreground)" : "inherit",
                    }}
                  >
                    {v} د
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="mb-1 font-bold">🔔 أنواع الإشعارات</p>
              <p className="mb-3 text-xs text-muted-foreground">
                ألغِ ما لا تريد استقباله من إشعارات.
              </p>
              <div className="space-y-2">
                {(Object.keys(notifTypeLabels) as NotifType[]).map((t) => (
                  <NotifToggle
                    key={t}
                    title={notifTypeLabels[t].title}
                    subtitle={notifTypeLabels[t].subtitle}
                    checked={types[t]}
                    onChange={() => toggleNotifType(t)}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={testNotification}
              className="w-full rounded-xl border-2 border-dashed py-2.5 text-xs font-bold transition-all hover:bg-muted"
              style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
            >
              🔔 إرسال إشعار اختبار الآن
            </button>

            {status.mode === "web-open" && (
              <p className="rounded-xl border p-3 text-[11px] font-semibold text-muted-foreground">
                على المتصفح قد لا يوقظ الهاتف بعد إغلاق التطبيق تماماً. للوصول في الوقت المحدد دائماً استخدم نسخة Android APK وثبّت إذن الإشعارات والمنبّه الدقيق من إعدادات الهاتف.
              </p>
            )}
          </div>
        )}

        {/* Storage */}
        <SettingRow
          icon={HardDrive}
          title="التلاوات المحملة"
          subtitle={`${storage.count} ملف • ${(storage.bytes / 1024 / 1024).toFixed(1)} ميجا`}
          action={
            storage.count > 0 ? (
              <button onClick={clearAudio} className="flex items-center gap-1 rounded-full bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground">
                <Trash2 className="h-3 w-3" />
                مسح
              </button>
            ) : null
          }
        />

        {/* Install */}
        <div className="rounded-3xl border p-5" style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-soft)" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}
            >
              <Smartphone className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-extrabold">تثبيت التطبيق على الجوال</p>
              <p className="text-xs text-muted-foreground">يعمل بدون إنترنت بعد التثبيت</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-bold">📱 طريقة 1: تثبيت كتطبيق ويب (الأسهل)</p>
            <ul className="space-y-1 pr-4 text-xs text-muted-foreground">
              <li>• <b>Chrome (أندرويد):</b> اضغط القائمة (⋮) ← "تثبيت التطبيق"</li>
              <li>• <b>Safari (آيفون):</b> اضغط أيقونة المشاركة ← "إضافة إلى الشاشة الرئيسية"</li>
            </ul>

            <p className="mt-4 font-bold">📦 طريقة 2: ملف APK لأندرويد</p>
            <ul className="space-y-1 pr-4 text-xs text-muted-foreground">
              <li>1. انشر التطبيق من زر "Publish" داخل لوفابل.</li>
              <li>2. افتح الرابط <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer" className="font-bold text-primary underline">PWABuilder.com</a> والصق رابط التطبيق.</li>
              <li>3. اضغط "Package for stores" ← Android ← حمّل ملف APK.</li>
              <li>4. ثبّت الملف على جوالك (فعّل "تثبيت من مصادر غير معروفة").</li>
            </ul>
            <a
              href="https://www.pwabuilder.com"
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold"
              style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
            >
              <Download className="h-4 w-4" />
              فتح PWABuilder
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <p className="py-6 text-center text-xs text-muted-foreground">
          صُنع بحب ❤️ — تطبيق نور
        </p>
      </div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: any;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border p-4"
      style={{ background: "var(--card)", boxShadow: "var(--shadow-soft)" }}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-2xl"
        style={{ background: "color-mix(in oklab, var(--primary) 12%, transparent)", color: "var(--primary)" }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function NotifToggle({
  title,
  subtitle,
  checked,
  onChange,
}: {
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center gap-3 rounded-xl border p-3 text-right transition-all"
      style={{
        background: checked ? "color-mix(in oklab, var(--gold) 10%, transparent)" : "var(--card)",
        borderColor: checked ? "var(--gold)" : "var(--border)",
      }}
    >
      <div className="flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <div
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? "var(--gradient-gold)" : "var(--muted)" }}
      >
        <div
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ right: checked ? "calc(100% - 1.375rem)" : "0.125rem" }}
        />
      </div>
    </button>
  );
}