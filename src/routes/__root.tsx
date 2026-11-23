import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BottomNav } from "@/components/BottomNav";
import { AchievementToast } from "@/components/AchievementToast";
import { ensureDailySchedule } from "@/lib/notifications";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <a href="/" className="mt-6 inline-flex rounded-2xl bg-primary px-6 py-3 text-primary-foreground">
          الرئيسية
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" },
      { name: "theme-color", content: "#1a3d2e" },
      { name: "application-name", content: "نور" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "نور" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "format-detection", content: "telephone=no" },
      { title: "نور — أذكار وقرآن ومواقيت الصلاة" },
      { name: "description", content: "تطبيق إسلامي شامل: أذكار الصباح والمساء والنوم، القرآن الكريم بأشهر القراء، مواقيت الصلاة، القبلة." },
      { property: "og:title", content: "نور — أذكار وقرآن ومواقيت الصلاة" },
      { name: "twitter:title", content: "نور — أذكار وقرآن ومواقيت الصلاة" },
      { property: "og:description", content: "تطبيق إسلامي شامل: أذكار الصباح والمساء والنوم، القرآن الكريم بأشهر القراء، مواقيت الصلاة، القبلة." },
      { name: "twitter:description", content: "تطبيق إسلامي شامل: أذكار الصباح والمساء والنوم، القرآن الكريم بأشهر القراء، مواقيت الصلاة، القبلة." },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    let notificationTimer: number | undefined;
    let notificationCheckInFlight = false;
    let lastNotificationCheck = 0;
    let waitingForInputToBlur = false;

    const isEditing = () => {
      const active = document.activeElement;
      return active instanceof HTMLElement &&
        (active.matches("input, textarea, select") || active.isContentEditable);
    };

    const runNotificationCheck = () => {
      notificationTimer = undefined;
      if (document.visibilityState !== "visible") return;
      if (isEditing()) {
        if (!waitingForInputToBlur) {
          waitingForInputToBlur = true;
          document.addEventListener("focusout", handleInputBlur, { once: true });
        }
        return;
      }
      if (notificationCheckInFlight || Date.now() - lastNotificationCheck < 60_000) return;

      notificationCheckInFlight = true;
      lastNotificationCheck = Date.now();
      void ensureDailySchedule()
        .catch(() => undefined)
        .finally(() => {
          notificationCheckInFlight = false;
        });
    };

    const scheduleNotificationCheck = (delay = 1600) => {
      if (notificationTimer !== undefined) window.clearTimeout(notificationTimer);
      notificationTimer = window.setTimeout(runNotificationCheck, delay);
    };

    const handleInputBlur = () => {
      waitingForInputToBlur = false;
      scheduleNotificationCheck();
    };

    const handleUserActivity = () => scheduleNotificationCheck();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleNotificationCheck();
      } else if (notificationTimer !== undefined) {
        window.clearTimeout(notificationTimer);
        notificationTimer = undefined;
      }
    };

    // Service-worker maintenance runs once at startup, never on keyboard focus.
    void registerServiceWorker().catch(() => undefined);
    scheduleNotificationCheck();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pointerdown", handleUserActivity, { passive: true });
    window.addEventListener("keydown", handleUserActivity);

    return () => {
      if (notificationTimer !== undefined) window.clearTimeout(notificationTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("focusout", handleInputBlur);
      window.removeEventListener("pointerdown", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
    };
  }, []);

  return (
    <ThemeProvider>
      <div className="mx-auto min-h-screen max-w-md pb-24" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
        <Outlet />
      </div>
      <BottomNav />
      <AchievementToast />
    </ThemeProvider>
  );
}
