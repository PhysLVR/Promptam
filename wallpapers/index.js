/* ═══════════════ Wallpapers Catalog ═══════════════
   کاتالوگ والپیپرها — بدون وابستگی به Vite.
   
   - static: تصاویر آماده در wallpapers/static/
   - live: ماژول‌های canvas در wallpapers/live/ که dynamic import می‌شن
*/

/* ── والپیپرهای استاتیک ── */
const STATIC_ITEMS = [
  {
    id: "aurora",
    title: "شفق قطبی",
    category: "nature",
    type: "static",
    src: "./wallpapers/static/aurora--nature.jpg",
    thumb: "./wallpapers/static/aurora--nature.jpg",
  },
  {
    id: "ac-blackflag",
    title: "Black Flag — Dark",
    category: "game",
    type: "static",
    src: "./wallpapers/static/assassinscreed-blackflagresynced--game--assassin+dark-01.png",
    thumb: "./wallpapers/static/assassinscreed-blackflagresynced--game--assassin+dark-01.png",
  },
  {
    id: "ac-unity-dark-romantic",
    title: "Unity — Dark Romantic",
    category: "game",
    type: "static",
    src: "./wallpapers/static/assassinscreed-unity--game--assassin+dark+romantic-02.png",
    thumb: "./wallpapers/static/assassinscreed-unity--game--assassin+dark+romantic-02.png",
  },
  {
    id: "ac-unity-dark",
    title: "Unity — Dark",
    category: "game",
    type: "static",
    src: "./wallpapers/static/assassinscreed-unity--game--assassin+dark-01.png",
    thumb: "./wallpapers/static/assassinscreed-unity--game--assassin+dark-01.png",
  },
  {
    id: "cyberpunk-01",
    title: "Cyberpunk 2077 — Neon 01",
    category: "game",
    type: "static",
    src: "./wallpapers/static/cyberpunk-2077--game--night+neon+city-01.png",
    thumb: "./wallpapers/static/cyberpunk-2077--game--night+neon+city-01.png",
  },
  {
    id: "cyberpunk-02",
    title: "Cyberpunk 2077 — Neon 02",
    category: "game",
    type: "static",
    src: "./wallpapers/static/cyberpunk-2077--game--night+neon+city-02.png",
    thumb: "./wallpapers/static/cyberpunk-2077--game--night+neon+city-02.png",
  },
  {
    id: "cyberpunk-03",
    title: "Cyberpunk 2077 — Neon 03",
    category: "game",
    type: "static",
    src: "./wallpapers/static/cyberpunk-2077--game--night+neon+city-03.png",
    thumb: "./wallpapers/static/cyberpunk-2077--game--night+neon+city-03.png",
  },
  {
    id: "cyberpunk-04",
    title: "Cyberpunk 2077 — Neon 04",
    category: "game",
    type: "static",
    src: "./wallpapers/static/cyberpunk-2077--game--night+neon+city-04.png",
    thumb: "./wallpapers/static/cyberpunk-2077--game--night+neon+city-04.png",
  },
  {
    id: "cyberpunk-05",
    title: "Cyberpunk 2077 — Neon 05",
    category: "game",
    type: "static",
    src: "./wallpapers/static/cyberpunk-2077--game--night+neon+city-05.png",
    thumb: "./wallpapers/static/cyberpunk-2077--game--night+neon+city-05.png",
  },
  {
    id: "got-samurai",
    title: "Ghost of Tsushima — Samurai",
    category: "game",
    type: "static",
    src: "./wallpapers/static/ghost-of-tsushima--game--nature+samurai+katana-01.png",
    thumb: "./wallpapers/static/ghost-of-tsushima--game--nature+samurai+katana-01.png",
  },
];

/* ── والپیپرهای زنده ──
   مسیر ماژول نگه داشته می‌شه، در loadWallpaperCatalog dynamic import می‌شه. */
const LIVE_ITEMS = [
  { id: "circuit",       title: "مدار",      category: "tech",     path: "./live/circuit.js" },
  { id: "constellation", title: "صورت فلکی", category: "space",    path: "./live/constellation.js" },
  { id: "flow",          title: "جریان",     category: "abstract", path: "./live/flow.js" },
  { id: "koi-pond",      title: "حوض کوی",   category: "nature",   path: "./live/koi-pond.js" },
  { id: "particles",     title: "ذرات",      category: "abstract", path: "./live/particles.js" },
];

export async function loadWallpaperCatalog() {
  const items = [...STATIC_ITEMS];

  /* live — eager resolve با try/catch تا یه ماژول خراب بقیه رو نکشه */
  await Promise.all(
    LIVE_ITEMS.map(async (live) => {
      try {
        const mod = await import(live.path);
        const resolved = mod.default || mod;
        if (resolved && typeof resolved.mount === "function") {
          items.push({
            id: live.id,
            title: live.title,
            category: live.category,
            type: "live",
            module: resolved,
          });
        } else {
          console.warn(
            `live wallpaper "${live.id}" has no mount() — skipped`
          );
        }
      } catch (e) {
        console.warn(`live wallpaper "${live.id}" failed to load:`, e);
      }
    })
  );

  return { items };
}