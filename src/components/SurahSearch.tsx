import { Link } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronLeft, Search, X } from "lucide-react";
import { surahs, type Surah } from "@/data/surahs";

const indexedSurahs = surahs.map((surah) => ({
  surah,
  searchText: [
    normalizeSearchText(surah.name),
    normalizeSearchText(surah.englishName),
    String(surah.number),
  ].join(" "),
}));

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function searchSurahs(query: string): Surah[] {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return surahs;

  return indexedSurahs
    .filter(({ searchText }) => tokens.every((token) => searchText.includes(token)))
    .map(({ surah }) => surah);
}

export const SurahSearch = memo(function SurahSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchSurahs(query), [query]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleNativeInput = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      const nextQuery = input.value;
      timerRef.current = window.setTimeout(() => {
        setQuery(nextQuery);
        timerRef.current = null;
      }, 160);
    };

    input.addEventListener("input", handleNativeInput, { passive: true });
    return () => {
      input.removeEventListener("input", handleNativeInput);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  function clearSearch() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
    setQuery("");
  }

  return (
    <section className="space-y-2" aria-label="البحث عن السور">
      <div
        role="search"
        className="flex items-center gap-2 rounded-2xl border px-4 py-3"
        style={{ background: "var(--card)", boxShadow: "var(--shadow-soft)" }}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={64}
          aria-label="اكتب اسم السورة أو رقمها"
          aria-controls="surah-search-results"
          defaultValue=""
          placeholder="ابحث عن سورة أو رقم..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button
          type="button"
          onClick={clearSearch}
          aria-label="مسح البحث"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p
        className="px-1 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {query.trim() ? results.length + " نتيجة" : "جميع السور"}
      </p>

      <div id="surah-search-results" className="space-y-2">
        {results.map((surah) => (
          <SurahSearchResult key={surah.number} surah={surah} />
        ))}
        {query.trim().length > 0 && results.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            لا توجد سورة مطابقة. جرّب الاسم بالعربية أو الإنجليزية أو رقم السورة.
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
        style={{
          background: "var(--gradient-gold)",
          color: "var(--gold-foreground)",
        }}
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
