// Service Worker لتطبيق نور — يفعّل العمل دون إنترنت ويرفع تقييم PWA
// IMPORTANT: ارفع رقم الإصدار عند كل تغيير لإبطال الكاش القديم
const CACHE_VERSION = "noor-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // لا نتدخّل في طلبات API
  if (url.pathname.startsWith("/api/")) return;

  // التنقل (HTML): شبكة دائماً أولاً، فلا نستخدم HTML قديم مع JS جديد
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // لا نخزّن HTML في الكاش لأن أسماء chunks تتغيّر مع كل بناء
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || new Response(
          "<!doctype html><meta charset=utf-8><title>غير متصل</title><body style='font-family:system-ui;text-align:center;padding:40px'>تعذّر الاتصال بالإنترنت — حاول لاحقاً.</body>",
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        )))
    );
    return;
  }

  // الأصول الثابتة (JS/CSS/صور): cache-first مع تحديث في الخلفية
  // أسماء الملفات بها hash لذلك آمنة للكاش الطويل
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// عند الضغط على إشعار: افتح التطبيق أو ركّز على نافذته
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow("/");
    })()
  );
});
