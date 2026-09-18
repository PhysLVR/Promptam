"use strict";

/* ═══════════════ ابزارها ═══════════════ */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const DATA_KEY = "promptManager_public_v1";
const PREF_KEY = "promptManagerPrefs_public_v1";
const CURRENT_VERSION = 3;

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function uid() {
  return (
    "p_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 7)
  );
}
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[\u200c\u200e\u200f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
function isMobile() {
  return window.matchMedia("(max-width: 760px)").matches;
}
function isTypingContext() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

const ICONS = {
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  folder:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M6 9l6 6 6-6M5 21h14"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M6 15l6-6 6 6M5 3h14"/></svg>',
  sparkle:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8L4 10.7l5.8 1.9L12 18.4l2.1-5.8L20 10.7l-5.9-1.9z"/></svg>',
  sort: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h7M3 12h5M3 16h3"/><path d="M17 4v16M13 16l4 4 4-4"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
};
function icon(name) {
  return ICONS[name] || "";
}

const AI_TARGETS = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    abbr: "G",
    color: "#10a37f",
    url: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
  },
  {
    id: "claude",
    name: "Claude",
    abbr: "Cl",
    color: "#d97757",
    url: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    abbr: "P",
    color: "#20808d",
    url: (q) =>
      `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: "grok",
    name: "Grok",
    abbr: "X",
    color: "#1f2937",
    url: (q) => `https://grok.com/?q=${encodeURIComponent(q)}`,
  },
  {
    id: "gemini",
    name: "Gemini",
    abbr: "Ge",
    color: "#4285f4",
    noPrefill: true,
    url: () => "https://gemini.google.com/app",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    abbr: "D",
    color: "#4d6bfe",
    noPrefill: true,
    url: () => "https://chat.deepseek.com/",
  },
  {
    id: "copilot",
    name: "Copilot",
    abbr: "Co",
    color: "#0a7cd6",
    noPrefill: true,
    url: () => "https://copilot.microsoft.com/",
  },
  {
    id: "qwen",
    name: "Qwen",
    abbr: "Q",
    color: "#615ced",
    noPrefill: true,
    url: () => "https://chat.qwen.ai/",
  },
  {
    id: "mistral",
    name: "Le Chat",
    abbr: "M",
    color: "#fa520f",
    noPrefill: true,
    url: () => "https://chat.mistral.ai/chat",
  },
];

let DATA = { version: CURRENT_VERSION, categories: [], prompts: [] };

function commit(mutator) {
  if (typeof mutator === "function") mutator(DATA);
  save();
  renderChips();
  renderGrid();
  renderCatList();
}

const DEFAULT_CATEGORIES = [
  { id: "write", name: "نوشتن و محتوا", color: "b-blu" },
  { id: "code", name: "کد و فنی", color: "b-grn" },
  { id: "image", name: "تصویرسازی", color: "b-vio" },
  { id: "general", name: "عمومی", color: "b-amb" },
];
const MIGRATIONS = {};
function migrate(d) {
  if (!d || typeof d !== "object") return d;
  const v = Number(d.version) || 1;
  let cur = d;
  for (let i = v; i < CURRENT_VERSION; i++) {
    if (typeof MIGRATIONS[i] === "function") cur = MIGRATIONS[i](cur);
  }
  cur.version = CURRENT_VERSION;
  if (!Array.isArray(cur.categories) || !cur.categories.length)
    cur.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  if (!Array.isArray(cur.prompts)) cur.prompts = [];
  return cur;
}

const PREF_DEFAULTS = {
  theme: "system",
  accent: "default",
  fs: "medium",
  cols: "3",
  sort: "updated",
  sortDir: "desc",
};
let PREFS = Object.assign({}, PREF_DEFAULTS);
function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      Object.keys(PREF_DEFAULTS).forEach((k) => {
        if (typeof p[k] === "string") PREFS[k] = p[k];
      });
    }
  } catch (e) {}
}
function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(PREFS));
  } catch (e) {}
}
function resolveTheme(val) {
  if (val === "system")
    return matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  return val;
}
let _lastTheme = null;
function applyPrefs() {
  const html = document.documentElement;
  const newTheme = resolveTheme(PREFS.theme);
  const themeChanged = _lastTheme !== null && _lastTheme !== newTheme;

  if (themeChanged) {
    html.classList.add("theme-instant");
    void html.offsetWidth;
  }

  html.dataset.theme = newTheme;
  html.dataset.accent = PREFS.accent;
  html.dataset.fs = PREFS.fs;
  html.style.setProperty("--cols", PREFS.cols);
  $("#themeBtn").innerHTML =
    newTheme === "light" ? icon("sun") : icon("moon");

  _lastTheme = newTheme;

  if (themeChanged) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        html.classList.remove("theme-instant");
      }),
    );
  }
}

function save() {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(DATA));
  } catch (e) {
    toast("ذخیره‌سازی ناموفق", "err");
  }
}
function load() {
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) {
    DATA.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    DATA.prompts = [];
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    /* دادهٔ خراب — قبل از reset، خام رو نگه‌دار تا کاربر بتونه نجات بده */
    try {
      localStorage.setItem(
        DATA_KEY + "_corrupted_" + Date.now(),
        raw
      );
    } catch (_) {}
    console.error("load: JSON.parse failed, raw backup saved", e);
    DATA.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    DATA.prompts = [];
    setTimeout(
      () =>
        toast(
          "داده‌ها خوانده نشد؛ نسخهٔ خام بکاپ گرفته شد",
          "err"
        ),
      500
    );
    return;
  }

  /* قبل از هر migration، نسخهٔ اصلی رو نگه‌دار */
  try {
    const v = Number(parsed.version) || 1;
    if (v < CURRENT_VERSION) {
      const key = DATA_KEY + "_pre_v" + v;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, raw);
      }
    }
  } catch (_) {}

  try {
    const m = migrate(parsed);
    DATA.categories = m.categories;
    DATA.prompts = m.prompts;
  } catch (e) {
    /* migration شکست خورد — دادهٔ اصلی دست‌نخورده می‌مونه */
    try {
      localStorage.setItem(
        DATA_KEY + "_migrate_failed_" + Date.now(),
        raw
      );
    } catch (_) {}
    console.error("load: migrate failed, raw backup saved", e);
    DATA.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    DATA.prompts = [];
    setTimeout(
      () =>
        toast(
          "مهاجرت داده‌ها ناموفق بود؛ نسخهٔ قبلی بکاپ شد",
          "err"
        ),
      500
    );
  }
}

let activeCat = "all";
let query = "";

let toastT;
function toast(msg, kind) {
  const el = $("#toast");
  $("#toastTxt").textContent = msg;
  el.classList.remove("err", "warn");
  if (kind === "err") el.classList.add("err");
  else if (kind === "warn") el.classList.add("warn");
  hideUndoToast();
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), 2200);
}
let undoFn = null,
  undoTimer = null;
function toastWithUndo(msg, fn, ms) {
  const el = $("#toastUndo");
  $("#toastUndoTxt").textContent = msg;
  undoFn = fn;
  $("#toast").classList.remove("show");
  clearTimeout(toastT);
  el.classList.add("show");
  clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndoToast, ms || 5000);
}
function hideUndoToast() {
  $("#toastUndo").classList.remove("show");
  clearTimeout(undoTimer);
  undoFn = null;
}

function copyText(txt, msg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(
      () => toast(msg || "کپی شد"),
      () => legacyCopy(txt, msg),
    );
  } else legacyCopy(txt, msg);
}
function legacyCopy(txt, msg) {
  const ta = document.createElement("textarea");
  ta.value = txt;
  ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    toast(msg || "کپی شد");
  } catch (e) {
    toast("کپی ناموفق", "err");
  }
  ta.remove();
}

const VAR_RE = /\{\{\s*([\w\u0600-\u06FF][\w\u0600-\u06FF-]*)\s*\}\}/g;
function extractVars(text) {
  const seen = new Set();
  let m;
  VAR_RE.lastIndex = 0;
  const s = String(text || "");
  while ((m = VAR_RE.exec(s))) seen.add(m[1]);
  return [...seen];
}
function fillVars(text, map) {
  VAR_RE.lastIndex = 0;
  return String(text || "").replace(VAR_RE, (full, key) => {
    const v = map && map[key];
    return v != null && String(v).trim() !== "" ? v : full;
  });
}
function renderContentWithVars(raw) {
  const s = String(raw || "");
  VAR_RE.lastIndex = 0;
  let out = "",
    last = 0,
    m;
  while ((m = VAR_RE.exec(s))) {
    out += esc(s.slice(last, m.index));
    out += `<span class="var">{{${esc(m[1])}}}</span>`;
    last = m.index + m[0].length;
  }
  out += esc(s.slice(last));
  return out;
}

let activeDialogEl = null;
let activeDialogCleanup = null;

function refreshFocusTrap() {
  const dialogEl = document.querySelector(
    ".modal-back.open, .drawer.open, .pv-drawer.open",
  );
  const msearchEl = document.querySelector(".msearch.open");
  /* قفل اسکرول فقط برای پنل‌های تمام‌صفحه.
     سرچ موبایل قفل نمی‌کند تا هدر sticky سر جایش بماند. */
  setActiveDialog(dialogEl || msearchEl, !!dialogEl);
}
/* ── قفل/آزادسازی اسکرول — هم روی html هم body ── */
function lockScroll() {
  document.documentElement.classList.add("no-scroll");
  document.body.classList.add("no-scroll");
  /* موقعیت فعلی اسکرول رو ذخیره کن، بعد قفل کن */
  const y = window.scrollY;
  document.body.style.top = `-${y}px`;
  document.body.dataset.savedScroll = String(y);
}
function unlockScroll() {
  document.documentElement.classList.remove("no-scroll");
  document.body.classList.remove("no-scroll");
  const y = Number(document.body.dataset.savedScroll || 0);
  document.body.style.top = "";
  delete document.body.dataset.savedScroll;
  window.scrollTo(0, y);
}

function setActiveDialog(el, forceScrollLock) {
  if (activeDialogCleanup) {
    activeDialogCleanup();
    activeDialogCleanup = null;
  }
  activeDialogEl = el;
  /* اگر صریحاً false داده شد، قفل نکن حتی اگر el هست
     (برای سرچ موبایل که هدر sticky را جابه‌جا می‌کند) */
  const shouldLock =
    forceScrollLock === undefined ? !!el : !!forceScrollLock;
  if (shouldLock) lockScroll();
  else unlockScroll();
  if (!el) return;
  const prev = document.activeElement;
  const sel =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const handler = (e) => {
    if (e.key !== "Tab") return;
    const nodes = Array.from(el.querySelectorAll(sel)).filter(
      (n) => n.offsetParent !== null,
    );
    if (!nodes.length) {
      e.preventDefault();
      return;
    }
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  el.addEventListener("keydown", handler);
  activeDialogCleanup = () => {
    el.removeEventListener("keydown", handler);
    if (prev && prev.focus) {
      try {
        prev.focus();
      } catch (_) {}
    }
  };
}

let dialogResolve = null;
let dialogMode = "confirm";

/* ── بازسازی دکمه‌های پیش‌فرض مودال دیالوگ ──
askImportMode دکمه‌های این فوتر را جایگزین می‌کند؛
بعد از آن، دیالوگ‌های بعدی باید دکمه‌های استاندارد را برگردانند. */
function restoreDialogFoot() {
  const foot = document.querySelector("#dialogBack .modal .foot");
  if (!foot) return;
  foot.innerHTML =
    '<button class="btn g" id="dialogOk">تأیید</button>' +
    '<button class="btn" id="dialogCancel">انصراف</button>';
  $("#dialogOk").onclick = () => {
    if (dialogMode === "prompt") closeDialog($("#dialogField").value);
    else closeDialog(true);
  };
  $("#dialogCancel").onclick = () =>
    closeDialog(dialogMode === "prompt" ? null : false);
}

function openDialog(opts) {
  return new Promise((resolve) => {
    restoreDialogFoot();
    dialogResolve = resolve;
    dialogMode = opts.mode || "confirm";
    $("#dialogIcon").textContent =
      opts.icon || (dialogMode === "prompt" ? "✎" : "؟");
    $("#dialogTitle").textContent = opts.title || "تأیید";
    $("#dialogMsg").innerHTML = opts.message || "";
    const ok = $("#dialogOk");
    ok.textContent = opts.okText || "تأیید";
    ok.classList.toggle("dgr", !!opts.danger);
    if (dialogMode === "prompt") {
      $("#dialogFieldWrap").style.display = "";
      $("#dialogFieldLabel").textContent = opts.label || "مقدار";
      $("#dialogField").value = opts.value || "";
      $("#dialogField").placeholder = opts.placeholder || "";
      setTimeout(() => $("#dialogField").focus(), 100);
    } else {
      $("#dialogFieldWrap").style.display = "none";
    }
    $("#dialogBack").classList.add("open");
    refreshFocusTrap();
    if (dialogMode !== "prompt") setTimeout(() => ok.focus(), 100);
  });
}
function closeDialog(value) {
  $("#dialogBack").classList.remove("open");
  refreshFocusTrap();
  const r = dialogResolve;
  dialogResolve = null;
  if (r) r(value);
}
const uiConfirm = (opts) =>
  openDialog(Object.assign({ mode: "confirm" }, opts));
const uiPrompt = (opts) =>
  openDialog(Object.assign({ mode: "prompt" }, opts));

function buildCSelect(rootId, { items, value, onChange }) {
  const root = $("#" + rootId);
  const menu = root.querySelector(".cselect-menu");
  const label = root.querySelector(".cs-label");
  let current = value;

  function render() {
    menu.innerHTML = items
      .map(
        (it) => `
<button type="button" class="cselect-item ${it.v === current ? "on" : ""}" data-v="${esc(it.v)}">
<span class="ci-check">${icon("check")}</span>
<span>${esc(it.label)}</span>
</button>
`,
      )
      .join("");
    const found = items.find((i) => i.v === current);
    label.textContent = found ? found.label : "—";
  }
  function close() {
    root.classList.remove("open");
  }

  root.querySelector(".cselect-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = root.classList.contains("open");
    $$(".cselect.open").forEach((c) => c.classList.remove("open"));
    if (!isOpen) root.classList.add("open");
  });
  menu.addEventListener("click", (e) => {
    const b = e.target.closest(".cselect-item");
    if (!b) return;
    current = b.dataset.v;
    render();
    close();
    if (onChange) onChange(current);
  });
  render();
  return {
    get value() {
      return current;
    },
    set value(v) {
      current = v;
      render();
    },
    refresh(newItems) {
      items = newItems;
      render();
    },
  };
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".cselect"))
    $$(".cselect.open").forEach((c) => c.classList.remove("open"));
});

