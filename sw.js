const CACHE = "pm-v8";
const APP_VERSION = "1.2";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/arabic-400.css",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/arabic-700.css",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/arabic-800.css",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/files/vazirmatn-arabic-400-normal.woff2",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/files/vazirmatn-arabic-700-normal.woff2",
  "https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.0.16/files/vazirmatn-arabic-800-normal.woff2",
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
  const isCdn = url.hostname.includes("jsdelivr.net");

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (isCdn || sameOrigin) {
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
  }
});
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});