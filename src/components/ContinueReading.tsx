import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft } from "lucide-react";
import { getReadingProgress, type ReadingProgress } from "@/lib/db";

export function ContinueReading({ compact = false }: { compact?: boolean }) {
  const [progress, setProgress] = useState<ReadingProgress | null>(null);

  useEffect(() => {
    getReadingProgress().then((p) => p && setProgress(p));
  }, []);

  if (!progress) return null;

  const pct = Math.round(((progress.page + 1) / progress.totalPages) * 100);

  return (
    <Link
      to="/quran/$num"
      params={{ num: String(progress.surahNumber) }}
      search={{ page: progress.page }}
      className="group relative block overflow-hidden rounded-3xl border p-4 transition-all active:scale-[0.98]"
      style={{
        background: "var(--gradient-card)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div className="pattern-islamic absolute inset-0 opacity-[0.06]" />
      <div className="relative flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}
        >
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            تابع القراءة
          </p>
          <p className="font-quran text-lg font-extrabold leading-tight truncate">
            سورة {progress.surahName}
          </p>
          {!compact && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              صفحة {progress.page + 1} من {progress.totalPages} • آية {progress.ayah}
            </p>
          )}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: "var(--gradient-gold)" }}
            />
          </div>
        </div>
        <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}
