// Service Worker لتطبيق نور — Offline-first بالكامل
const CACHE_VERSION = "noor-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  "/",
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

// استراتيجية cache-first لكل شيء على نفس النطاق — يعمل بدون إنترنت تماماً
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // صوتيات القراء الخارجية: cache-first ثم شبكة
  if (url.hostname.includes("everyayah.com")) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // التنقل: cache-first مع تحديث في الخلفية
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("/").then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put("/", copy));
            }
            return res;
          })
          .catch(() => cached || caches.match("/"));
        return cached || network;
      })
    );
    return;
  }

  // باقي الأصول: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // تحديث في الخلفية
        fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
            }
          })
          .catch(() => undefined);
        return cached;
      }
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("/"));
    })
  );
});
