import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Sunrise, Sunset, Moon, Plane, Home as HomeIcon, CloudRain, Star } from "lucide-react";
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
  return (
    <div>
      <PageHeader title="الأذكار" subtitle="ذكر الله طمأنينة وحصن" />
      <div className="space-y-3 px-4 py-4">
        {azkarCategories.map((cat) => {
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
      </div>
    </div>
  );
}