function renderChips() {
  const c = $("#chips");
  const total = DATA.prompts.length;
  let html = `<button class="chip ${activeCat === "all" ? "on" : ""}" data-c="all">
همه <span class="cnt">${total}</span>
</button>`;
  DATA.categories.forEach((cat) => {
    const n = DATA.prompts.filter((p) => p.category === cat.id).length;
    html += `<button class="chip ${activeCat === cat.id ? "on" : ""}" data-c="${cat.id}">
<span class="dot ${cat.color}"></span>${esc(cat.name)}
<span class="cnt">${n}</span>
</button>`;
  });
  c.innerHTML = html;
  c.querySelectorAll(".chip").forEach((b) => {
    b.onclick = () => {
      if (activeCat === b.dataset.c) return;
      activeCat = b.dataset.c;
      renderChips();
      renderGrid();
      const g = $("#grid");
      g.classList.remove("filtering");
      void g.offsetWidth;
      g.classList.add("filtering");
    };
  });
}

function renderCatList() {
  const el = $("#catList");
  if (!el) return;
  if (!DATA.categories.length) {
    el.innerHTML = `<div style="font-size:var(--f-xs);color:var(--dim);padding:6px 2px">هنوز دسته‌ای نداری.</div>`;
    return;
  }
  el.innerHTML = DATA.categories
    .map((c) => {
      const n = DATA.prompts.filter((p) => p.category === c.id).length;
      return `<div class="cat-item" data-id="${c.id}">
<span class="dot ${c.color}"></span>
<span class="cat-item-name">${esc(c.name)}</span>
<span class="cat-item-cnt">${n}</span>
<button class="cat-item-btn" data-act="edit-cat" title="ویرایش" aria-label="ویرایش">${icon("edit")}</button>
<button class="cat-item-btn dgr" data-act="del-cat" title="حذف" aria-label="حذف">${icon("trash")}</button>
</div>`;
    })
    .join("");
}

function catById(id) {
  return (
    DATA.categories.find((x) => x.id === id) || {
      id: "",
      name: "—",
      color: "b-blu",
    }
  );
}
function filtered() {
  const q = norm(query);
  const terms = q.split(" ").filter(Boolean);
  const arr = DATA.prompts.filter((p) => {
    if (activeCat !== "all" && p.category !== activeCat) return false;
    if (!terms.length) return true;
    const hay = norm(
      [
        p.title,
        p.description || "",
        (p.tags || []).join(" "),
        p.content,
      ].join(" "),
    );
    return terms.every((t) => hay.indexOf(t) >= 0);
  });
  const sort = PREFS.sort || "updated";
  const dirMul = PREFS.sortDir === "asc" ? 1 : -1;
  return arr.sort((a, b) => {
    const pa = a.pinned ? 1 : 0,
      pb = b.pinned ? 1 : 0;
    if (pb - pa) return pb - pa; /* سنجاق‌شده‌ها همیشه بالا */
    let cmp = 0;
    if (sort === "title")
      cmp = (a.title || "").localeCompare(b.title || "", "fa");
    else if (sort === "created")
      cmp = (a.createdAt || 0) - (b.createdAt || 0);
    else cmp = (a.updatedAt || 0) - (b.updatedAt || 0);
    return cmp * dirMul;
  });
}

let _firstRenderDone = false;
function renderGrid() {
  const g = $("#grid");
  if (_firstRenderDone) g.classList.add("no-anim");
  else _firstRenderDone = true;
  const list = filtered();
  if (!list.length) {
    const empty = DATA.prompts.length === 0;
    g.innerHTML = `<div class="empty" style="grid-column:1/-1">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
<path d="M14 2v6h6"/>
<path d="M9 13h6"/>
<path d="M9 17h4"/>
</svg>
${
empty
? `<h3>هنوز پرامپتی نداری</h3>
<p>روی «＋ پرامپت جدید» بزن یا از تنظیمات «۶ پرامپت پیش‌فرض» را اضافه کن.</p>`
: `<h3>موردی پیدا نشد</h3>
<p>دستهٔ دیگری را امتحان کن یا متن جست‌وجو را کوتاه‌تر کن.</p>`
}
</div>`;
    return;
  }
  g.innerHTML = list
    .map((p) => {
      const cat = catById(p.category);
      const tags = (p.tags || [])
        .map((t) => `<span class="tag"><span class="th">#</span><span class="tw">${esc(t)}</span></span>`)
        .join("");
      const varCount = extractVars(p.content).length;
      const copyTip = varCount ? `کپی (${varCount} متغیر)` : "کپی متن";
      return `
<div class="card" data-id="${p.id}">
<div class="phead">
<button class="pin ${p.pinned ? "on" : ""}" data-act="pin"
data-tip="${p.pinned ? "برداشتن سنجاق" : "سنجاق"}"
aria-label="${p.pinned ? "برداشتن سنجاق" : "سنجاق"}"
aria-pressed="${p.pinned ? "true" : "false"}">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<line x1="12" y1="17" x2="12" y2="22"/>
<path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
</svg>
</button>
<b dir="auto">${esc(p.title)}</b>
<span class="pcat ${cat.color}">${esc(cat.name)}</span>
</div>
${p.description ? `<div class="pdesc" dir="auto">${esc(p.description)}</div>` : ""}
${tags ? `<div class="ptags">${tags}</div>` : ""}
<div class="pfoot">
<button class="ibtn" data-act="toggle" data-tip="نمایش متن" aria-label="نمایش متن">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
<circle cx="12" cy="12" r="3"/>
</svg>
</button>
<button class="ibtn" data-act="copy" data-tip="${copyTip}" aria-label="${copyTip}">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<rect x="9" y="9" width="11" height="11" rx="2"/>
<path d="M5 15V5a2 2 0 0 1 2-2h10"/>
</svg>
</button>
<div class="grow"></div>
<button class="ibtn" data-act="edit" data-tip="ویرایش" aria-label="ویرایش">${icon("edit")}</button>
<button class="ibtn dgr" data-act="del" data-tip="حذف" aria-label="حذف">${icon("trash")}</button>
</div>
</div>
`;
    })
    .join("");
  if (selectMode) {
    updateCardsSelection();
    updateSelBar();
  }
}

async function deletePrompt(id) {
  const idx = DATA.prompts.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const p = DATA.prompts[idx];
  const ok = await uiConfirm({
    title: "حذف پرامپت",
    icon: "⚠",
    message: `پرامپت «<b>${esc(p.title)}</b>» حذف شود؟`,
    okText: "حذف",
    danger: true,
  });
  if (!ok) return;
  const snapshot = { p, index: idx };
  commit((d) => {
    d.prompts = d.prompts.filter((x) => x.id !== id);
  });
  toastWithUndo(`«${p.title}» حذف شد`, () => {
    commit((d) => {
      d.prompts.splice(snapshot.index, 0, snapshot.p);
    });
    toast("بازگردانی شد");
  });
}

/* ═══════════ حالت انتخاب چندگانه ═══════════ */
let selectMode = false;
let suppressClickUntil = 0;
const selectedIds = new Set();

function enterSelectMode(initialId) {
  selectMode = true;
  selectedIds.clear();
  if (initialId) selectedIds.add(initialId);
  document.body.classList.add("selmode");
  const btn = $("#selectModeBtn");
  if (btn) {
    btn.classList.add("on");
    btn.setAttribute("aria-pressed", "true");
    btn.setAttribute("title", "خروج از انتخاب");
  }
  updateCardsSelection();
  updateSelBar();
}
function exitSelectMode() {
  selectMode = false;
  selectedIds.clear();
  document.body.classList.remove("selmode");
  const btn = $("#selectModeBtn");
  if (btn) {
    btn.classList.remove("on");
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("title", "انتخاب چندگانه");
  }
  updateCardsSelection();
  updateSelBar();
}
function toggleCardSelection(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  updateCardsSelection();
  updateSelBar();
}
function updateCardsSelection() {
  $$("#grid .card").forEach((c) => {
    c.classList.toggle("selected", selectedIds.has(c.dataset.id));
  });
}
function updateSelBar() {
  const bar = $("#selBar");
  if (!bar) return;
  if (!selectMode) {
    bar.classList.remove("show");
    return;
  }
  bar.classList.add("show");
  const count = selectedIds.size;
  const cntEl = $("#selCount");
  if (cntEl) cntEl.textContent = toFaNum(count);
  const has = count > 0;
  $$("#selBar [data-sel-act]").forEach((b) => {
    b.disabled = !has;
  });

  const SVG_PIN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>';
  const SVG_UNPIN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"/><path d="m2 2 20 20"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/></svg>';

  const SVG_ALL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 11 4 4 8-8"/><path d="m10 15 4 4 8-8"/></svg>';
  const SVG_NONE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m9 9 6 6M15 9l-6 6"/></svg>';

  const pinBtn = $("#selPinBtn");
  if (pinBtn) {
    let allPinned = false;
    if (has) {
      allPinned = [...selectedIds].every((id) => {
        const p = DATA.prompts.find((x) => x.id === id);
        return p && p.pinned;
      });
    }
    const icoEl = pinBtn.querySelector(".sel-ico");
    if (icoEl) icoEl.innerHTML = allPinned ? SVG_UNPIN : SVG_PIN;
    const lblEl = pinBtn.querySelector(".sel-lbl");
    if (lblEl) lblEl.textContent = allPinned ? "برداشتن" : "سنجاق";
    const label = allPinned ? "برداشتن سنجاق" : "سنجاق";
    pinBtn.setAttribute("aria-label", label);
    pinBtn.setAttribute("title", label);
  }

  const allBtn = $("#selAllBtn");
  if (allBtn) {
    const visible = filtered();
    const allSel =
      visible.length > 0 &&
      visible.every((p) => selectedIds.has(p.id));
    const icoEl = allBtn.querySelector(".sel-ico");
    if (icoEl) icoEl.innerHTML = allSel ? SVG_NONE : SVG_ALL;
    const lblEl = allBtn.querySelector(".sel-lbl");
    if (lblEl) lblEl.textContent = allSel ? "هیچ‌کدام" : "همه";
    const label = allSel ? "هیچ‌کدام" : "همه";
    allBtn.setAttribute("aria-label", label);
    allBtn.setAttribute("title", label);
  }
}
function toggleSelectAll() {
  const visible = filtered();
  if (!visible.length) return;
  const allSel = visible.every((p) => selectedIds.has(p.id));
  if (allSel) visible.forEach((p) => selectedIds.delete(p.id));
  else visible.forEach((p) => selectedIds.add(p.id));
  updateCardsSelection();
  updateSelBar();
}
async function bulkDelete() {
  const ids = [...selectedIds];
  if (!ids.length) return;
  const ok = await uiConfirm({
    title: "حذف گروهی",
    icon: "⚠",
    message: `${toFaNum(ids.length)} پرامپت انتخاب‌شده حذف شوند؟`,
    okText: "حذف",
    danger: true,
  });
  if (!ok) return;

  const idSet = new Set(ids);
  const snapshot = [];
  DATA.prompts.forEach((p, i) => {
    if (idSet.has(p.id)) snapshot.push({ p, index: i });
  });

  exitSelectMode();
  commit((d) => {
    d.prompts = d.prompts.filter((p) => !idSet.has(p.id));
  });

  toastWithUndo(`${toFaNum(ids.length)} پرامپت حذف شد`, () => {
    commit((d) => {
      snapshot
        .slice()
        .sort((a, b) => a.index - b.index)
        .forEach((s) => {
          d.prompts.splice(s.index, 0, s.p);
        });
    });
    toast("بازگردانی شد");
  });
}
function bulkPin() {
  const ids = [...selectedIds];
  if (!ids.length) return;
  const idSet = new Set(ids);
  const allPinned = ids.every((id) => {
    const p = DATA.prompts.find((x) => x.id === id);
    return p && p.pinned;
  });
  const newState = !allPinned;
  commit((d) => {
    d.prompts.forEach((p) => {
      if (idSet.has(p.id)) {
        p.pinned = newState;
        p.updatedAt = Date.now();
      }
    });
  });
  const count = ids.length;
  exitSelectMode();
  toast(
    newState
      ? `${toFaNum(count)} پرامپت سنجاق شد`
      : `سنجاق از ${toFaNum(count)} پرامپت برداشته شد`,
  );
}
function openBulkMove() {
  if (!selectedIds.size) return;
  const list = $("#bulkMoveList");
  const desc = $("#bulkMoveDesc");
  if (!list || !desc) return;
  desc.innerHTML = `${toFaNum(
    selectedIds.size,
  )} پرامپت به کدام دسته منتقل شوند؟`;
  list.innerHTML = DATA.categories
    .map((c) => {
      const n = DATA.prompts.filter((p) => p.category === c.id).length;
      return `<button class="cat-item" type="button" data-cat="${esc(
        c.id,
      )}">
<span class="dot ${esc(c.color)}"></span>
<span class="cat-item-name">${esc(c.name)}</span>
<span class="cat-item-cnt">${toFaNum(n)}</span>
</button>`;
    })
    .join("");
  $("#bulkMoveBack").classList.add("open");
  refreshFocusTrap();
}
function closeBulkMove() {
  $("#bulkMoveBack").classList.remove("open");
  refreshFocusTrap();
}

