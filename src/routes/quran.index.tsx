import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, BookOpen, Download, Loader2, Check, X } from "lucide-react";
import { surahs, reciters, type ReciterId } from "@/data/surahs";
import { PageHeader } from "@/components/PageHeader";
import { ContinueReading } from "@/components/ContinueReading";
import { downloadFullSurah, audioKey } from "@/lib/quran-api";
import { getCachedAudioKeys } from "@/lib/db";

export const Route = createFileRoute("/quran/")({
  component: QuranIndex,
  head: () => ({
    meta: [{ title: "المصحف الشريف — نور" }, { name: "description", content: "القرآن الكريم كاملاً مع البحث وأشهر القراء." }],
  }),
});

function QuranIndex() {
  const [q, setQ] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkReciter, setBulkReciter] = useState<ReciterId>("ar.yasser");
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [cancelRef, setCancelRef] = useState<{ stop: boolean }>({ stop: false });
  const [cachedKeys, setCachedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    getCachedAudioKeys().then(setCachedKeys);
  }, [bulkProgress]);

  const filtered = useMemo(() => {
    if (!q.trim()) return surahs;
    const term = q.trim();
    return surahs.filter(
      (s) =>
        s.name.includes(term) ||
        s.englishName.toLowerCase().includes(term.toLowerCase()) ||
        String(s.number).includes(term)
    );
  }, [q]);

  const downloadedCount = useMemo(() => {
    return surahs.filter((s) => cachedKeys.has(audioKey(bulkReciter, s.number))).length;
  }, [cachedKeys, bulkReciter]);

  async function startBulkDownload() {
    const ctrl = { stop: false };
    setCancelRef(ctrl);
    setBulkProgress({ done: 0, total: surahs.length, current: surahs[0].name });
    try {
      for (let i = 0; i < surahs.length; i++) {
        if (ctrl.stop) break;
        const s = surahs[i];
        setBulkProgress({ done: i, total: surahs.length, current: s.name });
        try {
          await downloadFullSurah(bulkReciter, s.number);
        } catch (e) {
          console.error(`Failed surah ${s.number}`, e);
        }
      }
    } finally {
      setBulkProgress(null);
      setCachedKeys(await getCachedAudioKeys());
    }
  }

  function cancelBulk() {
    cancelRef.stop = true;
  }

  return (
    <div>
      <PageHeader title="المصحف الشريف" subtitle="114 سورة • تلاوة بأشهر القراء" />
      <div className="space-y-3 px-4 pt-3">
        <ContinueReading />

        {/* زر تحميل كل السور */}
        <button
          onClick={() => setBulkOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-right active:scale-[0.98] transition-all"
          style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)", boxShadow: "var(--shadow-gold)" }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20"
          >
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-extrabold">تحميل المصحف كاملاً</p>
            <p className="text-[11px] opacity-90">للاستماع بدون إنترنت • 114 سورة</p>
          </div>
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div
          className="flex items-center gap-2 rounded-2xl border px-4 py-3"
          style={{ background: "var(--card)", boxShadow: "var(--shadow-soft)" }}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن سورة أو رقم..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div className="space-y-2 px-4 py-4">
        {filtered.map((s) => (
          <Link
            key={s.number}
            to="/quran/$num"
            params={{ num: String(s.number) }}
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
              {s.number}
            </div>
            <div className="flex-1">
              <p className="text-lg font-extrabold font-quran">{s.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {s.revelationType === "Meccan" ? "مكية" : "مدنية"} • {s.numberOfAyahs} آية
              </p>
            </div>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">لا توجد نتائج</p>
        )}
      </div>

      {/* Sheet تحميل كل السور */}
      {bulkOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => !bulkProgress && setBulkOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border p-5"
            style={{ background: "var(--card)" }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <h3 className="mb-1 text-lg font-extrabold">تحميل المصحف كاملاً</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              اختر القارئ ثم اضغط تحميل. الحجم ≈ 1.5 جيجا تقريباً.
            </p>

            <div className="mb-4 space-y-2">
              {reciters.map((r) => (
                <button
                  key={r.id}
                  onClick={() => !bulkProgress && setBulkReciter(r.id)}
                  disabled={!!bulkProgress}
                  className="flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition-all disabled:opacity-50"
                  style={{
                    background: bulkReciter === r.id ? "color-mix(in oklab, var(--gold) 12%, transparent)" : "transparent",
                    borderColor: bulkReciter === r.id ? "var(--gold)" : "var(--border)",
                  }}
                >
                  <div className="text-2xl">{r.avatar}</div>
                  <div className="flex-1">
                    <p className="font-bold">{r.name}</p>
                  </div>
                  {bulkReciter === r.id && <Check className="h-4 w-4" style={{ color: "var(--gold)" }} />}
                </button>
              ))}
            </div>

            <p className="mb-3 text-xs text-muted-foreground">
              المحمّل لهذا القارئ: <b>{downloadedCount}</b> / 114
            </p>

            {bulkProgress ? (
              <div className="space-y-3">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">جاري تحميل</p>
                  <p className="font-bold">{bulkProgress.current}</p>
                  <p className="mt-1 text-xs">{bulkProgress.done} / {bulkProgress.total}</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${(bulkProgress.done / bulkProgress.total) * 100}%`,
                        background: "var(--gradient-gold)",
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={cancelBulk}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive py-3 font-bold text-destructive-foreground"
                >
                  <X className="h-4 w-4" />
                  إيقاف التحميل
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setBulkOpen(false)}
                  className="flex-1 rounded-2xl border py-3 font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={startBulkDownload}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-2xl py-3 font-bold"
                  style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
                >
                  <Download className="h-4 w-4" />
                  ابدأ التحميل
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

