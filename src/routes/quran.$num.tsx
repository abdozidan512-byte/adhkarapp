import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronRight, ZoomIn, ZoomOut, Play, Pause, Download, Check, Loader2, Volume2, Palette, Info, BookOpen, X } from "lucide-react";
import { surahs, reciters, type ReciterId } from "@/data/surahs";
import { fetchSurahTajweed, renderTajweed, tajweedLegend, type TajweedAyah } from "@/lib/tajweed";
import { fetchSurahTafsir, tafsirEditions, type TafsirAyah } from "@/lib/tafsir";
import {
  fetchSurahText,
  getAyahAudioUrl,
  downloadAyahAudio,
  getAyahAudioBlob,
  audioKey,
  getReciter,
  getFullSurahAudioUrl,
  getFullSurahBlob,
  downloadFullSurah,
} from "@/lib/quran-api";
import { getCachedAudioKeys, saveReadingProgress } from "@/lib/db";
import { cn } from "@/lib/utils";
import { recordQuranPageRead, recordSurahCompleted } from "@/lib/achievements";

export const Route = createFileRoute("/quran/$num")({
  component: SurahReader,
  validateSearch: (s: Record<string, unknown>) => ({
    page: typeof s.page === "string" ? Number(s.page) : typeof s.page === "number" ? s.page : undefined,
  }),
  loader: ({ params }) => {
    const num = Number(params.num);
    const meta = surahs.find((s) => s.number === num);
    if (!meta) throw notFound();
    return meta;
  },
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p>السورة غير موجودة</p>
      <Link to="/quran" className="mt-4 inline-block text-primary underline">رجوع</Link>
    </div>
  ),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  head: ({ loaderData }) => ({
    meta: [{ title: `سورة ${loaderData?.name ?? ""} — نور` }],
  }),
});

const FALLBACK_PAGE_SIZE = 5; // used only if API didn't return Mushaf page numbers

