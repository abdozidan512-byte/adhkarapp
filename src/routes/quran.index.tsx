import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronLeft, BookOpen, Download, Check, X } from "lucide-react";
import { surahs, reciters, type ReciterId } from "@/data/surahs";
import { PageHeader } from "@/components/PageHeader";
import { ContinueReading } from "@/components/ContinueReading";
import { downloadAyahAudio, downloadFullSurah, downloadMushafPage, fetchSurahText, getAyahAudioUrl, audioKey } from "@/lib/quran-api";
import { getCachedAudioKeys, getCachedMushafPageKeys, getCachedSurahNumbers, getStorageEstimate, requestPersistentStorage } from "@/lib/db";

export const Route = createFileRoute("/quran/")({
  component: QuranIndex,
  head: () => ({
    meta: [{ title: "المصحف الشريف — نور" }, { name: "description", content: "القرآن الكريم كاملاً مع البحث وأشهر القراء." }],
  }),
});


function formatBytes(bytes: number) {
  if (!bytes) return "0 ب.ا";
  const units = ["ب.ا", "ك.ب", "م.ب", "ج.ب"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function downloadReciterSurah(reciterId: ReciterId, surahNumber: number, signal: AbortSignal) {
  try {
    await downloadFullSurah(reciterId, surahNumber, undefined, signal);
    return;
  } catch (fullSurahError) {
    if (signal.aborted || !navigator.onLine) throw fullSurahError;
    const surah = surahs.find((item) => item.number === surahNumber);
    if (!surah || !getAyahAudioUrl(reciterId, surahNumber, 1)) throw fullSurahError;
    let nextAyah = 1;
    const failures: number[] = [];
    const worker = async () => {
      while (!signal.aborted && nextAyah <= surah.numberOfAyahs) {
        const ayah = nextAyah++;
        try {
          await downloadAyahAudio(reciterId, surahNumber, ayah, undefined, signal);
        } catch (error) {
          if (signal.aborted) return;
          failures.push(ayah);
          console.warn(`Ayah audio download failed for ${reciterId} / ${surahNumber} / ${ayah}`, error);
        }
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
    if (signal.aborted) throw new DOMException("تم إيقاف التنزيل", "AbortError");
    if (failures.length) throw new Error(`تعذّر تنزيل ${failures.length} آية من سورة ${surah.name}.`);
  }
}

function QuranIndex() {
  const [q, setQ] = useState("");
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
  const [allRecitersMessage, setAllRecitersMessage] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number; persistent: boolean | null }>({ usage: 0, quota: 0, persistent: null });

  useEffect(() => {
    getCachedAudioKeys().then(setCachedKeys);
    getCachedMushafPageKeys().then(setCachedPages);
    getCachedSurahNumbers().then(setCachedSurahs);
    getStorageEstimate().then(setStorageInfo);
  }, []);

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
    return surahs.filter((surah) => {
      if (cachedKeys.has(audioKey(bulkReciter, surah.number))) return true;
      for (let ayah = 1; ayah <= surah.numberOfAyahs; ayah++) {
        if (!cachedKeys.has(audioKey(bulkReciter, surah.number, ayah))) return false;
      }
      return true;
    }).length;
  }, [cachedKeys, bulkReciter]);

  async function startBulkDownload() {
    await requestPersistentStorage();
    setBulkMessage(null);
    const controller = new AbortController();
    cancelRef.current = controller;
    setBulkProgress({ done: 0, total: surahs.length, current: surahs[0].name });
    const failures: string[] = [];
    let done = 0;
    try {
      for (const surah of surahs) {
        if (controller.signal.aborted) break;
        setBulkProgress({ done, total: surahs.length, current: surah.name });
        try {
          await downloadReciterSurah(bulkReciter, surah.number, controller.signal);
        } catch (error) {
          if (controller.signal.aborted) break;
          failures.push(surah.name);
          console.warn(`Audio download failed for ${bulkReciter} / ${surah.number}`, error);
        }
        done++;
      }
    } finally {
      cancelRef.current = null;
      setBulkProgress(null);
      setCachedKeys(await getCachedAudioKeys());
      setStorageInfo(await getStorageEstimate());
      if (controller.signal.aborted) setBulkMessage(`توقف التنزيل عند ${done} من ${surahs.length}. الملفات المحفوظة باقية ويمكن استكمال الباقي بإعادة التنزيل.`);
      else if (failures.length) setBulkMessage(`تعذّر تنزيل ${failures.length} سورة لهذا القارئ؛ أعد المحاولة لاستكمالها.`);
      else setBulkMessage("اكتمل تنزيل سور هذا القارئ وأصبحت متاحة دون اتصال.");
    }
  }

  async function startAllRecitersDownload() {
    const currentStorage = await getStorageEstimate();
    const available = Math.max(0, currentStorage.quota - currentStorage.usage);
    const availableLabel = currentStorage.quota ? `المتاح حاليًا على الجهاز نحو ${formatBytes(available)}. ` : "";
    if (!window.confirm(`تنزيل تسجيلات القرآن كاملة للقراء السبعة قد يحتاج عدة غيغابايت من المساحة والبيانات. ${availableLabel}يمكن استكماله لاحقًا بإعادة المحاولة. هل تريد المتابعة؟`)) return;

    await requestPersistentStorage();
    setAllRecitersMessage(null);
    const controller = new AbortController();
    cancelRef.current = controller;
    const total = reciters.length * surahs.length;
    let done = 0;
    const failures: string[] = [];
    let stopped = false;
    try {
      for (const r of reciters) {
        for (const s of surahs) {
          if (controller.signal.aborted) { stopped = true; break; }
          setAllRecitersProgress({ done, total, current: `${r.name} — ${s.name}` });
          try {
            await downloadReciterSurah(r.id, s.number, controller.signal);
          } catch (e) {
            if (controller.signal.aborted) { stopped = true; break; }
            failures.push(`${r.name} — ${s.name}`);
            console.warn(`Audio download failed for ${r.id} / ${s.number}`, e);
          }
          done++;
        }
        if (stopped) break;
      }
    } finally {
      cancelRef.current = null;
      setAllRecitersProgress(null);
      setCachedKeys(await getCachedAudioKeys());
      setStorageInfo(await getStorageEstimate());
      if (stopped || controller.signal.aborted) {
        setAllRecitersMessage(`توقف التنزيل عند ${done} من ${total}. الملفات المكتملة محفوظة، ويمكن استكمال الباقي بإعادة التنزيل.`);
      } else if (failures.length) {
        setAllRecitersMessage(`اكتمل التنزيل جزئيًا: تعذّر تنزيل ${failures.length} سورة. أعد المحاولة لاستكمالها.`);
      } else {
        setAllRecitersMessage("اكتمل تنزيل أصوات القراء السبعة. أصبحت الملفات المحفوظة متاحة دون اتصال.");
      }
    }
  }

  function cancelBulk() {
    cancelRef.current?.abort();
  }

  async function downloadOfflineQuran() {
    const controller = new AbortController();
    offlineCancelRef.current = controller;
    const jobs = [
      ...(["clear", "tajweed"] as const).flatMap((mode) =>
        Array.from({ length: 604 }, (_, index) => ({
          label: `${mode === "clear" ? "النسخة الواضحة" : "ألوان التجويد"} — صفحة ${index + 1}`,
          run: () => downloadMushafPage(index + 1, mode, undefined, controller.signal, true),
        })),
      ),
      ...surahs.map((surah) => ({
        label: `نص سورة ${surah.name}`,
        run: () => fetchSurahText(surah.number, controller.signal),
      })),
    ];
    let nextIndex = 0;
    let done = 0;
    let failures = 0;
    let consecutiveFailures = 0;
    setDownloadError(null);
    await requestPersistentStorage();
    setOfflineProgress({ done, total: jobs.length, current: "بدء تجهيز المحتوى دون إنترنت" });

    const worker = async () => {
      while (!controller.signal.aborted && nextIndex < jobs.length && consecutiveFailures < 8) {
        const job = jobs[nextIndex++];
        setOfflineProgress({ done, total: jobs.length, current: job.label });
        try {
          await job.run();
          consecutiveFailures = 0;
        } catch (error) {
          if (controller.signal.aborted) break;
          failures++;
          consecutiveFailures++;
          console.warn(`Offline content download failed: ${job.label}`, error);
        } finally {
          done++;
          setOfflineProgress({ done, total: jobs.length, current: job.label });
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: 3 }, () => worker()));
      if (failures) setDownloadError(`تعذّر التحقق من ${failures} ملفًا. الملفات المكتملة محفوظة؛ أعد المحاولة لإكمال الناقص.`);
      else if (!controller.signal.aborted) setDownloadError(null);
    } finally {
      offlineCancelRef.current = null;
      setOfflineProgress(null);
      setCachedPages(await getCachedMushafPageKeys());
      setCachedSurahs(await getCachedSurahNumbers());
      setStorageInfo(await getStorageEstimate());
    }
  }

  function cancelOfflineDownload() {
    offlineCancelRef.current?.abort();
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
            <p className="font-extrabold">تنزيل أصوات القراء</p>
            <p className="text-[11px] opacity-90">للاستماع دون إنترنت • اختر قارئًا أو السبعة</p>
          </div>
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="rounded-2xl border p-4" style={{ background: "var(--card)" }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="font-extrabold">المصحف دون إنترنت</p>
              <p className="text-[11px] text-muted-foreground">النسخة الواضحة والتجويد + نص السور • قد يصل إلى 590 م.ب</p>
              <p className="mt-1 text-[10px] text-muted-foreground">المحفوظ: {cachedPages.size} / 1208 صفحة • {cachedSurahs.size} / 114 سورة</p>
              <p className="mt-1 text-[10px] text-muted-foreground">التخزين المستخدم: {formatBytes(storageInfo.usage)}{storageInfo.quota ? ` • المتاح: ${formatBytes(Math.max(0, storageInfo.quota - storageInfo.usage))}` : ""}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">الحفظ الدائم: {storageInfo.persistent === true ? "مفعّل" : storageInfo.persistent === false ? "غير مفعّل" : "غير مدعوم"}</p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold" style={{ background: "var(--gradient-gold)", color: "var(--gold-foreground)" }}>
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
            {bulkMessage && <p role="status" className="mt-3 rounded-xl border px-3 py-2 text-xs text-muted-foreground">{bulkMessage}</p>}
            {allRecitersMessage && <p role="status" className="mt-3 rounded-xl border px-3 py-2 text-xs text-muted-foreground">{allRecitersMessage}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