/* ورود با نگه‌داشتن روی کارت (لمس طولانی موبایل) */
(function setupLongPressSelect() {
  const grid = $("#grid");
  if (!grid) return;
  let timer = null;
  let pressedCard = null;
  let sx = 0,
    sy = 0;

  grid.addEventListener(
    "touchstart",
    (e) => {
      if (selectMode) return;
      if (e.touches.length !== 1) return;
      if (e.target.closest("button, a, input, textarea")) return;
      const card = e.target.closest(".card");
      if (!card) return;
      pressedCard = card;
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (!pressedCard) return;
        suppressClickUntil = Date.now() + 700;
        if (navigator.vibrate) navigator.vibrate(15);
        enterSelectMode(pressedCard.dataset.id);
        pressedCard = null;
      }, 480);
    },
    { passive: true },
  );

  grid.addEventListener(
    "touchmove",
    (e) => {
      if (!timer) return;
      const t = e.touches[0];
      if (
        Math.abs(t.clientX - sx) > 8 ||
        Math.abs(t.clientY - sy) > 8
      ) {
        clearTimeout(timer);
        timer = null;
        pressedCard = null;
      }
    },
    { passive: true },
  );

  const cancel = () => {
    clearTimeout(timer);
    timer = null;
    pressedCard = null;
  };
  grid.addEventListener("touchend", cancel, { passive: true });
  grid.addEventListener("touchcancel", cancel, { passive: true });
})();

$("#grid").addEventListener("click", (e) => {
  if (Date.now() < suppressClickUntil) {
    suppressClickUntil = 0;
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  const card = e.target.closest(".card");
  if (!card) return;
  if (selectMode) {
    e.preventDefault();
    e.stopPropagation();
    toggleCardSelection(card.dataset.id);
    return;
  }
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = card.dataset.id;
  const p = DATA.prompts.find((x) => x.id === id);
  if (!p) return;
  e.stopPropagation();
  const act = btn.dataset.act;
  if (act === "toggle") openPreview(p);
  else if (act === "copy") requestCopy(p);
  else if (act === "edit") openModal(p);
  else if (act === "del") deletePrompt(id);
  else if (act === "pin") {
    commit((d) => {
      const t = d.prompts.find((x) => x.id === id);
      if (t) {
        t.pinned = !t.pinned;
        t.updatedAt = Date.now();
      }
    });
  }
});

let currentPvId = null;

/* ═══ Gutter Engine: VSCode-style ═══
   شماره فقط روی اولین خط بصری هر خط منطقی می‌نشیند.
   خطوطی که به‌خاطر wrap بصری ادامه دارند، بدون شماره می‌مانند. */
const _gutterMeasureEl = document.createElement("div");
_gutterMeasureEl.setAttribute("aria-hidden", "true");
_gutterMeasureEl.style.cssText =
  "position:absolute;top:-99999px;left:-99999px;visibility:hidden;" +
  "pointer-events:none;white-space:pre-wrap;overflow-wrap:anywhere;" +
  "word-break:normal;hyphens:none;tab-size:2;margin:0;border:0;padding:0;";
document.body.appendChild(_gutterMeasureEl);

function _measureVisualRows(lines, contentWidth, cs, lineHeightPx) {
  const counts = new Array(lines.length);
  if (!lines.length) return counts;
  _gutterMeasureEl.style.width = Math.max(1, contentWidth) + "px";
  _gutterMeasureEl.style.fontFamily = cs.fontFamily;
  _gutterMeasureEl.style.fontSize = cs.fontSize;
  _gutterMeasureEl.style.fontWeight = cs.fontWeight;
  _gutterMeasureEl.style.fontStyle = cs.fontStyle;
  _gutterMeasureEl.style.letterSpacing = cs.letterSpacing;
  _gutterMeasureEl.style.lineHeight = cs.lineHeight;
  _gutterMeasureEl.textContent = lines.join("\n");
  const node = _gutterMeasureEl.firstChild;
  if (!node) {
    for (let i = 0; i < lines.length; i++) counts[i] = 1;
    return counts;
  }
  let off = 0;
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i].length;
    if (len === 0) {
      counts[i] = 1;
    } else {
      const r = document.createRange();
      r.setStart(node, off);
      r.setEnd(node, off + len);
      const rects = r.getClientRects();
      let rows = 0;
      let lastTop = -Infinity;
      for (let j = 0; j < rects.length; j++) {
        const t = rects[j].top;
        if (Math.abs(t - lastTop) > 1) {
          rows++;
          lastTop = t;
        }
      }
      counts[i] = Math.max(1, rows);
    }
    off += len + 1;
  }
  return counts;
}

/* کش خط‌به‌خط: فقط خط‌های واقعاً تغییرکرده دوباره اندازه‌گیری می‌شن */
let _gutterCache = { lines: [], counts: [], width: -1 };

function _buildGutterText(text, sourceEl) {
  const s = String(text || "");
  const lines = s.split(/\r?\n/);

  if (!sourceEl || !sourceEl.isConnected || sourceEl.clientWidth === 0) {
    const arr = new Array(lines.length);
    for (let i = 0; i < lines.length; i++) arr[i] = i + 1;
    return arr.join("\n");
  }

  _gutterMeasureEl.dir = sourceEl.getAttribute("dir") || "auto";
  const cs = getComputedStyle(sourceEl);
  const pl = parseFloat(cs.paddingLeft) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  const contentWidth = sourceEl.clientWidth - pl - pr;
  const lineHeightPx = parseFloat(cs.lineHeight) || 20;

  /* اگه عرض عوض شده (ریسایز، toggle متا و…)، کش کلاً بی‌اعتباره */
  const widthChanged = Math.abs(contentWidth - _gutterCache.width) > 0.5;
  const cachedLines = widthChanged ? [] : _gutterCache.lines;
  const cachedCounts = widthChanged ? [] : _gutterCache.counts;

  /* پیدا کردن پیشوند و پسوند مشترک با نسخهٔ قبلی */
  let prefixLen = 0;
  const maxCommon = Math.min(lines.length, cachedLines.length);
  while (prefixLen < maxCommon && lines[prefixLen] === cachedLines[prefixLen]) {
    prefixLen++;
  }
  let suffixLen = 0;
  const maxSuffix = maxCommon - prefixLen;
  while (
    suffixLen < maxSuffix &&
    lines[lines.length - 1 - suffixLen] ===
      cachedLines[cachedLines.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  /* فقط تکهٔ وسط (تغییرکرده) رو دوباره اندازه بگیر */
  const midStart = prefixLen;
  const midEnd = lines.length - suffixLen;
  const midLines = lines.slice(midStart, midEnd);
  const midCounts = midLines.length
    ? _measureVisualRows(midLines, contentWidth, cs, lineHeightPx)
    : [];

  const counts = new Array(lines.length);
  for (let i = 0; i < prefixLen; i++) counts[i] = cachedCounts[i];
  for (let i = 0; i < midCounts.length; i++) counts[midStart + i] = midCounts[i];
  for (let i = 0; i < suffixLen; i++) {
    counts[lines.length - 1 - i] = cachedCounts[cachedLines.length - 1 - i];
  }

  _gutterCache = { lines, counts, width: contentWidth };

  const out = [];
  let n = 1;
  for (let i = 0; i < counts.length; i++) {
    out.push(String(n));
    for (let k = 1; k < counts[i]; k++) out.push("");
    n++;
  }
  return out.join("\n");
}

function updatePreviewGutter(text) {
  const gutter = document.getElementById("pvGutter");
  if (!gutter) return;
  const pre = document.getElementById("pvContent");
  gutter.textContent = _buildGutterText(text, pre);
  gutter.scrollTop = 0;
}

/* هم‌زمانی اسکرول عمودی گاتر با متن پیش‌نمایش */
(function bindPreviewGutterSync() {
  const pre = document.getElementById("pvContent");
  const gutter = document.getElementById("pvGutter");
  if (!pre || !gutter) return;
  pre.addEventListener("scroll", () => {
    gutter.scrollTop = pre.scrollTop;
  });
})();

function openPreview(p) {
  currentPvId = p.id;
  const cat = catById(p.category);
  const vars = extractVars(p.content);
  $("#pvTitle").textContent = p.title;
  $("#pvDesc").textContent = p.description || "";
  $("#pvContent").innerHTML = renderContentWithVars(p.content);
  updatePreviewGutter(p.content);
  const pre = $("#pvContent");
  if (pre) {
    applyTextDir(pre, p.content);
    pre.scrollTop = 0;
    scrollLogicalStart(pre);
  }

  $$("#pvDrawer .var-hint").forEach((el) => el.remove());
  if (vars.length) {
    const hint = document.createElement("div");
    hint.className = "var-hint";
    hint.innerHTML =
      `<svg class="var-hint-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
      `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>` +
      `</svg>` +
      `<span>این پرامپت <b>${vars.length}</b> متغیر دارد — هنگام کپی، فرم پر کردن باز می‌شود.</span>`;
    $("#pvDesc").insertAdjacentElement("afterend", hint);
  }

  let metaHtml = `<span class="pcat ${cat.color}">${esc(cat.name)}</span>`;
  (p.tags || []).forEach((t) => {
    metaHtml += `<span class="tag"><span class="th">#</span><span class="tw">${esc(t)}</span></span>`;
  });
  $("#pvMeta").innerHTML = metaHtml;

  $("#pvDrawer").classList.add("open");
  $("#pvDrawer").setAttribute("aria-hidden", "false");
  $("#pvBack").classList.add("open");
  refreshFocusTrap();
}
function closePreview() {
  currentPvId = null;
  $("#pvDrawer").classList.remove("open");
  $("#pvDrawer").setAttribute("aria-hidden", "true");
  $("#pvBack").classList.remove("open");
  closeAiMenu();
  refreshFocusTrap();
}

function renderAiMenu() {
  const menu = $("#pvAiMenu");
  if (!menu || menu.dataset.built === "1") return;
  menu.innerHTML = AI_TARGETS.map(
    (t) => `
<button type="button" class="ai-open-item" data-ai="${t.id}" role="menuitem">
<span class="ai-dot" style="--ai-c:${t.color}">${esc(t.abbr)}</span>
<span>${esc(t.name)}</span>
${t.noPrefill ? '<span class="ai-tag">کپی</span>' : ""}
</button>`,
  ).join("");
  menu.dataset.built = "1";
}
function openAiMenu() {
  renderAiMenu();
  $("#pvAiWrap").classList.add("open");
}
function closeAiMenu() {
  $("#pvAiWrap").classList.remove("open");
}
function toggleAiMenu() {
  if ($("#pvAiWrap").classList.contains("open")) closeAiMenu();
  else openAiMenu();
}

function copyTextAsync(txt) {
  return new Promise((resolve) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(
        () => resolve(true),
        () => resolve(legacyCopySilent(txt)),
      );
    } else {
      resolve(legacyCopySilent(txt));
    }
  });
}
function legacyCopySilent(txt) {
  const ta = document.createElement("textarea");
  ta.value = txt;
  ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {}
  ta.remove();
  return ok;
}
function openInAI(p, target) {
  const vars = extractVars(p.content);
  if (vars.length) {
    openVarModal(p, vars, { aiTarget: target });
    return;
  }
  const win = window.open("", "_blank");
  copyTextAsync(p.content).then((ok) => {
    if (!win) {
      toast(
        ok
          ? "کپی شد؛ مرورگر اجازهٔ باز کردن تب جدید نداد"
          : "کپی و باز کردن هر دو ناموفق بود",
        "err",
      );
      return;
    }
    win.location.href = target.url(p.content);
    toast(
      ok
        ? `کپی شد — باز شد در ${target.name}`
        : `باز شد در ${target.name} (کپی ناموفق)`,
      ok ? undefined : "err",
    );
  });
}

let varState = null;
function requestCopy(p) {
  const vars = extractVars(p.content);
  if (!vars.length) {
    copyText(p.content, "متن پرامپت کپی شد");
    return;
  }
  openVarModal(p, vars);
}

function openVarModal(p, vars, opts) {
  varState = {
    prompt: p,
    values: {},
    pendingAI: (opts && opts.aiTarget) || null,
  };
  const form = $("#varForm");
  form.innerHTML = vars
    .map(
      (v) => `
<div class="var-row">
<label><code>{{${esc(v)}}}</code></label>
<input type="text" data-var="${esc(v)}" placeholder="مقدار…" autocomplete="off">
</div>
`,
    )
    .join("");

  /* پیش‌نمایش رو ببند هر بار باز کردن */
  const pvBox = $("#varPreviewBox");
  if (pvBox) pvBox.open = false;

  const inputs = Array.from(form.querySelectorAll("input[data-var]"));
  inputs.forEach((inp, i) => {
    inp.addEventListener("input", () => {
      varState.values[inp.dataset.var] = inp.value;
      updateVarPreview();
    });
    /* Enter = برو فیلد بعدی؛ تو فیلد آخر = کپی */
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const next = inputs[i + 1];
        if (next) next.focus();
        else $("#varCopyBtn").click();
      }
    });
  });

  updateVarPreview();
  $("#varModalBack").classList.add("open");
  refreshFocusTrap();
  setTimeout(() => {
    if (inputs[0]) inputs[0].focus();
  }, 100);
}
  
