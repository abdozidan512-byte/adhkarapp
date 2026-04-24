import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, BookHeart, Heart, Sparkles, Star, GraduationCap, Users, Trophy, Book } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { hadithCategories, filterHadiths } from "@/data/hadiths";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hadith")({
  component: HadithPage,
  head: () => ({
    meta: [
      { title: "الأحاديث النبوية الصحيحة — نور" },
      { name: "description", content: "مجموعة من الأحاديث النبوية الصحيحة من البخاري ومسلم مصنفة حسب الموضوع." },
    ],
  }),
});

const iconMap: Record<string, any> = {
  book: Book,
  heart: Heart,
  sparkles: Sparkles,
  mosque: BookHeart,
  star: Star,
  graduation: GraduationCap,
  users: Users,
  trophy: Trophy,
};

function HadithPage() {
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const list = useMemo(() => filterHadiths(activeCat, search), [activeCat, search]);

  return (
    <div style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
      <PageHeader title="الأحاديث النبوية" subtitle="من صحيح البخاري ومسلم وغيرهما" />

      {/* Search */}
      <div className="px-4 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الحديث، الراوي أو المصدر..."
            className="h-12 w-full rounded-2xl border bg-card pr-10 pl-4 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {hadithCategories.map((c) => {
          const Icon = iconMap[c.icon] ?? Book;
          const active = activeCat === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-all active:scale-95",
                active ? "border-transparent text-primary-foreground" : "bg-card text-foreground"
              )}
              style={
                active
                  ? { background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }
                  : undefined
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {c.title}
            </button>
          );
        })}
      </div>

      {/* Counter */}
      <div className="px-5 pt-3 text-xs text-muted-foreground">
        {list.length} حديث
      </div>

      {/* List */}
      <div className="space-y-4 px-4 pt-3">
        {list.map((h) => (
          <article
            key={h.id}
            className="relative overflow-hidden rounded-3xl border p-5"
            style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-soft)" }}
          >
            <div className="pattern-islamic absolute inset-0 opacity-[0.05]" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-extrabold"
                  style={{
                    background: "var(--gradient-gold)",
                    color: "var(--gold-foreground)",
                  }}
                >
                  {h.id}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground">
                  قال رسول الله ﷺ:
                </span>
              </div>
              <p className="font-quran text-base leading-loose">«{h.text}»</p>

              {h.explanation && (
                <p className="mt-3 rounded-2xl border p-3 text-xs leading-relaxed text-muted-foreground" style={{
                  background: "color-mix(in oklab, var(--primary) 5%, transparent)",
                  borderColor: "color-mix(in oklab, var(--primary) 20%, transparent)",
                }}>
                  💡 {h.explanation}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3 text-[11px]">
                <span className="font-bold" style={{ color: "var(--gold)" }}>
                  الراوي: {h.narrator}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{h.source}</span>
              </div>
            </div>
          </article>
        ))}

        {list.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            لا توجد أحاديث مطابقة لبحثك
          </div>
        )}
      </div>
    </div>
  );
}
