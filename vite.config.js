import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
   host: true,   
    port: 5173,
  },
  plugins: [
    VitePWA({
      registerType: "prompt",     // کاربر تأیید کنه برای آپدیت (مثل الان)
      injectRegister: false,      // خودت register می‌کنی (app.js داریش)
      strategies: "generateSW",
      srcDir: ".",
      filename: "sw.js",
      manifest: false,            // manifest خودت تو public/ هست
      workbox: {
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff2,json}"
        ],
        globIgnores: [
          "**/wallpapers/**",     // والپیپرها lazy load می‌شن
          "**/sw.js",
          "**/manifest.json"
        ],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: false,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "cdn-fonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-woff",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,              // تو dev، SW فعال نباشه
      },
    }),
  ],
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});