function SurahReader() {
  const meta = Route.useLoaderData();
  const search = Route.useSearch();
  const [ayahs, setAyahs] = useState<{ numberInSurah: number; text: string; page?: number; juz?: number }[] | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(28);
  const [reciter, setReciter] = useState<ReciterId>("ar.yasser");
  const [playing, setPlaying] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<{ ayah: number | "all"; pct: number } | null>(null);
  const [cachedKeys, setCachedKeys] = useState<Set<string>>(new Set());
  const [selectedAyahs, setSelectedAyahs] = useState<Set<number>>(new Set());
  const [showReciterSheet, setShowReciterSheet] = useState(false);
  const [tajweedMode, setTajweedMode] = useState(false);
  const [tajweedAyahs, setTajweedAyahs] = useState<TajweedAyah[] | null>(null);
  const [tajweedLoading, setTajweedLoading] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [tafsirAyah, setTafsirAyah] = useState<number | null>(null);
  const [tafsirEdition, setTafsirEdition] = useState<string>("ar.muyassar");
  const [tafsirData, setTafsirData] = useState<TafsirAyah[] | null>(null);
  const [tafsirLoading, setTafsirLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playQueueRef = useRef<number[]>([]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ direction: "rtl", align: "center", loop: false });
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetchSurahText(meta.number)
      .then((a) => alive && setAyahs(a))
      .catch(() => setError("تعذّر تحميل السورة، تحقق من الإنترنت أول مرة."));
    return () => {
      alive = false;
    };
  }, [meta.number]);

  useEffect(() => {
    getCachedAudioKeys().then(setCachedKeys);
  }, [downloading]);

  useEffect(() => {
    if (!tajweedMode || tajweedAyahs) return;
    let alive = true;
    setTajweedLoading(true);
    fetchSurahTajweed(meta.number)
      .then((a) => {
        if (alive) setTajweedAyahs(a);
      })
      .catch((e) => console.error("tajweed", e))
      .finally(() => alive && setTajweedLoading(false));
    return () => {
      alive = false;
    };
  }, [tajweedMode, tajweedAyahs, meta.number]);

  // Reset caches when surah changes
  useEffect(() => {
    setTajweedAyahs(null);
    setTafsirData(null);
  }, [meta.number]);

  // Load tafsir when sheet opens or edition changes
  useEffect(() => {
    if (tafsirAyah === null) return;
    if (tafsirData) return;
    let alive = true;
    setTafsirLoading(true);
    fetchSurahTafsir(meta.number, tafsirEdition)
      .then((d) => alive && setTafsirData(d))
      .catch((e) => console.error("tafsir", e))
      .finally(() => alive && setTafsirLoading(false));
    return () => {
      alive = false;
    };
  }, [tafsirAyah, tafsirEdition, tafsirData, meta.number]);

  // Reset tafsir cache when edition changes
  useEffect(() => {
    setTafsirData(null);
  }, [tafsirEdition]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setPage(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  // Group ayahs by real Mushaf page (so each swipe-page matches the printed page).
  // If the API didn't provide page numbers, fall back to a fixed slice.
  const pages: { numberInSurah: number; text: string; page?: number; juz?: number }[][] = (() => {
    if (!ayahs) return [];
    const hasPages = ayahs.every((a) => typeof a.page === "number");
    if (!hasPages) {
      return Array.from({ length: Math.ceil(ayahs.length / FALLBACK_PAGE_SIZE) }, (_, i) =>
        ayahs.slice(i * FALLBACK_PAGE_SIZE, (i + 1) * FALLBACK_PAGE_SIZE)
      );
    }
    const map = new Map<number, typeof ayahs>();
    for (const a of ayahs) {
      const p = a.page as number;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(a);
    }
    return Array.from(map.keys()).sort((a, b) => a - b).map((k) => map.get(k)!);
  })();

  // Jump to ?page= once carousel & ayahs are ready
  useEffect(() => {
    if (!emblaApi || !ayahs || search.page === undefined) return;
    const target = Math.max(0, Math.min(pages.length - 1, search.page));
    emblaApi.scrollTo(target, true);
  }, [emblaApi, ayahs, search.page, pages.length]);

  // Persist reading progress whenever the page changes
  useEffect(() => {
    if (!ayahs || pages.length === 0) return;
    const currentPage = pages[page];
    if (!currentPage || currentPage.length === 0) return;
    saveReadingProgress({
      surahNumber: meta.number,
      surahName: meta.name,
      page,
      totalPages: pages.length,
      ayah: currentPage[0].numberInSurah,
      updatedAt: Date.now(),
    });
    // Daily mission + achievement: a page was read
    recordQuranPageRead();
    // Reaching the last page = surah completed
    if (page === pages.length - 1) {
      recordSurahCompleted();
    }
  }, [page, ayahs, pages.length, meta.number, meta.name]);

  const currentReciter = getReciter(reciter);
  const isSurahMode = currentReciter?.mode === "surah";

  async function playAyah(ayah: number) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(ayah);

    let src: string;
    const blob = await getAyahAudioBlob(reciter, meta.number, ayah);
    if (blob) {
      src = URL.createObjectURL(blob);
    } else {
      src = getAyahAudioUrl(reciter, meta.number, ayah);
      if (!src) {
        setPlaying(null);
        return;
      }
    }

    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onended = () => {
      const next = playQueueRef.current.shift();
      if (next !== undefined) {
        playAyah(next);
      } else {
        setPlaying(null);
      }
    };
    audio.onerror = () => {
      setPlaying(null);
      playQueueRef.current = [];
    };
    audio.play().catch(() => setPlaying(null));
  }

  async function playFullSurahFile() {
    // تشغيل ملف السورة الكاملة (مفيد للقارئ "surah" مثل اللحيدان)
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(-1); // -1 = full surah
    let src: string;
    const blob = await getFullSurahBlob(reciter, meta.number);
    if (blob) {
      src = URL.createObjectURL(blob);
    } else {
      src = getFullSurahAudioUrl(reciter, meta.number);
      if (!src) {
        setPlaying(null);
        return;
      }
    }
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onended = () => setPlaying(null);
    audio.onerror = () => setPlaying(null);
    audio.play().catch(() => setPlaying(null));
  }

  function stopPlay() {
    audioRef.current?.pause();
    audioRef.current = null;
    playQueueRef.current = [];
    setPlaying(null);
  }

  function playFullSurah() {
    if (isSurahMode) {
      playFullSurahFile();
      return;
    }
    if (!ayahs) return;
    const list = ayahs.map((a) => a.numberInSurah);
    const first = list.shift()!;
    playQueueRef.current = list;
    playAyah(first);
  }

  function playSelected() {
    if (selectedAyahs.size === 0) return;
    if (isSurahMode) {
      // في وضع السورة الكاملة لا يمكن تشغيل آيات منفردة — شغّل الكامل
      playFullSurahFile();
      return;
    }
    const list = Array.from(selectedAyahs).sort((a, b) => a - b);
    const first = list.shift()!;
    playQueueRef.current = list;
    playAyah(first);
  }

  async function downloadAyah(ayah: number) {
    if (isSurahMode) return; // غير مدعوم
    setDownloading({ ayah, pct: 0 });
    try {
      await downloadAyahAudio(reciter, meta.number, ayah, (pct) => setDownloading({ ayah, pct }));
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(null);
      setCachedKeys(await getCachedAudioKeys());
    }
  }

  async function downloadAll() {
    if (!ayahs) return;
    setDownloading({ ayah: "all", pct: 0 });
    try {
      if (isSurahMode) {
        // تحميل ملف السورة الكاملة دفعة واحدة
        await downloadFullSurah(reciter, meta.number, (pct) => setDownloading({ ayah: "all", pct }));
      } else {
        for (let i = 0; i < ayahs.length; i++) {
          const a = ayahs[i].numberInSurah;
          await downloadAyahAudio(reciter, meta.number, a);
          setDownloading({ ayah: "all", pct: Math.round(((i + 1) / ayahs.length) * 100) });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(null);
      setCachedKeys(await getCachedAudioKeys());
    }
  }

  function isCached(ayah: number) {
    return cachedKeys.has(audioKey(reciter, meta.number, ayah));
  }

  function toggleSelect(ayah: number) {
    setSelectedAyahs((prev) => {
      const next = new Set(prev);
      if (next.has(ayah)) next.delete(ayah);
      else next.add(ayah);
      return next;
    });
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error}</p>
        <Link to="/quran" className="mt-4 inline-block underline">رجوع</Link>
      </div>
    );
  }

  if (!ayahs) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const showBismillah = meta.number !== 1 && meta.number !== 9;

  const currentMushafPage = pages[page]?.[0]?.page;
  const currentJuz = pages[page]?.[0]?.juz;

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "var(--mushaf-paper)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Top bar — collapsible */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          chromeVisible ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div
          className="flex items-center justify-between gap-2 border-b px-3 py-3"
          style={{ background: "var(--gradient-hero)" }}
        >
          <Link to="/quran" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-primary-foreground">
            <ChevronRight className="h-5 w-5" />
          </Link>
          <div className="flex-1 text-center text-primary-foreground">
            <p className="text-base font-extrabold font-quran">سورة {meta.name}</p>
            <p className="text-[10px] opacity-80">
              {currentMushafPage ? `صفحة المصحف ${currentMushafPage} • ` : ""}
              {page + 1} / {pages.length}
            </p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setTajweedMode((v) => !v)}
              className={cn(
                "flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-extrabold text-primary-foreground transition-all",
                tajweedMode ? "bg-white/40 ring-2 ring-white/70" : "bg-white/15"
              )}
              aria-label="تجويد"
            >
              <Palette className="h-4 w-4" />
              <span>تجويد</span>
            </button>
            <button
              onClick={() => setFontSize((s) => Math.max(18, s - 2))}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-primary-foreground"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => setFontSize((s) => Math.min(48, s + 2))}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-primary-foreground"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tajweed legend bar */}
        {tajweedMode && (
          <div className="flex items-center gap-2 overflow-x-auto border-b px-3 py-2 hide-scrollbar" style={{ background: "color-mix(in oklab, var(--gold) 6%, var(--card))" }}>
            <button
              onClick={() => setShowLegend(true)}
              className="flex shrink-0 items-center gap-1 rounded-full border bg-card px-2 py-1 text-[10px] font-bold"
            >
              <Info className="h-3 w-3" />
              مفتاح الألوان
            </button>
            {tajweedLegend.map((l) => (
              <div key={l.label} className="flex shrink-0 items-center gap-1 text-[10px]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                <span className="whitespace-nowrap text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Reciter quick bar */}
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs" style={{ background: "color-mix(in oklab, var(--mushaf-paper) 80%, var(--card))" }}>
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
          <button
            onClick={() => setShowReciterSheet(true)}
            className="flex-1 truncate rounded-full border bg-card px-3 py-1.5 text-right font-bold"
          >
            {reciters.find((r) => r.id === reciter)?.avatar} {reciters.find((r) => r.id === reciter)?.name}
          </button>
          {playing === null ? (
            <button
              onClick={selectedAyahs.size > 0 ? playSelected : playFullSurah}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
            >
              <Play className="h-3.5 w-3.5" />
              {selectedAyahs.size > 0 ? `تشغيل (${selectedAyahs.size})` : "تلاوة"}
            </button>
          ) : (
            <button
              onClick={stopPlay}
              className="flex items-center gap-1 rounded-full bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground"
            >
              <Pause className="h-3.5 w-3.5" />
              إيقاف
            </button>
          )}
          <button
            onClick={downloadAll}
            disabled={downloading !== null}
            className="flex h-8 w-8 items-center justify-center rounded-full border bg-card disabled:opacity-50"
            aria-label="تحميل السورة"
          >
            {downloading?.ayah === "all" ? (
              <span className="text-[9px] font-bold">{downloading.pct}%</span>
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Ayah pages — horizontal carousel */}
      <div className="flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {pages.map((pg, idx) => (
            <div key={idx} className="h-full min-w-0 shrink-0 grow-0 basis-full">
              <div
                className="mushaf-page relative h-full overflow-hidden p-4"
                onClick={() => setChromeVisible((v) => !v)}
              >
                <MushafPage
                  ayahs={pg}
                  baseFontSize={fontSize}
                  showBismillah={idx === 0 && showBismillah}
                  tajweedMode={tajweedMode}
                  tajweedAyahs={tajweedAyahs}
                  tajweedLoading={tajweedLoading}
                  selectedAyahs={selectedAyahs}
                  playing={playing}
                  onToggleSelect={(n) => toggleSelect(n)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mushaf bottom strip — surah name | page number | juz */}
      <div
        className="flex items-center justify-between border-t px-5 py-2 text-xs font-bold"
        style={{
          background: "color-mix(in oklab, var(--mushaf-paper) 92%, var(--mushaf-edge))",
          color: "var(--mushaf-ink)",
          borderColor: "color-mix(in oklab, var(--gold) 35%, transparent)",
        }}
      >
        <span className="font-quran" style={{ color: "color-mix(in oklab, var(--mushaf-ink) 75%, transparent)" }}>
          {currentJuz ? `الجزء ${currentJuz}` : ""}
        </span>
        <span
          className="font-quran tabular-nums"
          style={{ fontSize: 16, color: "var(--gold)" }}
        >
          {currentMushafPage ?? page + 1}
        </span>
        <span className="font-quran" style={{ color: "color-mix(in oklab, var(--mushaf-ink) 75%, transparent)" }}>
          سورة {meta.name}
        </span>
      </div>

      {/* Floating action bar for selected ayahs */}
      {selectedAyahs.size > 0 && (
        <div
          className="absolute bottom-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-1.5 shadow-2xl"
          style={{ background: "var(--card)", borderColor: "var(--gold)" }}
        >
          <span className="px-2 text-[11px] font-extrabold" style={{ color: "var(--gold)" }}>
            {selectedAyahs.size} محددة
          </span>
          {!isSurahMode && (
            <button
              onClick={() => playSelected()}
              className="flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-bold"
              style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
            >
              <Play className="h-3.5 w-3.5" /> تشغيل
            </button>
          )}
          {selectedAyahs.size === 1 && (
            <button
              onClick={() => setTafsirAyah(Array.from(selectedAyahs)[0])}
              className="flex h-9 items-center gap-1 rounded-full border bg-card px-3 text-[11px] font-bold"
              style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
            >
              <BookOpen className="h-3.5 w-3.5" /> تفسير
            </button>
          )}
          {!isSurahMode && selectedAyahs.size === 1 && (
            <button
              onClick={() => downloadAyah(Array.from(selectedAyahs)[0])}
              className="flex h-9 w-9 items-center justify-center rounded-full border bg-card"
              aria-label="تحميل"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setSelectedAyahs(new Set())}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="إلغاء"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Reciter sheet */}
      {showReciterSheet && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60"
          onClick={() => setShowReciterSheet(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border p-5"
            style={{
              background: "var(--card)",
              paddingBottom: "calc(1.25rem + 5rem + env(safe-area-inset-bottom))",
            }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <h3 className="mb-3 text-lg font-extrabold">اختر القارئ</h3>
            <div className="space-y-2">
              {reciters.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setReciter(r.id);
                    setShowReciterSheet(false);
                    stopPlay();
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition-all",
                    reciter === r.id && "ring-2"
                  )}
                  style={{
                    background: reciter === r.id ? "color-mix(in oklab, var(--gold) 12%, transparent)" : "transparent",
                    borderColor: reciter === r.id ? "var(--gold)" : "var(--border)",
                  }}
                >
                  <div className="text-2xl">{r.avatar}</div>
                  <div className="flex-1">
                    <p className="font-bold">{r.name}</p>
                  </div>
                  {reciter === r.id && <Check className="h-4 w-4" style={{ color: "var(--gold)" }} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tajweed legend modal */}
      {showLegend && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60"
          onClick={() => setShowLegend(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border p-5"
            style={{ background: "var(--card)", paddingBottom: "calc(1.25rem + 5rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <h3 className="mb-3 text-lg font-extrabold">مفتاح ألوان التجويد</h3>
            <div className="space-y-2">
              {tajweedLegend.map((l) => (
                <div key={l.label} className="flex items-center gap-3 rounded-xl border p-3">
                  <span className="h-5 w-5 rounded-full" style={{ background: l.color }} />
                  <span className="font-bold">{l.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              الألوان مطابقة لمصحف المدينة المنورة برواية حفص عن عاصم.
            </p>
          </div>
        </div>
      )}

      {/* Tafsir sheet */}
      {tafsirAyah !== null && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60"
          onClick={() => setTafsirAyah(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border"
            style={{ background: "var(--card)" }}
          >
            <div className="flex items-center justify-between border-b p-4" style={{ background: "var(--gradient-hero)" }}>
              <div className="flex items-center gap-2 text-primary-foreground">
                <BookOpen className="h-5 w-5" />
                <div>
                  <p className="text-base font-extrabold">تفسير الآية {tafsirAyah}</p>
                  <p className="text-[10px] opacity-80">سورة {meta.name}</p>
                </div>
              </div>
              <button
                onClick={() => setTafsirAyah(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-primary-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Edition tabs */}
            <div className="flex gap-2 overflow-x-auto border-b px-3 py-2 hide-scrollbar">
              {tafsirEditions.map((ed) => (
                <button
                  key={ed.id}
                  onClick={() => setTafsirEdition(ed.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                    tafsirEdition === ed.id ? "text-primary-foreground" : "bg-card"
                  )}
                  style={
                    tafsirEdition === ed.id
                      ? { background: "var(--gradient-primary)", borderColor: "transparent" }
                      : undefined
                  }
                >
                  {ed.shortName}
                </button>
              ))}
            </div>

            <div
              className="flex-1 overflow-y-auto p-5"
              style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            >
              {/* الآية */}
              {ayahs && (
                <div
                  className="mb-4 rounded-2xl border p-4 text-center font-quran leading-loose"
                  style={{ background: "color-mix(in oklab, var(--gold) 8%, transparent)", fontSize: 22, lineHeight: 2.2 }}
                >
                  {ayahs.find((a) => a.numberInSurah === tafsirAyah)?.text}
                  <span className="mx-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}>
                    {tafsirAyah}
                  </span>
                </div>
              )}

              {/* التفسير */}
              {tafsirLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="mr-2">جاري تحميل التفسير...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-muted-foreground">
                    {tafsirEditions.find((e) => e.id === tafsirEdition)?.name}
                  </p>
                  <p className="text-base leading-loose" style={{ lineHeight: 2 }}>
                    {tafsirData?.find((t) => t.numberInSurah === tafsirAyah)?.text || "التفسير غير متاح حالياً."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
