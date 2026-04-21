import { fetchSurahText } from "./quran-api";
import { getSetting, saveSetting } from "./db";

const PRELOAD_KEY = "quran-preloaded-v1";

// تنزيل نص المصحف كاملاً (114 سورة) في الخلفية بهدوء — لمرة واحدة فقط
export async function preloadQuranInBackground() {
  if (typeof window === "undefined") return;
  const done = await getSetting<boolean>(PRELOAD_KEY);
  if (done) return;

  // ابدأ بعد ثانيتين لتفادي التزاحم مع تحميل الصفحة
  setTimeout(async () => {
    try {
      for (let n = 1; n <= 114; n++) {
        try {
          await fetchSurahText(n);
        } catch {
          // تجاهل الفشل — سيُعاد لاحقاً
        }
        // فاصل صغير لعدم إغراق الشبكة
        await new Promise((r) => setTimeout(r, 80));
      }
      await saveSetting(PRELOAD_KEY, true);
    } catch {
      // تجاهل
    }
  }, 2000);
}
