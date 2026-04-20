import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BottomNav } from "@/components/BottomNav";
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
      { title: "نور — أذكار وقرآن ومواقيت الصلاة" },
      { name: "description", content: "تطبيق إسلامي شامل: أذكار الصباح والمساء والنوم، القرآن الكريم بأشهر القراء، مواقيت الصلاة، القبلة." },
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
  return (
    <ThemeProvider>
      <div className="mx-auto min-h-screen max-w-md pb-24" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
        <Outlet />
      </div>
      <BottomNav />
    </ThemeProvider>
  );
}