function updateVarPreview() {
  if (!varState) return;

  const varPreviewEl = $("#varPreview");
  if (varPreviewEl) {
    varPreviewEl.scrollTop = 0;
    scrollLogicalStart(varPreviewEl);
  }

  const filled = fillVars(varState.prompt.content, varState.values);
  varPreviewEl.textContent = filled;
  applyTextDir(varPreviewEl, filled);
}
function closeVarModal() {
  $("#varModalBack").classList.remove("open");
  refreshFocusTrap();
  varState = null;
}
function copyVarFinal() {
  if (!varState) return;
  const txt = fillVars(varState.prompt.content, varState.values);
  const target = varState.pendingAI;

  if (target) {
    const win = window.open("", "_blank");
    copyTextAsync(txt).then((ok) => {
      if (!win) {
        toast(
          ok
            ? "کپی شد؛ مرورگر اجازهٔ باز کردن تب جدید نداد"
            : "کپی و باز کردن هر دو ناموفق بود",
          "err",
        );
        return;
      }
      win.location.href = target.url(txt);
      toast(
        ok
          ? `کپی شد — باز شد در ${target.name}`
          : `باز شد در ${target.name} (کپی ناموفق)`,
        ok ? undefined : "err",
      );
    });
  } else {
    copyText(txt, "متن نهایی کپی شد");
  }
  closeVarModal();
}

function copyVarRaw() {
  if (!varState) return;
  copyText(varState.prompt.content, "متن خام کپی شد");
  closeVarModal();
}

const editorArea = $("#pContent");
const editorGutter = $("#editorGutter");
const editorModal = $("#editorModal");
const metaToggleBtn = $("#metaToggle");

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
function toFaNum(n) {
  return String(n)
    .replace(/\B(?=(\d{3})+(?!\d))/g, "٬")
    .replace(/\d/g, (d) => FA_DIGITS[+d]);
}
function countWords(text) {
  const s = String(text || "").trim();
  if (!s) return 0;
  return s.split(/\s+/).filter(Boolean).length;
}
function estimateTokens(text) {
  const s = String(text || "");
  if (!s) return 0;
  return Math.round(s.length / 3.5);
}
function updateEditorGutter() {
  editorGutter.textContent = _buildGutterText(
    editorArea.value,
    editorArea,
  );
  editorGutter.scrollTop = editorArea.scrollTop;
}

function updateEditorStats() {
  const v = editorArea.value;
  const lines = v.split("\n").length;
  $("#statLines").textContent = toFaNum(lines) + " خط";
  $("#statChars").textContent = toFaNum(v.length) + " کاراکتر";
  $("#statWords").textContent = toFaNum(countWords(v)) + " کلمه";
  $("#statTokens").textContent =
    "~" + toFaNum(estimateTokens(v)) + " توکن";
}
function syncEditor() {
  updateEditorGutter();
  updateEditorStats();
  applyTextDir(editorArea, editorArea.value);
}

editorArea.addEventListener("input", syncEditor);
editorArea.addEventListener("scroll", () => {
  editorGutter.scrollTop = editorArea.scrollTop;
});
/* موبایل: وقتی فوکوس میره رو متن (یعنی کیبورد باز می‌شه)، متادیتا رو جمع کن
   تا فضای متن + دکمه‌های پایین همیشه تضمین‌شده باشه —
   مستقل از موقعیت تو سند، بدون نیاز به اسکرول کل مودال */

editorArea.addEventListener("keydown", (e) => {
  if (
    e.key === "Tab" &&
    !e.shiftKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey
  ) {
    e.preventDefault();
    const s = editorArea.selectionStart;
    const en = editorArea.selectionEnd;
    editorArea.setRangeText("  ", s, en, "end");
    syncEditor();
  }
});

metaToggleBtn.addEventListener("click", () => {
  const hidden = editorModal.classList.toggle("meta-hidden");
  metaToggleBtn.classList.toggle("on", !hidden);
  metaToggleBtn.setAttribute("aria-pressed", hidden ? "false" : "true");
});

let pCatSelect = null;

function initPromptCatSelect() {
  pCatSelect = buildCSelect("pCatSel", {
    items: [],
    value: "",
    onChange: (v) => {
      $("#pCat").value = v;
    },
  });
}
function refreshPromptCatSelect(selected) {
  const items = DATA.categories.map((c) => ({ v: c.id, label: c.name }));
  const fallback = selected || (items[0] && items[0].v) || "";
  if (pCatSelect) {
    pCatSelect.refresh(items);
    pCatSelect.value = fallback;
  }
  $("#pCat").value = fallback;
}
function openModal(p) {
  $("#modalTitle").textContent = p ? "ویرایش پرامپت" : "افزودن پرامپت";
  $("#pId").value = p ? p.id : "";
  $("#pTitle").value = p ? p.title : "";
  $("#pTags").value = p ? (p.tags || []).join(", ") : "";
  $("#pDesc").value = p ? p.description || "" : "";
  editorArea.value = p ? p.content : "";
  refreshPromptCatSelect(p ? p.category : null);

  editorModal.classList.remove("meta-hidden");
  metaToggleBtn.classList.add("on");
  metaToggleBtn.setAttribute("aria-pressed", "true");

  applyTextDir(editorArea, editorArea.value);
  editorArea.scrollTop = 0;
  scrollLogicalStart(editorArea);

  $("#modalBack").classList.add("open");
  refreshFocusTrap();
  syncEditor();

  setTimeout(() => {
    if (!$("#pTitle").value) $("#pTitle").focus();
    else editorArea.focus();
  }, 100);
}
function closeModal() {
  $("#modalBack").classList.remove("open");
  refreshFocusTrap();
}
function ensureMetaVisible() {
  if (editorModal.classList.contains("meta-hidden")) {
    editorModal.classList.remove("meta-hidden");
    metaToggleBtn.classList.add("on");
    metaToggleBtn.setAttribute("aria-pressed", "true");
  }
}
function flashField(el) {
  if (!el) return;
  el.classList.remove("field-error");
  el.classList.add("field-error");
  clearTimeout(el._errT);
  el._errT = setTimeout(() => el.classList.remove("field-error"), 800);
}

function savePrompt() {
  const id = $("#pId").value;
  const title = $("#pTitle").value.trim();
  const content = $("#pContent").value;

  if (!title) {
    ensureMetaVisible();
    flashField($("#pTitle"));
    toast("عنوان لازم است", "err");
    setTimeout(() => $("#pTitle").focus(), 60);
    return;
  }
  if (!content.trim()) {
    flashField($("#pContent"));
    toast("متن پرامپت لازم است", "err");
    setTimeout(() => $("#pContent").focus(), 60);
    return;
  }
  const tags = $("#pTags")
    .value.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cat = $("#pCat").value;
  const desc = $("#pDesc").value.trim();
  const now = Date.now();

  if (id) {
    commit((d) => {
      const p = d.prompts.find((x) => x.id === id);
      if (p)
        Object.assign(p, {
          title,
          content,
          tags,
          category: cat,
          description: desc,
          updatedAt: now,
        });
    });
  } else {
    commit((d) => {
      d.prompts.push({
        id: uid(),
        title,
        content,
        tags,
        category: cat,
        description: desc,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      });
    });
  }
  closeModal();
  toast(id ? "ویرایش شد" : "افزوده شد");
}

function openCatModal(cat) {
  const isEdit = !!cat;
  $("#catModalIcon").textContent = isEdit ? "✎" : "＋";
  $("#catModalTitle").textContent = isEdit ? "ویرایش دسته" : "دستهٔ جدید";
  $("#catId").value = isEdit ? cat.id : "";
  $("#catName").value = isEdit ? cat.name : "";
  const cur = isEdit ? cat.color : "b-vio";
  $$("#catColors button").forEach((b) => {
    b.classList.toggle("on", b.dataset.c === cur);
  });
  $("#catModalBack").classList.add("open");
  refreshFocusTrap();
  setTimeout(() => $("#catName").focus(), 100);
}
function closeCatModal() {
  $("#catModalBack").classList.remove("open");
  refreshFocusTrap();
}
function saveCatModal() {
  const id = $("#catId").value;
  const name = $("#catName").value.trim();
  const color = ($("#catColors button.on") || {}).dataset?.c || "b-vio";
  if (!name) {
    toast("نام دسته لازم است", "err");
    $("#catName").focus();
    return;
  }
  if (id) {
    commit((d) => {
      const c = d.categories.find((x) => x.id === id);
      if (c) {
        c.name = name;
        c.color = color;
      }
    });
    toast("دسته ویرایش شد");
  } else {
    const newId =
      "c_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 5);
    commit((d) => {
      d.categories.push({ id: newId, name, color });
    });
    toast("دسته افزوده شد");
  }
  closeCatModal();
}

async function deleteCategory(id) {
  const cat = DATA.categories.find((x) => x.id === id);
  if (!cat) return;
  const n = DATA.prompts.filter((p) => p.category === id).length;
  const msg = n
    ? `دستهٔ «<b>${esc(cat.name)}</b>» حذف شود؟<br><span style="color:var(--dim);font-size:var(--f-xs)">${n} پرامپت این دسته به دستهٔ اول منتقل می‌شوند.</span>`
    : `دستهٔ «<b>${esc(cat.name)}</b>» حذف شود؟`;
  const ok = await uiConfirm({
    title: "حذف دسته",
    icon: "⚠",
    message: msg,
    okText: "حذف",
    danger: true,
  });
  if (!ok) return;

  const snapshot = {
    cat,
    index: DATA.categories.findIndex((c) => c.id === id),
    movedIds: DATA.prompts
      .filter((p) => p.category === id)
      .map((p) => p.id),
  };

  commit((d) => {
    d.categories = d.categories.filter((c) => c.id !== id);
    if (!d.categories.length)
      d.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    d.prompts.forEach((p) => {
      if (p.category === id) p.category = d.categories[0].id;
    });
    if (activeCat === id) activeCat = "all";
  });

  toastWithUndo(`دستهٔ «${cat.name}» حذف شد`, () => {
    commit((d) => {
      d.categories.splice(snapshot.index, 0, snapshot.cat);
      d.prompts.forEach((p) => {
        if (snapshot.movedIds.includes(p.id))
          p.category = snapshot.cat.id;
      });
    });
    toast("بازگردانی شد");
  });
}

const searchIn = $("#searchIn");
const searchRes = $("#searchRes");
const mSearchBtn = $("#mSearchBtn");
const mSearchBack = $("#mSearchBack");
const mSearch = $("#mSearch");
const mSearchIn = $("#mSearchIn");
const mSearchBody = $("#mSearchBody");

const ACTIONS = [
  {
    id: "new",
    ic: "plus",
    label: "افزودن پرامپت جدید",
    run: () => openModal(),
  },
  {
    id: "settings",
    ic: "gear",
    label: "تنظیمات",
    run: () => openDrawer(),
  },
  {
    id: "theme",
    ic: "moon",
    label: "تغییر پوسته",
    run: () => toggleTheme(),
  },
  {
    id: "export",
    ic: "down",
    label: "خروجی JSON",
    run: () => exportData(),
  },
  {
    id: "import",
    ic: "up",
    label: "ورودی JSON",
    run: () => $("#importFile").click(),
  },
  {
    id: "addcat",
    ic: "folder",
    label: "افزودن دستهٔ جدید",
    run: () => openCatModal(),
  },
  {
    id: "seed",
    ic: "sparkle",
    label: "افزودن ۶ پرامپت پیش‌فرض",
    run: () => seedDefaults(),
  },
];

let spItems = [];
let spActive = 0;

