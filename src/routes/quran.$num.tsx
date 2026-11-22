import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronRight, Play, Pause, Download, Check, Loader2, Volume2, Palette, Info, BookOpen, X } from "lucide-react";
import { surahs, reciters, type ReciterId } from "@/data/surahs";
import { tajweedLegend } from "@/lib/tajweed";
import { fetchSurahTafsir, tafsirEditions, type TafsirAyah } from "@/lib/tafsir";
import {
  fetchSurahText,
  getAyahAudioUrl,
  getAyahAudioBlob,
  getReciter,
  getFullSurahAudioUrl,
  getFullSurahBlob,
  downloadFullSurah,
} from "@/lib/quran-api";
import { saveReadingProgress } from "@/lib/db";
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

type QuranAyah = { numberInSurah: number; text: string; page?: number; juz?: number };
type QuranPage = { ayahs: QuranAyah[]; mushafPage: number };

const TAJWEED_MARK_RE = /\[[a-z](?::\d+)?\[([^\]]*)\]/g;

function stripTajweedMarks(text: string) {
  return text.replace(TAJWEED_MARK_RE, "$1").replace(/\]/g, "");
}

function getMushafPageImageUrl(page: number, tajweed: boolean) {
  const collection = tajweed ? "ayat/tajweed" : "kfgqpc/hafs-wasat";
  const extension = tajweed ? "png" : "jpg";
  return `https://raw.githubusercontent.com/QuranHub/quran-pages-images/main/${collection}/${page}.${extension}`;
}

