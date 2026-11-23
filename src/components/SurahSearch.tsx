import { Link } from "@tanstack/react-router";
import { memo, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, Search, X } from "lucide-react";
import { surahs, type Surah } from "@/data/surahs";

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

export const SurahSearch = memo(function SurahSearch() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const searchText = normalizeSearchText(query);
    if (!searchText) return [];

    return surahs.filter((surah) => {
      const searchableName = normalizeSearchText(
        "سورة " + surah.name + " " + surah.englishName + " " + surah.number,
      );
      return searchableName.includes(searchText);
    });
  }, [query]);

  return (
    <section className="space-y-3" aria-label="البحث عن سور القرآن" dir="rtl">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-extrabold">السور</h2>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {query.trim() ? results.length + " نتيجة" : "114 سورة"}
        </span>
      </div>

      <div
        className="flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors focus-within:border-primary"
        style={{ background: "var(--card)", boxShadow: "var(--shadow-soft)" }}
      >
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          aria-label="ابحث باسم السورة أو رقمها"
          aria-controls="surah-search-results"
          placeholder="ابحث عن سورة..."
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="مسح البحث"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div id="surah-search-results" className="space-y-2">
        {!query.trim() && (
          <p className="rounded-2xl border py-8 text-center text-sm text-muted-foreground">
            اكتب اسم السورة لتظهر النتائج
          </p>
        )}

        {query.trim() &&
          results.map((surah) => (
            <SurahSearchResult key={surah.number} surah={surah} />
          ))}

        {query.trim() && results.length === 0 && (
          <p className="rounded-2xl border py-8 text-center text-sm text-muted-foreground">
            لا توجد سورة بهذا الاسم
          </p>
        )}
      </div>
    </section>
  );
});

const SurahSearchResult = memo(function SurahSearchResult({ surah }: { surah: Surah }) {
  return (
    <Link
      to="/quran/$num"
      params={{ num: String(surah.number) }}
      search={{ page: undefined }}
      className="flex items-center gap-3 rounded-2xl border p-3 transition-all active:scale-[0.98]"
      style={{ background: "var(--card)" }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold"
        style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}
      >
        {surah.number}
      </div>
      <div className="flex-1">
        <p className="text-lg font-extrabold font-quran">{surah.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {surah.revelationType === "Meccan" ? "مكية" : "مدنية"} • {surah.numberOfAyahs} آية
        </p>
      </div>
      <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <ChevronLeft className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
});