function fuzzyMatch(text, q) {
  if (!q) return true;
  const t = norm(text),
    n = norm(q);
  if (t.indexOf(n) >= 0) return true;
  let i = 0;
  for (const ch of n) {
    const j = t.indexOf(ch, i);
    if (j < 0) return false;
    i = j + 1;
  }
  return true;
}
function highlight(text, q) {
  const raw = String(text || "");
  if (!q) return esc(raw);
  const terms = q.split(/\s+/).filter(Boolean);
  if (!terms.length) return esc(raw);
  const pattern = terms
    .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  if (!pattern) return esc(raw);
  try {
    const re = new RegExp("(" + pattern + ")", "gi");
    let out = "",
      last = 0,
      m;
    while ((m = re.exec(raw))) {
      out += esc(raw.slice(last, m.index));
      out += "<mark>" + esc(m[0]) + "</mark>";
      last = m.index + m[0].length;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    out += esc(raw.slice(last));
    return out;
  } catch (e) {
    return esc(raw);
  }
}

function buildSearchResults(q) {
  const actions = ACTIONS.filter((a) => !q || fuzzyMatch(a.label, q));
  const prompts = q ? filtered().slice(0, 8) : [];
  const items = [];
  let html = "";

  if (actions.length) {
    html += `<div class="sp-group-label">${q ? "دستورها" : "دستورهای سریع"}</div>`;
    actions.forEach((a) => {
      html += `
<button class="sp-item" type="button" data-idx="${items.length}">
<span class="sp-item-ic">${icon(a.ic)}</span>
<span class="sp-item-body"><span class="sp-item-title">${esc(a.label)}</span></span>
</button>`;
      items.push({ run: a.run });
    });
  }
  if (prompts.length) {
    html += `<div class="sp-group-label">پرامپت‌ها</div>`;
    prompts.forEach((p) => {
      const cat = catById(p.category);
      const sub = (p.description || p.content || "")
        .replace(/\s+/g, " ")
        .slice(0, 80);
      html += `
<button class="sp-item" type="button" data-idx="${items.length}">
<span class="sp-item-ic">${icon("doc")}</span>
<span class="sp-item-body">
<span class="sp-item-title">${highlight(p.title, q)}</span>
<span class="sp-item-sub">${esc(sub)}</span>
</span>
<span class="sp-item-meta">${esc(cat.name)}</span>
</button>`;
      items.push({ run: () => openPreview(p) });
    });
  }
  if (!actions.length && !prompts.length) {
    html = `<div class="sp-empty">موردی پیدا نشد</div>`;
  }
  return { html, items };
}

function updateSpActive() {
  const container = mSearch.classList.contains("open")
    ? mSearchBody
    : searchRes;
  const nodes = container.querySelectorAll(".sp-item");
  nodes.forEach((n, i) => n.classList.toggle("active", i === spActive));
  const active = nodes[spActive];
  if (active && active.scrollIntoView)
    active.scrollIntoView({ block: "nearest" });
}
function activateSPItem(idx) {
  const it = spItems[idx];
  if (!it) return;
  closeAllSearchPanels();
  setTimeout(() => {
    try {
      it.run();
    } catch (e) {}
  }, 50);
}
function closeAllSearchPanels() {
  closeDesktopSearchPanel();
  closeMobileSearchPanel();
}

function renderDesktopSearchPanel() {
  const r = buildSearchResults(query.trim());
  searchRes.innerHTML = r.html;
  spItems = r.items;
  spActive = 0;
  updateSpActive();
}
function openDesktopSearchPanel() {
  renderDesktopSearchPanel();
  searchRes.classList.add("show");
  searchIn.setAttribute("aria-expanded", "true");
}
function closeDesktopSearchPanel() {
  searchRes.classList.remove("show");
  searchIn.setAttribute("aria-expanded", "false");
}

function updateHeaderHeight() {
  const h = document.querySelector("header.top").offsetHeight;
  document.documentElement.style.setProperty("--header-h", h + "px");
}
function renderMobileSearchPanel() {
  const r = buildSearchResults(query.trim());
  mSearchBody.innerHTML = r.html;
  spItems = r.items;
  spActive = 0;
  updateSpActive();
}
function openMobileSearchPanel() {
  updateHeaderHeight();
  mSearchIn.value = query;
  renderMobileSearchPanel();
  document.body.classList.add("msearch-open");
  mSearchBack.classList.add("open");
  mSearch.classList.add("open");
  mSearchBtn.classList.add("on");
  mSearchBtn.setAttribute("title", "بستن");
  mSearchBtn.setAttribute("aria-label", "بستن");
  mSearchBtn.setAttribute("aria-expanded", "true");
  refreshFocusTrap();
  setTimeout(() => {
    mSearchIn.focus();
    mSearchIn.select();
  }, 120);
}
function closeMobileSearchPanel() {
  document.body.classList.remove("msearch-open");
  mSearchBack.classList.remove("open");
  mSearch.classList.remove("open");
  mSearchBtn.classList.remove("on");
  mSearchBtn.setAttribute("title", "جست‌وجو");
  mSearchBtn.setAttribute("aria-label", "جست‌وجو");
  mSearchBtn.setAttribute("aria-expanded", "false");
  mSearchIn.blur();
  refreshFocusTrap();
}

const debouncedGridRender = debounce(renderGrid, 160);

searchIn.addEventListener("focus", openDesktopSearchPanel);
searchIn.addEventListener("input", () => {
  query = searchIn.value;
  renderDesktopSearchPanel();
  debouncedGridRender();
});
searchIn.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (spItems.length) {
      spActive = (spActive + 1) % spItems.length;
      updateSpActive();
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (spItems.length) {
      spActive = (spActive - 1 + spItems.length) % spItems.length;
      updateSpActive();
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    activateSPItem(spActive);
  } else if (e.key === "Escape") {
    e.stopPropagation();
    closeDesktopSearchPanel();
    searchIn.blur();
  }
});

mSearchIn.addEventListener("input", () => {
  query = mSearchIn.value;
  renderMobileSearchPanel();
  debouncedGridRender();
});
mSearchIn.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (spItems.length) {
      spActive = (spActive + 1) % spItems.length;
      updateSpActive();
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (spItems.length) {
      spActive = (spActive - 1 + spItems.length) % spItems.length;
      updateSpActive();
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    activateSPItem(spActive);
  } else if (e.key === "Escape") {
    e.stopPropagation();
    closeMobileSearchPanel();
  }
});

mSearchBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (mSearch.classList.contains("open")) closeMobileSearchPanel();
  else openMobileSearchPanel();
});
mSearchBack.addEventListener("click", closeMobileSearchPanel);

searchRes.addEventListener("click", (e) => {
  const item = e.target.closest(".sp-item");
  if (!item) return;
  activateSPItem(Number(item.dataset.idx));
});
mSearchBody.addEventListener("click", (e) => {
  const item = e.target.closest(".sp-item");
  if (!item) return;
  activateSPItem(Number(item.dataset.idx));
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".searchwrap")) closeDesktopSearchPanel();
});

function openDrawer() {
  $("#drawer").classList.add("open");
  $("#drawerBack").classList.add("open");
  renderCatList();
  refreshFocusTrap();
}
function closeDrawer() {
  $("#drawer").classList.remove("open");
  $("#drawerBack").classList.remove("open");
  refreshFocusTrap();
}
function renderPrefs() {
  $$(".seg[data-pref]").forEach((seg) => {
    const key = seg.dataset.pref;
    seg.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("on", b.dataset.v === PREFS[key]);
      b.onclick = () => {
        PREFS[key] = b.dataset.v;
        savePrefs();
        applyPrefs();

        const doToggle = () => {
          seg
            .querySelectorAll("button")
            .forEach((x) => x.classList.toggle("on", x === b));
        };
        if (key === "theme") {
          requestAnimationFrame(() => requestAnimationFrame(doToggle));
        } else {
          doToggle();
        }
      };
    });
  });
}

let sortSelect = null;
function syncSortDirBtn() {
  const btn = $("#sortDirBtn");
  if (!btn) return;
  const isDesc = PREFS.sortDir !== "asc";
  btn.classList.toggle("desc", isDesc);
  const label = isDesc ? "نزولی" : "صعودی";
  const tip = isDesc ? "نزولی — کلیک برای صعودی" : "صعودی — کلیک برای نزولی";
  btn.setAttribute("aria-label", "جهت مرتب‌سازی: " + label);
  btn.setAttribute("title", tip);
}
function toggleSortDir() {
  PREFS.sortDir = PREFS.sortDir === "asc" ? "desc" : "asc";
  savePrefs();
  syncSortDirBtn();
  renderGrid();
  const g = $("#grid");
  g.classList.remove("filtering");
  void g.offsetWidth;
  g.classList.add("filtering");
}
function initSortSelect() {
  sortSelect = buildCSelect("sortSel", {
    items: [
      { v: "updated", label: "آخرین ویرایش" },
      { v: "created", label: "تاریخ ایجاد" },
      { v: "title", label: "عنوان" },
    ],
    value: PREFS.sort || "updated",
    onChange: (v) => {
      PREFS.sort = v;
      /* جهت پیش‌فرض منطقی با هر نوع مرتب‌سازی */
      PREFS.sortDir = v === "title" ? "asc" : "desc";
      savePrefs();
      syncSortDirBtn();
      renderGrid();
    },
  });
  $("#sortSelIcon").innerHTML = icon("sort");
  syncSortDirBtn();
  $("#sortDirBtn")?.addEventListener("click", toggleSortDir);
}

function exportData() {
  try {
    const blob = new Blob([JSON.stringify(DATA, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "prompts-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("خروجی دانلود شد");
  } catch (e) {
    toast("خروجی ناموفق", "err");
  }
}
/* ═══════════ پارسر بردبار برای import ═══════════ */

function cleanJSONText(raw) {
  let s = String(raw || "");
  s = s.replace(/^\uFEFF/, "");
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
  return s;
}

/* استخراج آبجکت‌های JSON با شمارش آکولاد
— حتی وقتی داخل رشته‌ها آکولاد باشد، درست عمل می‌کند */
function extractJSONObjects(text) {
  const objects = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    /* اولین { را پیدا کن */
    while (i < n && text[i] !== "{") i++;
    if (i >= n) break;

    const start = i;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let closed = false;

    while (i < n) {
      const ch = text[i];

      if (esc) {
        esc = false;
        i++;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        i++;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        i++;
        continue;
      }

      if (!inStr) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            i++;
            closed = true;
            break;
          }
        }
      }
      i++;
    }

    if (closed) {
      objects.push(text.slice(start, i));
    }
  }
  return objects;
}

