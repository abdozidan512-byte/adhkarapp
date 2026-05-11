import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Sunrise, Sunset, Moon, Plane, Home as HomeIcon, CloudRain, Star, Search } from "lucide-react";
import { azkarCategories } from "@/data/azkar";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/azkar/")({
  component: AzkarIndex,
  head: () => ({
    meta: [{ title: "الأذكار — نور" }, { name: "description", content: "أذكار الصباح والمساء والنوم وأدعية متعددة." }],
  }),
});

const iconMap: Record<string, any> = {
  sunrise: Sunrise,
  sunset: Sunset,
  moon: Moon,
  mosque: Star,
  plane: Plane,
  home: HomeIcon,
  "cloud-rain": CloudRain,
};

function AzkarIndex() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim();
    if (!term) return azkarCategories;
    return azkarCategories.filter((c) => {
      if (c.title.includes(term) || c.subtitle.includes(term)) return true;
      return c.items.some((it: any) =>
        (it.text && String(it.text).includes(term)) ||
        (it.zikr && String(it.zikr).includes(term))
      );
    });
  }, [q]);

  return (
    <div>
      <PageHeader title="الأذكار" subtitle="ذكر الله طمأنينة وحصن" />
      <div className="px-4 pt-3">
        <div
          className="flex items-center gap-2 rounded-2xl border px-4 py-3"
          style={{ background: "var(--card)", boxShadow: "var(--shadow-soft)" }}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في الأذكار..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </div>
      <div className="space-y-3 px-4 py-4">
        {filtered.map((cat) => {
          const Icon = iconMap[cat.icon] ?? Star;
          return (
            <Link
              key={cat.id}
              to="/azkar/$id"
              params={{ id: cat.id }}
              className="group flex items-center gap-4 rounded-3xl border p-4 transition-all active:scale-[0.98]"
              style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-soft)" }}
            >
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
                style={{
                  background: "var(--gradient-gold)",
                  color: "var(--gold-foreground)",
                  boxShadow: "var(--shadow-gold)",
                }}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-extrabold">{cat.title}</p>
                <p className="text-xs text-muted-foreground">{cat.subtitle}</p>
                <p className="mt-1 text-[10px] font-bold" style={{ color: "var(--gold)" }}>
                  {cat.items.length} ذكراً
                </p>
              </div>
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">لا توجد نتائج</p>
        )}
      </div>
    </div>
  );
}
