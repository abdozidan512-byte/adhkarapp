import { Link } from "@tanstack/react-router";
import { memo, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, Search, X } from "lucide-react";
import { surahs, type Surah } from "@/data/surahs";

const PAGE_SIZE = 16;

function normalizeSurahQuery(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/[^a-z0-9\\u0600-\\u06ff]+/g, " ")
    .trim()
    .replace(/\\s+/g, " ");
}

const indexedSurahs = surahs.map((surah) => ({
  surah,
  searchText: [
    normalizeSurahQuery(surah.name),
    normalizeSurahQuery(surah.englishName),
    String(surah.number),
  ].join(" "),
}));

export const SurahSearch = memo(function SurahSearch() {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const normalizedQuery = normalizeSurahQuery(query);
  const matches = useMemo(() => {
    if (!normalizedQuery) return indexedSurahs;
    const terms = normalizedQuery.split(" ").filter(Boolean);
    return indexedSurahs.filter(({ searchText }) =>
      terms.every((term) => searchText.includes(term))
    );
  }, [normalizedQuery]);
  const visibleMatches = matches.slice(0, visibleCount);

  function handleQueryChange(value: string) {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
  }

  function clearSearch() {
    handleQueryChange("");
  }

  const hasQuery = normalizedQuery.length > 0;

  return (
    <section className="space-y-3" aria-label="البحث عن سور القرآن" dir="rtl">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-extrabold">السور</h2>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {hasQuery ? matches.length + " نتيجة" : "114 سورة"}
        </span>
      </div>

      <div
        className="flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors focus-within:border-primary"
        style={{ background: "var(--card)", boxShadow: "var(--shadow-soft)" }}
      >
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          inputMode="text"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={64}
          aria-label="ابحث باسم السورة أو رقمها"
          aria-controls="surah-search-results"
          value={query}
          onChange={(event) => handleQueryChange(event.currentTarget.value)}
          placeholder="ابحث عن سورة أو رقم..."
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="مسح البحث"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div id="surah-search-results" className="space-y-2">
        {visibleMatches.map(({ surah }) => (
          <SurahSearchResult key={surah.number} surah={surah} />
        ))}

        {hasQuery && matches.length === 0 && (
          <p className="rounded-2xl border py-10 text-center text-sm text-muted-foreground">
            لا توجد سورة مطابقة. جرّب الاسم بالعربية أو الإنجليزية أو رقم السورة.
          </p>
        )}

        {visibleCount < matches.length && (
          <button
            type="button"
            onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, matches.length))}
            className="w-full rounded-2xl border py-3 text-sm font-bold text-primary"
          >
            عرض المزيد • {matches.length - visibleCount} سورة
          </button>
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