/* استراتژی‌های متعدد parse — از سخت‌گیرانه به آسان‌گیر */
function parseJSONLenient(raw) {
  const text = cleanJSONText(raw);

  /* اگر متن خالی است، پیام دقیق بده */
  if (!text.trim()) {
    throw new Error("فایل خالی است");
  }

  /* اگر شبیه HTML است، پیام دقیق بده */
  const trimmed = text.trim();
  if (/^<!doctype|^<html/i.test(trimmed)) {
    throw new Error("فایل HTML است نه JSON — فایل .json را انتخاب کن");
  }

  const stripComments = (s) =>
    s.replace(/\/\/[^\n\r]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  const stripTrailing = (s) => s.replace(/,\s*([\]}])/g, "$1");

  /* فقط newlines داخل رشته‌ها را escape می‌کند (خارج از رشته دست نمی‌زند) */
  const escapeNewlines = (s) => {
    let out = "",
      inStr = false,
      esc = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (esc) {
        out += ch;
        esc = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        out += ch;
        continue;
      }
      if (inStr && (ch === "\n" || ch === "\r")) {
        out += "\\n";
        continue;
      }
      out += ch;
    }
    return out;
  };

  const attempts = [
    /* اول: حالت معمول — یک JSON کامل */
    { name: "strict", fn: () => JSON.parse(text) },

    /* چند آبجکت جدا با کاما: {..}, {..}, {..} */
    {
      name: "brace-extract",
      fn: () => {
        const objs = extractJSONObjects(text);
        if (!objs.length) throw new Error("هیچ آبجکت JSON پیدا نشد");
        const parsed = objs.map((o) =>
          JSON.parse(escapeNewlines(stripTrailing(o))),
        );
        if (parsed.length === 1) return parsed[0];
        return parsed; /* آرایه برمی‌گرداند */
      },
    },

    { name: "strip-comments", fn: () => JSON.parse(stripComments(text)) },
    { name: "strip-trailing", fn: () => JSON.parse(stripTrailing(text)) },
    {
      name: "escape-newlines",
      fn: () => JSON.parse(escapeNewlines(text)),
    },
    {
      name: "all-combos-1",
      fn: () => JSON.parse(stripTrailing(stripComments(text))),
    },
    {
      name: "all-combos-2",
      fn: () => JSON.parse(escapeNewlines(stripComments(text))),
    },
    {
      name: "all-combos-3",
      fn: () =>
        JSON.parse(escapeNewlines(stripTrailing(stripComments(text)))),
    },
    /* پیدا کردن اولین { یا [ و آخرین } یا ] و از آنجا parse */
    {
      name: "extract-object",
      fn: () => {
        const firstBrace = text.search(/[\{\[]/);
        if (firstBrace < 0) throw new Error("نشانه‌ای از JSON پیدا نشد");
        const isArr = text[firstBrace] === "[";
        const closeCh = isArr ? "]" : "}";
        const lastBrace = text.lastIndexOf(closeCh);
        if (lastBrace <= firstBrace)
          throw new Error("بسته شدن JSON پیدا نشد");
        const sliced = text.slice(firstBrace, lastBrace + 1);
        return JSON.parse(
          escapeNewlines(stripTrailing(stripComments(sliced))),
        );
      },
    },

    /* حالت: چند آبجکت جدا با کاما، بدون [] */
    /* مثل: { obj1 }, { obj2 }, { obj3 } */
    {
      name: "wrap-in-array",
      fn: () => {
        const first = text.search(/[\{\[]/);
        const last = text.lastIndexOf(text[first] === "[" ? "]" : "}");
        if (first < 0 || last < 0) throw new Error("JSON پیدا نشد");
        const inner = escapeNewlines(
          stripTrailing(stripComments(text.slice(first, last + 1))),
        );
        /* دور همه‌چیز [] بگذار */
        return JSON.parse("[" + inner + "]");
      },
    },

    /* همان کاری که قبلاً، ولی فقط برای [] تکی */
    {
      name: "wrap-in-object",
      fn: () => {
        const first = text.search(/[\{\[]/);
        const last = text.lastIndexOf(text[first] === "[" ? "]" : "}");
        if (first < 0 || last < 0) throw new Error("JSON پیدا نشد");
        const inner = escapeNewlines(
          stripTrailing(stripComments(text.slice(first, last + 1))),
        );
        return JSON.parse('{ "prompts": [' + inner + "] }");
      },
    },
  ];

  const errors = [];
  for (const { name, fn } of attempts) {
    try {
      return fn();
    } catch (e) {
      errors.push(name + ": " + (e.message || "خطا"));
    }
  }

  /* اطلاعات تشخیصی */
  console.group("❌ Import — همهٔ استراتژی‌ها شکست خوردند");
  errors.forEach((e) => console.warn(e));
  console.warn("طول فایل:", text.length);
  console.warn(
    "تعداد آبجکت‌های یافت‌شده:",
    extractJSONObjects(text).length,
  );
  console.warn("اولین ۴۰۰ کاراکتر:", text.slice(0, 400));
  console.warn("آخرین ۲۰۰ کاراکتر:", text.slice(-200));
  console.groupEnd();

  throw new Error("ساختار JSON قابل خواندن نیست — کنسول را باز کن (F12)");
}

/* نرمال‌سازی: از هر شکلی، ساختار نهایی را می‌سازد */
const IMPORT_COLORS = [
  "b-vio",
  "b-blu",
  "b-cyn",
  "b-grn",
  "b-amb",
  "b-ros",
];

function normalizeImport(raw) {
  let data = parseJSONLenient(raw);

  /* حالت ۱: فقط آرایهٔ پرامپت‌ها */
  if (Array.isArray(data)) data = { prompts: data };

  /* حالت ۲: یک پرامپت تکی (title/content دارد ولی prompts ندارد) */
  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    !data.prompts &&
    (data.title || data.content)
  ) {
    data = { prompts: [data] };
  }

  if (!data || typeof data !== "object")
    throw new Error("ساختار فایل قابل تشخیص نیست");

  if (!Array.isArray(data.prompts))
    throw new Error("آرایهٔ prompts در فایل پیدا نشد");

  /* ── نرمال‌سازی دسته‌ها ── */
  let categories = Array.isArray(data.categories) ? data.categories : [];
  categories = categories
    .filter((c) => c && typeof c === "object")
    .map((c, i) => ({
      id: String(
        c.id ||
          "c_imp_" + i + "_" + Math.random().toString(36).slice(2, 6),
      ),
      name:
        String(c.name || c.title || "دسته " + (i + 1)).trim() ||
        "دسته " + (i + 1),
      color: IMPORT_COLORS.includes(c.color)
        ? c.color
        : IMPORT_COLORS[i % IMPORT_COLORS.length],
    }));

  if (!categories.length)
    categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));

  /* حذف idهای تکراری */
  const seenIds = new Set();
  categories = categories.filter((c) => {
    if (seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });

  const validCatIds = new Set(categories.map((c) => c.id));
  const fallbackCat = categories[0].id;

  /* ── نرمال‌سازی پرامپت‌ها ── */
  const now = Date.now();
  const prompts = [];
  const rejected = [];

  data.prompts.forEach((p, i) => {
    if (!p || typeof p !== "object") {
      rejected.push(`#${i + 1}: ساختار نامعتبر`);
      return;
    }
    const title = String(p.title || "").trim();
    const content = String(p.content || "");

    if (!title) {
      rejected.push(`#${i + 1}: بدون عنوان`);
      return;
    }
    if (!content.trim()) {
      rejected.push(`#${i + 1}: بدون متن`);
      return;
    }

    let category = String(p.category || "");
    if (!validCatIds.has(category)) category = fallbackCat;

    /* tags: اگر رشته بود، به آرایه تبدیل کن */
    let tags;
    if (Array.isArray(p.tags)) {
      tags = p.tags.map((t) => String(t || "").trim()).filter(Boolean);
    } else if (typeof p.tags === "string") {
      tags = p.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      tags = [];
    }

    prompts.push({
      id: String(p.id || uid()),
      category,
      title,
      description: String(p.description || "").trim(),
      tags,
      pinned: !!p.pinned,
      content,
      createdAt: Number(p.createdAt) || now,
      updatedAt: Number(p.updatedAt) || now,
    });
  });

  return { categories, prompts, rejected };
}

/* ── تشخیص تکراری بر اساس id یا (عنوان + متن) ── */
function findDuplicate(incoming, existing) {
  const byId = existing.find((p) => p.id === incoming.id);
  if (byId) return byId;
  return (
    existing.find(
      (p) => p.title === incoming.title && p.content === incoming.content,
    ) || null
  );
}

/* ── ادغام: پرامپت‌های جدید اضافه، تکراری‌ها به‌روز، دسته‌های جدید اضافه ── */
function mergeImport(result) {
  /* دسته‌ها: هر دستهٔ جدید که id تکراری ندارد اضافه شود */
  const existingCatIds = new Set(DATA.categories.map((c) => c.id));
  result.categories.forEach((c) => {
    if (!existingCatIds.has(c.id)) {
      DATA.categories.push(c);
      existingCatIds.add(c.id);
    }
  });
  const validCatIds = new Set(DATA.categories.map((c) => c.id));

  let added = 0,
    updated = 0,
    skipped = 0;
  result.prompts.forEach((p) => {
    /* اگر دستهٔ ورودی حالا معتبر نیست، به اولین دسته وصل کن */
    const category = validCatIds.has(p.category)
      ? p.category
      : DATA.categories[0].id;

    const dup = findDuplicate({ ...p, category }, DATA.prompts);
    if (dup) {
      /* به‌روزرسانی محتوا ولی حفظ id قبلی و تاریخ ایجاد */
      Object.assign(dup, {
        title: p.title,
        content: p.content,
        description: p.description,
        tags: p.tags,
        category,
        pinned: p.pinned || dup.pinned,
        updatedAt: Date.now(),
      });
      updated++;
    } else {
      DATA.prompts.push({ ...p, category });
      added++;
    }
  });
  return { added, updated, skipped };
}

/* ── مودال تأیید: جایگزینی یا ادغام ── */
function askImportMode(count, rejectedN, onDone) {
  return new Promise((resolve) => {
    dialogResolve = (choice) => {
      /* choice: 'merge' | 'replace' | 'cancel' */
      if (choice === "cancel" || !choice) {
        resolve();
        return;
      }
      onDone(choice);
      resolve();
    };
    dialogMode = "confirm";

    const existing = DATA.prompts.length;
    const msg = rejectedN
      ? `این فایل ${count} پرامپت معتبر دارد (${rejectedN} مورد رد شد).<br>
در اپ فعلی ${existing} پرامپت داری.<br>
<span style="color:var(--dim);font-size:var(--f-xs)">
ادغام: پرامپت‌های جدید اضافه می‌شوند، تکراری‌ها به‌روز می‌شوند.<br>
جایگزینی: همهٔ پرامپت‌های فعلی حذف و این فایل جایگزین می‌شود.</span>`
      : `این فایل ${count} پرامپت دارد.<br>
در اپ فعلی ${existing} پرامپت داری.`;

    $("#dialogIcon").textContent = "⬇";
    $("#dialogTitle").textContent = "ورودی فایل";
    $("#dialogMsg").innerHTML = msg;
    $("#dialogFieldWrap").style.display = "none";

    /* سه دکمه: ادغام / جایگزینی / انصراف */
    const foot = document.querySelector("#dialogBack .modal .foot");
    foot.innerHTML = `
<button class="btn g" id="importMergeBtn">ادغام کن</button>
<button class="btn dgr" id="importReplaceBtn">جایگزین کن</button>
<button class="btn" id="importCancelBtn">انصراف</button>
`;

    $("#importMergeBtn").onclick = () => {
      closeDialog("merge");
    };
    $("#importReplaceBtn").onclick = () => {
      /* حتی در جایگزینی، یک تأیید دوباره */
      const ok = confirm(
        "همهٔ پرامپت‌ها و دسته‌های فعلی حذف می‌شوند. مطمئن هستی؟",
      );
      if (ok) closeDialog("replace");
    };
    $("#importCancelBtn").onclick = () => {
      closeDialog("cancel");
    };

    $("#dialogBack").classList.add("open");
    refreshFocusTrap();
    setTimeout(() => $("#importMergeBtn").focus(), 100);
  });
}

/* ── تابع اصلی import ── */
function importData(file) {
  if (!file) {
    toast("فایلی انتخاب نشد", "err");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast("فایل بزرگ‌تر از ۵ مگابایت است", "err");
    return;
  }

  const r = new FileReader();
  r.onerror = () => toast("خواندن فایل ناموفق بود", "err");
  r.onload = (e) => {
    let result;
    try {
      result = normalizeImport(e.target.result);
    } catch (err) {
      const msg = err && err.message ? err.message : "خطای ناشناخته";
      toast("فایل نامعتبر: " + msg, "err");
      console.group("❌ Import error — جزئیات کامل");
      console.error(err);
      console.groupEnd();
      return;
    }

    if (!result.prompts.length) {
      toast("هیچ پرامپت معتبری در فایل پیدا نشد", "err");
      if (result.rejected.length)
        console.warn("Import — موارد رد شده:", result.rejected);
      return;
    }

    /* از کاربر بپرس: ادغام یا جایگزینی */
    askImportMode(
      result.prompts.length,
      result.rejected.length,
      (choice) => {
        if (choice === "merge") {
          const { added, updated } = mergeImport(result);
          save();
          renderChips();
          renderGrid();
          renderCatList();
          const parts = [];
          if (added) parts.push(`${added} افزوده`);
          if (updated) parts.push(`${updated} به‌روز`);
          toast("ادغام شد — " + (parts.join("، ") || "تغییری نبود"));
        } else if (choice === "replace") {
          /* پشتیبان خودکار قبل از جایگزینی */
          try {
            localStorage.setItem(
              DATA_KEY + "_backup",
              localStorage.getItem(DATA_KEY),
            );
          } catch (_) {}
          DATA.categories = result.categories;
          DATA.prompts = result.prompts;
          save();
          renderChips();
          renderGrid();
          renderCatList();
          const n = result.prompts.length;
          const rej = result.rejected.length;
          toast(
            rej
              ? `جایگزین شد — ${n} پرامپت (${rej} رد شد)`
              : `جایگزین شد — ${n} پرامپت`,
            rej ? "warn" : undefined,
          );
        }
      },
    );

    if (result.rejected.length) {
      console.warn("Import — موارد رد شده:", result.rejected);
    }
  };
  r.readAsText(file, "utf-8");
}
async function resetAll() {
  const ok = await uiConfirm({
    title: "بازنشانی همه",
    icon: "⚠",
    message:
      'همهٔ پرامپت‌ها و دسته‌ها حذف شوند؟<br><span style="color:var(--dim);font-size:var(--f-xs)">این کار قابل بازگشت نیست.</span>',
    okText: "حذف همه",
    danger: true,
  });
  if (!ok) return;
  commit((d) => {
    d.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    d.prompts = [];
    activeCat = "all";
  });
  closeDrawer();
  toast("بازنشانی شد");
}

async function seedDefaults() {
  if (DATA.prompts.length > 0) {
    const ok = await uiConfirm({
      title: "افزودن پرامپت‌های پیش‌فرض",
      message:
        "پرامپت‌های موجود باقی می‌مانند. شش پرامپت پیش‌فرض اضافه شوند؟",
      okText: "افزودن",
    });
    if (!ok) return;
  }
  const now = Date.now();
  const seeds = [
    {
      id: uid(),
      category: "write",
      title: "نویسندهٔ مقاله",
      description: "نوشتن مقالهٔ فارسی روان با ساختار مقدمه/بدنه/نتیجه.",
      tags: ["نوشتن", "مقاله", "محتوا"],
      pinned: true,
      content:
        "# نقش تو\nنویسندهٔ حرفه‌ای فارسی هستی. متن‌های روان، دقیق و بدون حاشیه می‌نویسی.\n\n# موضوع\n{{موضوع}}\n\n# لحن\n{{لحن}}   (رسمی / دوستانه / آموزشی / طنز)\n\n# طول\nحدود {{طول}} کلمه.\n\n# قواعد\n1. پاراگراف‌های کوتاه.\n2. از تکرار کلمات پرهیز کن.\n3. هر ادعا با مثال یا پشتوانه.\n4. کلمات انگلیسی را با معادل رایج فارسی بنویس.\n5. بدون مقدمه‌چینی و تعارف.\n\n# ساختار\n- مقدمه: قلاب + طرح مسئله\n- بدنه: ۳ تا ۵ بخش با زیرعنوان\n- نتیجه: جمع‌بندی + یک جملهٔ ماندگار\n",
    },
    {
      id: uid(),
      category: "general",
      title: "مترجم حرفه‌ای",
      description: "ترجمهٔ معنایی با حفظ لحن و یادداشت انتخاب‌ها.",
      tags: ["ترجمه", "زبان", "متن"],
      pinned: false,
      content:
        "# نقش تو\nمترجم حرفه‌ای از {{مبدأ}} به {{مقصد}} هستی.\n\n# متن\n{{متن}}\n\n# قواعد\n1. ترجمهٔ معنایی، نه تحت‌اللفظی.\n2. اصطلاحات را با معادل طبیعی همان زبان برگردان.\n3. لحن اصلی را حفظ کن.\n4. اسم‌های خاص را ترجمه نکن.\n5. اگر جمله مبهم بود، ترجمهٔ محتمل بده و علامت بزن.\n\n# خروجی\n- ترجمه\n- ۳ یادداشت کوتاه دربارهٔ انتخاب‌های مهم\n",
    },
    {
      id: uid(),
      category: "code",
      title: "بازبینی کد",
      description: "مرور دقیق کد با تفکیک بحرانی/معماری/خوانایی/کارایی.",
      tags: ["کد", "بازبینی", "review"],
      pinned: true,
      content:
        "# نقش تو\nمهندس نرم‌افزار ارشد هستی. کد را دقیق، بی‌تعارف و با پیشنهاد مشخص بازبینی می‌کنی.\n\n# زبان\n{{زبان}}\n\n# کد\n{{کد}}\n\n# خروجی مورد انتظار\n1. مشکلات بحرانی — باگ، امنیت، نشت حافظه.\n2. مشکلات معماری — ساختار، جداسازی مسئولیت‌ها.\n3. بهبود خوانایی — نام‌گذاری، کامنت، پیچیدگی.\n4. بهبود کارایی — تنها اگر مسئله واقعی است.\n5. پیشنهاد بازنویسی — فقط بخش‌های مشکل‌دار.\n\n# قواعد\n- برای هر مورد بگو «چرا».\n- تعریف بی‌دلیل نکن.\n- اگر بخشی خوب است، بگو.\n",
    },
    {
      id: uid(),
      category: "image",
      title: "تصویر — واقع‌گرا",
      description:
        "پرامپت عکس فتوریالیستیک با کنترل نور، زاویه و حال‌وهوا.",
      tags: ["تصویر", "واقع‌گرا", "photo"],
      pinned: true,
      content:
        "# پرامپت تصویر — فتوریالیستیک\n\n## سوژه\n{{سوژه}}\n\n## جزئیات\n- زاویهٔ دوربین: {{زاویه}}   (close-up / medium / wide)\n- نور: {{نور}}   (طلوع / غروب / ابری / نئون شبانه)\n- پس‌زمینه: {{پس‌زمینه}}\n- حال‌وهوا: {{حال}}\n\n## پرامپت\nphotorealistic, {{سوژه}}, {{زاویه}} shot,\n{{نور}} lighting, {{پس‌زمینه}} in background,\nmood: {{حال}},\n35mm lens, f/1.8, shallow depth of field,\nnatural skin texture, subsurface scattering,\nfilm grain, shot on Kodak Portra 400,\n4K, ultra detailed, sharp focus\n\n## منفی (Negative)\ncartoon, painting, illustration, 3d render,\nlow res, blurry, deformed hands, extra fingers,\nwatermark, text, signature\n",
    },
    {
      id: uid(),
      category: "image",
      title: "تصویر — هنری",
      description: "پرامپت تصویرسازی با انتخاب سبک، پالت و نسبت.",
      tags: ["تصویر", "هنری", "illustration"],
      pinned: false,
      content:
        "# پرامپت تصویر — تصویرسازی هنری\n\n## ایده\n{{ایده}}\n\n## سبک\n{{سبک}}   (آبرنگ / دیجیتال آرت / مینیمال تخت / رترو / سورئال)\n\n## پالت\n{{پالت}}   (گرم / سرد / تک‌رنگ / پاستلی / نئون)\n\n## نسبت\n{{نسبت}}   (1:1 / 16:9 / 9:16 / 4:5)\n\n## پرامپت\n{{ایده}},\n{{سبک}} style, {{پالت}} palette,\nelegant composition, rule of thirds,\nsoft shadow, artstation trending,\nmasterwork, highly detailed, 8k\n\n## منفی\nphoto, realistic, 3d render, low quality,\ncluttered, watermark, text, signature\n",
    },
    {
      id: uid(),
      category: "image",
      title: "لوگو",
      description: "پرامپت لوگوی مینیمال با کنترل سبک و رنگ برند.",
      tags: ["لوگو", "برند", "logo"],
      pinned: false,
      content:
        "# پرامپت لوگو\n\n## برند\nنام: {{نام برند}}\nصنعت: {{صنعت}}\nمخاطب: {{مخاطب}}\nپیام اصلی: {{پیام}}\n\n## مشخصات بصری\n- نوع: {{نوع}}   (wordmark / lettermark / abstract / mascot)\n- سبک: {{سبک}}   (مینیمال / فلت / ژئومتریک / ارگانیک)\n- رنگ: {{رنگ}}\n\n## پرامپت\nminimalist logo for {{نام برند}},\n{{صنعت}} brand, {{نوع}} style,\n{{سبک}} design, {{رنگ}} color scheme,\nclean vector lines, professional branding,\nwhite background, centered composition,\nhigh contrast, scalable\n\n## منفی\n3d, gradient mesh, drop shadow, text,\nwatermark, photo, cluttered, complex details\n",
    },
  ];
  if (!DATA.categories.length)
    DATA.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  const ensureSeedCat = (id) =>
    DATA.categories.some((c) => c.id === id) ? id : DATA.categories[0].id;
  seeds.forEach((s) => {
    s.category = ensureSeedCat(s.category);
    s.createdAt = now;
    s.updatedAt = now;
  });
  commit((d) => {
    seeds.forEach((s) => d.prompts.push(s));
  });
  closeDrawer();
  toast("۶ پرامپت پیش‌فرض افزوده شد");
}

function toggleTheme() {
  const resolved = resolveTheme(PREFS.theme);
  PREFS.theme = resolved === "dark" ? "light" : "dark";
  savePrefs();
  applyPrefs();
  renderPrefs();
  toast("پوسته: " + (PREFS.theme === "dark" ? "تاریک" : "روشن"));
}

$("#pvClose").onclick = closePreview;
$("#pvBack").onclick = closePreview;
$("#pvCopy").onclick = () => {
  const p = DATA.prompts.find((x) => x.id === currentPvId);
  if (p) requestCopy(p);
};
$("#pvEdit").onclick = () => {
  const p = DATA.prompts.find((x) => x.id === currentPvId);
  if (p) {
    closePreview();
    openModal(p);
  }
};

$("#pvOpenInAI").addEventListener("click", (e) => {
  e.stopPropagation();
  toggleAiMenu();
});
$("#pvAiMenu").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-ai]");
  if (!btn) return;
  const target = AI_TARGETS.find((t) => t.id === btn.dataset.ai);
  if (!target) return;
  const p = DATA.prompts.find((x) => x.id === currentPvId);
  closeAiMenu();
  if (p) openInAI(p, target);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".ai-open-wrap")) closeAiMenu();
});

