import { Link, useLocation } from "@tanstack/react-router";
import { Home, BookOpen, Compass, Sparkles, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/azkar", label: "الأذكار", icon: Sparkles },
  { to: "/qibla", label: "القبلة", icon: Compass },
  { to: "/quran", label: "المصحف", icon: BookOpen },
  { to: "/settings", label: "الإعدادات", icon: Settings },
] as const;

export function BottomNav() {
  const location = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl"
      style={{
        background: "color-mix(in oklab, var(--background) 85%, transparent)",
        borderColor: "var(--border)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((it) => {
          const active = location.pathname === it.to || (it.to !== "/" && location.pathname.startsWith(it.to));
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-3 text-[11px] font-semibold transition-all",
                active ? "text-primary scale-105" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl transition-all",
                  active && "bg-primary/15 shadow-[0_0_20px_color-mix(in_oklab,var(--primary)_30%,transparent)]"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
