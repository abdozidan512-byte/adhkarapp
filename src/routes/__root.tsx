import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BottomNav } from "@/components/BottomNav";
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
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/96a2394f-db23-4e96-8a8d-90f9db80fe11/id-preview-5210b28d--8bfeace8-24a9-46c3-a8a1-073d7dcd166c.lovable.app-1776715183600.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/96a2394f-db23-4e96-8a8d-90f9db80fe11/id-preview-5210b28d--8bfeace8-24a9-46c3-a8a1-073d7dcd166c.lovable.app-1776715183600.png" },
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
    const registerServiceWorker = async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

      let inIframe = false;
      try {
        inIframe = window.self !== window.top;
      } catch {
        inIframe = true;
      }

      const host = window.location.hostname;
      const isPreview =
        host.includes("id-preview--") ||
        host.includes("lovableproject.com") ||
        host === "localhost" ||
        host === "127.0.0.1";

      if (inIframe || isPreview) {
        const regs = await navigator.serviceWorker.getRegistrations();
        regs.forEach((r) => r.unregister());
        return;
      }

      const existing = await navigator.serviceWorker.getRegistration();
      const reg = existing ?? (await navigator.serviceWorker.register("/sw.js").catch(() => undefined));
      if (!reg) return;

      // إجبار التحديث وفحص الإصدار الجديد
      try {
        await reg.update();
      } catch {}

      // إذا وُجد SW جديد بانتظار التفعيل، فعّله فوراً ثم أعد التحميل مرة واحدة
      const activateWaiting = (sw: ServiceWorker | null) => {
        if (sw && sw.state === "installed" && navigator.serviceWorker.controller) {
          sw.postMessage("SKIP_WAITING");
        }
      };
      activateWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => activateWaiting(nw));
      });

      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });

      await navigator.serviceWorker.ready.catch(() => undefined);
    };

    const syncNotifications = async () => {
      await registerServiceWorker();
      await ensureDailySchedule().catch(() => undefined);
    };

    syncNotifications();

    const handleFocus = () => {
      syncNotifications();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncNotifications();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
  return (
    <ThemeProvider>
      <div className="mx-auto min-h-screen max-w-md pb-24" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
        <Outlet />
      </div>
      <BottomNav />
    </ThemeProvider>
  );
}