$("#settingsBtn").onclick = () => {
  closeMobileSearchPanel();
  openDrawer();
};
$("#themeBtn").onclick = () => {
  closeMobileSearchPanel();
  toggleTheme();
};
$("#closeDrawer").onclick = closeDrawer;
$("#drawerBack").onclick = closeDrawer;
$("#addCatBtn").onclick = () => openCatModal();
$("#exportBtn").onclick = exportData;
$("#importBtn").onclick = () => $("#importFile").click();
$("#importFile").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if (f) importData(f);
});
$("#seedBtn").onclick = seedDefaults;
$("#resetBtn").onclick = resetAll;

$("#catList").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const item = btn.closest(".cat-item");
  if (!item) return;
  const id = item.dataset.id;
  const act = btn.dataset.act;
  if (act === "edit-cat") {
    const c = DATA.categories.find((x) => x.id === id);
    if (c) openCatModal(c);
  } else if (act === "del-cat") {
    deleteCategory(id);
  }
});

$("#catColors").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  $$("#catColors button").forEach((x) =>
    x.classList.toggle("on", x === b),
  );
});

$("#saveBtn").onclick = savePrompt;
$("#cancelBtn").onclick = closeModal;
$("#modalCloseBtn").onclick = closeModal;
$("#modalBack").addEventListener("click", (e) => {
  if (e.target.id === "modalBack") closeModal();
});

$("#varCopyBtn").onclick = copyVarFinal;
$("#varCopyRawBtn").onclick = copyVarRaw;
$("#varCancelBtn").onclick = closeVarModal;
$("#varModalBack").addEventListener("click", (e) => {
  if (e.target.id === "varModalBack") closeVarModal();
});

$("#catSaveBtn").onclick = saveCatModal;
$("#catCancelBtn").onclick = closeCatModal;
$("#catModalBack").addEventListener("click", (e) => {
  if (e.target.id === "catModalBack") closeCatModal();
});

$("#dialogOk").onclick = () => {
  if (dialogMode === "prompt") closeDialog($("#dialogField").value);
  else closeDialog(true);
};
$("#dialogCancel").onclick = () =>
  closeDialog(dialogMode === "prompt" ? null : false);
$("#dialogBack").addEventListener("click", (e) => {
  if (e.target.id === "dialogBack")
    closeDialog(dialogMode === "prompt" ? null : false);
});
$("#dialogField").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("#dialogOk").click();
  }
});

$("#toastUndoBtn").onclick = () => {
  if (typeof undoFn === "function") {
    const fn = undoFn;
    hideUndoToast();
    try {
      fn();
    } catch (e) {}
  }
};

document.addEventListener("keydown", (e) => {
  const k = e.key;
  const overlayOpen = !!document.querySelector(
    ".modal-back.open, .drawer.open, .pv-drawer.open, .msearch.open",
  );
  if (
    k === "/" &&
    !overlayOpen &&
    !isTypingContext() &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey
  ) {
    e.preventDefault();
    if (isMobile()) openMobileSearchPanel();
    else {
      searchIn.focus();
      searchIn.select();
    }
    return;
  }

  if (k === "Escape") {
    if ($("#bulkMoveBack")?.classList.contains("open")) {
      closeBulkMove();
      return;
    }
    if (selectMode) {
      exitSelectMode();
      return;
    }
    if ($("#dialogBack").classList.contains("open")) {
      closeDialog(dialogMode === "prompt" ? null : false);
      return;
    }
    if ($("#catModalBack").classList.contains("open")) {
      closeCatModal();
      return;
    }
    if ($("#varModalBack").classList.contains("open")) {
      closeVarModal();
      return;
    }
    if (mSearch.classList.contains("open")) {
      closeMobileSearchPanel();
      return;
    }
    if (searchRes.classList.contains("show")) {
      closeDesktopSearchPanel();
      searchIn.blur();
      return;
    }
    if ($("#modalBack").classList.contains("open")) {
      closeModal();
      return;
    }
    if ($("#drawer").classList.contains("open")) {
      closeDrawer();
      return;
    }
    if ($("#pvDrawer").classList.contains("open")) {
      closePreview();
      return;
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "s") {
    if ($("#modalBack").classList.contains("open")) {
      e.preventDefault();
      savePrompt();
      return;
    }
  }

  if ((e.ctrlKey || e.metaKey) && k === "Enter") {
    if ($("#modalBack").classList.contains("open")) {
      savePrompt();
      return;
    }
    if ($("#varModalBack").classList.contains("open")) {
      copyVarFinal();
      return;
    }
    if ($("#catModalBack").classList.contains("open")) {
      saveCatModal();
      return;
    }
    if ($("#dialogBack").classList.contains("open")) {
      $("#dialogOk").click();
      return;
    }
  }
});

matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  () => {
    if (PREFS.theme === "system") applyPrefs();
  },
);

window.addEventListener("resize", () => {
  updateHeaderHeight();
  /* بازسازی گاترها بعد از تغییر عرض */
  if (document.getElementById("pvContent")) {
    updatePreviewGutter($("#pvContent").textContent);
  }
  if (editorArea && $("#modalBack").classList.contains("open")) {
    updateEditorGutter();
  }
});

/* ═══════════════ تول‌تیپ لمسی ═══════════════ */
/* روی دستگاه‌های بدون hover: لمسِ دکمه → نمایش تول‌تیپ به‌مدت ۱.۶ ثانیه */
(function setupTouchTooltips() {
  if (!matchMedia("(hover: none)").matches) return;

  const HOLD = 1600;
  let timer = null;
  let lastEl = null;

  function show(el) {
    if (!el) return;
    if (lastEl && lastEl !== el) lastEl.classList.remove("tip-show");
    el.classList.add("tip-show");
    lastEl = el;
    clearTimeout(timer);
    timer = setTimeout(() => {
      el.classList.remove("tip-show");
      if (lastEl === el) lastEl = null;
    }, HOLD);
  }

  document.addEventListener(
    "touchstart",
    (e) => {
      const el = e.target.closest("[data-tip]");
      if (!el) return;
      show(el);
    },
    { passive: true },
  );

  /* با شروع اسکرول یا لمس جای دیگر، پاک شود */
  document.addEventListener(
    "scroll",
    () => {
      if (lastEl) {
        lastEl.classList.remove("tip-show");
        lastEl = null;
      }
      clearTimeout(timer);
    },
    { passive: true },
  );
  document.addEventListener(
    "touchstart",
    (e) => {
      if (!e.target.closest("[data-tip]")) {
        if (lastEl) {
          lastEl.classList.remove("tip-show");
          lastEl = null;
        }
        clearTimeout(timer);
      }
    },
    { passive: true },
  );
})();

/* ═══ Text Engine: robust logical lines ═══ */
const LINE_SPLIT = /\r?\n/;

function updateEditorStats() {
  const v = editorArea.value;
  const lines = v.split(LINE_SPLIT).length;
  $("#statLines").textContent = toFaNum(lines) + " خط";
  $("#statChars").textContent = toFaNum(v.length) + " کاراکتر";
  $("#statWords").textContent = toFaNum(countWords(v)) + " کلمه";
  $("#statTokens").textContent =
    "~" + toFaNum(estimateTokens(v)) + " توکن";
}

/* ═══ Text Direction: auto detection ═══ */
function detectTextDir(text) {
  const s = String(text || "");
  const limit = Math.min(s.length, 2000);

  for (let i = 0; i < limit; i++) {
    const ch = s[i];

    /* حروف لاتین و مشابه آن */
    if (
      /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02AF\u1E00-\u1EFF]/.test(
        ch,
      )
    )
      return "ltr";

    /* حروف عبری/عربی/فارسی و مرتبط */
    if (
      /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(
        ch,
      )
    )
      return "rtl";
  }

  return "ltr";
}

function applyTextDir(el, text) {
  if (!el) return;
  const source =
    text == null ? (el.value != null ? el.value : el.textContent) : text;
  const dir = detectTextDir(source);

  if (el.dir !== dir) el.dir = dir;
  el.dataset.dirMode = dir;
}

function scrollLogicalStart(el) {
  if (!el) return;

  /* اگر مرورگر پشتیبانی کند، در RTL به ابتدای منطقی یعنی راست می‌رود */
  try {
    el.scrollTo({ top: 0, inline: "start" });
  } catch (_) {
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }
}

initPromptCatSelect();
initSortSelect();
loadPrefs();
load();
applyPrefs();
renderPrefs();
renderChips();
renderCatList();
renderGrid();
updateHeaderHeight();
setTimeout(updateHeaderHeight, 200);

/* ═══ رویدادهای حالت انتخاب چندگانه ═══ */

