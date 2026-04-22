import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronRight, ZoomIn, ZoomOut, Play, Pause, Download, Check, Loader2, Volume2 } from "lucide-react";
import { surahs, reciters, type ReciterId } from "@/data/surahs";
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

const PAGE_SIZE = 5; // ayahs per swipe page

function SurahReader() {
  const meta = Route.useLoaderData();
  const search = Route.useSearch();
  const [ayahs, setAyahs] = useState<{ numberInSurah: number; text: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(28);
  const [reciter, setReciter] = useState<ReciterId>("ar.yasser");
  const [playing, setPlaying] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<{ ayah: number | "all"; pct: number } | null>(null);
  const [cachedKeys, setCachedKeys] = useState<Set<string>>(new Set());
  const [selectedAyahs, setSelectedAyahs] = useState<Set<number>>(new Set());
  const [showReciterSheet, setShowReciterSheet] = useState(false);

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

  const pages = ayahs
    ? Array.from({ length: Math.ceil(ayahs.length / PAGE_SIZE) }, (_, i) =>
        ayahs.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE)
      )
    : [];

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

  return (
    <div className="flex h-[100dvh] flex-col" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
      {/* Top bar */}
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
            صفحة {page + 1} / {pages.length} • {meta.numberOfAyahs} آية
          </p>
        </div>
        <div className="flex gap-1">
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

      {/* Reciter selector */}
      <div className="flex items-center gap-2 border-b px-3 py-2 text-xs">
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
            {selectedAyahs.size > 0 ? `تشغيل المحدد (${selectedAyahs.size})` : "تلاوة كاملة"}
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

      {/* Ayah pages — horizontal carousel */}
      <div className="flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {pages.map((pg, idx) => (
            <div key={idx} className="h-full min-w-0 shrink-0 grow-0 basis-full px-3 py-3">
              <div
                className="relative h-full overflow-y-auto rounded-3xl border p-5 hide-scrollbar"
                style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-soft)" }}
              >
                <div className="pattern-islamic absolute inset-0 opacity-[0.05]" />
                <div className="relative">
                  {idx === 0 && showBismillah && (
                    <p
                      className="font-quran mb-6 text-center"
                      style={{ fontSize: fontSize * 1.1, color: "var(--gold)" }}
                    >
                      بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                    </p>
                  )}
                  <div className="font-quran text-justify leading-loose" style={{ fontSize, lineHeight: 2.4 }}>
                    {pg.map((a) => {
                      const selected = selectedAyahs.has(a.numberInSurah);
                      const isPlaying = playing === a.numberInSurah;
                      const cached = isCached(a.numberInSurah);
                      return (
                        <span key={a.numberInSurah}>
                          <span
                            onClick={() => toggleSelect(a.numberInSurah)}
                            className={cn(
                              "cursor-pointer rounded-md px-0.5 transition-colors",
                              isPlaying && "bg-[color-mix(in_oklab,var(--gold)_25%,transparent)]",
                              selected && !isPlaying && "bg-[color-mix(in_oklab,var(--primary)_15%,transparent)]"
                            )}
                          >
                            {a.text}
                          </span>{" "}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isPlaying) stopPlay();
                              else playAyah(a.numberInSurah);
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border align-middle text-[11px] font-bold transition-all hover:scale-110"
                            style={{
                              background: "var(--gradient-gold)",
                              color: "var(--gold-foreground)",
                              borderColor: "var(--gold)",
                            }}
                            aria-label={`آية ${a.numberInSurah}`}
                          >
                            {a.numberInSurah}
                          </button>{" "}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadAyah(a.numberInSurah);
                            }}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-primary"
                            aria-label="تحميل الآية"
                          >
                            {downloading?.ayah === a.numberInSurah ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : cached ? (
                              <Check className="h-3 w-3" style={{ color: "var(--gold)" }} />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                          </button>{" "}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Page indicators */}
      <div className="flex justify-center gap-1 px-4 py-2">
        {pages.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={cn("h-1.5 rounded-full transition-all", i === page ? "w-6 bg-primary" : "w-1.5 bg-muted")}
          />
        ))}
      </div>

      {/* Reciter sheet */}
      {showReciterSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setShowReciterSheet(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border p-5"
            style={{ background: "var(--card)" }}
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
    </div>
  );
}
