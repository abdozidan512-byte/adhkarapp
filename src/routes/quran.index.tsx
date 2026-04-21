import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, ChevronLeft, BookOpen } from "lucide-react";
import { surahs } from "@/data/surahs";
import { PageHeader } from "@/components/PageHeader";
import { ContinueReading } from "@/components/ContinueReading";

export const Route = createFileRoute("/quran/")({
  component: QuranIndex,
  head: () => ({
    meta: [{ title: "المصحف الشريف — نور" }, { name: "description", content: "القرآن الكريم كاملاً مع البحث وأشهر القراء." }],
  }),
});

function QuranIndex() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q.trim()) return surahs;
    const term = q.trim();
    return surahs.filter(
      (s) =>
        s.name.includes(term) ||
        s.englishName.toLowerCase().includes(term.toLowerCase()) ||
        String(s.number).includes(term)
    );
  }, [q]);

  return (
    <div>
      <PageHeader title="المصحف الشريف" subtitle="114 سورة • تلاوة بأشهر القراء" />
      <div className="space-y-3 px-4 pt-3">
        <ContinueReading />
        <div
          className="flex items-center gap-2 rounded-2xl border px-4 py-3"
          style={{ background: "var(--card)", boxShadow: "var(--shadow-soft)" }}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن سورة أو رقم..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div className="space-y-2 px-4 py-4">
        {filtered.map((s) => (
          <Link
            key={s.number}
            to="/quran/$num"
            params={{ num: String(s.number) }}
            search={{ page: undefined }}
            className="flex items-center gap-3 rounded-2xl border p-3 transition-all active:scale-[0.98]"
            style={{ background: "var(--card)" }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold"
              style={{
                background: "var(--gradient-gold)",
                color: "var(--gold-foreground)",
              }}
            >
              {s.number}
            </div>
            <div className="flex-1">
              <p className="text-lg font-extrabold font-quran">{s.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {s.revelationType === "Meccan" ? "مكية" : "مدنية"} • {s.numberOfAyahs} آية
              </p>
            </div>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">لا توجد نتائج</p>
        )}
      </div>
    </div>
  );
}