$("#quickFab")?.addEventListener("click", (e) => {
  const part = e.target.closest("[data-qf]");
  if (!part) return;
  const act = part.dataset.qf;
  if (act === "add") openModal();
  else if (act === "select") enterSelectMode();
});
$("#selAllBtn")?.addEventListener("click", toggleSelectAll);
$("#selPinBtn")?.addEventListener("click", bulkPin);
$("#selMoveBtn")?.addEventListener("click", openBulkMove);
$("#selDelBtn")?.addEventListener("click", bulkDelete);
$("#selCancelBtn")?.addEventListener("click", exitSelectMode);
$("#bulkMoveCancelBtn")?.addEventListener("click", closeBulkMove);
$("#bulkMoveBack")?.addEventListener("click", (e) => {
  if (e.target.id === "bulkMoveBack") closeBulkMove();
});
$("#bulkMoveList")?.addEventListener("click", (e) => {
  const item = e.target.closest("[data-cat]");
  if (!item) return;
  const catId = item.dataset.cat;
  const ids = [...selectedIds];
  if (!ids.length) return;
  const idSet = new Set(ids);
  commit((d) => {
    d.prompts.forEach((p) => {
      if (idSet.has(p.id)) {
        p.category = catId;
        p.updatedAt = Date.now();
      }
    });
  });
  closeBulkMove();
  exitSelectMode();
  toast(`${toFaNum(ids.length)} پرامپت منتقل شد`);
});

/* ═══════════ غیرفعال‌سازی کانتکست منوی پیش‌فرض ═══════════
   فقط داخل input/textarea/contenteditable فعال می‌مونه تا کاربر
   بتونه از منوی بومی «Paste» استفاده کنه. */
document.addEventListener("contextmenu", (e) => {
  if (
    e.target.closest(
      "input, textarea, [contenteditable='true'], [contenteditable='']"
    )
  )
    return;
  e.preventDefault();
});

/* ═══════════ کانتکست منو (دسکتاپ) ═══════════ */
(function setupCardContextMenu() {
  const menu = $("#cardCtxMenu");
  if (!menu) return;
  let ctxPrompt = null;

  const CTX_ICONS = {
    edit: icon("edit"),
    copy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    ai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>',
    move: icon("folder"),
    dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
    select:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/></svg>',
    del: icon("trash"),
    chev: '<svg class="ctx-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  };

  function buildMenu(p) {
    const vars = extractVars(p.content);
    const copyLabel = vars.length
      ? `کپی متن (${toFaNum(vars.length)} متغیر)`
      : "کپی متن";
    const aiItems = AI_TARGETS.map(
      (t) => `
<button type="button" role="menuitem" data-ctx-ai="${t.id}">
<span class="ai-dot" style="--ai-c:${t.color}">${esc(t.abbr)}</span>
<span>${esc(t.name)}</span>
${t.noPrefill ? '<span class="ctx-hint">کپی</span>' : ""}
</button>`,
    ).join("");
    const catItems = DATA.categories
      .map(
        (c) => `
<button type="button" role="menuitem" data-ctx-move="${esc(c.id)}">
<span class="dot ${esc(c.color)}" style="width:.6rem;height:.6rem;border-radius:50%;flex-shrink:0"></span>
<span>${esc(c.name)}</span>
${
  p.category === c.id
    ? `<span class="ctx-hint">${icon("check").replace("<svg", '<svg style="width:.9rem;height:.9rem"')}</span>`
    : ""
}
</button>`,
      )
      .join("");

    menu.innerHTML = `
<button type="button" role="menuitem" data-ctx="edit">${CTX_ICONS.edit}<span>ویرایش</span></button>
<button type="button" role="menuitem" data-ctx="copy">${CTX_ICONS.copy}<span>${esc(copyLabel)}</span></button>
<div class="ctx-sub">
<button type="button" role="menuitem" aria-haspopup="menu" data-ctx="ai">${CTX_ICONS.ai}<span>باز کردن در AI</span>${CTX_ICONS.chev}</button>
<div class="ctx-submenu" role="menu">${aiItems}</div>
</div>
<div class="ctx-sep"></div>
<button type="button" role="menuitem" data-ctx="pin">${CTX_ICONS.pin}<span>${p.pinned ? "برداشتن سنجاق" : "سنجاق کردن"}</span></button>
<div class="ctx-sub">
<button type="button" role="menuitem" aria-haspopup="menu" data-ctx="move">${CTX_ICONS.move}<span>انتقال به دسته</span>${CTX_ICONS.chev}</button>
<div class="ctx-submenu" role="menu">${catItems}</div>
</div>
<button type="button" role="menuitem" data-ctx="dup">${CTX_ICONS.dup}<span>تکثیر</span></button>
<div class="ctx-sep"></div>
<button type="button" role="menuitem" data-ctx="select">${CTX_ICONS.select}<span>انتخاب چندگانه</span></button>
<div class="ctx-sep"></div>
<button type="button" role="menuitem" class="ctx-dgr" data-ctx="del">${CTX_ICONS.del}<span>حذف</span></button>
`;
  }

  function show(x, y, p) {
    ctxPrompt = p;
    buildMenu(p);
    menu.hidden = false;
    menu.style.left = "0px";
    menu.style.top = "0px";
    const r = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x;
    let ny = y;
    if (nx + r.width > vw - 8) nx = vw - r.width - 8;
    if (ny + r.height > vh - 8) ny = vh - r.height - 8;
    if (nx < 8) nx = 8;
    if (ny < 8) ny = 8;
    menu.style.left = nx + "px";
    menu.style.top = ny + "px";
  }
  function hide() {
    menu.hidden = true;
    ctxPrompt = null;
  }

  /* راست-کلیک روی کارت */
  $("#grid").addEventListener("contextmenu", (e) => {
    if (selectMode) return;
    const card = e.target.closest(".card");
    if (!card) return;
    const p = DATA.prompts.find((x) => x.id === card.dataset.id);
    if (!p) return;
    e.preventDefault();
    show(e.clientX, e.clientY, p);
  });

  /* راست-کلیک روی فضای خالی گرید → پرامپت جدید */
  $("#grid").addEventListener("contextmenu", (e) => {
    if (e.target.closest(".card")) return;
    e.preventDefault();
    openModal();
  });

  document.addEventListener("click", (e) => {
    if (menu.hidden) return;
    if (e.target.closest("#cardCtxMenu")) return;
    hide();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      hide();
      e.stopPropagation();
    }
  });
  window.addEventListener("scroll", hide, { passive: true });
  window.addEventListener("resize", hide);
  window.addEventListener("blur", hide);

  menu.addEventListener("click", (e) => {
    /* اول ساب‌منو */
    const aiBtn = e.target.closest("[data-ctx-ai]");
    if (aiBtn && ctxPrompt) {
      const t = AI_TARGETS.find((x) => x.id === aiBtn.dataset.ctxAi);
      const p = ctxPrompt;
      hide();
      if (t) openInAI(p, t);
      return;
    }
    const moveBtn = e.target.closest("[data-ctx-move]");
    if (moveBtn && ctxPrompt) {
      const catId = moveBtn.dataset.ctxMove;
      const p = ctxPrompt;
      hide();
      commit((d) => {
        const t = d.prompts.find((x) => x.id === p.id);
        if (t) {
          t.category = catId;
          t.updatedAt = Date.now();
        }
      });
      toast("منتقل شد");
      return;
    }

    const btn = e.target.closest("[data-ctx]");
    if (!btn || !ctxPrompt) return;
    const act = btn.dataset.ctx;
    const p = ctxPrompt;
    hide();

    if (act === "edit") openModal(p);
    else if (act === "copy") requestCopy(p);
    else if (act === "pin") {
      commit((d) => {
        const t = d.prompts.find((x) => x.id === p.id);
        if (t) {
          t.pinned = !t.pinned;
          t.updatedAt = Date.now();
        }
      });
    } else if (act === "dup") {
      const now = Date.now();
      commit((d) => {
        const orig = d.prompts.find((x) => x.id === p.id);
        if (!orig) return;
        d.prompts.push({
          ...orig,
          id: uid(),
          title: orig.title + " (کپی)",
          pinned: false,
          createdAt: now,
          updatedAt: now,
        });
      });
      toast("تکثیر شد");
    } else if (act === "select") {
      enterSelectMode(p.id);
    } else if (act === "del") {
      deletePrompt(p.id);
    }
  });
})();

/* ═══ چنج‌لاگ ═══ */
const CHANGELOG = [
  {
    version: "1.3",
    date: "۱۴۰۴/۰۶/۲۷",
    items: [
      "انتخاب چندگانه با حذف، سنجاق و انتقال گروهی",
      "کانتکست منو: راست‌کلیک روی کارت → ویرایش، کپی، AI، انتقال، تکثیر، حذف",
      "FAB شناور: پرامپت جدید و انتخاب چندگانه",
      "جهت مرتب‌سازی: صعودی / نزولی با یک کلیک",
      "چیپس‌های افقی اسکرول‌شو در موبایل",
      "محافظت داده: بکاپ خودکار قبل از مهاجرت",
    ],
  },
  {
    version: "1.2",
    date: "۱۴۰۴/۰۶/۲۶",
    items: [
      "نصب روی گوشی مثل یک اپ واقعی",
      "به‌روزرسانی آسان از تنظیمات",
      "تاریخچهٔ تغییرات در دسترس",
      "ظاهر مرتب‌تر کارت‌ها",
      "پس‌زمینهٔ جدید",
      "ادیتور راحت‌تر روی موبایل",
      "سرعت بارگذاری بهتر",
    ],
  },
  {
    version: "1.1",
    date: "۱۴۰۴/۰۶/۲۵",
    items: [
      "متغیرها: {{موضوع}} و {{لحن}}",
      "باز کردن مستقیم پرامپت در ChatGPT و Claude و بقیه",
      "پشتیبان‌گیری و بازیابی با فایل",
    ],
  },
  {
    version: "1.0",
    date: "۱۴۰۴/۰۶/۲۴",
    items: [
      "اولین نسخه",
      "جست‌وجو، دسته‌بندی و سنجاق",
    ],
  },
];

let currentAppVer = null;

function renderChangelog() {
  const el = $("#chlogList");
  if (!el) return;
  el.innerHTML = CHANGELOG.map((c, i) => {
    const isCurrent = currentAppVer && c.version === currentAppVer;
    return `
<div class="chlog-item">
  <div class="chlog-head">
    <span class="chlog-ver">
      نسخه ${esc(c.version)}
      ${
        isCurrent || (!currentAppVer && i === 0)
          ? '<span class="chlog-current">فعلی</span>'
          : ""
      }
    </span>
    <span class="chlog-date">${esc(c.date || "")}</span>
  </div>
  <ul>${c.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul>
</div>`;
  }).join("");
}
function openChangelog() {
  renderChangelog();
  $("#chlogBack").classList.add("open");
  refreshFocusTrap();
}
function closeChangelog() {
  $("#chlogBack").classList.remove("open");
  refreshFocusTrap();
}
$("#chlogBtn")?.addEventListener("click", openChangelog);
$("#chlogCloseBtn")?.addEventListener("click", closeChangelog);
$("#chlogBack")?.addEventListener("click", (e) => {
  if (e.target.id === "chlogBack") closeChangelog();
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    $("#chlogBack")?.classList.contains("open")
  ) {
    closeChangelog();
    e.stopPropagation();
  }
});

/* ═══ خواندن نسخهٔ اپ از sw.js ═══ */
(async function showVersion() {
  try {
    const res = await fetch("./sw.js", { cache: "no-store" });
    const txt = await res.text();
    const m = txt.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
    if (m && m[1]) {
      currentAppVer = m[1];
      const ftVer = $("#ftVer");
      if (ftVer) ftVer.textContent = m[1];
      if ($("#chlogBack")?.classList.contains("open")) renderChangelog();
    }
  } catch (_) {}
})();

/* ═══ PWA: نصب ═══ */
let deferredInstall = null;
const installBtn = $("#installBtn");
const iosHint = $("#iosHint");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  installBtn.classList.add("show");
});

window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  installBtn.classList.remove("show");
  toast("اپ نصب شد ✓");
});

installBtn.addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  if (outcome === "accepted") installBtn.classList.remove("show");
  deferredInstall = null;
});

(function iosInstallHint() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.navigator.standalone === true ||
    matchMedia("(display-mode: standalone)").matches;
  const dismissed = localStorage.getItem("iosHintDismissed") === "1";
  if (isIos && !isStandalone && !dismissed) {
    setTimeout(() => iosHint.classList.add("show"), 3000);
  }
  $("#iosHintClose")?.addEventListener("click", () => {
    iosHint.classList.remove("show");
    localStorage.setItem("iosHintDismissed", "1");
  });
})();

/* ═══ Service Worker + آپدیت دستی ═══ */
let swWaitingWorker = null;

function showUpdateIndicator(ver) {
  $("#settingsBtn")?.classList.add("has-update");
  const grp = $("#updateGroup");
  if (grp) grp.style.display = "";
  const lbl = $("#updateVerLabel");
  if (lbl && ver) {
    lbl.textContent = `نسخهٔ ${ver} آماده است. برای اعمال، دکمه را بزن.`;
  } else if (lbl) {
    lbl.textContent = "برای اعمال تغییرات، دکمه را بزن.";
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        /* اگه از قبل waiting داره (مثلاً reload کرده) */
        if (reg.waiting && navigator.serviceWorker.controller) {
          swWaitingWorker = reg.waiting;
          showUpdateIndicator();
        }

        /* آپدیت جدید پیدا شد */
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              swWaitingWorker = newWorker;
              showUpdateIndicator();
            }
          });
        });

        /* هر بار اپ باز می‌شه، چک کن نسخهٔ جدید هست */
        reg.update();
      })
      .catch((err) => console.warn("SW register failed:", err));

    /* بعد از آپدیت، صفحه reload می‌شه */
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

/* دکمهٔ آپدیت تو تنظیمات */
$("#updateBtn")?.addEventListener("click", () => {
  if (!swWaitingWorker) {
    /* اگه waiting نیست، شاید بعد از reload تموم شده */
    closeDrawer();
    window.location.reload();
    return;
  }
  swWaitingWorker.postMessage("SKIP_WAITING");
  $("#settingsBtn")?.classList.remove("has-update");
  const grp = $("#updateGroup");
  if (grp) grp.style.display = "none";
  toast("به‌روزرسانی در حال اعمال…");
});

