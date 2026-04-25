import { useEffect, useRef, useState, Fragment, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, RefreshCw, Sparkles, Play, Pause, Loader2, Rewind, FastForward, Gauge } from "lucide-react";
import type { Zikr } from "@/data/azkar";
import { azkarSectionAudio } from "@/data/azkar-audio";

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Renders text with [[N]] markers replaced by golden numbered circles.
function renderWithAyahNumbers(text: string): ReactNode {
  const parts = text.split(/(\[\[\d+\]\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[\[(\d+)\]\]$/);
    if (m) {
      return (
        <span
          key={i}
          className="mx-1 inline-flex h-7 w-7 items-center justify-center rounded-full border align-middle text-[11px] font-bold"
          style={{
            background: "var(--gradient-gold)",
            color: "var(--gold-foreground)",
            borderColor: "var(--gold)",
          }}
        >
          {m[1]}
        </span>
      );
    }
    return (
      <Fragment key={i}>
        {part.split("\n").map((line, j, arr) => (
          <Fragment key={j}>
            {line}
            {j < arr.length - 1 && <br />}
          </Fragment>
        ))}
      </Fragment>
    );
  });
}

export function ZikrCarousel({ items, title, sectionId }: { items: Zikr[]; title: string; sectionId: string }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    direction: "rtl",
    loop: false,
    align: "center",
  });
  const [selected, setSelected] = useState(0);
  const [counts, setCounts] = useState<number[]>(() => items.map((it) => it.count));

  // Section-level audio player (one mp3 covering the whole category)
  const audioInfo = azkarSectionAudio[sectionId];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    setCounts(items.map((it) => it.count));
    setSelected(0);
    emblaApi?.scrollTo(0);
  }, [items, emblaApi]);

  // Initialize audio element once per section
  useEffect(() => {
    if (!audioInfo) return;
    const a = new Audio(audioInfo.url);
    a.preload = "metadata";
    a.onended = () => setPlaying(false);
    a.onpause = () => setPlaying(false);
    a.onplay = () => setPlaying(true);
    a.onwaiting = () => setLoading(true);
    a.oncanplay = () => setLoading(false);
    a.onloadedmetadata = () => setDuration(a.duration || 0);
    a.ondurationchange = () => setDuration(a.duration || 0);
    a.ontimeupdate = () => {
      if (!seekingRef.current) setCurrentTime(a.currentTime);
    };
    a.onerror = () => {
      setAudioError("تعذّر تحميل الصوت — تحقق من الاتصال");
      setPlaying(false);
      setLoading(false);
    };
    audioRef.current = a;
    return () => {
      a.pause();
      a.src = "";
      audioRef.current = null;
      setPlaying(false);
      setLoading(false);
      setCurrentTime(0);
      setDuration(0);
    };
  }, [audioInfo]);

  // ref mirror for seeking flag (avoids stale closure inside ontimeupdate)
  const seekingRef = useRef(false);
  useEffect(() => { seekingRef.current = seeking; }, [seeking]);

  async function toggleSectionPlay() {
    if (!audioRef.current) return;
    setAudioError(null);
    if (playing) {
      audioRef.current.pause();
      return;
    }
    try {
      setLoading(true);
      await audioRef.current.play();
    } catch {
      setAudioError("تعذّر تشغيل الصوت");
      setLoading(false);
    }
  }

  function skip(delta: number) {
    const a = audioRef.current;
    if (!a) return;
    const next = Math.min(Math.max((a.currentTime || 0) + delta, 0), duration || a.duration || 0);
    a.currentTime = next;
    setCurrentTime(next);
  }

  function changeRate() {
    const rates = [1, 1.25, 1.5, 0.75];
    const idx = rates.indexOf(rate);
    const nr = rates[(idx + 1) % rates.length];
    setRate(nr);
    if (audioRef.current) audioRef.current.playbackRate = nr;
  }

  function onSeekChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setCurrentTime(v);
  }
  function onSeekCommit(e: React.SyntheticEvent<HTMLInputElement>) {
    const v = Number((e.target as HTMLInputElement).value);
    if (audioRef.current) audioRef.current.currentTime = v;
    setSeeking(false);
  }

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const dec = (idx: number) => {
    setCounts((c) => {
      const next = [...c];
      if (next[idx] > 0) next[idx] = next[idx] - 1;
      if (next[idx] === 0 && idx < items.length - 1) {
        setTimeout(() => emblaApi?.scrollNext(), 250);
      }
      return next;
    });
  };
  const reset = (idx: number) =>
    setCounts((c) => {
      const next = [...c];
      next[idx] = items[idx].count;
      return next;
    });

  return (
    <div className="flex h-full flex-col">
      {/* Progress + section audio */}
      <div className="px-5 pt-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-bold text-foreground">{title}</span>
          <span>
            {selected + 1} / {items.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${((selected + 1) / items.length) * 100}%`,
              background: "var(--gradient-gold)",
            }}
          />
        </div>

        {audioInfo && (
          <div
            className="mt-3 rounded-2xl border p-3"
            style={{
              background: "color-mix(in oklab, var(--gold) 8%, transparent)",
              borderColor: "color-mix(in oklab, var(--gold) 35%, transparent)",
            }}
          >
            {/* Title row */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-extrabold">{audioInfo.label}</p>
              <button
                onClick={changeRate}
                className="flex h-7 shrink-0 items-center gap-1 rounded-lg border bg-card px-2 text-[10px] font-extrabold"
                aria-label="سرعة التشغيل"
              >
                <Gauge className="h-3 w-3" />
                {rate}x
              </button>
            </div>

            {/* Seek bar */}
            <div className="flex items-center gap-2">
              <span className="w-9 text-[10px] tabular-nums text-muted-foreground">{fmt(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(duration, 0.001)}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                onChange={onSeekChange}
                onPointerDown={() => setSeeking(true)}
                onPointerUp={onSeekCommit}
                onTouchStart={() => setSeeking(true)}
                onTouchEnd={onSeekCommit}
                onMouseDown={() => setSeeking(true)}
                onMouseUp={onSeekCommit}
                className="zikr-seek h-2 flex-1 cursor-pointer appearance-none rounded-full"
                style={{
                  background: `linear-gradient(to left, var(--gold) ${
                    duration ? (currentTime / duration) * 100 : 0
                  }%, color-mix(in oklab, var(--muted-foreground) 25%, transparent) ${
                    duration ? (currentTime / duration) * 100 : 0
                  }%)`,
                }}
              />
              <span className="w-9 text-[10px] tabular-nums text-muted-foreground">{fmt(duration)}</span>
            </div>

            {/* Controls */}
            <div className="mt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => skip(-5)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card active:scale-95"
                aria-label="رجوع 5 ثواني"
              >
                <Rewind className="h-4 w-4" />
              </button>
              <button
                onClick={toggleSectionPlay}
                disabled={loading}
                className="flex h-12 w-12 items-center justify-center rounded-2xl active:scale-95 disabled:opacity-60"
                style={{
                  background: "var(--gradient-gold)",
                  color: "var(--gold-foreground)",
                  boxShadow: "var(--shadow-gold)",
                }}
                aria-label={playing ? "إيقاف" : "تشغيل"}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : playing ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={() => skip(5)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card active:scale-95"
                aria-label="تقديم 5 ثواني"
              >
                <FastForward className="h-4 w-4" />
              </button>
            </div>

            {audioError && (
              <p className="mt-2 text-center text-[10px] text-destructive">{audioError}</p>
            )}
          </div>
        )}
      </div>

      {/* Embla viewport - full screen card per zikr */}
      <div className="flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {items.map((zikr, idx) => {
            const remaining = counts[idx];
            const done = remaining === 0;
            return (
              <div
                key={idx}
                className="relative flex h-full min-w-0 shrink-0 grow-0 basis-full px-4 py-4"
              >
                <div
                  className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl border p-5"
                  style={{
                    background: "var(--gradient-card)",
                    boxShadow: "var(--shadow-elegant)",
                    borderColor: done ? "var(--gold)" : "var(--border)",
                  }}
                >
                  <div className="pattern-islamic absolute inset-0 opacity-[0.07]" />

                  <div className="absolute right-3 top-3 text-2xl opacity-30" style={{ color: "var(--gold)" }}>﷽</div>

                  <div className="relative flex-1 overflow-y-auto pt-8 hide-scrollbar">
                    <p
                      className="font-quran text-center"
                      style={{
                        fontSize: zikr.text.length > 200 ? "1.05rem" : zikr.text.length > 100 ? "1.2rem" : "1.4rem",
                        lineHeight: 2.2,
                      }}
                    >
                      {renderWithAyahNumbers(zikr.text)}
                    </p>
                    {zikr.fadl && (
                      <div className="mt-5 flex items-start gap-2 rounded-2xl border p-3 text-xs" style={{ background: "color-mix(in oklab, var(--gold) 8%, transparent)", borderColor: "color-mix(in oklab, var(--gold) 30%, transparent)" }}>
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--gold)" }} />
                        <p className="leading-relaxed">{zikr.fadl}</p>
                      </div>
                    )}
                  </div>

                  {/* Counter buttons */}
                  <div className="relative mt-4 flex items-center justify-between gap-2">
                    <button
                      onClick={() => reset(idx)}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-muted-foreground transition-all hover:bg-muted active:scale-95"
                      aria-label="إعادة"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => dec(idx)}
                      disabled={done}
                      className="flex flex-1 items-center justify-center gap-3 rounded-2xl py-4 text-base font-extrabold transition-all active:scale-[0.98] disabled:opacity-60"
                      style={{
                        background: done ? "var(--gradient-gold)" : "var(--gradient-primary)",
                        color: done ? "var(--gold-foreground)" : "var(--primary-foreground)",
                        boxShadow: done ? "var(--shadow-gold)" : "var(--shadow-elegant)",
                      }}
                    >
                      {done ? "✓ تم بحمد الله" : `متبقّي ${remaining}`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side nav */}
      <div className="flex items-center justify-between px-5 pb-2">
        <button
          onClick={() => emblaApi?.scrollPrev()}
          disabled={selected === 0}
          className="flex h-10 items-center gap-1 rounded-full border bg-card px-4 text-xs font-bold disabled:opacity-40"
        >
          السابق
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => emblaApi?.scrollNext()}
          disabled={selected === items.length - 1}
          className="flex h-10 items-center gap-1 rounded-full border bg-card px-4 text-xs font-bold disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          التالي
        </button>
      </div>
    </div>
  );
}
