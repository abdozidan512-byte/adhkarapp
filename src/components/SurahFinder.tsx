import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, Search, X } from "lucide-react";
import { surahs, type Surah } from "@/data/surahs";

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/\s+/g, " ")
    .trim();
}

export function SurahFinder() {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearchText(query);

  const visibleSurahs = useMemo(() => {
    if (!normalizedQuery) return surahs;

    return surahs.filter((surah) => {
      const searchableText = normalizeSearchText(
        surah.name + " سورة " + surah.name + " " + surah.englishName + " " + surah.number,
      );
      return searchableText.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  return (
    <section className="space-y-3" aria-label="البحث عن سور القرآن" dir="rtl">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-extrabold">السور</h2>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {normalizedQuery ? visibleSurahs.length + " نتيجة" : "114 سورة"}
        </span>
      </div>

      <div
        className="flex items-center gap-3 rounded-2xl border px-4 py-3 focus-within:border-primary"
        style={{ background: "var(--card)", boxShadow: "var(--shadow-soft)" }}
      >
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          aria-label="ابحث عن سورة"
          placeholder="اكتب اسم السورة..."
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="مسح البحث"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="space-y-2" aria-live="polite">
        {visibleSurahs.map((surah) => (
          <SurahRow key={surah.number} surah={surah} />
        ))}
        {normalizedQuery && visibleSurahs.length === 0 && (
          <p className="rounded-2xl border py-8 text-center text-sm text-muted-foreground">
            لم يتم العثور على سورة بهذا الاسم
          </p>
        )}
      </div>
    </section>
  );
}

function SurahRow({ surah }: { surah: Surah }) {
  return (
    <Link
      to="/quran/$num"
      params={{ num: String(surah.number) }}
      search={{ page: undefined }}
      className="flex items-center gap-3 rounded-2xl border p-3 active:scale-[0.98]"
      style={{ background: "var(--card)" }}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold"
        style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}
      >
        {surah.number}
      </span>
      <span className="flex-1">
        <span className="block text-lg font-extrabold font-quran">{surah.name}</span>
        <span className="block text-[10px] text-muted-foreground">
          {surah.revelationType === "Meccan" ? "مكية" : "مدنية"} • {surah.numberOfAyahs} آية
        </span>
      </span>
      <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <ChevronLeft className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
