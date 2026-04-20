import { useEffect, useState } from "react";
import { Sun, Sunrise, Sunset, Moon, CloudMoon, Sparkles, Clock } from "lucide-react";
import {
  computePrayerStatus,
  fetchPrayerTimes,
  formatDuration,
  formatTimeArabic,
  getUserCoords,
  prayerArabic,
  type PrayerName,
  type PrayerStatus,
} from "@/lib/prayer";

const icons: Record<PrayerName, any> = {
  Fajr: Sunrise,
  Sunrise: Sun,
  Dhuhr: Sun,
  Asr: Sunset,
  Maghrib: Sunset,
  Isha: Moon,
};

export function PrayerTimesCard() {
  const [timings, setTimings] = useState<Record<string, string> | null>(null);
  const [status, setStatus] = useState<PrayerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const c = await getUserCoords();
        const t = await fetchPrayerTimes(c);
        if (mounted) setTimings(t);
      } catch (e: any) {
        setError("تعذّر جلب مواعيد الصلاة. تحقق من الاتصال أول مرة.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!timings) return;
    const tick = () => setStatus(computePrayerStatus(timings));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timings]);

  if (error) return <div className="rounded-2xl border bg-card p-5 text-sm text-destructive">{error}</div>;
  if (!status) {
    return (
      <div className="h-48 animate-pulse rounded-3xl" style={{ background: "var(--gradient-card)" }} />
    );
  }

  const NextIcon = icons[status.next.name] ?? CloudMoon;
  const remaining = formatDuration(status.next.remainingMs);
  const elapsed = status.current ? formatDuration(status.current.elapsedMs) : null;

  return (
    <div className="space-y-4">
      {/* Big countdown card */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 text-primary-foreground"
        style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}
      >
        <div className="pattern-islamic absolute inset-0 opacity-15" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm opacity-90">
              <Clock className="h-4 w-4" />
              {status.current ? "مضى على " + prayerArabic[status.current.name] : "متبقٍّ على " + prayerArabic[status.next.name]}
            </div>
            <NextIcon className="h-6 w-6 opacity-80" />
          </div>

          {status.current ? (
            <>
              <div className="mt-3 flex items-end gap-2 font-mono text-5xl font-extrabold tracking-tight">
                <span>{String(elapsed!.h).padStart(2, "0")}</span>
                <span className="opacity-50">:</span>
                <span>{String(elapsed!.m).padStart(2, "0")}</span>
                <span className="opacity-50">:</span>
                <span>{String(elapsed!.s).padStart(2, "0")}</span>
              </div>
              <p className="mt-2 text-xs opacity-80">
                التالي: {prayerArabic[status.next.name]} الساعة {formatTimeArabic(status.next.time)}
              </p>
            </>
          ) : (
            <>
              <div className="mt-3 flex items-end gap-2 font-mono text-5xl font-extrabold tracking-tight">
                <span>{String(remaining.h).padStart(2, "0")}</span>
                <span className="opacity-50">:</span>
                <span>{String(remaining.m).padStart(2, "0")}</span>
                <span className="opacity-50">:</span>
                <span>{String(remaining.s).padStart(2, "0")}</span>
              </div>
              <p className="mt-2 text-xs opacity-80">
                الأذان الساعة {formatTimeArabic(status.next.time)}
              </p>
            </>
          )}
        </div>

        <Sparkles
          className="absolute -bottom-4 -left-4 h-24 w-24 opacity-10"
          style={{ color: "var(--gold)" }}
        />
      </div>

      {/* All prayers strip */}
      <div className="grid grid-cols-6 gap-2 rounded-3xl border bg-card p-3" style={{ boxShadow: "var(--shadow-soft)" }}>
        {status.all.map((p) => {
          const Icon = icons[p.name];
          const isNext = p.name === status.next.name;
          const isCurrent = status.current?.name === p.name;
          return (
            <div
              key={p.name}
              className={"flex flex-col items-center gap-1 rounded-2xl p-2 transition-all"}
              style={{
                background: isNext
                  ? "var(--gradient-gold)"
                  : isCurrent
                  ? "color-mix(in oklab, var(--primary) 12%, transparent)"
                  : "transparent",
                color: isNext ? "var(--gold-foreground)" : "inherit",
              }}
            >
              <Icon className="h-4 w-4" />
              <p className="text-[10px] font-bold">{prayerArabic[p.name]}</p>
              <p className="text-[10px] font-mono opacity-80">{formatTimeArabic(p.time)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
