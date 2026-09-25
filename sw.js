const CACHE = "pm-v20";
const APP_VERSION = "1.6";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./library.json",
  "./manifest.json",
  /* فایل‌های زنده دیگه از پوشه‌شون load می‌شن، نه از یه فایل —
     Vite تو build اونا رو bundle می‌کنه و اسم‌های hashed می‌گیرن.
     پس لازم نیست صریح کش بشن. */
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",

  /* Vazirmatn — همهٔ وزن‌های لینک‌شده در HTML */
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/arabic-300.css",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/arabic-400.css",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/arabic-700.css",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/arabic-800.css",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/files/vazirmatn-arabic-300-normal.woff2",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/files/vazirmatn-arabic-400-normal.woff2",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/files/vazirmatn-arabic-700-normal.woff2",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/files/vazirmatn-arabic-800-normal.woff2",

  /* فونت‌های اختیاری اسکین‌ها — اگه در دسترس نباشن مشکلی نیست */
  "https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;700&display=swap",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(ASSETS.map((u) => c.add(u).catch(() => {})))
    )
  );
  /* بدون skipWaiting — منتظر می‌مونه تا کاربر تأیید کنه */
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isCdn =
    url.hostname.includes("jsdelivr.net") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com");

  /* ناوبری: network-first با fallback به index کش‌شده */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match("./index.html").then(
            (hit) => hit || new Response("آفلاین", { status: 503 })
          )
        )
    );
    return;
  }

  /* CDN (فونت‌ها): cache-first — هیچ‌وقت عوض نمی‌شن */
  if (isCdn) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  if (sameOrigin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type !== "opaque") {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached || caches.match("./index.html"));
        /* کش داریم → فوری بده، ولی آپدیت رو هم بگیر */
        return cached || networkFetch;
      })
    );
    return;
  }
});
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
