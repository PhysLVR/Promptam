/* ═══════════ Wallpaper Catalog — Auto-Discovery ═══════════
   Vite با import.meta.glob همه فایل‌ها رو خودکار پیدا می‌کنه.
   کافیه یه فایل بذاری تو live/ یا static/ — بلافاصله ظاهر می‌شه. */

/* ── والپیپرهای زنده ── */
const liveModules = import.meta.glob("./live/*.js", { eager: true });

/* ── تصاویر استاتیک ── */
const staticImages = import.meta.glob("./static/*.{jpg,jpeg,png,webp,avif,gif}", {
  eager: true,
  query: "?url",
  import: "default",
});

/* ── پارسر هدر @wallpaper ── */
function parseHeader(src) {
  const m = src.match(/\/\*\s*@wallpaper([\s\S]*?)\*\//);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/);
    if (!mm) continue;
    const key = mm[1].trim();
    const val = mm[2].trim();
    if (key === "tags") out.tags = val.split(",").map((s) => s.trim()).filter(Boolean);
    else out[key] = val;
  }
  return out;
}

function titleFromFilename(path) {
  const base = path.split("/").pop().replace(/\.[^.]+$/, "");
  return base
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ── پردازش والپیپرهای زنده ──
   نکته: هدر رو از خود فایل ماژول نمی‌تونیم بخونیم چون import شده.
   پس از یه کامنت جدا تو define یا از فایل meta.json استفاده می‌کنیم.
   راه‌حل: هر ماژول یه export به اسم `meta` داشته باشه. */
function buildLiveItems() {
  const items = [];
  for (const [path, mod] of Object.entries(liveModules)) {
    const fileName = path.split("/").pop();
    const base = fileName.replace(/\.js$/, "");
    const meta = mod.default?.meta || mod.meta || {};

    items.push({
      id: "l_" + base,
      type: "live",
      title: meta.title || titleFromFilename(path),
      category: meta.category || "abstract",
      tags: meta.tags || [],
      engine: meta.engine || "Canvas 2D",
      cost: meta.cost || "medium",
      module: mod.default,
      thumb: meta.thumb || null,
    });
  }
  return items;
}

/* ── پردازش استاتیک ── */
function buildStaticItems() {
  const items = [];
  for (const [path, url] of Object.entries(staticImages)) {
    const fileName = path.split("/").pop();
    if (fileName.includes("-thumb")) continue;

    const base = fileName.replace(/\.[^.]+$/, "");
    /* الگو: name--category--tag1+tag2.jpg */
    const parts = base.split("--");
    const titleRaw = parts[0] || base;
    const category = parts[1] || "general";
    const tags = parts[2] ? parts[2].split("+").filter(Boolean) : [];

    /* kebab → Title Case فقط برای لاتین */
    const isLatin = /[a-zA-Z]/.test(titleRaw);
    const title = isLatin
      ? titleRaw.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : titleRaw;

    /* thumbnail اگه هست */
    const thumbPath = path.replace(/\.([^.]+)$/, "-thumb.$1");
    const thumb = staticImages[thumbPath] || url;

    items.push({
      id: "s_" + base.replace(/[^\w\u0600-\u06FF-]/g, "_"),
      type: "static",
      title,
      category,
      tags,
      src: url,
      thumb,
    });
  }
  return items;
}

/* ── catalog نهایی ── */
let _cache = null;

export async function loadWallpaperCatalog() {
  if (_cache) return _cache;
  const items = [...buildStaticItems(), ...buildLiveItems()].sort(
    (a, b) =>
      a.category.localeCompare(b.category, "fa") ||
      a.title.localeCompare(b.title, "fa")
  );
  _cache = { version: 1, items };
  return _cache;
}