import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronRight, Play, Pause, Download, Check, Loader2, Volume2, Palette, Info, BookOpen, X, ListChecks, Repeat2 } from "lucide-react";
import { surahs, reciters, type ReciterId } from "@/data/surahs";
import { tajweedLegend } from "@/lib/tajweed";
import { fetchSurahTafsir, tafsirEditions, type TafsirAyah } from "@/lib/tafsir";
import {
  fetchSurahText,
  getAyahAudioUrl,
  downloadAyahAudio,
  getAyahAudioBlob,
  audioKey,
  getFullSurahAudioUrl,
  getFullSurahBlob,
  getMushafPageImageUrl,
  downloadMushafPage,
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

type QuranAyah = { numberInSurah: number; text: string; page?: number; juz?: number };
type QuranPage = { ayahs: QuranAyah[]; mushafPage: number };

function SurahReader() {
  const meta = Route.useLoaderData();
  const search = Route.useSearch();
  const [ayahs, setAyahs] = useState<QuranAyah[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reciter, setReciter] = useState<ReciterId>("ar.yasser");
  const [playing, setPlaying] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<{ ayah: number | "all"; pct: number } | null>(null);
  const [showReciterSheet, setShowReciterSheet] = useState(false);
  const [tajweedMode, setTajweedMode] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showReaderActions, setShowReaderActions] = useState(false);
  const [pageImageLoaded, setPageImageLoaded] = useState(false);
  const [pageImageError, setPageImageError] = useState(false);
  const [pageImageSrc, setPageImageSrc] = useState("");
  const [imageRetry, setImageRetry] = useState(0);
  const [showAyahSelection, setShowAyahSelection] = useState(false);
  const [selectedAyahs, setSelectedAyahs] = useState<number[]>([]);
  const [repeatSelectedAyahs, setRepeatSelectedAyahs] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [tafsirSelection, setTafsirSelection] = useState(false);
  const [tafsirAyah, setTafsirAyah] = useState<number | null>(null);
  const [tafsirEdition, setTafsirEdition] = useState<string>("ar.muyassar");
  const [tafsirData, setTafsirData] = useState<TafsirAyah[] | null>(null);
  const [tafsirLoading, setTafsirLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const audioFallbackRef = useRef<WeakSet<HTMLAudioElement>>(new WeakSet());
  const cachedAudioKeysRef = useRef<Set<string>>(new Set());
  const playQueueRef = useRef<number[]>([]);
  const selectedAyahsRef = useRef<number[]>([]);
  const repeatSelectedRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const handledLongPressRef = useRef(false);

  useEffect(() => {
    selectedAyahsRef.current = selectedAyahs;
  }, [selectedAyahs]);

  useEffect(() => {
    repeatSelectedRef.current = repeatSelectedAyahs;
  }, [repeatSelectedAyahs]);

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

  // Clear page-scoped selections when opening another surah.
  useEffect(() => {
    setSelectedAyahs([]);
    setRepeatSelectedAyahs(false);
    setShowAyahSelection(false);
    setTafsirAyah(null);
    setTafsirSelection(false);
    setTafsirData(null);
    setAudioError(null);
    playQueueRef.current = [];
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


  useEffect(() => {
    let active = true;
    getCachedAudioKeys().then((keys) => {
      if (active) cachedAudioKeysRef.current = keys;
    });
    return () => {
      active = false;
    };
  }, [reciter, meta.number]);

  // Stop audio and release local media URLs when leaving the reader.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
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
    const mushafPage = pages[page]?.mushafPage;
    if (!mushafPage) return;
    let active = true;
    let objectUrl: string | null = null;
    const mode = tajweedMode ? "tajweed" : "clear";
    setPageImageLoaded(false);
    setPageImageError(false);
    setPageImageSrc("");

    downloadMushafPage(mushafPage, mode)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPageImageSrc(objectUrl);
      })
      .catch(() => {
        if (active) setPageImageError(true);
      });

    for (const adjacent of [pages[page - 1]?.mushafPage, pages[page + 1]?.mushafPage]) {
      if (adjacent) {
        const image = new Image();
        image.src = getMushafPageImageUrl(adjacent, mode);
      }
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
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

  function clearAudioObjectUrl() {
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
  }

  function stopCurrentAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
    clearAudioObjectUrl();
  }

  async function fallBackToCachedAudio(audio: HTMLAudioElement, ayah?: number) {
    if (audioRef.current !== audio || audio.src.startsWith("blob:") || audioFallbackRef.current.has(audio)) return;
    audioFallbackRef.current.add(audio);
    let blob = ayah === undefined
      ? await getFullSurahBlob(reciter, meta.number)
      : await getAyahAudioBlob(reciter, meta.number, ayah);

    // Some Android WebViews fail to stream remote MP3s directly. Download the
    // requested track once and retry from a local Blob URL.
    if (!blob && navigator.onLine) {
      try {
        blob = ayah === undefined
          ? await downloadFullSurah(reciter, meta.number)
          : await downloadAyahAudio(reciter, meta.number, ayah);
        cachedAudioKeysRef.current.add(audioKey(reciter, meta.number, ayah));
      } catch (downloadError) {
        console.error("Audio fallback download failed", downloadError);
      }
    }

    if (audioRef.current !== audio) return;
    if (!blob) {
      // If the combined surah stream is unavailable, fall back to the
      // reciter's ayah files when they are available.
      const firstAyah = ayahs?.[0]?.numberInSurah;
      if (ayah === undefined && firstAyah !== undefined && getAyahAudioUrl(reciter, meta.number, firstAyah)) {
        playQueueRef.current = ayahs!.slice(1).map((item) => item.numberInSurah);
        playAyah(firstAyah);
        return;
      }
      const code = audio.error?.code;
      setAudioError(code
        ? `تعذّر تشغيل التلاوة (رمز المشغّل ${code}). أعد المحاولة أو نزّل السورة أولًا.`
        : "تعذّر تشغيل التلاوة. تحقق من الاتصال أو نزّل السورة للاستماع دون إنترنت.");
      setPlaying(null);
      playQueueRef.current = [];
      return;
    }
    clearAudioObjectUrl();
    const localUrl = URL.createObjectURL(blob);
    audioObjectUrlRef.current = localUrl;
    audio.src = localUrl;
    audio.load();
    audio.play().catch((playError) => {
      console.error("Cached audio playback failed", playError);
      setAudioError("حُفظ ملف التلاوة لكن تعذّر تشغيله على هذا الجهاز.");
      setPlaying(null);
    });
  }

  function playAyah(ayah: number, existingAudio?: HTMLAudioElement) {
    const src = getAyahAudioUrl(reciter, meta.number, ayah);
    if (!src) {
      setAudioError("لا تتوفر تلاوة آية بآية لهذا القارئ؛ شغّل السورة كاملة.");
      playQueueRef.current = [];
      playFullSurahFile();
      return;
    }

    const audio = existingAudio ?? new Audio();
    if (existingAudio) {
      audio.pause();
      clearAudioObjectUrl();
      audioFallbackRef.current = new WeakSet();
    } else {
      stopCurrentAudio();
    }

    setAudioError(null);
    setPlaying(ayah);
    audio.preload = "auto";
    // Do not set crossOrigin here: several recitation hosts do not send CORS
    // headers, and media playback itself does not need cross-origin access.
    audio.removeAttribute("crossorigin");
    audio.src = src;
    audio.load();
    audioRef.current = audio;
    audio.onended = () => {
      clearAudioObjectUrl();
      const next = playQueueRef.current.shift();
      if (next !== undefined) {
        playAyah(next, audio);
      } else if (repeatSelectedRef.current && selectedAyahsRef.current.length) {
        playQueueRef.current = selectedAyahsRef.current.slice(1);
        playAyah(selectedAyahsRef.current[0], audio);
      } else {
        audioRef.current = null;
        setPlaying(null);
      }
    };
    audio.onerror = () => void fallBackToCachedAudio(audio, ayah);
    // Keep one media element for the whole queue; Android WebView can reject
    // a new Audio instance created later from an ended event.
    audio.play().catch((playError) => {
      console.error("Ayah playback failed", playError);
      void fallBackToCachedAudio(audio, ayah);
    });
  }

  function playFullSurahFile() {
    const src = getFullSurahAudioUrl(reciter, meta.number);
    if (!src) {
      setAudioError("لا يوجد رابط تلاوة لهذه السورة.");
      setPlaying(null);
      return;
    }
    stopCurrentAudio();
    setAudioError(null);
    setPlaying(-1);
    const audio = new Audio(src);
    audio.preload = "auto";
    // Avoid CORS mode for remote media servers that do not expose CORS headers.
    audio.removeAttribute("crossorigin");
    audioRef.current = audio;
    audio.onended = () => {
      clearAudioObjectUrl();
      audioRef.current = null;
      setPlaying(null);
    };
    audio.onerror = () => void fallBackToCachedAudio(audio);
    audio.play().catch((playError) => {
      console.error("Full surah playback failed", playError);
      void fallBackToCachedAudio(audio);
    });
  }

  function stopPlay() {
    stopCurrentAudio();
    playQueueRef.current = [];
    setPlaying(null);
  }

  function playFullSurah() {
    // Prefer one continuous audio file for a full-surah request. If that
    // stream fails, fallBackToCachedAudio tries a local copy and then ayah files.
    playQueueRef.current = [];
    playFullSurahFile();
  }

  function playCurrentPage() {
    const selectedReciter = reciters.find((item) => item.id === reciter);
    const list = (pages[page]?.ayahs ?? []).map((a) => a.numberInSurah);
    if (selectedReciter?.mode !== "surah" && list.length && getAyahAudioUrl(reciter, meta.number, list[0])) {
      const first = list.shift()!;
      playQueueRef.current = list;
      playAyah(first);
      return;
    }
    playFullSurahFile();
  }

  function toggleSelectedAyah(ayahNumber: number) {
    setSelectedAyahs((current) => current.includes(ayahNumber)
      ? current.filter((number) => number !== ayahNumber)
      : [...current, ayahNumber].sort((a, b) => a - b));
  }

  function startAyahLongPress(ayahNumber: number) {
    handledLongPressRef.current = false;
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      handledLongPressRef.current = true;
      toggleSelectedAyah(ayahNumber);
      if ("vibrate" in navigator) navigator.vibrate?.(24);
    }, 420);
  }

  function endAyahLongPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function selectAyahFromRow(ayahNumber: number) {
    endAyahLongPress();
    if (handledLongPressRef.current) {
      handledLongPressRef.current = false;
      return;
    }
    toggleSelectedAyah(ayahNumber);
  }

  function playSelectedAyahs() {
    if (!selectedAyahs.length) return;
    if (!getAyahAudioUrl(reciter, meta.number, selectedAyahs[0])) {
      setAudioError("التلاوة المحددة غير متاحة آية بآية لهذا القارئ. اختر قارئًا آخر لتكرار الآيات المحددة.");
      return;
    }
    playQueueRef.current = selectedAyahs.slice(1);
    playAyah(selectedAyahs[0]);
  }

  function openSelectedTafsir() {
    if (!selectedAyahs.length) return;
    setTafsirSelection(true);
    setTafsirAyah(selectedAyahs[0]);
    setShowAyahSelection(false);
  }

  async function downloadAll() {
    if (!ayahs) return;
    setDownloading({ ayah: "all", pct: 0 });
    try {
      if (getFullSurahAudioUrl(reciter, meta.number)) {
        await downloadFullSurah(reciter, meta.number, (pct) => setDownloading({ ayah: "all", pct }));
        cachedAudioKeysRef.current.add(audioKey(reciter, meta.number));
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

  const currentMushafPage = pages[page]?.mushafPage;

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "var(--mushaf-paper)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Reciter quick bar moved to the top of the reading area. */}
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs" style={{ background: "color-mix(in oklab, var(--mushaf-paper) 80%, var(--card))" }}>
          <Link to="/quran" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card" aria-label="العودة لقائمة السور">
            <ChevronRight className="h-4 w-4" />
          </Link>
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
            onClick={() => setShowAyahSelection(true)}
            className="flex h-8 items-center justify-center gap-1 rounded-full border bg-card px-2 text-[10px] font-bold"
            aria-label="تحديد آيات الصفحة"
          >
            <ListChecks className="h-3.5 w-3.5" /> آيات
          </button>
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
          <button onClick={() => setShowReaderActions((open) => !open)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card" aria-label="أدوات القراءة" aria-expanded={showReaderActions}>
            <BookOpen className="h-4 w-4" />
          </button>
        </div>
      </div>
      {audioError && <div role="alert" className="relative z-30 mx-3 mt-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">{audioError}</div>}

      {/* The Mushaf page stays in its own reading area between the controls and footer. */}
      <div className="relative min-h-0 flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full w-full">
          {pages.map((pg, idx) => (
            <div key={pg.mushafPage} className="h-full min-w-0 shrink-0 grow-0 basis-full">
              <div className="relative flex h-full w-full items-center justify-center p-0">
                {idx === page && !pageImageLoaded && !pageImageError && (
                  <Loader2 className="absolute h-8 w-8 animate-spin text-muted-foreground" aria-label="جارٍ تحميل صفحة المصحف" />
                )}
                {idx === page && pageImageError ? (
                  <div className="mx-6 rounded-2xl border bg-card p-5 text-center text-sm shadow-lg">
                    <p className="font-bold">تعذّر تحميل صورة الصفحة</p>
                    <p className="mt-2 text-xs text-muted-foreground">الصفحة غير محفوظة بعد. اتصل بالإنترنت لتنزيلها أو نزّل المصحف من صفحة السور.</p>
                    <button onClick={() => setImageRetry((value) => value + 1)} className="mt-4 rounded-full px-4 py-2 text-xs font-bold text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>إعادة المحاولة</button>
                  </div>
                ) : Math.abs(idx - page) <= 1 && (idx !== page || !!pageImageSrc) ? (
                  <img
                    key={`${pg.mushafPage}-${tajweedMode}-${idx === page ? imageRetry : 0}`}
                    src={idx === page ? pageImageSrc : getMushafPageImageUrl(pg.mushafPage, tajweedMode ? "tajweed" : "clear")}
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

      {/* Additional reading tools, opened from the compact top toolbar. */}
      {showReaderActions && (
        <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+3.5rem)] z-[70]">
          <div className="grid w-56 gap-1.5 rounded-2xl border p-2 shadow-2xl" style={{ background: "var(--card)", borderColor: "var(--gold)" }}>
            <button onClick={() => { playCurrentPage(); setShowReaderActions(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold"><Play className="h-4 w-4" /> تلاوة الصفحة</button>
            <button onClick={() => { playFullSurah(); setShowReaderActions(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold"><BookOpen className="h-4 w-4" /> تلاوة السورة</button>
            <button onClick={() => { setShowReciterSheet(true); setShowReaderActions(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold"><Volume2 className="h-4 w-4" /> اختيار القارئ</button>
            <button onClick={() => { setShowLegend(true); setShowReaderActions(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold"><Palette className="h-4 w-4" /> مفتاح ألوان التجويد</button>
            <button onClick={() => { setTafsirSelection(false); setTafsirAyah(pages[page]?.ayahs[0]?.numberInSurah ?? null); setShowReaderActions(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold"><BookOpen className="h-4 w-4" /> تفسير أول آية بالصفحة</button>
            <button onClick={() => { setShowAyahSelection(true); setShowReaderActions(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold"><ListChecks className="h-4 w-4" /> تحديد عدة آيات</button>
            <button onClick={() => { void downloadAll(); setShowReaderActions(false); }} disabled={downloading !== null} className="flex items-center gap-2 rounded-xl px-3 py-2 text-right text-sm font-bold disabled:opacity-50"><Download className="h-4 w-4" /> تحميل السورة</button>
          </div>
        </div>
      )}
      {/* Floating control now toggles tajweed directly. */}
      <div className="absolute bottom-6 left-4 z-[70]">
        <button
          onClick={() => setTajweedMode((value) => !value)}
          aria-pressed={tajweedMode}
          aria-label={tajweedMode ? "إيقاف ألوان التجويد" : "تفعيل ألوان التجويد"}
          className="flex h-14 w-14 items-center justify-center rounded-full shadow-xl"
          style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}
        >
          <Palette className="h-6 w-6" />
        </button>
      </div>

      {selectedAyahs.length > 0 && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-[85] flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 rounded-2xl border px-2 py-2 shadow-2xl" style={{ background: "var(--card)", borderColor: "var(--gold)" }}>
          <span className="whitespace-nowrap px-2 text-xs font-extrabold">{selectedAyahs.length} آية</span>
          <button onClick={playSelectedAyahs} className="flex items-center gap-1 rounded-xl px-2 py-2 text-xs font-bold text-primary-foreground" style={{ background: "var(--gradient-primary)" }}><Play className="h-3.5 w-3.5" /> تلاوة</button>
          <button onClick={() => setRepeatSelectedAyahs((value) => !value)} aria-pressed={repeatSelectedAyahs} className="flex items-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold" style={repeatSelectedAyahs ? { background: "var(--gradient-gold)", color: "var(--gold-foreground)" } : undefined}><Repeat2 className="h-3.5 w-3.5" /> تكرار</button>
          <button onClick={openSelectedTafsir} className="flex items-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold"><BookOpen className="h-3.5 w-3.5" /> تفسير</button>
          <button onClick={() => { setSelectedAyahs([]); setRepeatSelectedAyahs(false); }} aria-label="إلغاء التحديد" className="flex h-8 w-8 items-center justify-center rounded-xl"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Verse selection sheet */}
      {showAyahSelection && (
        <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/60" onClick={() => setShowAyahSelection(false)}>
          <div onClick={(event) => event.stopPropagation()} className="max-h-[82vh] w-full max-w-md overflow-y-auto rounded-t-3xl border p-4" style={{ background: "var(--card)", paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted" />
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-extrabold">آيات الصفحة {currentMushafPage}</h3>
                <p className="text-xs text-muted-foreground">اضغط مطولًا على الآية لتحديدها، ويمكنك اختيار عدة آيات.</p>
              </div>
              <button onClick={() => setShowAyahSelection(false)} className="flex h-9 w-9 items-center justify-center rounded-full border"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              {(pages[page]?.ayahs ?? []).map((ayah) => {
                const selected = selectedAyahs.includes(ayah.numberInSurah);
                return (
                  <button
                    key={ayah.numberInSurah}
                    onPointerDown={() => startAyahLongPress(ayah.numberInSurah)}
                    onPointerUp={endAyahLongPress}
                    onPointerCancel={endAyahLongPress}
                    onPointerLeave={endAyahLongPress}
                    onClick={() => selectAyahFromRow(ayah.numberInSurah)}
                    onContextMenu={(event) => event.preventDefault()}
                    className="flex w-full items-start gap-3 rounded-2xl border p-3 text-right select-none"
                    style={{ background: selected ? "color-mix(in oklab, var(--gold) 14%, transparent)" : "transparent", borderColor: selected ? "var(--gold)" : "var(--border)", touchAction: "manipulation" }}
                  >
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: selected ? "var(--gradient-gold)" : "color-mix(in oklab, var(--gold) 12%, transparent)", color: "var(--gold)" }}>{ayah.numberInSurah}</span>
                    <span className="font-quran text-lg leading-loose">{ayah.text}</span>
                    {selected && <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--gold)" }} />}
                  </button>
                );
              })}
            </div>
            {selectedAyahs.length > 0 && <p className="mt-3 text-center text-xs font-bold" style={{ color: "var(--gold)" }}>تم تحديد {selectedAyahs.length} آية — استخدم شريط الأدوات للتلاوة أو التكرار أو التفسير</p>}
          </div>
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
                    setAudioError(null);
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
          onClick={() => { setTafsirAyah(null); setTafsirSelection(false); }}
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
                  <p className="text-base font-extrabold">{tafsirSelection ? `تفسير ${selectedAyahs.length} آية محددة` : `تفسير الآية ${tafsirAyah}`}</p>
                  <p className="text-[10px] opacity-80">سورة {meta.name}</p>
                </div>
              </div>
              <button
                onClick={() => { setTafsirAyah(null); setTafsirSelection(false); }}
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
              {tafsirLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="mr-2">جاري تحميل التفسير...</span>
                </div>
              ) : tafsirSelection ? (
                <div className="space-y-4">
                  <p className="text-xs font-bold text-muted-foreground">{tafsirEditions.find((e) => e.id === tafsirEdition)?.name}</p>
                  {selectedAyahs.map((number) => (
                    <div key={number} className="rounded-2xl border p-4">
                      <div className="mb-3 rounded-xl p-3 text-center font-quran text-lg leading-loose" style={{ background: "color-mix(in oklab, var(--gold) 8%, transparent)" }}>
                        {ayahs?.find((a) => a.numberInSurah === number)?.text}
                        <span className="mx-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}>{number}</span>
                      </div>
                      <p className="text-base leading-loose" style={{ lineHeight: 2 }}>{tafsirData?.find((t) => t.numberInSurah === number)?.text || "التفسير غير متاح حالياً."}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {ayahs && (
                    <div className="rounded-2xl border p-4 text-center font-quran leading-loose" style={{ background: "color-mix(in oklab, var(--gold) 8%, transparent)", fontSize: 22, lineHeight: 2.2 }}>
                      {ayahs.find((a) => a.numberInSurah === tafsirAyah)?.text}
                      <span className="mx-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}>{tafsirAyah}</span>
                    </div>
                  )}
                  <p className="text-xs font-bold text-muted-foreground">{tafsirEditions.find((e) => e.id === tafsirEdition)?.name}</p>
                  <p className="text-base leading-loose" style={{ lineHeight: 2 }}>{tafsirData?.find((t) => t.numberInSurah === tafsirAyah)?.text || "التفسير غير متاح حالياً."}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


