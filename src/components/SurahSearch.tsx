import { Link } from "@tanstack/react-router";
import { memo, useEffect, useRef } from "react";
import { BookOpen, ChevronLeft, Search, X } from "lucide-react";
import { surahs } from "@/data/surahs";

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[ؤئ]/g, (letter) => (letter === "ؤ" ? "و" : "ي"))
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const surahRows = surahs.map((surah) => ({
  surah,
  searchText: [
    normalizeSearchText(surah.name),
    normalizeSearchText(surah.englishName),
    String(surah.number),
  ].join(" "),
}));

export const SurahSearch = memo(function SurahSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    const list = resultsRef.current;
    const status = statusRef.current;
    const emptyMessage = emptyRef.current;
    const clearButton = clearRef.current;
    if (!input || !list || !status || !emptyMessage || !clearButton) return;

    const rows = Array.from(
      list.querySelectorAll<HTMLElement>("[data-surah-search-result]")
    );
    let frameId: number | null = null;

    const filterRows = () => {
      frameId = null;
      const tokens = normalizeSearchText(input.value).split(" ").filter(Boolean);
      let visibleCount = 0;

      for (const row of rows) {
        const searchableText = row.getAttribute("data-search-text") || "";
        const matches =
          tokens.length === 0 ||
          tokens.every((token) => searchableText.includes(token));

        const display = matches ? "" : "none";
        if (row.style.display !== display) row.style.display = display;
        if (matches) visibleCount += 1;
      }

      status.textContent = tokens.length === 0
        ? visibleCount + " سورة"
        : visibleCount + " نتيجة";
      emptyMessage.style.display = visibleCount === 0 ? "" : "none";
    };

    const scheduleFilter = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(filterRows);
    };

    const clearInput = () => {
      input.value = "";
      filterRows();
      input.focus();
    };

    input.addEventListener("input", scheduleFilter, { passive: true });
    clearButton.addEventListener("click", clearInput);
    filterRows();

    return () => {
      input.removeEventListener("input", scheduleFilter);
      clearButton.removeEventListener("click", clearInput);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

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
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={64}
          aria-label="اكتب اسم السورة أو رقمها"
          aria-controls="surah-search-results"
          placeholder="ابحث عن سورة أو رقم..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button
          ref={clearRef}
          type="button"
          aria-label="مسح البحث"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p
        ref={statusRef}
        className="px-1 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        114 سورة
      </p>

      <div id="surah-search-results" ref={resultsRef} className="space-y-2">
        {surahRows.map(({ surah, searchText }) => (
          <Link
            key={surah.number}
            to="/quran/$num"
            params={{ num: String(surah.number) }}
            search={{ page: undefined }}
            data-surah-search-result=""
            data-search-text={searchText}
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
        ))}
        <p
          ref={emptyRef}
          className="py-12 text-center text-sm text-muted-foreground"
          role="status"
          style={{ display: "none" }}
        >
          لا توجد سورة مطابقة. جرّب الاسم بالعربية أو الإنجليزية أو رقم السورة.
        </p>
      </div>
    </section>
  );
});
