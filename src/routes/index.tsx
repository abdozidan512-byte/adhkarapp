import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, BookOpen, Compass, Settings, Sun, Moon, BookHeart } from "lucide-react";
import { PrayerTimesCard } from "@/components/PrayerTimesCard";
import { ContinueReading } from "@/components/ContinueReading";
import { useTheme } from "@/contexts/ThemeContext";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [{ title: "نور — تطبيق الأذكار والقرآن" }],
  }),
});

function HomePage() {
  const { theme, toggleTheme } = useTheme();
  const today = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section
        className="relative overflow-hidden px-5 pb-12 pt-12"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="pattern-islamic absolute inset-0 opacity-15" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold tracking-widest text-primary-foreground/70">السلام عليكم</p>
              <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-primary-foreground drop-shadow">
                نور
              </h1>
              <p className="mt-1 text-xs text-primary-foreground/70">{today}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-primary-foreground backdrop-blur"
              aria-label="تبديل المظهر"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>

          <div className="mt-6">
            <PrayerTimesCard />
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="-mt-2 px-4">
        <div className="grid grid-cols-2 gap-3">
          <QuickCard to="/azkar" icon={Sparkles} title="الأذكار" subtitle="صباح، مساء، نوم..." gold />
          <QuickCard to="/quran" icon={BookOpen} title="المصحف" subtitle="114 سورة + قراء" />
          <QuickCard to="/hadith" icon={BookHeart} title="الأحاديث" subtitle="من البخاري ومسلم" />
          <QuickCard to="/qibla" icon={Compass} title="القبلة" subtitle="بوصلة دقيقة" />
          <QuickCard to="/settings" icon={Settings} title="الإعدادات" subtitle="ثيم، إشعارات، APK" />
        </div>
      </section>

      {/* Continue reading */}
      <section className="px-4 pt-4">
        <ContinueReading />
      </section>

      {/* Quote */}
      <section className="px-5 py-8">
        <div
          className="relative overflow-hidden rounded-3xl border p-6 text-center"
          style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-soft)" }}
        >
          <div className="text-3xl opacity-30" style={{ color: "var(--gold)" }}>﴾﴿</div>
          <p className="font-quran mt-2 text-xl leading-loose">
            فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ
          </p>
          <p className="mt-3 text-xs text-muted-foreground">سورة البقرة - 152</p>
        </div>
      </section>
    </div>
  );
}

function QuickCard({
  to,
  icon: Icon,
  title,
  subtitle,
  gold,
}: {
  to: string;
  icon: any;
  title: string;
  subtitle: string;
  gold?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col gap-2 overflow-hidden rounded-3xl border p-4 transition-all active:scale-[0.97]"
      style={{
        background: gold ? "var(--gradient-gold)" : "var(--gradient-card)",
        boxShadow: gold ? "var(--shadow-gold)" : "var(--shadow-soft)",
        color: gold ? "var(--gold-foreground)" : undefined,
      }}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-2xl"
        style={{
          background: gold ? "rgba(0,0,0,0.1)" : "color-mix(in oklab, var(--primary) 12%, transparent)",
          color: gold ? "inherit" : "var(--primary)",
        }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-base font-extrabold">{title}</p>
        <p className="text-xs opacity-75">{subtitle}</p>
      </div>
    </Link>
  );
}