function SurahReader() {
  const meta = Route.useLoaderData();
  const search = Route.useSearch();
  const [ayahs, setAyahs] = useState<QuranAyah[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reciter, setReciter] = useState<ReciterId>("ar.yasser");
  const [playing, setPlaying] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<{ ayah: number | "all"; pct: number } | null>(null);
  const [showReciterSheet, setShowReciterSheet] = useState(false);
  const [tajweedMode, setTajweedMode] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [showReaderActions, setShowReaderActions] = useState(false);
  const [pageImageLoaded, setPageImageLoaded] = useState(false);
  const [pageImageError, setPageImageError] = useState(false);
  const [imageRetry, setImageRetry] = useState(0);
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

  // Reset the tafsir cache when changing surahs.
  useEffect(() => {
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

  // Build pages from standard Madani Mushaf page numbers returned with each ayah.
  // Stable page boundaries prevent short, arbitrary pages caused by viewport measurements.
  const pages = useMemo<QuranPage[]>(() => {
    if (!ayahs) return [];
    const grouped: QuranPage[] = [];

    for (const ayah of ayahs) {
      const fallbackPage = Math.floor((ayah.numberInSurah - 1) / 8) + 1;
      const mushafPage = ayah.page ?? fallbackPage;
      const current = grouped[grouped.length - 1];
      if (current?.mushafPage === mushafPage) {
        current.ayahs.push(ayah);
      } else {
        grouped.push({ mushafPage, ayahs: [ayah] });
      }
    }

    return grouped;
  }, [ayahs]);

  useEffect(() => {
    setPageImageLoaded(false);
    setPageImageError(false);
    for (const adjacent of [pages[page - 1]?.mushafPage, pages[page + 1]?.mushafPage]) {
      if (adjacent) {
        const image = new Image();
        image.src = getMushafPageImageUrl(adjacent, tajweedMode);
      }
    }
  }, [pages, page, tajweedMode, imageRetry]);

  // Re-init the page carousel whenever the surah page list changes
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit();
  }, [emblaApi, pages.length]);

  // Jump to ?page= once carousel & ayahs are ready
  useEffect(() => {
    if (!emblaApi || !ayahs || search.page === undefined) return;
    const target = Math.max(0, Math.min(pages.length - 1, search.page));
    emblaApi.scrollTo(target, true);
  }, [emblaApi, ayahs, search.page, pages.length]);

  // Persist reading progress whenever the page changes
  useEffect(() => {
    if (!ayahs || pages.length === 0) return;
    const currentPage = pages[page]?.ayahs;
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

  function playCurrentPage() {
    if (isSurahMode) {
      playFullSurahFile();
      return;
    }
    const list = (pages[page]?.ayahs ?? []).map((a) => a.numberInSurah);
    const first = list.shift();
    if (first === undefined) return;
    playQueueRef.current = list;
    playAyah(first);
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
    }
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

  const currentMushafPage = pages[page]?.mushafPage;
  const currentJuz = pages[page]?.ayahs[0]?.juz;

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "var(--mushaf-paper)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Reader controls stay visible while reading. */}
      <div className="shrink-0">
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
              {currentMushafPage ? <>صفحة المصحف <bdi dir="ltr">{currentMushafPage}</bdi> • </> : ""}
              <bdi dir="ltr">{page + 1} / {pages.length}</bdi>
            </p>
          </div>
          <div className="flex items-center gap-1">
          <button onClick={() => emblaApi?.scrollPrev()} disabled={page === 0} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-primary-foreground disabled:opacity-40" aria-label="الصفحة السابقة">
            <ChevronRight className="h-5 w-5" />
          </button>
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
          <button onClick={() => emblaApi?.scrollNext()} disabled={page === pages.length - 1} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-primary-foreground disabled:opacity-40" aria-label="الصفحة التالية">
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
        </div>
        </div>

        {/* Tajweed legend bar */}
        {tajweedMode && (
          <div className="flex items-center gap-3 overflow-x-auto border-b px-3 py-2 hide-scrollbar" style={{ background: "color-mix(in oklab, var(--gold) 6%, var(--card))" }}>
            <button onClick={() => setShowLegend(true)} className="flex shrink-0 items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-[11px] font-bold">
              <Info className="h-3.5 w-3.5" /> مفتاح الألوان
            </button>
            {tajweedLegend.map((l) => (
              <div key={l.label} className="flex shrink-0 items-center gap-1.5 text-[11px]">
                <span className="h-3 w-3 rounded-full" style={{ background: l.color }} />
                <span className="text-muted-foreground">{l.label}</span>
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
              onClick={playFullSurah}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
            >
              <Play className="h-3.5 w-3.5" /> تلاوة
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

      {/* Fixed Mushaf page images keep every line, verse marker, and margin in its canonical position. */}
      <div className="relative min-h-0 flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {pages.map((pg, idx) => (
            <div key={pg.mushafPage} className="h-full min-w-0 shrink-0 grow-0 basis-full">
              <div className="relative flex h-full w-full items-center justify-center px-1 py-2">
                {idx === page && !pageImageLoaded && !pageImageError && (
                  <Loader2 className="absolute h-8 w-8 animate-spin text-muted-foreground" aria-label="جارٍ تحميل صفحة المصحف" />
                )}
                {idx === page && pageImageError ? (
                  <div className="mx-6 rounded-2xl border bg-card p-5 text-center text-sm shadow-lg">
                    <p className="font-bold">تعذّر تحميل صورة الصفحة</p>
                    <p className="mt-2 text-xs text-muted-foreground">تحقق من اتصال الإنترنت ثم أعد المحاولة.</p>
                    <button onClick={() => setImageRetry((value) => value + 1)} className="mt-4 rounded-full px-4 py-2 text-xs font-bold text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>إعادة المحاولة</button>
                  </div>
                ) : Math.abs(idx - page) <= 1 ? (
                  <img
                    key={`${pg.mushafPage}-${tajweedMode}-${idx === page ? imageRetry : 0}`}
                    src={getMushafPageImageUrl(pg.mushafPage, tajweedMode)}
                    alt={`صفحة المصحف ${pg.mushafPage} من سورة ${meta.name}`}
                    className="h-full w-full select-none object-contain"
                    draggable={false}
                    loading={idx === page ? "eager" : "lazy"}
                    decoding="async"
                    onLoad={() => idx === page && setPageImageLoaded(true)}
                    onError={() => idx === page && setPageImageError(true)}
                  />
                ) : null}
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

      {/* Reader actions remain one tap away, while page and audio controls stay visible. */}
      <div className="absolute bottom-[4.75rem] left-4 z-[70]">
        {showReaderActions && (
          <div className="mb-3 grid w-52 gap-1.5 rounded-2xl border p-2 shadow-2xl" style={{ background: "var(--card)", borderColor: "var(--gold)" }}>
            <button onClick={() => { playCurrentPage(); setShowReaderActions(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold"><Play className="h-4 w-4" /> تلاوة الصفحة</button>
            <button onClick={() => { playFullSurah(); setShowReaderActions(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold"><BookOpen className="h-4 w-4" /> تلاوة السورة</button>
            <button onClick={() => { setShowReciterSheet(true); setShowReaderActions(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold"><Volume2 className="h-4 w-4" /> اختيار القارئ</button>
            <button onClick={() => { setShowLegend(true); setShowReaderActions(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold"><Palette className="h-4 w-4" /> مفتاح التجويد</button>
            <button onClick={() => { setTafsirAyah(pages[page]?.ayahs[0]?.numberInSurah ?? null); setShowReaderActions(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold"><BookOpen className="h-4 w-4" /> تفسير أول آية بالصفحة</button>
            <button onClick={() => { void downloadAll(); setShowReaderActions(false); }} disabled={downloading !== null} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold disabled:opacity-50"><Download className="h-4 w-4" /> تحميل السورة</button>
          </div>
        )}
        <button onClick={() => setShowReaderActions((open) => !open)} className="flex h-14 w-14 items-center justify-center rounded-full shadow-xl" style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }} aria-label="أدوات القراءة">
          {showReaderActions ? <X className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
        </button>
      </div>

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
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              الألوان مطابقة لمصحف المدينة المنورة برواية حفص عن عاصم. صور الصفحات من مشروع <a className="underline" href="https://github.com/QuranHub/quran-pages-images" target="_blank" rel="noreferrer">QuranHub/quran-pages-images</a>.
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


