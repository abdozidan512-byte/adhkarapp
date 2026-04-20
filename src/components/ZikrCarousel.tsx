import { useEffect, useState, Fragment, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, RefreshCw, Sparkles } from "lucide-react";
import type { Zikr } from "@/data/azkar";

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
    // Preserve newlines
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

export function ZikrCarousel({ items, title }: { items: Zikr[]; title: string }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    direction: "rtl",
    loop: false,
    align: "center",
  });
  const [selected, setSelected] = useState(0);
  const [counts, setCounts] = useState<number[]>(() => items.map((it) => it.count));

  useEffect(() => {
    setCounts(items.map((it) => it.count));
    setSelected(0);
    emblaApi?.scrollTo(0);
  }, [items, emblaApi]);

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
      // auto advance when finished
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
      {/* Progress */}
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

                  {/* corner ornaments */}
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

                  {/* Counter button */}
                  <div className="relative mt-4 flex items-center justify-between gap-3">
                    <button
                      onClick={() => reset(idx)}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl border text-muted-foreground transition-all hover:bg-muted active:scale-95"
                      aria-label="إعادة"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => dec(idx)}
                      disabled={done}
                      className="flex flex-1 items-center justify-center gap-3 rounded-2xl py-4 text-lg font-extrabold transition-all active:scale-[0.98] disabled:opacity-60"
                      style={{
                        background: done ? "var(--gradient-gold)" : "var(--gradient-primary)",
                        color: done ? "var(--gold-foreground)" : "var(--primary-foreground)",
                        boxShadow: done ? "var(--shadow-gold)" : "var(--shadow-elegant)",
                      }}
                    >
                      {done ? "✓ تم بحمد الله" : `اضغط - متبقّي ${remaining}`}
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
