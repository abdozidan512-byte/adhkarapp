import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Download, Check, X } from "lucide-react";
import { surahs, reciters, type ReciterId } from "@/data/surahs";
import { PageHeader } from "@/components/PageHeader";
import { ContinueReading } from "@/components/ContinueReading";
import { SurahSearch } from "@/components/SurahSearch";
import { downloadFullSurah, downloadMushafPage, fetchSurahText, audioKey } from "@/lib/quran-api";
import { getCachedAudioKeys, getCachedMushafPageKeys, getCachedSurahNumbers } from "@/lib/db";

export const Route = createFileRoute("/quran/")({
  component: QuranIndex,
  head: () => ({
    meta: [{ title: "المصحف الشريف — نور" }, { name: "description", content: "القرآن الكريم كاملاً مع البحث وأشهر القراء." }],
  }),
});


function QuranIndex() {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkReciter, setBulkReciter] = useState<ReciterId>("ar.yasser");
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const cancelRef = useRef<AbortController | null>(null);
  const offlineCancelRef = useRef<AbortController | null>(null);
  const [cachedKeys, setCachedKeys] = useState<Set<string>>(new Set());
  const [cachedPages, setCachedPages] = useState<Set<string>>(new Set());
  const [cachedSurahs, setCachedSurahs] = useState<Set<number>>(new Set());
  const [offlineProgress, setOfflineProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [allRecitersProgress, setAllRecitersProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    getCachedAudioKeys().then(setCachedKeys);
    getCachedMushafPageKeys().then(setCachedPages);
    getCachedSurahNumbers().then(setCachedSurahs);
  }, []);

  const downloadedCount = useMemo(() => {
    return surahs.filter((s) => cachedKeys.has(audioKey(bulkReciter, s.number))).length;
  }, [cachedKeys, bulkReciter]);

  async function startBulkDownload() {
    const controller = new AbortController();
    cancelRef.current = controller;
    setBulkProgress({ done: 0, total: surahs.length, current: surahs[0].name });
    try {
      for (let i = 0; i < surahs.length; i++) {
        if (controller.signal.aborted) break;
        const s = surahs[i];
        setBulkProgress({ done: i, total: surahs.length, current: s.name });
        try {
          await downloadFullSurah(bulkReciter, s.number, undefined, controller.signal);
        } catch (e) {
          if (!controller.signal.aborted) console.error(`Failed surah ${s.number}`, e);
        }
      }
    } finally {
      cancelRef.current = null;
      setBulkProgress(null);
      setCachedKeys(await getCachedAudioKeys());
    }
  }

  async function startAllRecitersDownload() {
    if (!window.confirm("تنزيل تسجيلات القرآن كاملة للقراء السبعة قد يحتاج عدة غيغابايت من المساحة والبيانات. هل تريد المتابعة؟")) return;
    const controller = new AbortController();
    cancelRef.current = controller;
    const total = reciters.length * surahs.length;
    let done = 0;
    try {
      for (const r of reciters) {
        for (const s of surahs) {
          if (controller.signal.aborted) return;
          setAllRecitersProgress({ done, total, current: `${r.name} — ${s.name}` });
          try {
            await downloadFullSurah(r.id, s.number, undefined, controller.signal);
          } catch (e) {
            if (!controller.signal.aborted) console.error(`Failed ${r.id} / ${s.number}`, e);
          }
          done++;
        }
      }
    } finally {
      cancelRef.current = null;
      setAllRecitersProgress(null);
      setCachedKeys(await getCachedAudioKeys());
    }
  }

  function cancelBulk() {
    cancelRef.current?.abort();
  }

  async function downloadOfflineQuran() {
    const controller = new AbortController();
    offlineCancelRef.current = controller;
    const modes = ["clear", "tajweed"] as const;
    const total = 604 * modes.length + surahs.length;
    let done = 0;
    setDownloadError(null);
    try {
      for (const mode of modes) {
        for (let page = 1; page <= 604; page++) {
          if (controller.signal.aborted) return;
          setOfflineProgress({ done, total, current: `${mode === "clear" ? "النسخة الواضحة" : "ألوان التجويد"} — صفحة ${page}` });
          await downloadMushafPage(page, mode, undefined, controller.signal);
          done++;
        }
      }
      for (const surah of surahs) {
        if (controller.signal.aborted) return;
        setOfflineProgress({ done, total, current: `نص سورة ${surah.name}` });
        await fetchSurahText(surah.number, controller.signal);
        done++;
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error("Offline Quran download failed", e);
        setDownloadError("تعذّر تنزيل بعض الصفحات أو النص. أعد المحاولة لإكمال ما لم يُحفظ.");
      }
    } finally {
      offlineCancelRef.current = null;
      setOfflineProgress(null);
      setCachedPages(await getCachedMushafPageKeys());
      setCachedSurahs(await getCachedSurahNumbers());
    }
  }

  function cancelOfflineDownload() {
    offlineCancelRef.current?.abort();
  }

  return (
    <div>
      <PageHeader title="المصحف الشريف" subtitle="114 سورة • تلاوة بأشهر القراء" />
      <div className="space-y-3 px-4 pt-3">
        <SurahSearch />
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
            <p className="font-extrabold">تنزيل أصوات القراء</p>
            <p className="text-[11px] opacity-90">للاستماع دون إنترنت • اختر قارئًا أو السبعة</p>
          </div>
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="rounded-2xl border p-4" style={{ background: "var(--card)" }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="font-extrabold">المصحف دون إنترنت</p>
              <p className="text-[11px] text-muted-foreground">النسخة الواضحة والتجويد + نص السور • نحو 260 م.ب</p>
              <p className="mt-1 text-[10px] text-muted-foreground">المحفوظ: {cachedPages.size} / 1208 صفحة • {cachedSurahs.size} / 114 سورة</p>
            </div>
            <Download className="h-5 w-5 shrink-0" style={{ color: "var(--gold)" }} />
          </div>
          {downloadError && <p role="alert" className="mb-2 text-xs font-bold text-destructive">{downloadError}</p>}
          {offlineProgress ? (
            <div className="space-y-2">
              <p className="truncate text-xs">{offlineProgress.current} • {offlineProgress.done} / {offlineProgress.total}</p>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full" style={{ width: `${Math.round(offlineProgress.done / offlineProgress.total * 100)}%`, background: "var(--gradient-gold)" }} /></div>
              <button onClick={cancelOfflineDownload} className="w-full rounded-xl bg-destructive py-2 text-sm font-bold text-destructive-foreground">إيقاف التنزيل</button>
            </div>
          ) : (
            <button onClick={downloadOfflineQuran} className="w-full rounded-xl py-2.5 text-sm font-bold text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>تنزيل الصفحات ونص القرآن</button>
          )}
        </div>

      </div>

      {/* Sheet تحميل كل السور */}
      {bulkOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60"
          onClick={() => !bulkProgress && !allRecitersProgress && setBulkOpen(false)}
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
            <h3 className="mb-1 text-lg font-extrabold">تنزيل أصوات القراء</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              نزّل سور قارئ واحد أو اختر تنزيل أصوات القراء السبعة كاملة. تنزيل كل القراء قد يحتاج عدة غيغابايت؛ ابدأه على شبكة Wi-Fi وتأكد من المساحة.
            </p>

            <div className="mb-4 space-y-2">
              {reciters.map((r) => (
                <button
                  key={r.id}
                  onClick={() => !bulkProgress && setBulkReciter(r.id)}
                  disabled={!!bulkProgress || !!allRecitersProgress}
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

            {allRecitersProgress ? (
              <div className="space-y-3">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">تنزيل أصوات القراء السبعة</p>
                  <p className="truncate font-bold">{allRecitersProgress.current}</p>
                  <p className="mt-1 text-xs">{allRecitersProgress.done} / {allRecitersProgress.total}</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full transition-all" style={{ width: `${allRecitersProgress.done / allRecitersProgress.total * 100}%`, background: "var(--gradient-gold)" }} /></div>
                </div>
                <button onClick={cancelBulk} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive py-3 font-bold text-destructive-foreground"><X className="h-4 w-4" />إيقاف التنزيل</button>
              </div>
            ) : bulkProgress ? (
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
                  تنزيل القارئ
                </button>
                <button
                  onClick={startAllRecitersDownload}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 font-bold"
                  style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
                >
                  <Download className="h-4 w-4" />
                  تنزيل أصوات القراء السبعة
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

