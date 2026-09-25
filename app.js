"use strict";

import { loadWallpaperCatalog } from "./wallpapers/index.js";

/* ═══════════════ ابزارها ═══════════════ */
/* مرورگر به‌صورت پیش‌فرض موقع history.back/forward اسکرول رو ری‌ست می‌کنه.
   ما خودمون مدیریت می‌کنیم (lock/unlock) — پس این رو دست‌دستی خاموش می‌کنیم. */
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

/* ── ارتفاع visual viewport ──
   iOS Safari dvh رو با کیبورد کوچیک نمی‌کنه، پس مستقیم از
   visualViewport.height می‌گیریم و تو --vvh می‌ذاریم.
   ادیتور موبایل ارتفاعش رو از این var می‌گیره. */
if (window.visualViewport) {
  const vv = window.visualViewport;
  const setVVH = () => {
    document.documentElement.style.setProperty(
      "--vvh",
      vv.height + "px"
    );
  };
  vv.addEventListener("resize", setVVH);
  vv.addEventListener("scroll", setVVH);
  setVVH();
}
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const DATA_KEY = "promptManager_public_v1";
const PREF_KEY = "promptManagerPrefs_public_v1";
const CURRENT_VERSION = 4;

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

/* ═══════════════ موتور صدا ═══════════════ */
const SFX = (() => {
  let ctx = null;
  let enabled = false;
  let master = null;
  let volPct = 70;
  let currentTheme = "soft";
  let _activated = false;
  const BASE_VOL = 0.22;

  /* مرورگرها ساخت AudioContext قبل از اولین تعامل را بلاک می‌کنند.
     تا اولین pointerdown/keydown، ensure() هیچ‌کاری نمی‌کند.
     مهم: حتی اگه صدا خاموشه، تو اولین gesture ctx رو بساز —
     وگرنه بعداً که کاربر صدا رو روشن می‌کنه، ساخت خارج از gesture
     بلاک می‌شه و خطای «not allowed to start» می‌ده. */
  function _onFirstGesture(e) {
    if (!e.isTrusted) return;
    _activated = true;
    ensure();
  }
  document.addEventListener("pointerdown", _onFirstGesture, {
    once: true,
    capture: true,
  });
  document.addEventListener("keydown", _onFirstGesture, {
    once: true,
    capture: true,
  });

  function ensure() {
    if (!_activated) return null;
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C({ latencyHint: "interactive" });

      /* زنجیره: source → hp → presence → lp → destination
         بهینه برای هدفون/TWS: حذف sub-bass، تقویت وضوح 3kHz */
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 70;
      hp.Q.value = 0.6;

      const presence = ctx.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 3000;
      presence.Q.value = 0.9;
      presence.gain.value = 2.5;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 14000;
      lp.Q.value = 0.3;

      hp.connect(presence);
      presence.connect(lp);
      lp.connect(ctx.destination);
      master = hp;
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  /* partials: آرایهٔ ضرایب فرکانس برای شبیه‌سازی سازهای کوبه‌ای واقعی.
     مثلاً [1, 2.76, 5.4] برای bell — هارمونیک‌های ناهارمونیک.
     اگه داده نشه، یه oscillator تک مثل قبل ساخته می‌شه. */
  const PARTIAL_FALLOFF = [1, 0.5, 0.3, 0.2, 0.14, 0.1];

  function tone({
    freq,
    dur,
    delay = 0,
    sweep = null,
    vol = 1,
    attack = 0.02,
    release = 0.1,
    wave = "sine",
    lpf = null,
    partials = null,
  }) {
    if (!enabled) return;
    const c = ensure();
    if (!c || !master) return;
    const t0 = c.currentTime + delay;
    const peak = BASE_VOL * (volPct / 100) * vol;

    const oscs = [];
    const list = partials && partials.length ? partials : [1];
    list.forEach((mult, i) => {
      const osc = c.createOscillator();
      osc.type = wave;
      const f0 = freq * mult;
      osc.frequency.setValueAtTime(f0, t0);
      if (sweep) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(sweep * mult, 60),
          t0 + dur
        );
      }
      oscs.push(osc);
    });

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(
      0.0001,
      t0 + dur + release
    );

    /* هر partial با یه گین جدا وصل می‌شه — falloff برای گرمی */
    oscs.forEach((osc, i) => {
      const pg = c.createGain();
      const fv = list.length > 1 ? PARTIAL_FALLOFF[i] || 0.08 : 1;
      pg.gain.value = fv;
      osc.connect(pg);
      pg.connect(g);
    });

    let out = g;
    if (lpf) {
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lpf;
      f.Q.value = 0.7;
      g.connect(f);
      out = f;
    }
    out.connect(master);

    oscs.forEach((osc) => {
      osc.start(t0);
      osc.stop(t0 + dur + release + 0.05);
    });
  }

  /* صدای نویز فیلترشده — برای ضربه‌های ضربی (چوب، تیک ساعت).
     نویز سفید + فیلتر باندپاس/هایپاس/لوپاس = خشکیِ ضربه. */
  function noise({
    dur,
    delay = 0,
    vol = 1,
    attack = 0.001,
    release = 0.04,
    lpf = null,
    hpf = null,
    bp = null,
    bpQ = 6,
  }) {
    if (!enabled) return;
    const c = ensure();
    if (!c || !master) return;
    const t0 = c.currentTime + delay;

    const len = Math.ceil(
      c.sampleRate * (dur + release + 0.03)
    );
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buf;

    let node = src;
    if (bp) {
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = bp;
      f.Q.value = bpQ;
      node.connect(f);
      node = f;
    }
    if (hpf) {
      const f = c.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = hpf;
      f.Q.value = 0.7;
      node.connect(f);
      node = f;
    }
    if (lpf) {
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lpf;
      f.Q.value = 0.7;
      node.connect(f);
      node = f;
    }

    const g = c.createGain();
    const peak = BASE_VOL * (volPct / 100) * vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(
      0.0001,
      t0 + dur + release
    );
    node.connect(g);
    g.connect(master);

    src.start(t0);
    src.stop(t0 + dur + release + 0.03);
  }

  const THEMES = {
    /* ── نرم: ملودیک ──
       دو نُت سین در فاصلهٔ پنجم درست (C5 + G5).
       نزدیک به موسیقی، گرم و آشنا. */
    soft: {
      copy: () => {
        tone({ freq: 523.25, dur: 0.05, vol: 0.75 });
        tone({ freq: 783.99, dur: 0.09, delay: 0.045, vol: 0.55, release: 0.14 });
      },
      del: () => tone({ freq: 440, dur: 0.09, sweep: 260, vol: 0.7, release: 0.12 }),
      undo: () => tone({ freq: 349.23, dur: 0.075, sweep: 523.25, vol: 0.75, release: 0.12 }),
      err: () => {
        tone({ freq: 233, dur: 0.07, vol: 0.65 });
        tone({ freq: 175, dur: 0.09, delay: 0.08, vol: 0.6 });
      },
      tick: () => tone({ freq: 587.33, dur: 0.025, vol: 0.35 }),
    },

    /* ── بلورین: بِل شیشه‌ای ──
       سین با هارمونیک‌های ناهارمونیک (2.76 و 5.4) = جنس شیشه/کریستال.
       فرکانس بالا، انتشار طولانی، درخشان. */
    crystal: {
      copy: () => tone({
        freq: 1568, dur: 0.08, vol: 0.4,
        attack: 0.002, release: 0.42,
        partials: [1, 2.76, 5.4],
      }),
      del: () => tone({
        freq: 1046.5, dur: 0.06, vol: 0.35,
        attack: 0.002, release: 0.3,
        partials: [1, 2.76, 5.4],
      }),
      undo: () => tone({
        freq: 1318.5, dur: 0.06, vol: 0.35,
        attack: 0.002, release: 0.32,
        partials: [1, 2.76, 5.4],
      }),
      err: () => {
        tone({ freq: 622.25, dur: 0.05, vol: 0.35, partials: [1, 2.76, 5.4] });
        tone({ freq: 415.3, dur: 0.09, delay: 0.08, vol: 0.32, partials: [1, 2.76, 5.4] });
      },
      tick: () => tone({
        freq: 2093, dur: 0.02, vol: 0.25,
        attack: 0.001, release: 0.08,
        partials: [1, 3.4],
      }),
    },

    /* ── چوبی: ضربه‌ای خشک ──
       بست نویز باندپاس (شبیه ضربه به چوب) + تامپ سینِ کوتاه پایین.
       دقیقاً ساختار یه ساز کوبه‌ای واقعی. */
    wood: {
      copy: () => {
        noise({ dur: 0.012, vol: 0.5, attack: 0.0008, release: 0.04, bp: 1400, bpQ: 5 });
        tone({ freq: 320, dur: 0.035, vol: 0.5, wave: "sine", attack: 0.001, release: 0.06 });
        noise({ dur: 0.01, delay: 0.05, vol: 0.4, attack: 0.0008, release: 0.03, bp: 1800, bpQ: 5 });
        tone({ freq: 480, dur: 0.03, delay: 0.05, vol: 0.4, wave: "sine", attack: 0.001, release: 0.05 });
      },
      del: () => {
        noise({ dur: 0.014, vol: 0.55, attack: 0.0008, release: 0.05, bp: 900, bpQ: 4 });
        tone({ freq: 200, dur: 0.05, vol: 0.45, wave: "sine", attack: 0.001, release: 0.08 });
      },
      undo: () => {
        noise({ dur: 0.012, vol: 0.5, attack: 0.0008, release: 0.04, bp: 1100, bpQ: 4 });
        tone({ freq: 260, dur: 0.05, vol: 0.45, wave: "sine", attack: 0.001, release: 0.08, sweep: 440 });
      },
      err: () => {
        noise({ dur: 0.02, vol: 0.5, attack: 0.001, release: 0.06, bp: 700, bpQ: 3 });
        tone({ freq: 170, dur: 0.06, vol: 0.5, wave: "sine", attack: 0.001, release: 0.1 });
        noise({ dur: 0.02, delay: 0.08, vol: 0.45, attack: 0.001, release: 0.06, bp: 600, bpQ: 3 });
        tone({ freq: 140, dur: 0.06, delay: 0.08, vol: 0.45, wave: "sine", attack: 0.001, release: 0.1 });
      },
      tick: () => {
        noise({ dur: 0.008, vol: 0.5, attack: 0.0005, release: 0.025, bp: 1800, bpQ: 6 });
        tone({ freq: 420, dur: 0.015, vol: 0.35, wave: "sine", attack: 0.001, release: 0.03 });
      },
    },

    /* ── دیجیتال: رباتیک گلیچی ──
       سه پالس مربع پشت‌سرهم با فرکانس صعودی + فیلتر لوپاس.
       حس «داده در حال انتقال» یا ماشین حساب قدیمی. */
    digital: {
      copy: () => {
        tone({ freq: 1200, dur: 0.012, vol: 0.3, wave: "square", attack: 0.0005, release: 0.008, lpf: 3000 });
        tone({ freq: 1600, dur: 0.012, delay: 0.022, vol: 0.28, wave: "square", attack: 0.0005, release: 0.008, lpf: 3000 });
        tone({ freq: 2000, dur: 0.015, delay: 0.044, vol: 0.25, wave: "square", attack: 0.0005, release: 0.01, lpf: 3000 });
      },
      del: () => {
        tone({ freq: 900, dur: 0.02, sweep: 400, vol: 0.35, wave: "square", attack: 0.001, release: 0.02, lpf: 2200 });
        tone({ freq: 500, dur: 0.02, delay: 0.035, sweep: 220, vol: 0.3, wave: "square", attack: 0.001, release: 0.03, lpf: 1800 });
      },
      undo: () => {
        tone({ freq: 500, dur: 0.018, sweep: 1000, vol: 0.32, wave: "square", attack: 0.001, release: 0.02, lpf: 2400 });
        tone({ freq: 900, dur: 0.018, delay: 0.03, sweep: 1800, vol: 0.3, wave: "square", attack: 0.001, release: 0.025, lpf: 2400 });
      },
      err: () => {
        tone({ freq: 320, dur: 0.03, vol: 0.35, wave: "square", attack: 0.0008, release: 0.02, lpf: 1400 });
        tone({ freq: 260, dur: 0.04, delay: 0.04, vol: 0.35, wave: "square", attack: 0.0008, release: 0.03, lpf: 1200 });
      },
      tick: () => tone({
        freq: 1800, dur: 0.006, vol: 0.24,
        wave: "square", attack: 0.0003, release: 0.006, lpf: 3200,
      }),
    },

    /* ── ساعت: مکانیکی ظریف ──
       تیک نویز هایپاس (فرکانس بالا، خشک) + پینگ سین ریز.
       مثل صدای ساعت مچی مکانیکی یا تایمر. */
    watch: {
      copy: () => {
        noise({ dur: 0.006, vol: 0.55, attack: 0.0003, release: 0.012, hpf: 4000 });
        tone({ freq: 2400, dur: 0.01, vol: 0.35, wave: "sine", attack: 0.0005, release: 0.03 });
        noise({ dur: 0.006, delay: 0.055, vol: 0.5, attack: 0.0003, release: 0.012, hpf: 4000 });
        tone({ freq: 2800, dur: 0.01, delay: 0.055, vol: 0.3, wave: "sine", attack: 0.0005, release: 0.03 });
      },
      del: () => {
        noise({ dur: 0.008, vol: 0.55, attack: 0.0003, release: 0.018, hpf: 3000 });
        tone({ freq: 1800, dur: 0.012, vol: 0.35, wave: "sine", attack: 0.0005, release: 0.04, sweep: 900 });
      },
      undo: () => {
        noise({ dur: 0.008, vol: 0.5, attack: 0.0003, release: 0.015, hpf: 3200 });
        tone({ freq: 1200, dur: 0.014, vol: 0.35, wave: "sine", attack: 0.0005, release: 0.04, sweep: 2000 });
      },
      err: () => {
        noise({ dur: 0.012, vol: 0.5, attack: 0.0005, release: 0.025, hpf: 2000 });
        tone({ freq: 700, dur: 0.03, vol: 0.35, wave: "sine", attack: 0.001, release: 0.06 });
        noise({ dur: 0.012, delay: 0.06, vol: 0.45, attack: 0.0005, release: 0.025, hpf: 1800 });
        tone({ freq: 500, dur: 0.03, delay: 0.06, vol: 0.32, wave: "sine", attack: 0.001, release: 0.07 });
      },
      tick: () => {
        noise({ dur: 0.004, vol: 0.5, attack: 0.0002, release: 0.008, hpf: 5000 });
        tone({ freq: 2600, dur: 0.006, vol: 0.28, wave: "sine", attack: 0.0003, release: 0.02 });
      },
    },

    /* ── زنگی: طنین‌دار، کشیده ──
       سین با ۴ هارمونیک دقیق (2.01, 2.98, 4.16) — شبیه زنگ کلیسا.
       ریلیز طولانی، حس فضا. */
    bell: {
      copy: () => tone({
        freq: 1046.5, dur: 0.15, vol: 0.5,
        attack: 0.003, release: 0.8,
        partials: [1, 2.01, 2.98, 4.16],
      }),
      del: () => tone({
        freq: 784, dur: 0.15, vol: 0.45,
        attack: 0.003, release: 0.75,
        partials: [1, 2.01, 2.98, 4.16],
      }),
      undo: () => tone({
        freq: 659.25, dur: 0.15, vol: 0.45,
        attack: 0.003, release: 0.75,
        partials: [1, 2.01, 2.98, 4.16],
      }),
      err: () => {
        tone({
          freq: 523.25, dur: 0.14, vol: 0.4,
          attack: 0.003, release: 0.6,
          partials: [1, 2.01, 2.98, 4.16],
        });
        tone({
          freq: 392, dur: 0.18, delay: 0.15, vol: 0.36,
          attack: 0.003, release: 0.7,
          partials: [1, 2.01, 2.98, 4.16],
        });
      },
      tick: () => tone({
        freq: 1318.5, dur: 0.04, vol: 0.3,
        attack: 0.002, release: 0.2,
        partials: [1, 2.01],
      }),
    },
  };

  return {
    play(name) {
      const theme = THEMES[currentTheme] || THEMES.soft;
      const fn = theme[name] || THEMES.soft[name];
      if (fn) fn();
    },
    setEnabled(v) {
      enabled = !!v;
      if (enabled) ensure();
    },
    setVolume(v) {
      const n = Number(v);
      if (isFinite(n)) volPct = n;
    },
    setTheme(t) {
      currentTheme = THEMES[t] ? t : "soft";
    },
    isEnabled: () => enabled,
  };
})();

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
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/></svg>',
  move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="m12 11-2 2 2 2"/><path d="M14 13H9"/></svg>',
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

/* ═══ کتابخانهٔ پرامپت‌ها ═══
   از library.json لود می‌شه (جدا از app.js — برای رشد بدون سنگین شدن) */
const LIBRARY_SHOWN = 8;
let _libraryCache = null;
let currentLibItems = [];

async function loadLibrary() {
  if (_libraryCache) return _libraryCache;
  try {
    const res = await fetch("./library.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const items = Array.isArray(data) ? data : data.items || [];
    _libraryCache = items;
    return items;
  } catch (e) {
    console.warn("library load failed", e);
    _libraryCache = [];
    return [];
  }
}

/* PRNG سبک (mulberry32) — خروجی یکسان برای یه seed */
function _mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* seed — روزانه بر اساس تاریخ، دستی بر اساس libOffset */
function _daySeed() {
  if (PREFS.libMode === "manual") {
    /* پایهٔ عدد اول تا consecutive offsets دنبالهٔ مشابه ندن */
    return 900000000 + (PREFS.libOffset || 0) * 7919;
  }
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function pickDailyItems(all, n) {
  if (all.length <= n) return [...all];
  const rnd = _mulberry32(_daySeed());
  const copy = [...all];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

let DATA = { version: CURRENT_VERSION, categories: [], prompts: [], trash: [] };

function commit(mutator) {
  if (typeof mutator === "function") mutator(DATA);
  /* پاک‌سازی کش‌هایی که ممکنه با mutation بی‌اعتبار شن */
  if (typeof _pruneHayCache === "function") _pruneHayCache();
  save();
  renderChips();
  renderGrid();
  renderCatList();
  /* صفحهٔ سطل باز باشه → refresh */
  if ($("#trashList")) renderTrash();
  renderSettingsValues();
}

/* حذف ورودی‌های کش برای پرامپت‌های حذف‌شده */
function _pruneHayCache() {
  if (_hayCache.size < 500) return; /* وقتی کوچیکه، بی‌خیال */
  const alive = new Set(DATA.prompts.map((p) => p.id));
  for (const id of _hayCache.keys()) {
    if (!alive.has(id)) _hayCache.delete(id);
  }
}

const DEFAULT_CATEGORIES = [
  { id: "write", name: "نوشتن و محتوا", color: "b-blu" },
  { id: "code", name: "کد و فنی", color: "b-grn" },
  { id: "image", name: "تصویرسازی", color: "b-vio" },
  { id: "analyze", name: "تحلیل و بررسی", color: "b-cyn" },
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
  if (!Array.isArray(cur.trash)) cur.trash = [];
  return cur;
}

/* ═══ پالت‌های رنگ — منبع یگانهٔ حقیقت ═══ */
const PALETTES = {
  default:      { label: "پیش‌فرض",     sw: "conic-gradient(from 90deg, #a78bfa 0 90deg, #60a5fa 90deg 180deg, #34d399 180deg 270deg, #fbbf24 270deg 360deg)" },
  ocean:        { label: "اقیانوس",     sw: "linear-gradient(135deg, #60a5fa, #22d3ee)" },
  forest:       { label: "جنگل",        sw: "linear-gradient(135deg, #34d399, #84cc16)" },
  sunset:       { label: "غروب",        sw: "linear-gradient(135deg, #fb7185, #fbbf24)" },
  galaxy:       { label: "کهکشان",      sw: "linear-gradient(135deg, #c084fc, #f472b6)" },
  mono:         { label: "بی‌رنگ",      sw: "linear-gradient(135deg, #e2e8f0, #475569)" },
  "crt-green":  { label: "فسفری سبز",   sw: "radial-gradient(circle at 35% 35%, #c4ffd0 0%, #4ade80 45%, #166534 100%)" },
  "crt-amber":  { label: "کهربایی",     sw: "radial-gradient(circle at 35% 35%, #ffe9b3 0%, #fbbf24 45%, #92400e 100%)" },
  "crt-cyan":   { label: "فیروزه‌ای",    sw: "radial-gradient(circle at 35% 35%, #a5f3fc 0%, #22d3ee 45%, #0e7490 100%)" },
  "crt-white":  { label: "سفید فسفری",  sw: "radial-gradient(circle at 35% 35%, #ffffff 0%, #cbd5e1 45%, #475569 100%)" },
  "crt-magenta":{ label: "ارغوانی",     sw: "radial-gradient(circle at 35% 35%, #fce7f3 0%, #f472b6 45%, #9d174d 100%)" },
};

const DEFAULT_PALETTES = ["default", "ocean", "forest", "sunset", "galaxy", "mono"];
const CRT_PALETTES     = ["crt-green", "crt-amber", "crt-cyan", "crt-white", "crt-magenta"];

/* ═══ تعریف اسکین‌ها — قوانین هر اسکین ═══ */
const SKIN_DEFS = {
  default:   { themes: ["dark", "light", "system"], palettes: DEFAULT_PALETTES, label: "پیش‌فرض" },
  sharp:     { themes: ["dark", "light", "system"], palettes: DEFAULT_PALETTES, label: "تیز" },
  soft:      { themes: ["dark", "light", "system"], palettes: DEFAULT_PALETTES, label: "نرم" },
  brutalist: { themes: ["dark", "light"],           palettes: DEFAULT_PALETTES, label: "بروتال" },
  mono:      { themes: ["dark", "light"],           palettes: ["mono"],         label: "تک‌رنگ" },
  glass:     { themes: ["dark", "light", "system"], palettes: DEFAULT_PALETTES, label: "شیشه‌ای" },
  terminal:  { themes: ["dark"], forced: "dark",    palettes: CRT_PALETTES,     label: "ترمینال" },
  editorial: { themes: ["light"], forced: "light",  palettes: ["default", "forest", "sunset"], label: "مجله‌ای" },
};

const PREF_DEFAULTS = {
  theme: "system",
  accent: "default",
  bg: "default",
  bgType: "pattern",       /* "none" | "pattern" | "static" | "live" */
  skin: "default",
  fs: "medium",
  cols: "3",
  sort: "updated",
  sortDir: "desc",
  sound: "off",
  soundVol: 70,
  soundTheme: "soft",
  libMode: "daily",
  libOffset: 0,
  varHintSeen: false,
  wall: "none",
  wallDim: 40,
  wallBlur: 0,
};

let PREFS = Object.assign({}, PREF_DEFAULTS);
function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      Object.keys(PREF_DEFAULTS).forEach((k) => {
        if (p[k] === undefined) return;
        if (typeof p[k] === typeof PREF_DEFAULTS[k]) PREFS[k] = p[k];
      });
      /* migrate: تم صوتی deep حذف شد — برگردون به soft */
      if (PREFS.soundTheme === "deep") {
        PREFS.soundTheme = "soft";
        savePrefs();
      }
      /* migrate: پترن clean حذف شد — برگردون به default */
      if (PREFS.bg === "clean") {
        PREFS.bg = "default";
        savePrefs();
      }
      /* migrate: اگه کاربر wall داشت ولی bgType نداشت،
         پس پترن بوده — مگه اینکه wall فعال بوده */
      if (PREFS.bgType === undefined) {
        if (PREFS.wall && PREFS.wall !== "none") {
          PREFS.bgType = "live";  /* فرض: کاربر والپیپر داشته */
        } else {
          PREFS.bgType = "pattern";
        }
        savePrefs();
      }
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

/* ═══════════════ والپیپر ═══════════════ */
let _wallCatalog = null;
let _wallInstance = null;
let _wallLayer = null;
let _lastWall = null;

const _wallPointer = { x: 0, y: 0, nx: 0.5, ny: 0.5, inside: false, down: false };
["pointermove", "pointerdown", "pointerup"].forEach((ev) => {
  window.addEventListener(ev, (e) => {
    if (ev === "pointerup") { _wallPointer.down = false; return; }
    _wallPointer.x = e.clientX;
    _wallPointer.y = e.clientY;
    _wallPointer.nx = e.clientX / innerWidth;
    _wallPointer.ny = e.clientY / innerHeight;
    _wallPointer.inside = true;
    if (ev === "pointerdown") _wallPointer.down = true;
  }, { passive: true });
});

async function loadWallCatalog() {
  if (_wallCatalog) return _wallCatalog;
  try {
    const data = await loadWallpaperCatalog();
    _wallCatalog = data.items || [];
    return _wallCatalog;
  } catch (e) {
    console.warn("wallpapers load failed", e);
    _wallCatalog = [];
    return [];
  }
}

function ensureWallLayer() {
  if (_wallLayer) return _wallLayer;
  const el = document.createElement("div");
  el.id = "wallpaperLayer";
  el.setAttribute("aria-hidden", "true");
  document.body.insertBefore(el, document.body.firstChild);
  _wallLayer = el;
  return el;
}

function clearWall() {
  if (_wallInstance) {
    try { _wallInstance.unmount && _wallInstance.unmount(); } catch (_) {}
    _wallInstance = null;
  }
  if (_wallLayer) _wallLayer.innerHTML = "";
}

function readWallPal() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    bg: v("--bg"), deep: v("--deep"), card: v("--card"),
    txt: v("--txt"), mut: v("--mut"), dim: v("--dim"),
    acc: v("--acc"), vio: v("--vio"), blu: v("--blu"), cyn: v("--cyn"),
    amb: v("--amb"), ros: v("--ros"),
    light: document.documentElement.dataset.theme === "light",
  };
}

async function applyWallpaper(id) {
  clearWall();
  if (!id || id === "none") {
    delete document.documentElement.dataset.wall;
    return;
  }

  const catalog = await loadWallCatalog();
  const item = catalog.find((x) => x.id === id);
  if (!item) {
    console.warn("wallpaper not found:", id);
    return;
  }

  document.documentElement.dataset.wall = item.type;
  const layer = ensureWallLayer();

  if (item.type === "static") {
    const img = document.createElement("img");
    img.src = item.src;
    img.alt = "";
    img.decoding = "async";
    img.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" +
      "opacity:0;transition:opacity .6s var(--ease-ios);";
    layer.appendChild(img);
    const show = () => (img.style.opacity = "1");
    if (img.complete) requestAnimationFrame(show);
    else img.onload = show;
    _wallInstance = {
      start() {}, stop() {}, resize() {},
      unmount() { img.remove(); },
    };
  } else if (item.type === "live") {
    try {
      /* module دیگه یه آبجکته، نه مسیر */
      const mod = item.module;
      /* اگه Vite از eager استفاده نکرد، fallback به dynamic import */
      const resolved = mod && typeof mod.mount === "function"
        ? mod
        : (await import(/* @vite-ignore */ mod))?.default;

      if (!resolved || typeof resolved.mount !== "function") {
        throw new Error("ماژول معتبر نیست");
      }
      const ctx = {
        pal: readWallPal(),
        pointer: _wallPointer,
        theme: document.documentElement.dataset.theme || "dark",
        RM: matchMedia("(prefers-reduced-motion: reduce)").matches,
        on: (ev, fn) => window.addEventListener(ev, fn),
      };
      const inst = resolved.mount(layer, ctx);
      _wallInstance = inst;
      inst.start && inst.start();

      /* پال به‌روزرسانی */
      window.addEventListener("wallpal", () => {
        if (_wallInstance && _wallInstance.pal) {
          _wallInstance.pal(readWallPal());
        }
      });

      /* pause/resume */
      document.addEventListener("visibilitychange", () => {
        if (!_wallInstance) return;
        if (document.hidden) _wallInstance.stop && _wallInstance.stop();
        else _wallInstance.start && _wallInstance.start();
      }, { passive: true });
    } catch (e) {
      console.error("live wallpaper failed:", id, e);
    }
  }
}

function syncWallpaper() {
  const bgType = PREFS.bgType || "pattern";
  const wantWall = bgType === "static" || bgType === "live";
  const id = wantWall ? (PREFS.wall || "none") : "none";
  const key = bgType + ":" + id;
  if (key === _lastWall) return;
  _lastWall = key;
  applyWallpaper(id);
}

/* نمایش/مخفی بخش‌های وابسته به bgType */
function updateAppearanceSections() {
  const bgType = PREFS.bgType || "pattern";
  $$('[data-when="bgType-pattern"]').forEach((el) => {
    el.hidden = bgType !== "pattern";
  });
  $$('[data-when="bgType-wall"]').forEach((el) => {
    el.hidden = bgType !== "static" && bgType !== "live";
  });
}

function applyPrefs() {
  const html = document.documentElement;
  /* اگه اسکین فعلی تم رو قفل کرده باشه، اعمالش کن */
  const skinDef = SKIN_DEFS[PREFS.skin] || SKIN_DEFS.default;
  if (skinDef.forced && PREFS.theme !== skinDef.forced) {
    PREFS.theme = skinDef.forced;
    savePrefs();
  }
  /* پالت مجاز اسکین — اگه accent فعلی تو لیست نباشه، اولین گزینه */
  const allowedPalettes = skinDef.palettes || DEFAULT_PALETTES;
  if (!allowedPalettes.includes(PREFS.accent)) {
    PREFS.accent = allowedPalettes[0];
    savePrefs();
  }
  const newTheme = resolveTheme(PREFS.theme);
  const themeChanged = _lastTheme !== null && _lastTheme !== newTheme;

  if (themeChanged) {
    html.classList.add("theme-instant");
    void html.offsetWidth;
  }

  html.dataset.theme = newTheme;
  html.dataset.accent = PREFS.accent;
  window.dispatchEvent(new Event("wallpal"));
  html.dataset.skin = PREFS.skin || "default";
  html.dataset.fs = PREFS.fs;

  /* ── منطق پس‌زمینه ──
     فقط یکی از این سه حالت می‌تونه فعال باشه:
     - bgType=pattern → data-bg از PREFS.bg
     - bgType=static/live → data-wall, data-bg="none"
     - bgType=none → هر دو "none" */
  const bgType = PREFS.bgType || "pattern";
  html.dataset.bgType = bgType;

  if (bgType === "pattern") {
    html.dataset.bg = PREFS.bg || "default";
    delete html.dataset.wall;
  } else if (bgType === "none") {
    html.dataset.bg = "none";
    delete html.dataset.wall;
  } else {
    /* static یا live — applyWallpaper مسئول set data-wall هست */
    html.dataset.bg = "none";
  }

  html.style.setProperty("--wall-dim", (PREFS.wallDim || 0) / 100);
  html.style.setProperty("--wall-blur", (PREFS.wallBlur || 0) + "px");

  syncWallpaper();
  updateAppearanceSections();
  renderAccentSwatches();
  html.style.setProperty("--cols", PREFS.cols);
  $("#themeBtn").innerHTML =
    newTheme === "light" ? icon("sun") : icon("moon");
  SFX.setEnabled(PREFS.sound === "on");
  SFX.setVolume(PREFS.soundVol);
  SFX.setTheme(PREFS.soundTheme || "soft");
  updateSoundSections();

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
    DATA.trash = [];
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
    DATA.trash = [];
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
    DATA.trash = Array.isArray(m.trash) ? m.trash : [];
  } catch (e) {
    /* migration شکست خورد — دادهٔ اصلی دست‌نخورده می‌مونه */
    try {
      localStorage.setItem(
        DATA_KEY + "_migrate_failed_" + Date.now(),
        raw
      );
    } catch (_) {}
    console.error("load: migrate failed, raw backup saved", e);

    /* سعی کن از autobackup بازیابی کنی */
    let restored = false;
    try {
      const auto = localStorage.getItem(DATA_KEY + "_autobackup");
      if (auto) {
        const autoParsed = JSON.parse(auto);
        if (autoParsed && Array.isArray(autoParsed.prompts)) {
          DATA.categories = autoParsed.categories || DEFAULT_CATEGORIES;
          DATA.prompts = autoParsed.prompts;
          DATA.trash = Array.isArray(autoParsed.trash) ? autoParsed.trash : [];
          restored = true;
          console.warn("load: restored from autobackup, prompts:", DATA.prompts.length);
        }
      }
    } catch (_) {}

    if (!restored) {
      DATA.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      DATA.prompts = [];
      DATA.trash = [];
    }

    setTimeout(
      () =>
        toast(
          restored
            ? "داده‌ها از پشتیبان اضطراری بازیابی شد"
            : "مهاجرت داده‌ها ناموفق بود؛ نسخهٔ قبلی بکاپ شد",
          restored ? "warn" : "err"
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
  if (kind === "err") {
    el.classList.add("err");
    SFX.play("err");
  } else if (kind === "warn") {
    el.classList.add("warn");
  }
  hideUndoToast();
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), 2200);
}
let undoFn = null;
function toastWithUndo(msg, fn, ms) {
  const el = $("#toastUndo");
  const dur = ms || 5000;
  $("#toastUndoTxt").textContent = msg;
  undoFn = fn;
  $("#toast").classList.remove("show");
  clearTimeout(toastT);
  el.classList.remove("show");
  el.style.setProperty("--undo-dur", dur + "ms");
  void el.offsetWidth;
  el.classList.add("show");
}
function hideUndoToast() {
  $("#toastUndo").classList.remove("show");
  undoFn = null;
}
(function bindUndoAutoHide() {
  const el = $("#toastUndo");
  const bar = el?.querySelector(".undo-progress");
  if (!bar) return;
  bar.addEventListener("animationend", () => {
    if (el.classList.contains("show")) hideUndoToast();
  });
})();

function copyText(txt, msg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(
      () => {
        SFX.play("copy");
        toast(msg || "کپی شد");
      },
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
    SFX.play("copy");
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
  /* روی موبایل همهٔ این پنل‌ها فول‌اسکرین‌اند، پس overflow: hidden روی
     html لازم نیست و روی برخی مرورگرها باعث recompute هدر sticky و
     پرش/lag می‌شه. به‌جاش touch-action: none روی backdrop جلوش رو می‌گیره.
     روی دسکتاپ (drawer وسط‌چین) هنوز قفل لازمه. */
  const needLock = !isMobile() && !!dialogEl;
  setActiveDialog(dialogEl || msearchEl, needLock);
}
/* ── قفل/آزادسازی اسکرول ──
   فقط کلاس. هیچ position: fixed و هیچ ذخیرهٔ scrollTop‌ای لازم نیست —
   overflow: hidden روی html، scrollTop رو دست‌نخورده نگه می‌داره
   و نوار اسکرول هم چون scrollbar-gutter: stable هست، جاش می‌مونه. */
function lockScroll() {
  if (document.documentElement.classList.contains("no-scroll")) return;
  document.documentElement.classList.add("no-scroll");
  document.body.classList.add("no-scroll");
}
function unlockScroll() {
  if (!document.documentElement.classList.contains("no-scroll")) return;
  document.documentElement.classList.remove("no-scroll");
  document.body.classList.remove("no-scroll");
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
    /* preventScroll حیاتی‌ست: بدون اون، مرورگر عنصر focus شده رو
       (معمولاً دکمه‌ای تو هدر) میاره تو دید و صفحه به بالا می‌پره. */
    if (prev && prev.focus && prev.isConnected) {
      try {
        prev.focus({ preventScroll: true });
      } catch (_) {
        try {
          prev.focus();
        } catch (_) {}
      }
    }
  };
}

let dialogResolve = null;
let dialogMode = "confirm";

/* ── بازسازی دکمه‌های پیش‌فرض مودال دیالوگ ──
askImportMode دکمه‌های این فوتر را جایگزین می‌کند؛
بعد از آن، دیالوگ‌های بعدی باید دکمه‌های استاندارد را برگردانند. */
function restoreDialogFoot() {
  const foot = document.querySelector("#dialogBack .dialog-foot");
  if (!foot) return;
  /* ترتیب RTL: انصراف اول (راست)، تأیید دوم (چپ) */
  foot.innerHTML =
    '<button class="btn ghost" id="dialogCancel">انصراف</button>' +
    '<button class="btn g" id="dialogOk">تأیید</button>';
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

    const modal = $("#dialogModal");
    /* ریست کلاس‌های حالت — هر دیالوگ از صفر شروع می‌شه */
    if (modal) {
      modal.classList.remove("is-danger", "is-help", "is-down");
    }

    const dIcon = $("#dialogIcon");
    dIcon.className = "dialog-ic";
    if (opts.icon && /^</.test(opts.icon)) {
      dIcon.innerHTML = opts.icon;
    } else if (opts.icon && icon(opts.icon)) {
      dIcon.innerHTML = icon(opts.icon);
    } else {
      dIcon.innerHTML = icon(dialogMode === "prompt" ? "edit" : "help");
      if (dialogMode === "prompt" && modal) modal.classList.add("is-help");
    }

    /* حالت danger — هم آیکون رو قرمز می‌کنه هم نوار بالا رو */
    if ((opts.warn || opts.danger) && modal) {
      modal.classList.add("is-danger");
    }

    $("#dialogTitle").textContent = opts.title || "تأیید";
    $("#dialogMsg").innerHTML = opts.message || "";

    const ok = $("#dialogOk");
    ok.textContent = opts.okText || "تأیید";

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
    _navPush("overlay", "dialogBack");
    refreshFocusTrap();
    if (dialogMode !== "prompt") setTimeout(() => ok.focus(), 100);
  });
}
function closeDialog(value) {
  if (!$("#dialogBack")?.classList.contains("open")) return;
  /* UI فوری */
  $("#dialogBack").classList.remove("open");
  refreshFocusTrap();
  const r = dialogResolve;
  dialogResolve = null;
  if (r) r(value);
  _navSilentBack();
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
  /* یک پاس برای شمردن همهٔ دسته‌ها */
  const counts = Object.create(null);
  for (let i = 0; i < DATA.prompts.length; i++) {
    const id = DATA.prompts[i].category;
    counts[id] = (counts[id] || 0) + 1;
  }
  let html = `<button class="chip ${activeCat === "all" ? "on" : ""}" data-c="all">
همه <span class="cnt">${total}</span>
</button>`;
  DATA.categories.forEach((cat) => {
    const n = counts[cat.id] || 0;
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

/* ═══ حالت مرتب‌سازی دسته‌ها ═══
   - بالای لیست: هیچ دکمه‌ای
   - هر ردیف: چک‌باکس + نام، با کلیک انتخاب می‌شه
   - پایین: نوار شناور با ↑/↓ گروهی و دکمهٔ پایان */
let _catReordering = false;
const _catSelected = new Set();
let _catFirstRenderDone = false;

function renderCatList() {
  const el = $("#catList");
  if (!el) return;
  /* stagger ورود فقط بار اول — بعدش هر render کلاس no-anim می‌گیره */
  el.classList.toggle("no-anim", _catFirstRenderDone);
  _catFirstRenderDone = true;

  const rbtn = document.getElementById("reorderCatsBtn");
  const addBtn = document.getElementById("addCatBtn");
  const tools = document.getElementById("catReorderTools");

  /* swap بین حالت عادی و حالت مرتب‌سازی — جای دکمه‌ها عوض نمی‌شه */
  if (rbtn) rbtn.hidden = _catReordering;
  if (addBtn) addBtn.hidden = _catReordering;
  if (tools) tools.hidden = !_catReordering;
  if (rbtn) rbtn.disabled = !DATA.categories.length;

  if (!DATA.categories.length) {
    el.classList.remove("reordering");
    el.innerHTML = `<div class="cat-empty">هنوز دسته‌ای نداری.</div>`;
    if (tools) tools.hidden = true;
    updateCatReorderControls();
    return;
  }

  el.classList.toggle("reordering", _catReordering);

  el.innerHTML = DATA.categories
    .map((c) => {
      const n = DATA.prompts.filter((p) => p.category === c.id).length;
      if (_catReordering) {
        const sel = _catSelected.has(c.id);
        return `<button type="button" class="cat-item selectable${
          sel ? " selected" : ""
        }" data-id="${c.id}" aria-pressed="${sel ? "true" : "false"}">
<span class="cat-check" aria-hidden="true">${icon("check")}</span>
<span class="dot ${c.color}"></span>
<span class="cat-item-name">${esc(c.name)}</span>
<span class="cat-item-cnt">${n}</span>
</button>`;
      }
      return `<div class="cat-item" data-id="${c.id}">
<span class="dot ${c.color}"></span>
<span class="cat-item-name">${esc(c.name)}</span>
<span class="cat-item-cnt">${n}</span>
<button class="cat-item-btn" data-act="edit-cat" title="ویرایش" aria-label="ویرایش">${icon("edit")}</button>
<button class="cat-item-btn dgr" data-act="del-cat" title="حذف" aria-label="حذف">${icon("trash")}</button>
</div>`;
    })
    .join("");

  updateCatReorderControls();
}

function updateCatReorderControls() {
  const info = document.getElementById("catSelInfo");
  const upBtn = document.getElementById("catMoveUpBtn");
  const dnBtn = document.getElementById("catMoveDownBtn");
  const doneBtn = document.getElementById("catReorderDoneBtn");

  const n = _catSelected.size;
  if (info) {
    info.textContent = n ? toFaNum(n) + " انتخاب" : "چیزی انتخاب نشده";
    /* تو موبایل باریک، ::before این رو نشون می‌ده */
    info.dataset.count = toFaNum(n);
  }
  if (doneBtn) {
    /* dکمهٔ پایان همیشه فعاله، حتی اگه چیزی انتخاب نشده — برای خروج */
    doneBtn.disabled = false;
  }

  const indices = [..._catSelected]
    .map((id) => DATA.categories.findIndex((c) => c.id === id))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);

  const canUp = indices.length > 0 && indices[0] > 0;
  const canDown =
    indices.length > 0 &&
    indices[indices.length - 1] < DATA.categories.length - 1;

  if (upBtn) upBtn.disabled = !canUp;
  if (dnBtn) dnBtn.disabled = !canDown;
}

function enterCatReorderMode() {
  if (_catReordering) return;
  _catReordering = true;
  _catSelected.clear();
  renderCatList();
  SFX.play("tick");
}
function exitCatReorderMode() {
  if (!_catReordering) return;
  _catReordering = false;
  _catSelected.clear();
  renderCatList();
  SFX.play("tick");
}
function toggleCatSelection(id) {
  const sel = !_catSelected.has(id);
  if (sel) _catSelected.add(id);
  else _catSelected.delete(id);

  /* فقط همون ردیف رو آپدیت کن — نه کل لیست.
     اگه renderCatList() رو صدا بزنیم، DOM از نو ساخته می‌شه و
     انیمیشن همهٔ ردیف‌های انتخاب‌شده دوباره اجرا می‌شه. */
  const row = document.querySelector(
    `#catList .cat-item[data-id="${CSS.escape(id)}"]`
  );
  if (row) {
    row.classList.toggle("selected", sel);
    row.setAttribute("aria-pressed", sel ? "true" : "false");
  }
  updateCatReorderControls();
}

/* حرکت گروهی — delta = -1 (بالا) یا +1 (پایین) */
function moveSelectedCategories(delta) {
  const indices = [..._catSelected]
    .map((id) => DATA.categories.findIndex((c) => c.id === id))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);

  if (!indices.length) return;
  if (delta === -1 && indices[0] === 0) return;
  if (
    delta === 1 &&
    indices[indices.length - 1] === DATA.categories.length - 1
  )
    return;

  commit((d) => {
    const cats = d.categories;
    if (delta === -1) {
      for (let k = 0; k < indices.length; k++) {
        const i = indices[k];
        const tmp = cats[i - 1];
        cats[i - 1] = cats[i];
        cats[i] = tmp;
      }
    } else {
      for (let k = indices.length - 1; k >= 0; k--) {
        const i = indices[k];
        const tmp = cats[i + 1];
        cats[i + 1] = cats[i];
        cats[i] = tmp;
      }
    }
  });

  SFX.play("tick");
  renderCatList();

  const el = document.getElementById("catList");
  if (!el) return;

  /* ۱. انیمیشن تیک/پالس رو موقع re-render خفه کن — وگرنه هر جابه‌جایی
        دوباره تیک‌ها رو انیمیت می‌کنه و آزاردهنده می‌شه. */
  el.classList.add("no-check-anim");
  requestAnimationFrame(() =>
    requestAnimationFrame(() => el.classList.remove("no-check-anim"))
  );

  /* ۲. ولی highlight «جابه‌جا شد» رو نشون بده */
  _catSelected.forEach((id) => {
    const row = el.querySelector(
      `.cat-item[data-id="${CSS.escape(id)}"]`
    );
    if (!row) return;
    row.classList.add("moved");
    setTimeout(() => row.classList.remove("moved"), 620);
  });
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

/* کش haystack جست‌وجو — کلید: id، اعتبار: updatedAt
   فقط وقتی پرامپت ویرایش شه دوباره محاسبه می‌شه */
const _hayCache = new Map();
function _haystack(p) {
  const cached = _hayCache.get(p.id);
  if (cached && cached.at === p.updatedAt) return cached.h;
  const h = norm(
    [
      p.title,
      p.description || "",
      (p.tags || []).join(" "),
      p.content,
    ].join(" "),
  );
  _hayCache.set(p.id, { at: p.updatedAt, h });
  return h;
}

function filtered() {
  const q = norm(query);
  const terms = q.split(" ").filter(Boolean);
  const arr = DATA.prompts.filter((p) => {
    if (activeCat !== "all" && p.category !== activeCat) return false;
    if (!terms.length) return true;
    const hay = _haystack(p);
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
const ANIM_CAP = 20; /* بالای این تعداد، انیمیشن ورود معنی نداره — فقط شلوغیه */

function renderGrid() {
  const g = $("#grid");
  if (_firstRenderDone) g.classList.add("no-anim");
  else _firstRenderDone = true;
  const list = filtered();
  /* اگه لیست بزرگه، همهٔ کارت‌ها no-anim می‌شن */
  g.classList.toggle("mass-list", list.length > ANIM_CAP);
  if (!list.length) {
    const empty = DATA.prompts.length === 0;
    g.innerHTML = `<div class="empty">
<div class="empty-inner">
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
<p>روی «＋ پرامپت جدید» بزن یا از کتابخانه شروع کن.</p>
<div class="empty-actions">
<button class="empty-cta" type="button" data-empty-act="library">
${icon("sparkle")}<span>رفتن به کتابخانه</span>
</button>
<button class="empty-cta help" type="button" data-empty-act="help">
${icon("help")}<span>راهنما</span>
</button>
</div>`
: `<h3>موردی پیدا نشد</h3>
<p>دستهٔ دیگری را امتحان کن یا متن جست‌وجو را کوتاه‌تر کن.</p>`
}
</div>
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
      const q = query.trim();
      const titleHtml = q
        ? highlight(p.title, q)
        : esc(p.title);
      const descHtml = q
        ? highlight(p.description || "", q)
        : esc(p.description || "");
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
<b dir="auto">${titleHtml}</b>
<span class="pcat ${cat.color}">${esc(cat.name)}</span>
</div>
${p.description ? `<div class="pdesc" dir="auto">${descHtml}</div>` : ""}
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
    icon: "warn",
    warn: true,
    message: `پرامپت «<b>${esc(p.title)}</b>» به سطل آشغال منتقل شود؟`,
    okText: "حذف",
    danger: true,
  });
  if (!ok) return;
  const trashItem = { ...p, deletedAt: Date.now(), originalIndex: idx };
  commit((d) => {
    d.prompts = d.prompts.filter((x) => x.id !== id);
    d.trash.unshift(trashItem);
  });
  SFX.play("del");
  toastWithUndo("به سطل آشغال منتقل شد", () => {
    commit((d) => {
      d.prompts.splice(Math.min(idx, d.prompts.length), 0, p);
      d.trash = d.trash.filter((x) => x.id !== id);
    });
    toast("بازگردانی شد");
  });
}

/* ═══════════ حالت انتخاب چندگانه ═══════════ */
let selectMode = false;
let suppressClickUntil = 0;
const selectedIds = new Set();

function enterSelectMode(initialId) {
  if (selectMode) return;
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
  _navPush("select");
}
/* خروج خالص بدون دست زدن به history — برای popstate */
function _exitSelectModeRaw() {
  if (!selectMode) return;
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

/* خروج از دکمهٔ X یا بعد از انجام عملیات — state رو هم pop می‌کنه */
function exitSelectMode() {
  if (!selectMode) return;
  _exitSelectModeRaw();
  _navSilentBack();
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
    icon: "warn",
    warn: true,
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

  const now = Date.now();
  exitSelectMode();
  commit((d) => {
    d.prompts = d.prompts.filter((p) => !idSet.has(p.id));
    snapshot.forEach((s) => {
      d.trash.unshift({
        ...s.p,
        deletedAt: now,
        originalIndex: s.index,
      });
    });
  });

  SFX.play("del");
  toastWithUndo(`${toFaNum(ids.length)} پرامپت به سطل آشغال منتقل شد`, () => {
    commit((d) => {
      snapshot
        .slice()
        .sort((a, b) => a.index - b.index)
        .forEach((s) => {
          d.prompts.splice(s.index, 0, s.p);
          d.trash = d.trash.filter((x) => x.id !== s.p.id);
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
function bulkDuplicate() {
  const ids = [...selectedIds];
  if (!ids.length) return;
  const idSet = new Set(ids);
  const now = Date.now();
  let count = 0;
  commit((d) => {
    const additions = [];
    d.prompts.forEach((p) => {
      if (idSet.has(p.id)) {
        additions.push({
          ...p,
          id: uid(),
          title: p.title + " (کپی)",
          pinned: false,
          createdAt: now,
          updatedAt: now,
        });
        count++;
      }
    });
    d.prompts.push(...additions);
  });
  exitSelectMode();
  toast(`${toFaNum(count)} پرامپت تکثیر شد`);
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
  _navPush("overlay", "bulkMoveBack");
  refreshFocusTrap();
}
function closeBulkMove() {
  if (!$("#bulkMoveBack")?.classList.contains("open")) return;
  _CLOSE_RAW.bulkMoveBack();
  _navSilentBack();
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
  if (!card) {
    const cta = e.target.closest("[data-empty-act]");
    if (cta) {
      e.preventDefault();
      const act = cta.dataset.emptyAct;
      if (act === "library") openDrawer("library");
      else if (act === "help") openDrawer("help");
    }
    return;
  }
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
    SFX.play("tick");
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
  /* hint فقط بار اول نشون داده می‌شه — توضیح کامل تو «درباره ← راهنما» */
  if (vars.length && !PREFS.varHintSeen) {
    PREFS.varHintSeen = true;
    savePrefs();
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
  _navPush("overlay", "pvDrawer");
  refreshFocusTrap();
}
function closePreview() {
  if (!$("#pvDrawer")?.classList.contains("open")) return;
  _CLOSE_RAW.pvDrawer();
  _navSilentBack();
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

  /* همیشه بسته باز شه — کاربر با دکمه/تب بازش می‌کنه */
  setVarPreviewOpen(false);

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
  _navPush("overlay", "varModalBack");
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
function isMobileVarPreview() {
  return window.matchMedia("(max-width: 759px)").matches;
}
function setVarPreviewOpen(open) {
  const deck =
    document.getElementById("varDeck") ||
    document.querySelector(".var-deck");
  if (!deck) return;
  deck.classList.toggle("preview-open", !!open);
  const toggle = document.getElementById("varPreviewToggle");
  if (toggle) {
    toggle.classList.toggle("on", !!open);
    toggle.setAttribute("aria-pressed", open ? "true" : "false");
  }
}
function closeVarModal() {
  if (!$("#varModalBack")?.classList.contains("open")) return;
  _CLOSE_RAW.varModalBack();
  _navSilentBack();
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
/* فقط ارقام رو فارسی می‌کنه، بدون جداکنندهٔ هزارگان.
   مناسب برای تاریخ، کد، شمارهٔ نسخه. */
function toFaDigits(s) {
  return String(s == null ? "" : s).replace(
    /\d/g,
    (d) => FA_DIGITS[+d]
  );
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

function syncEditor() {
  updateEditorGutter();
  updateEditorStats();
  applyTextDir(editorArea, editorArea.value);
  /* اگه preview روشن باشه، با هر تغییر آپدیت کن */
  if (_mdPreviewOn) {
    const body = $("#mdBody");
    if (body) {
      body.innerHTML = mdToHtml(editorArea.value || "");
      applyTextDir(body, editorArea.value || "");
    }
  }
}

editorArea.addEventListener("input", syncEditor);
editorArea.addEventListener(
  "scroll",
  () => {
    /* scrollTop mirror — ساده‌ترین روش، همیشه هم‌تراز.
       transform رو تست کردیم ولی تو WebView آفست عمودی می‌ساخت. */
    editorGutter.scrollTop = editorArea.scrollTop;
  },
  { passive: true }
);

/* بازسازی گاترها بعد از لود فونت — فونت Vazirmatn async لود می‌شه و
   قبل از رسیدنش، wrap شدن خطوط با متریک فونت fallback اندازه‌گیری
   می‌شه. نتیجه: شماره‌های گاتر از خطوط متن جدا می‌افتن. بعد از لود
   فونت، کش رو باطل کن و همه‌چیز رو دوباره اندازه بگیر. */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    _gutterCache = { lines: [], counts: [], width: -1 };
    if (editorArea && editorArea.value) {
      updateEditorGutter();
    }
    const pv = document.getElementById("pvContent");
    if (pv && pv.textContent) {
      updatePreviewGutter(pv.textContent);
    }
  });
}

/* موبایل: وقتی فوکوس میره رو متن (یعنی کیبورد باز می‌شه)، متادیتا رو جمع کن
   تا فضای متن + دکمه‌های پایین همیشه تضمین‌شده باشه —
   مستقل از موقعیت تو سند، بدون نیاز به اسکرول کل مودال */
editorArea.addEventListener("focus", () => {
  if (window.matchMedia("(max-width: 760px)").matches) {
    editorModal.classList.add("meta-hidden");
    metaToggleBtn.classList.remove("on");
    metaToggleBtn.setAttribute("aria-pressed", "false");
  }
});

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
  /* روی موبایل، بدنه رو قفل کن تا iOS موقع فوکوس، layout رو نکشه بالا */
  if (isMobile()) {
    const y = window.scrollY;
    document.body.dataset.kbScroll = String(y);
    document.body.style.top = `-${y}px`;
    document.body.classList.add("kb-lock");
  }
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
  editorGutter.scrollTop = 0;
  scrollLogicalStart(editorArea);

  $("#modalBack").classList.add("open");
  _navPush("overlay", "modalBack");
  refreshFocusTrap();
  syncEditor();
  /* ریست حالت پیش‌نمایش — هر بار ادیتور تازه باز می‌شه */
  setMdPreview(false);

  setTimeout(() => {
    if (!$("#pTitle").value) $("#pTitle").focus();
    else editorArea.focus();
  }, 100);
}
function closeModal() {
  if (!$("#modalBack")?.classList.contains("open")) return;
  _CLOSE_RAW.modalBack();
  _navSilentBack();
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
  SFX.play("copy");
  toast(id ? "ویرایش شد" : "افزوده شد");
}

function openCatModal(cat) {
  const isEdit = !!cat;
  const iconEl = $("#catModalIcon");
  iconEl.innerHTML = icon(isEdit ? "edit" : "plus");
  iconEl.className = "modal-h-ic";
  $("#catModalTitle").textContent = isEdit ? "ویرایش دسته" : "دستهٔ جدید";
  $("#catId").value = isEdit ? cat.id : "";
  $("#catName").value = isEdit ? cat.name : "";
  const cur = isEdit ? cat.color : "b-vio";
  $$("#catColors button").forEach((b) => {
    b.classList.toggle("on", b.dataset.c === cur);
  });
  $("#catModalBack").classList.add("open");
  _navPush("overlay", "catModalBack");
  refreshFocusTrap();
  setTimeout(() => $("#catName").focus(), 100);
}
function closeCatModal() {
  if (!$("#catModalBack")?.classList.contains("open")) return;
  _CLOSE_RAW.catModalBack();
  _navSilentBack();
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

/* جابه‌جایی دسته در آرایه — delta = -1 (بالا) یا +1 (پایین) */
function moveCategory(id, delta) {
  const idx = DATA.categories.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= DATA.categories.length) return;
  commit((d) => {
    const cats = d.categories;
    const tmp = cats[idx];
    cats[idx] = cats[newIdx];
    cats[newIdx] = tmp;
  });
  SFX.play("tick");
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
    icon: "warn",
    warn: true,
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
    d.trash.forEach((p) => {
      if (p.category === id) p.category = d.categories[0].id;
    });
    if (activeCat === id) activeCat = "all";
  });

  SFX.play("del");
  toastWithUndo("دسته حذف شد", () => {
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
  /* اگه query هنوز داره، گرید رو رندر کن تا هایلایت حذف شه */
  if (query.trim()) {
    query = "";
    searchIn.value = "";
    renderGrid();
  }
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
  _navPush("overlay", "mSearch");
  refreshFocusTrap();
  setTimeout(() => {
    mSearchIn.focus();
    mSearchIn.select();
  }, 120);
}
function closeMobileSearchPanel() {
  if (!mSearch.classList.contains("open")) return;
  _CLOSE_RAW.mSearch();
  _navSilentBack();
  /* پاک کردن query تا هایلایت و فیلتر برداشته شه */
  if (query.trim()) {
    query = "";
    mSearchIn.value = "";
    searchIn.value = "";
    renderGrid();
  }
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

const ST_VIEWS = {
  home: "تنظیمات",
  appearance: "ظاهر",
  sound: "صدا",
  library: "کتابخانه",
  categories: "دسته‌ها",
  data: "داده و پشتیبان",
  trash: "سطل آشغال",
  about: "درباره",
  help: "راهنمای استفاده",
};

const ST_THEME_LABEL = { dark: "تاریک", light: "روشن", system: "سیستم" };
const ST_ACCENT_LABEL = {
  default: "پیش‌فرض",
  ocean: "اقیانوس",
  forest: "جنگل",
  sunset: "غروب",
  galaxy: "کهکشان",
  mono: "بی‌رنگ",
};

function isDesktopSettings() {
  return window.matchMedia("(min-width: 900px)").matches;
}

/* ═══ History Navigation ═══
   هر overlay باز → یه state push. back فیزیکی → popstate → بستن بالاترین.
   X button → UI فوری + silent back (بدون اجرای popstate دوباره). */

const _HK = "pmNav";
let _suppressPopstate = false;
let _goingBack = false;

const VIEW_PARENT = {
  trash: "data",
  help: "about",
};

/* ترتیب پایین به بالا — برای پیدا کردن بالاترین overlay باز */
const _OVERLAY_ORDER = [
  "drawer",
  "pvDrawer",
  "mSearch",
  "modalBack",
  "varModalBack",
  "catModalBack",
  "dialogBack",
  "bulkMoveBack",
  "chlogBack",
  "libPreviewBack",
  "libSettingsBack",
];

function _navPush(kind, id, view) {
  const prevDepth = (history.state && history.state.depth) || 0;
  try {
    history.pushState(
      { [_HK]: 1, kind, id: id || null, view: view || null, depth: prevDepth + 1 },
      ""
    );
  } catch (_) {}
}

function _navSilentBack() {
  if (!history.state || !history.state[_HK]) return;
  /* اسکرول رو قبل و بعد از back دستی حفظ می‌کنیم.
     history.back غیرهمزمانـه و مرورگر ممکنه scrollRestoration
     رو (حتی تو حالت manual) با یه تیک تأخیر اعمال کنه. */
  const y = window.scrollY;
  _suppressPopstate = true;
  try {
    history.back();
  } catch (_) {
    _suppressPopstate = false;
    return;
  }
  /* چند فریم پشت‌سرهم چک کن — هر بار اگه مرورگر پرش زد، برگردون */
  const restore = () => {
    if (window.scrollY !== y) window.scrollTo(0, y);
  };
  requestAnimationFrame(restore);
  setTimeout(restore, 0);
  setTimeout(restore, 50);
  setTimeout(restore, 150);
}

function _topOpenOverlay() {
  for (let i = _OVERLAY_ORDER.length - 1; i >= 0; i--) {
    const el = document.getElementById(_OVERLAY_ORDER[i]);
    if (el && el.classList.contains("open")) return _OVERLAY_ORDER[i];
  }
  return null;
}

/* بستن خالص بدون side-effect تاریخچه — برای popstate */
const _CLOSE_RAW = {
  drawer: () => {
    const d = $("#drawer");
    if (!d || !d.classList.contains("open")) return;
    d.classList.remove("open");
    $("#drawerBack")?.classList.remove("open");
    refreshFocusTrap();
  },
  pvDrawer: () => {
    const d = $("#pvDrawer");
    if (!d || !d.classList.contains("open")) return;
    currentPvId = null;
    d.classList.remove("open");
    d.setAttribute("aria-hidden", "true");
    $("#pvBack")?.classList.remove("open");
    closeAiMenu();
    refreshFocusTrap();
  },
  mSearch: () => {
    if (!$("#mSearch")?.classList.contains("open")) return;
    document.body.classList.remove("msearch-open");
    $("#mSearchBack")?.classList.remove("open");
    $("#mSearch")?.classList.remove("open");
    $("#mSearchBtn")?.classList.remove("on");
    $("#mSearchIn")?.blur();
    refreshFocusTrap();
  },
  modalBack: () => {
    if (!$("#modalBack")?.classList.contains("open")) return;
    $("#modalBack").classList.remove("open");
    if (document.body.classList.contains("kb-lock")) {
      const y = Number(document.body.dataset.kbScroll || 0);
      document.body.classList.remove("kb-lock");
      document.body.style.top = "";
      delete document.body.dataset.kbScroll;
      window.scrollTo(0, y);
    }
    refreshFocusTrap();
  },
  varModalBack: () => {
    if (!$("#varModalBack")?.classList.contains("open")) return;
    $("#varModalBack").classList.remove("open");
    varState = null;
    refreshFocusTrap();
  },
  catModalBack: () => {
    if (!$("#catModalBack")?.classList.contains("open")) return;
    $("#catModalBack").classList.remove("open");
    refreshFocusTrap();
  },
  dialogBack: () => {
    if (!$("#dialogBack")?.classList.contains("open")) return;
    $("#dialogBack").classList.remove("open");
    refreshFocusTrap();
    const r = dialogResolve;
    dialogResolve = null;
    if (r) r(dialogMode === "prompt" ? null : false);
  },
  bulkMoveBack: () => {
    if (!$("#bulkMoveBack")?.classList.contains("open")) return;
    $("#bulkMoveBack").classList.remove("open");
    refreshFocusTrap();
  },
  chlogBack: () => {
    if (!$("#chlogBack")?.classList.contains("open")) return;
    $("#chlogBack").classList.remove("open");
    refreshFocusTrap();
  },
  libPreviewBack: () => {
    if (!$("#libPreviewBack")?.classList.contains("open")) return;
    libPreviewIdx = -1;
    $("#libPreviewBack").classList.remove("open");
    refreshFocusTrap();
  },
  libSettingsBack: () => {
    if (!$("#libSettingsBack")?.classList.contains("open")) return;
    $("#libSettingsBack").classList.remove("open");
    refreshFocusTrap();
  },
};

/* نمایش view — استفادهٔ داخلی */
function _applyView(view) {
  const drawer = $("#drawer");
  if (!drawer) return;
  const desktop = isDesktopSettings();
  /* روی دسکتاپ، home یک صفحهٔ مستقل نیست — همیشه سایدباره */
  if (desktop && view === "home") view = "appearance";

  const prevView = drawer.dataset.view;
  const isChange = prevView && prevView !== view;
  /* back = ناوبری از دکمهٔ back، یا مقصد پدرِ view فعلیه */
  const isBack = prevView && (_goingBack || VIEW_PARENT[prevView] === view);

  drawer.dataset.view = view;
  drawer.dataset.canBack = VIEW_PARENT[view] ? "1" : "0";

  const title = $("#drawerTitle");
  if (title) title.textContent = ST_VIEWS[view] || "تنظیمات";

  $$(".st-view", drawer).forEach((v) => {
    if (desktop && v.dataset.view === "home") {
      v.hidden = false;
      return;
    }
    v.hidden = v.dataset.view !== view;
  });

  $$(".st-row", drawer).forEach((r) => {
    r.classList.toggle("active", r.dataset.nav === view);
  });

  /* انیمیشن ورود فقط روی viewی که تازه ظاهر شد — home رو دست نمی‌زنیم */
  if (isChange) {
    const incoming = drawer.querySelector(`.st-view[data-view="${view}"]`);
    if (incoming && !incoming.hidden) {
      incoming.classList.remove("view-in-fwd", "view-in-back");
      void incoming.offsetWidth; /* force reflow تا animation ری‌استارت شه */
      incoming.classList.add(isBack ? "view-in-back" : "view-in-fwd");
    }
  }

  if (view === "library") {
    renderLibrary();
    updateLibModeUI();
  }
  if (view === "trash") renderTrash();
  /* هر بار از view دسته‌ها خارج شیم، حالت مرتب‌سازی ریست شه */
  if (view !== "categories" && _catReordering) {
    _catReordering = false;
    _catSelected.clear();
  }
  /* برگشت به view دسته‌ها، stagger ورود دوباره اجرا شه */
  if (view === "categories") {
    _catFirstRenderDone = false;
  }
  if (view === "appearance") {
  renderWallpaperGrid();
 }
  const body = drawer.querySelector(".drawer-body");
  if (body) body.scrollTop = 0;
}

/* ناوبری به یه view — history state هم push می‌شه */
function navigateSettings(view) {
  const drawer = $("#drawer");
  if (!drawer) return;
  if (drawer.dataset.view === view) return;
  if (drawer.classList.contains("open")) {
    _navPush("drawer", "drawer", view);
  }
  _applyView(view);
}

/* دکمهٔ back داخلی — به history مرورگر واگذار می‌کنه */
function navigateBack() {
  const drawer = $("#drawer");
  if (!drawer || !drawer.classList.contains("open")) return;
  const cur = drawer.dataset.view;
  if (!cur || cur === "home") {
    closeDrawer();
    return;
  }
  history.back();
}

function renderSettingsValues() {
  const themeEl = $("#stValTheme");
  if (themeEl) themeEl.textContent = ST_THEME_LABEL[PREFS.theme] || "—";
  const sndEl = $("#stValSound");
  if (sndEl) sndEl.textContent = PREFS.sound === "on" ? "روشن" : "خاموش";
  const catEl = $("#stValCat");
  if (catEl) catEl.textContent = toFaNum(DATA.categories.length) + " دسته";
  const trashEl = $("#stValTrash");
  if (trashEl) {
    const n = (DATA.trash || []).length;
    trashEl.textContent = n ? toFaNum(n) + " پرامپت" : "خالی";
  }
  const verEl = $("#stValVer");
  if (verEl && currentAppVer) verEl.textContent = "v" + currentAppVer;
  const aboutVer = $("#stAboutVer");
  if (aboutVer && currentAppVer) aboutVer.textContent = currentAppVer;
}

function openDrawer(initialView) {
  const drawer = $("#drawer");
  if (!drawer) return;
  if (drawer.classList.contains("open")) {
    navigateSettings(
      initialView || (isDesktopSettings() ? "appearance" : "home")
    );
    return;
  }
  delete drawer.dataset.view;
  const target =
    initialView || (isDesktopSettings() ? "appearance" : "home");

  /* موبایل: اگه target=home نیست، home رو اول push کن
     تا دکمهٔ back اول به home برگرده، نه خارج از اپ */
  if (!isDesktopSettings() && target !== "home") {
    _navPush("drawer", "drawer", "home");
  }
  _navPush("drawer", "drawer", target);

  _applyView(target);
  drawer.classList.add("open");
  $("#drawerBack").classList.add("open");
  renderCatList();
  renderSettingsValues();
  refreshFocusTrap();
}

function closeDrawer() {
  const drawer = $("#drawer");
  if (!drawer || !drawer.classList.contains("open")) return;
  /* UI فوری */
  _CLOSE_RAW.drawer();
  /* دراور ممکنه چند تا state push کرده باشه (mobile: home + target + nav)
     پس همه رو یه‌جا pop می‌کنیم، نه فقط یکی. */
  if (history.state && history.state[_HK]) {
    const depth = history.state.depth || 0;
    if (depth > 0) {
      const y = window.scrollY;
      _suppressPopstate = true;
      try {
        history.go(-depth);
      } catch (_) {
        _suppressPopstate = false;
        return;
      }
      const restore = () => {
        if (window.scrollY !== y) window.scrollTo(0, y);
      };
      requestAnimationFrame(restore);
      setTimeout(restore, 0);
      setTimeout(restore, 50);
      setTimeout(restore, 150);
    }
  }
}

$("#stBack")?.addEventListener("click", navigateBack);
$("#drawer")?.addEventListener("click", (e) => {
  const nav = e.target.closest("[data-nav]");
  if (!nav) return;
  navigateSettings(nav.dataset.nav);
});

/* ═══ دکمهٔ back فیزیکی ═══ */
window.addEventListener("popstate", (e) => {
  if (_suppressPopstate) {
    _suppressPopstate = false;
    return;
  }
  const st = e.state;

  /* برگشت به یه state داخلی دراور — فقط view رو ست کن */
  if (st && st[_HK] && st.kind === "drawer" && st.view) {
    const drawer = $("#drawer");
    if (drawer && drawer.classList.contains("open")) {
      if (drawer.dataset.view !== st.view) {
        _goingBack = true;
        _applyView(st.view);
        _goingBack = false;
      }
      refreshFocusTrap();
      return;
    }
  }

  /* بالاترین overlay باز رو ببند */
  const top = _topOpenOverlay();
  if (top) {
    _CLOSE_RAW[top]();
    refreshFocusTrap();
    return;
  }

  /* هیچ overlay باز نیست ولی سلکت فعاله — از سلکت خارج شو */
  if (selectMode) {
    _exitSelectModeRaw();
    refreshFocusTrap();
    return;
  }
});

/* اگه بعد از reload تو state دراور گیر کردیم، پاکش کن */
(function _cleanupStaleHistory() {
  if (history.state && history.state[_HK]) {
    const d = history.state.depth || 1;
    _suppressPopstate = true;
    try {
      history.go(-d);
    } catch (_) {
      _suppressPopstate = false;
    }
  }
})();

/* ═══ صفحهٔ صدا: اسلایدر شدت + پیش‌نمایش ═══ */
function updateSoundSections() {
  const isOn = PREFS.sound === "on";
  $$('[data-when="sound-on"]').forEach((el) => {
    el.hidden = !isOn;
  });
}
(function initSoundControls() {
  const slider = $("#soundVol");
  const valEl = $("#soundVolVal");
  if (slider) {
    slider.value = Number(PREFS.soundVol) || 70;
    if (valEl) valEl.textContent = toFaNum(Number(slider.value)) + "٪";

    const testPlay = debounce(() => SFX.play("tick"), 90);
    slider.addEventListener("input", () => {
      const v = Number(slider.value) || 0;
      PREFS.soundVol = v;
      SFX.setVolume(v);
      if (valEl) valEl.textContent = toFaNum(v) + "٪";
      savePrefs();
      testPlay();
    });
  }
  $("#soundTestBtn")?.addEventListener("click", () => {
    SFX.play("copy");
    setTimeout(() => SFX.play("del"), 220);
    setTimeout(() => SFX.play("undo"), 440);
  });
})();
/* ── موتور PSwitch: اسلایدر بین N گزینه ──
   موقعیت با JS اندازه‌گیری می‌شه چون CSS نمی‌تونه بفهمه کدوم گزینه فعاله.
   ResizeObserver روی خود المان، برای باز شدن دیالوگ و تغییر عرض.
   برای هر تعداد گزینه کار می‌کنه — flex:1 پهنای مساوی می‌ده. */
const _pswInstances = new Map();

function _initPsw(el) {
  if (_pswInstances.has(el)) return;
  const slide = el.querySelector(".pswitch-slide");
  if (!slide) return;

  let raf = 0;
  const position = () => {
    const active =
      el.querySelector(".pswitch-opt.on") || el.querySelector(".pswitch-opt");
    if (!active) return;
    const r = active.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    /* اگه مخفی‌ست (width=0)، هیچ کاری نکن */
    if (r.width === 0) return;
    slide.style.width = r.width + "px";
    slide.style.transform = `translateX(${r.left - er.left}px)`;
    el.classList.add("ready");
  };
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(position);
  };
  _pswInstances.set(el, schedule);

  if (window.ResizeObserver) {
    new ResizeObserver(schedule).observe(el);
  }
  schedule();
}

function _syncPsw(el) {
  const key = el.dataset.pref;
  if (!key) return;
  el.querySelectorAll(".pswitch-opt").forEach((b) => {
    const on = b.dataset.v === PREFS[key];
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const sched = _pswInstances.get(el);
  if (sched) sched();
}

function initAllPswitches() {
  $$(".pswitch[data-pref]").forEach((el) => {
    if (!_pswInstances.has(el)) {
      _initPsw(el);
      el.querySelectorAll(".pswitch-opt").forEach((b) => {
        b.addEventListener("click", () => {
          const key = el.dataset.pref;
          if (!key || PREFS[key] === b.dataset.v) return;
          PREFS[key] = b.dataset.v;
          savePrefs();
          applyPrefs();
          _syncPsw(el);
          renderSettingsValues();
          if (key === "libMode") {
            updateLibModeUI();
            if ($("#drawer")?.dataset.view === "library") {
              renderLibrary();
            }
          }
          if (key === "sound") {
            SFX.setEnabled(PREFS.sound === "on");
            updateSoundSections();
            if (PREFS.sound === "on") SFX.play("tick");
          }
          if (key === "bgType") {
            updateAppearanceSections();
            if (PREFS.bgType === "static" || PREFS.bgType === "live") {
              renderWallpaperGrid();
            }
          }
          SFX.play("tick");
        });
      });
    }
    _syncPsw(el);
  });
}

/* بعد از لود فونت دوباره اندازه‌گیری */
if (document.fonts?.ready) {
  document.fonts.ready.then(() => {
    _pswInstances.forEach((sched) => sched());
  });
}

/* resize پنجره */
window.addEventListener("resize", () => {
  _pswInstances.forEach((sched) => sched());
});

/* ═══ رندر پالت‌ها بر اساس اسکین فعلی ═══
   منبع حقیقت: SKIN_DEFS[skin].palettes + PALETTES
   خروجی: دکمه‌های swatch با --sw اینلاین */
function renderAccentSwatches() {
  const seg = document.getElementById("accentSeg");
  if (!seg) return;
  const skinDef = SKIN_DEFS[PREFS.skin] || SKIN_DEFS.default;
  const palettes = skinDef.palettes || DEFAULT_PALETTES;

  seg.innerHTML = palettes
    .map((id) => {
      const p = PALETTES[id];
      if (!p) return "";
      const on = id === PREFS.accent ? " on" : "";
      return `<button type="button" data-v="${esc(id)}" class="${on.trim()}" style="--sw: ${p.sw};" data-tip="${esc(p.label)}" aria-label="${esc(p.label)}"></button>`;
    })
    .join("");

  seg.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      if (PREFS.accent === b.dataset.v) return;
      PREFS.accent = b.dataset.v;
      savePrefs();
      applyPrefs();
      seg.querySelectorAll("button").forEach((x) =>
        x.classList.toggle("on", x === b)
      );
      SFX.play("tick");
    };
  });
}

/* ═══ رندر گرید والپیپر ═══ */
let _wallCatFilter = "all";

async function renderWallpaperGrid() {
  const grid = $("#wallGrid");
  const cats = $("#wallCats");
  const controls = $("#wallControls");
  if (!grid) return;

  const bgType = PREFS.bgType || "pattern";
  if (bgType !== "static" && bgType !== "live") return;

  const all = await loadWallCatalog();
  /* فقط آیتم‌های مرتبط با bgType فعلی */
  const catalog = all.filter((x) => x.type === bgType);

  if (!catalog.length) {
    if (cats) cats.innerHTML = "";
    const label = bgType === "static" ? "تصویر" : "زنده";
    grid.innerHTML = `<div class="wall-empty">
      هنوز والپیپر ${label}ی نداری.<br>
      ${
        bgType === "static"
          ? `یه عکس بذار تو <code>wallpapers/static/</code>`
          : `یه ماژول JS بذار تو <code>wallpapers/live/</code>`
      }
    </div>`;
    if (controls) controls.hidden = true;
    return;
  }

  /* اگه wall فعلی توی این دسته نیست، اولین رو انتخاب کن */
  const valid = catalog.find((x) => x.id === PREFS.wall);
  if (!valid) {
    PREFS.wall = catalog[0].id;
    savePrefs();
    applyWallpaper(PREFS.wall);
  }

  /* فیلتر دسته‌ها */
  const allCats = [...new Set(catalog.map(x => x.category))].sort();
  if (_wallCatFilter !== "all" && !allCats.includes(_wallCatFilter)) {
    _wallCatFilter = "all";
  }

  if (cats) {
    cats.innerHTML =
      `<button class="wall-cat ${_wallCatFilter === "all" ? "on" : ""}" data-c="all">` +
        `<span class="wc-name">همه</span>` +
        `<span class="wc-count">${toFaNum(catalog.length)}</span>` +
      `</button>` +
      allCats.map(c => {
        const n = catalog.filter(x => x.category === c).length;
        return `<button class="wall-cat ${_wallCatFilter === c ? "on" : ""}" data-c="${esc(c)}">` +
          `<span class="wc-name">${esc(c)}</span>` +
          `<span class="wc-count">${toFaNum(n)}</span>` +
        `</button>`;
      }).join("");
  }

  /* آیتم‌ها */
  const filtered = _wallCatFilter === "all"
    ? catalog
    : catalog.filter(x => x.category === _wallCatFilter);

  grid.innerHTML = filtered.map(item => {
    const isLive = item.type === "live";
    const on = PREFS.wall === item.id;
    const thumb = item.thumb
      ? `<img src="${esc(item.thumb)}" alt="" loading="lazy" decoding="async">`
      : `<div class="wall-prev">${isLive ? "◐" : "▢"}</div>`;
    return `<button class="wall-card ${on ? "on" : ""}" data-id="${esc(item.id)}" type="button" title="${esc(item.title)}">
      ${thumb}
      <span class="wall-badge ${isLive ? "live" : ""}">${isLive ? "لایو" : "استاتیک"}</span>
      <span class="wall-name" dir="auto">${esc(item.title)}</span>
    </button>`;
  }).join("");

  if (controls) controls.hidden = false;
  syncWallControls();
}

function syncWallControls() {
  const dim = $("#wallDim"), dimV = $("#wallDimVal");
  const blur = $("#wallBlur"), blurV = $("#wallBlurVal");
  if (dim) {
    dim.value = PREFS.wallDim || 40;
    if (dimV) dimV.textContent = toFaNum(dim.value) + "٪";
  }
  if (blur) {
    blur.value = PREFS.wallBlur || 0;
    if (blurV) blurV.textContent = toFaNum(blur.value) + "px";
  }
}

function renderPrefs() {
  $$(".seg[data-pref], .skin-grid[data-pref]").forEach((seg) => {
    const key = seg.dataset.pref;
    if (key === "accent") return; /* با renderAccentSwatches مدیریت می‌شه */

    seg.querySelectorAll("button").forEach((b) => {
      if (key === "theme") {
        const skinDef = SKIN_DEFS[PREFS.skin] || SKIN_DEFS.default;
        const allowed = !skinDef.forced || b.dataset.v === skinDef.forced;
        b.disabled = !allowed;
        b.classList.toggle("locked", !allowed);
        b.setAttribute("aria-disabled", allowed ? "false" : "true");
        b.title = allowed
          ? ""
          : `اسکین ${skinDef.label} فقط حالت ${
              skinDef.forced === "dark" ? "تاریک" : "روشن"
            } را پشتیبانی می‌کند`;
      }
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
        renderSettingsValues();
        if (key === "sound") {
          SFX.setEnabled(PREFS.sound === "on");
          updateSoundSections();
          if (PREFS.sound === "on") SFX.play("tick");
        }
        if (key === "soundTheme") {
          SFX.setTheme(PREFS.soundTheme);
          setTimeout(() => SFX.play("copy"), 30);
        }
        if (key === "libMode") {
          updateLibModeUI();
          if ($("#drawer")?.dataset.view === "library") renderLibrary();
        }
        if (key === "skin") {
          const newDef = SKIN_DEFS[PREFS.skin] || SKIN_DEFS.default;

          const themeSeg = document.querySelector('.seg[data-pref="theme"]');
          if (themeSeg) {
            themeSeg.querySelectorAll("button").forEach((tb) => {
              const allowed = !newDef.forced || tb.dataset.v === newDef.forced;
              tb.disabled = !allowed;
              tb.classList.toggle("locked", !allowed);
              tb.classList.toggle("on", tb.dataset.v === PREFS.theme);
            });
          }
          /* پالت‌ها با applyPrefs خودکار رندر می‌شن */

          if (newDef.forced) {
            toast(
              `اسکین ${newDef.label} — تم قفل شد روی ${
                newDef.forced === "dark" ? "تاریک" : "روشن"
              }`
            );
          }
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

  /* ── نرمال‌سازی سطل آشغال (اختیاری) ── */
  const now2 = Date.now();
  const trash = [];
  if (Array.isArray(data.trash)) {
    data.trash.forEach((p) => {
      if (!p || typeof p !== "object") return;
      const title = String(p.title || "").trim();
      const content = String(p.content || "");
      if (!title || !content.trim()) return;
      let category = String(p.category || "");
      if (!validCatIds.has(category)) category = fallbackCat;
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
      trash.push({
        id: String(p.id || uid()),
        category,
        title,
        description: String(p.description || "").trim(),
        tags,
        pinned: !!p.pinned,
        content,
        createdAt: Number(p.createdAt) || now2,
        updatedAt: Number(p.updatedAt) || now2,
        deletedAt: Number(p.deletedAt) || now2,
        originalIndex: Number(p.originalIndex) || 0,
      });
    });
  }

  return { categories, prompts, trash, rejected };
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
  /* سطل آشغال: آرایهٔ جداست، بدون conflict با prompts */
  if (Array.isArray(result.trash)) {
    const activeIds = new Set(DATA.prompts.map((p) => p.id));
    const trashIds = new Set(DATA.trash.map((p) => p.id));
    result.trash.forEach((p) => {
      if (activeIds.has(p.id)) return;
      if (trashIds.has(p.id)) return;
      if (
        DATA.prompts.some(
          (x) => x.title === p.title && x.content === p.content
        )
      )
        return;
      DATA.trash.push(p);
      trashIds.add(p.id);
    });
  }

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

    const modal = $("#dialogModal");
    if (modal) {
      modal.classList.remove("is-danger", "is-help", "is-down");
      modal.classList.add("is-down");
    }

    const dIcon = $("#dialogIcon");
    dIcon.className = "dialog-ic";
    dIcon.innerHTML = icon("down");

    $("#dialogTitle").textContent = "ورودی فایل";
    $("#dialogMsg").innerHTML = msg;
    $("#dialogFieldWrap").style.display = "none";

    /* سه دکمه: انصراف (راست) — جایگزین (وسط) — ادغام (چپ) */
    const foot = document.querySelector("#dialogBack .dialog-foot");
    foot.innerHTML = `
<button class="btn ghost" id="importCancelBtn">انصراف</button>
<button class="btn" id="importReplaceBtn">جایگزین</button>
<button class="btn g" id="importMergeBtn">ادغام</button>
`;

    $("#importMergeBtn").onclick = () => {
      closeDialog("merge");
    };
    $("#importReplaceBtn").onclick = () => {
      /* پیام خود مودال به‌قدر کافی هشدار داده — تأیید دوباره لازم نیست */
      closeDialog("replace");
    };
    $("#importCancelBtn").onclick = () => {
      closeDialog("cancel");
    };

    $("#dialogBack").classList.add("open");
    _navPush("overlay", "dialogBack");
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
          DATA.trash = Array.isArray(result.trash) ? result.trash : [];
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
    icon: "warn",
    warn: true,
    message:
      'همهٔ پرامپت‌ها و دسته‌ها حذف شوند؟<br><span style="color:var(--dim);font-size:var(--f-xs)">این کار قابل بازگشت نیست.</span>',
    okText: "حذف همه",
    danger: true,
  });
  if (!ok) return;
  commit((d) => {
    d.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    d.prompts = [];
    d.trash = [];
    activeCat = "all";
  });
  closeDrawer();
  toast("بازنشانی شد");
}

/* ═══════════ سطل آشغال ═══════════ */
const TRASH_TTL_DAYS = 30;
const TRASH_TTL_MS = TRASH_TTL_DAYS * 24 * 60 * 60 * 1000;

function purgeOldTrash() {
  if (!Array.isArray(DATA.trash) || !DATA.trash.length) return 0;
  const cutoff = Date.now() - TRASH_TTL_MS;
  const before = DATA.trash.length;
  DATA.trash = DATA.trash.filter((p) => (p.deletedAt || 0) > cutoff);
  return before - DATA.trash.length;
}

function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "همین حالا";
  if (min < 60) return toFaNum(min) + " دقیقه پیش";
  const hr = Math.floor(min / 60);
  if (hr < 24) return toFaNum(hr) + " ساعت پیش";
  const day = Math.floor(hr / 24);
  if (day < 30) return toFaNum(day) + " روز پیش";
  return toFaNum(Math.floor(day / 30)) + " ماه پیش";
}

function daysLeftInTrash(deletedAt) {
  const elapsed = Math.floor((Date.now() - (deletedAt || 0)) / 86400000);
  return Math.max(0, TRASH_TTL_DAYS - elapsed);
}

function stripTrashMeta(item) {
  const { deletedAt, originalIndex, ...clean } = item;
  return clean;
}

function restoreFromTrash(id) {
  const idx = DATA.trash.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const item = DATA.trash[idx];
  const clean = stripTrashMeta(item);
  const insertAt = Math.min(
    Math.max(0, item.originalIndex || 0),
    DATA.prompts.length
  );
  commit((d) => {
    d.trash = d.trash.filter((p) => p.id !== id);
    d.prompts.splice(insertAt, 0, clean);
  });
  SFX.play("undo");
  toast("پرامپت بازگردانی شد");
}

function restoreAllTrash() {
  if (!DATA.trash.length) return;
  const items = DATA.trash
    .slice()
    .sort((a, b) => (a.originalIndex || 0) - (b.originalIndex || 0));
  commit((d) => {
    items.forEach((item) => {
      const insertAt = Math.min(
        Math.max(0, item.originalIndex || 0),
        d.prompts.length
      );
      d.prompts.splice(insertAt, 0, stripTrashMeta(item));
    });
    d.trash = [];
  });
  SFX.play("undo");
  toast(`${toFaNum(items.length)} پرامپت بازگردانی شد`);
}

async function purgeFromTrash(id) {
  const item = DATA.trash.find((p) => p.id === id);
  if (!item) return;
  const ok = await uiConfirm({
    title: "حذف کامل",
    icon: "warn",
    warn: true,
    message: `پرامپت «<b>${esc(item.title)}</b>» برای همیشه حذف شود؟`,
    okText: "حذف کامل",
    danger: true,
  });
  if (!ok) return;
  commit((d) => {
    d.trash = d.trash.filter((p) => p.id !== id);
  });
  SFX.play("del");
  toast("برای همیشه حذف شد");
}

async function emptyTrash() {
  if (!DATA.trash.length) return;
  const n = DATA.trash.length;
  const ok = await uiConfirm({
    title: "خالی کردن سطل",
    icon: "warn",
    warn: true,
    message: `${toFaNum(
      n
    )} پرامپت برای همیشه حذف شوند؟<br><span style="color:var(--dim);font-size:var(--f-xs)">این کار قابل بازگشت نیست.</span>`,
    okText: "خالی کن",
    danger: true,
  });
  if (!ok) return;
  commit((d) => {
    d.trash = [];
  });
  SFX.play("del");
  toast("سطل خالی شد");
}

function renderTrash() {
  const el = $("#trashList");
  if (!el) return;
  const items = DATA.trash
    .slice()
    .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

  const headEl = $("#trashHead");
  const emptyBtn = $("#trashEmptyBtn");
  const restoreAllBtn = $("#trashRestoreAllBtn");

  if (!items.length) {
    if (headEl) headEl.hidden = true;
    el.innerHTML = `<div class="trash-empty">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
<p>سطل آشغال خالی است</p>
<span>پرامپت‌های حذف‌شده تا ۳۰ روز اینجا می‌مونن.</span>
</div>`;
    return;
  }

  if (headEl) {
    headEl.hidden = false;
    if (emptyBtn)
      emptyBtn.textContent = `خالی کردن (${toFaNum(items.length)})`;
    if (restoreAllBtn) restoreAllBtn.textContent = "بازیابی همه";
  }

  el.innerHTML = items
    .map((p) => {
      const cat = catById(p.category);
      const daysLeft = daysLeftInTrash(p.deletedAt);
      return `<div class="trash-item" data-id="${p.id}">
<div class="trash-item-head">
<b dir="auto">${esc(p.title)}</b>
<span class="pcat ${cat.color}">${esc(cat.name)}</span>
</div>
<div class="trash-item-meta">
<span>${timeAgo(p.deletedAt)}</span>
<span class="trash-item-sep">·</span>
<span class="trash-item-ttl">${toFaNum(daysLeft)} روز مانده</span>
</div>
<div class="trash-item-acts">
<button class="btn sm g" data-trash-act="restore" type="button">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
<span>بازیابی</span>
</button>
<button class="btn sm dgr" data-trash-act="purge" type="button">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
<span>حذف کامل</span>
</button>
</div>
</div>`;
    })
    .join("");
}

async function seedDefaults() {
  const all = await loadLibrary();
  if (!all.length) {
    toast("کتابخانه در دسترس نیست", "err");
    return;
  }
  if (DATA.prompts.length > 0) {
    const ok = await uiConfirm({
      title: "افزودن پرامپت‌های پیش‌فرض",
      message: `پرامپت‌های موجود باقی می‌مانند. ${toFaNum(
        all.length
      )} پرامپت کتابخانه اضافه شوند؟`,
      okText: "افزودن",
    });
    if (!ok) return;
  }
  const n = addLibraryItems(all);
  if (n > 0) toast(`${toFaNum(n)} پرامپت افزوده شد`);
  setTimeout(() => closeDrawer(), 400);
}

function addLibraryItems(items) {
  const now = Date.now();
  if (!DATA.categories.length)
    DATA.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  const ensureCat = (id) =>
    DATA.categories.some((c) => c.id === id) ? id : DATA.categories[0].id;

  let added = 0;
  commit((d) => {
    items.forEach((item) => {
      if (!item || !item.title || !item.content) return;
      const exists = d.prompts.some(
        (p) => p.title === item.title && p.content === item.content
      );
      if (exists) return;
      d.prompts.push({
        id: uid(),
        category: ensureCat(item.category || "general"),
        title: item.title,
        description: item.description || "",
        tags: Array.isArray(item.tags) ? [...item.tags] : [],
        pinned: !!item.pinned,
        content: item.content,
        createdAt: now,
        updatedAt: now,
      });
      added++;
    });
  });
  return added;
}

function toggleTheme() {
  const resolved = resolveTheme(PREFS.theme);
  PREFS.theme = resolved === "dark" ? "light" : "dark";
  savePrefs();
  applyPrefs();
  renderPrefs();
  SFX.play("tick");
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
$("#reorderCatsBtn")?.addEventListener("click", enterCatReorderMode);
$("#catReorderDoneBtn")?.addEventListener("click", exitCatReorderMode);
$("#catMoveUpBtn")?.addEventListener("click", () =>
  moveSelectedCategories(-1)
);
$("#catMoveDownBtn")?.addEventListener("click", () =>
  moveSelectedCategories(1)
);
$("#exportBtn").onclick = exportData;
$("#importBtn").onclick = () => $("#importFile").click();
$("#importFile").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if (f) importData(f);
});

$("#resetBtn").onclick = resetAll;

$("#catList").addEventListener("click", (e) => {
  const item = e.target.closest(".cat-item");
  if (!item) return;
  const id = item.dataset.id;

  /* حالت مرتب‌سازی: کلیک روی ردیف = toggle انتخاب */
  if (_catReordering) {
    toggleCatSelection(id);
    return;
  }

  /* حالت عادی: فقط دکمه‌های ویرایش/حذف */
  const btn = e.target.closest("[data-act]");
  if (!btn || btn.disabled) return;
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

/* toggle پیش‌نمایش — هم دسکتاپ هم موبایل */
$("#varPreviewToggle")?.addEventListener("click", () => {
  const deck = document.getElementById("varDeck");
  if (!deck) return;
  setVarPreviewOpen(!deck.classList.contains("preview-open"));
});

/* دکمهٔ back تو هدر پنل — برمی‌گرده به فرم */
$("#varPreviewBack")?.addEventListener("click", () => {
  setVarPreviewOpen(false);
});

/* دکمه‌های فوتر پنل: انصراف (بستن کل مودال) / کپی */
$("#varPreviewPanel")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-var-action]");
  if (!btn) return;
  const act = btn.dataset.varAction;
  if (act === "back") setVarPreviewOpen(false);
  else if (act === "cancel") closeVarModal();
  else if (act === "copy") copyVarFinal();
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
    SFX.play("undo");
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
  const isSlash = e.code === "Slash" || k === "/";
  if (
    isSlash &&
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
    if ($("#libPreviewBack")?.classList.contains("open")) {
      closeLibPreview();
      return;
    }
    if ($("#libSettingsBack")?.classList.contains("open")) {
      closeLibSettings();
      return;
    }
    if ($("#chlogBack")?.classList.contains("open")) {
      closeChangelog();
      return;
    }
    if ($("#mdPreviewBack")?.classList.contains("open")) {
      closeMdPreview();
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
      if (_mdPreviewOn) {
        setMdPreview(false);
        return;
      }
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

  /* e.code نه e.key — چون تو چیدمان فارسی e.key می‌شه "س" */
  const isS = e.code === "KeyS" || k.toLowerCase() === "s";
  if ((e.ctrlKey || e.metaKey) && isS) {
    /* Ctrl+S بومی مرورگر بلاک می‌شه — تو ادیتور «ذخیره»، بیرونش سکوت */
    e.preventDefault();
    if ($("#modalBack").classList.contains("open")) {
      savePrompt();
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && (e.code === "Enter" || k === "Enter")) {
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

/* ── resize: فقط وقتی عرض عوض شده دوباره اندازه بگیر ──
   روی موبایل، باز/بسته شدن کیبورد فقط ارتفاع رو عوض می‌کنه و resize
   چند بار پشت سر هم fire می‌شه. هر بار force reflow + اندازه‌گیری
   گاتر گرون‌ـه و باعث lag می‌شه، در حالی که نتیجه‌اش هیچ فرقی نمی‌کنه. */
let _resizeTimer = null;
let _lastResizeW = window.innerWidth;

window.addEventListener("resize", () => {
  const w = window.innerWidth;
  const widthChanged = Math.abs(w - _lastResizeW) > 1;
  _lastResizeW = w;
  if (!widthChanged) return;

  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    updateHeaderHeight();
    if (document.getElementById("pvContent")) {
      updatePreviewGutter($("#pvContent").textContent);
    }
    if (editorArea && $("#modalBack").classList.contains("open")) {
      updateEditorGutter();
    }
    const drawer = $("#drawer");
    if (drawer?.classList.contains("open")) {
      if (isDesktopSettings() && drawer.dataset.view === "home") {
        navigateSettings("appearance");
      }
    }
  }, 120);
});

/* ═══════════════ موتور tooltip گلوبال ═══════════════
   چرا گلوبال: کارت‌ها content-visibility: auto دارن که paint containment
   ایجاد می‌کنه و tooltip‌های بیرون‌زننده (مثل پین که بالای کارت باز می‌شه)
   رو clip می‌کنه. این موتور tooltip رو تو یه عنصر سراسری با
   position: fixed نشون می‌ده که از همهٔ contain contexts بیرونه. */
(function setupGlobalTooltips() {
  const tip = document.getElementById("gtip");
  if (!tip) return;

  const isTouch = matchMedia("(hover: none)").matches;
  let hideTimer = null;
  let activeEl = null;

  function position(el) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const gap = 8;

    /* ترجیح: بالا. اگه جا نیست: پایین. اگه اونم نیست: هر جوری بذار. */
    let y;
    if (r.top - h - gap >= 4) {
      y = r.top - h - gap; /* بالای دکمه */
    } else if (r.bottom + gap + h <= window.innerHeight - 4) {
      y = r.bottom + gap; /* زیر دکمه */
    } else {
      y = Math.max(4, r.top - h - gap);
    }

    /* محدود کردن افقی — تولتیپ از لبه‌های viewport بیرون نزنه */
    let x = cx;
    const halfW = w / 2;
    if (x - halfW < 4) x = halfW + 4;
    if (x + halfW > window.innerWidth - 4) {
      x = window.innerWidth - halfW - 4;
    }

    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }

  function show(el) {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    activeEl = el;
    tip.textContent = text;
    tip.hidden = false;

    /* مرحله ۱: یه بار با ابعاد محتوا — بعد از این فریم، ابعاد پایدارن */
    position(el);

    /* مرحله ۲: بعد از paint، اگه هنوز همون عنصریم، یه بار دیگه position
       و کلاس show رو اضافه کن (animation رو اجرا می‌کنه) */
    requestAnimationFrame(() => {
      if (activeEl !== el) return;
      position(el);
      tip.classList.add("show");
    });

    clearTimeout(hideTimer);
  }

  function hide() {
    if (!tip.classList.contains("show")) {
      tip.hidden = true;
      activeEl = null;
      return;
    }
    tip.classList.remove("show");
    const localEl = activeEl;
    activeEl = null;
    setTimeout(() => {
      if (activeEl === null) tip.hidden = true;
    }, 180);
    if (localEl) localEl.blur?.();
  }

  /* دسکتاپ — hover و focus
     نکته: mouseover/mouseout روی خود دکمه هم fire می‌شن وقتی ماوس وارد
     یا خارج یه فرزند (مثل SVG) می‌شه. اگه چک نکنیم، hide() و show()
     پشت‌سرهم اجرا می‌شن و ترنزیشن transform/opacity از صفر شروع می‌شه —
     همین باعث «لرزش چند پیکسلی» تولتیپ موقع حرکت ریز می‌شه. */
  document.addEventListener("mouseover", (e) => {
    if (isTouch) return;
    const el = e.target.closest("[data-tip]");
    if (!el || el === activeEl) return;
    /* اگه از داخل همون دکمه میایم (تغییر فرزند)، نمایش دوباره لازم نیست */
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    show(el);
  });
  document.addEventListener("mouseout", (e) => {
    if (isTouch) return;
    const el = e.target.closest("[data-tip]");
    if (!el) return;
    /* اگه داریم می‌ریم به یه فرزند، در واقع خارج نشدیم */
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    hide();
  });
  document.addEventListener(
    "focusin",
    (e) => {
      if (isTouch) return;
      const el = e.target.closest("[data-tip]");
      if (el) show(el);
    },
    true
  );
  document.addEventListener(
    "focusout",
    (e) => {
      if (isTouch) return;
      if (e.target.closest("[data-tip]")) hide();
    },
    true
  );

  /* ── موبایل: نگه‌داشتن → نمایش، برداشتن انگشت → مخفی ── */
  const TOUCH_HOLD = 220;   /* قبل از نمایش، اینقدر نگه‌داری */
  const TOUCH_RELEASE = 80; /* بعد از برداشتن انگشت، اینقدر بمونه */
  let touchTimer = null;
  let touchEl = null;

  document.addEventListener(
    "touchstart",
    (e) => {
      const el = e.target.closest("[data-tip]");
      if (!el) return;
      clearTimeout(touchTimer);
      touchEl = el;
      touchTimer = setTimeout(() => {
        if (touchEl === el) show(el);
      }, TOUCH_HOLD);
    },
    { passive: true }
  );

  const onTouchEnd = () => {
    clearTimeout(touchTimer);
    touchTimer = null;
    touchEl = null;
    /* تأخیر کوچیک تا کاربر بتونه بخونه، بعد محو */
    setTimeout(hide, TOUCH_RELEASE);
  };
  document.addEventListener("touchend", onTouchEnd, { passive: true });
  document.addEventListener("touchcancel", onTouchEnd, { passive: true });

  /* اگه انگشت حرکت کرد (اسکرول)، تولتیپ لغو شه */
  document.addEventListener(
    "touchmove",
    () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
        touchEl = null;
      }
      hide();
    },
    { passive: true }
  );

  /* با اسکرول یا لمس جای دیگه، مخفی */
  document.addEventListener("scroll", hide, { passive: true });
  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.target.closest("[data-tip]")) return;
      hide();
    },
    { passive: true }
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

/* ═══════════════ Markdown Preview ═══════════════ */

/* پارسر سبک — فقط syntax پرکاربرد، بدون dependency.
   امنیت: اول همه چیز escape می‌شه، بعد فنس/اینلاین‌کد
   با placeholder جدا می‌شن، بعد مارک‌آپ اعمال می‌شه. */
function _mdInline(txt) {
  return txt
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
}

function mdToHtml(src) {
  if (!src) return "";
  const raw = String(src);

  /* ۱) جدا کردن fenced code از متن — با placeholder یونیکد */
  const fences = [];
  let s = raw.replace(/```([^\n`]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = fences.length;
    fences.push(code.replace(/\n$/, ""));
    return `\u0001F${i}\u0001`;
  });

  /* ۲) جدا کردن inline code */
  const inlines = [];
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    const i = inlines.length;
    inlines.push(code);
    return `\u0001I${i}\u0001`;
  });

  /* ۳) escape کل باقی‌مانده */
  s = esc(s);

  /* ۴) برگرداندن inline code به شکل امن */
  inlines.forEach((code, i) => {
    s = s.replace(
      `\u0001I${i}\u0001`,
      `<code class="md-icode">${esc(code)}</code>`
    );
  });

  /* ۵) پردازش خط‌به‌خط */
  const lines = s.split(/\r?\n/);
  const out = [];
  let inList = null; /* "ul" | "ol" | null */
  let inQuote = false;

  const closeList = () => {
    if (inList) {
      out.push(`</${inList}>`);
      inList = null;
    }
  };
  const closeQuote = () => {
    if (inQuote) {
      out.push("</blockquote>");
      inQuote = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    /* فنس کد */
    const fm = line.match(/^\u0001F(\d+)\u0001$/);
    if (fm) {
      closeList(); closeQuote();
      const i = Number(fm[1]);
      out.push(
        `<pre class="md-code"><code>${esc(fences[i] || "")}</code></pre>`
      );
      continue;
    }

    /* خط خالی */
    if (!line) {
      closeList(); closeQuote();
      continue;
    }

    /* افقی */
    if (/^[-*_]{3,}$/.test(line)) {
      closeList(); closeQuote();
      out.push('<hr class="md-hr">');
      continue;
    }

    /* هدر */
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      closeList(); closeQuote();
      const lvl = hm[1].length;
      out.push(
        `<h${lvl} class="md-h${lvl}">${_mdInline(hm[2])}</h${lvl}>`
      );
      continue;
    }

    /* نقل قول — esc() علامت > رو به &gt; تبدیل کرده */
    const qm = line.match(/^&gt;\s?(.*)$/);
    if (qm) {
      closeList();
      if (!inQuote) {
        out.push('<blockquote class="md-quote">');
        inQuote = true;
      }
      out.push(`<p>${_mdInline(qm[1])}</p>`);
      continue;
    } else {
      closeQuote();
    }

    /* لیست نقطه‌ای */
    const ulm = line.match(/^[-*+]\s+(.+)$/);
    if (ulm) {
      closeQuote();
      if (inList !== "ul") { closeList(); out.push('<ul class="md-ul">'); inList = "ul"; }
      out.push(`<li>${_mdInline(ulm[1])}</li>`);
      continue;
    }

    /* لیست شماره‌دار */
    const olm = line.match(/^\d+\.\s+(.+)$/);
    if (olm) {
      closeQuote();
      if (inList !== "ol") { closeList(); out.push('<ol class="md-ol">'); inList = "ol"; }
      out.push(`<li>${_mdInline(olm[1])}</li>`);
      continue;
    }

    /* پاراگراف */
    closeList();
    out.push(`<p class="md-p">${_mdInline(line)}</p>`);
  }
  closeList(); closeQuote();

  return out.join("\n");
}

/* ── وضعیت و toggle ── */
let _mdPreviewOn = false;

function setMdPreview(on) {
  if (_mdPreviewOn === on) return;
  _mdPreviewOn = on;

  const preview = $("#mdPreview");
  const body = $("#mdBody");
  const wrap = $("#editorWrap");
  const btn = $("#mdToggle");
  const gutter = $("#editorGutter");

  if (!preview || !body || !wrap) return;

  if (on) {
    const raw = editorArea.value || "";
    body.innerHTML = mdToHtml(raw);
    /* جهت رو مثل ادیتور ست کن */
    applyTextDir(body, raw);
    /* اسکرول از اول */
    preview.scrollTop = 0;
    preview.hidden = false;
    /* textarea و گاتر بمونن ولی مخفی شن (بدون نمایش: none تا فریم‌بافر نشه) */
    editorArea.style.visibility = "hidden";
    if (gutter) gutter.style.visibility = "hidden";
  } else {
    preview.hidden = true;
    body.innerHTML = "";
    editorArea.style.visibility = "";
    if (gutter) gutter.style.visibility = "";
    /* برگشت به ادیتور — فوکوس رو برگردون */
    editorArea.focus({ preventScroll: true });
  }

  if (btn) {
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute(
      "data-tip",
      on ? "بازگشت به ویرایش" : "پیش‌نمایش Markdown"
    );
    btn.setAttribute(
      "aria-label",
      on ? "بازگشت به ویرایش" : "پیش‌نمایش Markdown"
    );
  }
  editorModal.classList.toggle("md-preview-on", on);
}

/* کلیک روی بج */
$("#mdToggle")?.addEventListener("click", () => {
  setMdPreview(!_mdPreviewOn);
  SFX.play("tick");
});

/* راهنما: کلید Ctrl+M برای سوییچ سریع */
document.addEventListener("keydown", (e) => {
  if (
    (e.ctrlKey || e.metaKey) &&
    (e.code === "KeyM" || e.key.toLowerCase() === "m") &&
    $("#modalBack")?.classList.contains("open")
  ) {
    e.preventDefault();
    setMdPreview(!_mdPreviewOn);
  }
});


initPromptCatSelect();
initSortSelect();
loadPrefs();
load();
/* پاک‌سازی خودکار سطل آشغال (۳۰ روز TTL) */
(function initTrashPurge() {
  const n = purgeOldTrash();
  if (n > 0) {
    save();
    setTimeout(
      () =>
        toast(`${toFaNum(n)} پرامپت قدیمی از سطل پاک شد`, "warn"),
      1200
    );
  }
})();

/* ═══ اسکرول‌بار سفارشی PWA ═══ */
(function initCustomScrollbar() {
  if (matchMedia("(max-width: 760px)").matches) return;
  if (matchMedia("(hover: none)").matches) return;

  const el = document.createElement("div");
  el.id = "customScrollbar";
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);

  let hideTimer = null;
  let raf = 0;

  function update() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const scrollH = doc.scrollHeight;
      const viewH = doc.clientHeight;
      const maxScroll = scrollH - viewH;

      if (maxScroll <= 4) {
        el.hidden = true;
        return;
      }
      el.hidden = false;

      /* ارتفاع نوار متناسب با محتوا */
      const ratio = viewH / scrollH;
      const trackH = viewH - 6; /* padding ناچیز بالا/پایین */
      const thumbH = Math.max(22, trackH * ratio);
      const thumbY = (scrollTop / maxScroll) * (trackH - thumbH) + 3;

      el.style.height = thumbH + "px";
      el.style.transform = `translateY(${thumbY}px)`;
    });
  }

  function show() {
    el.classList.add("visible");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      el.classList.remove("visible");
      el.classList.remove("hover");
    }, 700);
  }

  /* چند منبع برای trigger — چون بعضی WebViewها scroll رو
     روی window fire نمی‌کنن (خصوصاً وقتی html خودش اسکرول‌کننده‌ست). */
  const trigger = () => {
    update();
    show();
  };
  window.addEventListener("scroll", trigger, { passive: true });
  document.addEventListener("scroll", trigger, {
    passive: true,
    capture: true,
  });
  window.addEventListener("wheel", trigger, { passive: true });
  window.addEventListener("touchmove", trigger, { passive: true });
  window.addEventListener(
    "keydown",
    (e) => {
      if (
        e.key === "PageUp" ||
        e.key === "PageDown" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === " "
      )
        trigger();
    },
    { passive: true }
  );

  window.addEventListener("resize", update, { passive: true });

  /* هر بار محتوا بزرگ‌تر/کوچک‌تر شد، availability رو دوباره حساب کن */
  if (window.ResizeObserver) {
    new ResizeObserver(update).observe(document.body);
  }

  /* فقط نمایشی — بدون drag. hover صرفاً تأکید بصریه. */
  el.addEventListener("mouseenter", () => {
    el.classList.add("hover");
    show();
  });
  el.addEventListener("mouseleave", () => {
    el.classList.remove("hover");
  });

  /* مقدار اولیه — دو بار با تأخیر، چون DOM اولیه هنوز کامل نیست */
  update();
  requestAnimationFrame(update);
  setTimeout(() => {
    update();
    /* اگه صفحه از همون اول اسکرول‌پذیره، یک‌بار نشونش بده تا کاربر بفهمه هست */
    if (
      document.documentElement.scrollHeight >
      document.documentElement.clientHeight + 4
    ) {
      show();
    }
  }, 450);
})();

applyPrefs();
renderPrefs();
initAllPswitches();

/* ═══ رویدادهای والپیپر ═══ */
$("#wallCats")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".wall-cat");
  if (!btn) return;
  const c = btn.dataset.c;
  if (c === _wallCatFilter) return;
  _wallCatFilter = c;
  renderWallpaperGrid();
});

$("#wallGrid")?.addEventListener("click", (e) => {
  const card = e.target.closest(".wall-card");
  if (!card) return;
  const id = card.dataset.id;
  if (PREFS.wall === id) return;
  PREFS.wall = id;
  savePrefs();
  applyWallpaper(id);
  renderWallpaperGrid();
  SFX.play("tick");
});

$("#wallDim")?.addEventListener("input", (e) => {
  const v = Number(e.target.value) || 0;
  PREFS.wallDim = v;
  savePrefs();
  document.documentElement.style.setProperty("--wall-dim", v / 100);
  const el = $("#wallDimVal");
  if (el) el.textContent = toFaNum(v) + "٪";
});

$("#wallBlur")?.addEventListener("input", (e) => {
  const v = Number(e.target.value) || 0;
  PREFS.wallBlur = v;
  savePrefs();
  document.documentElement.style.setProperty("--wall-blur", v + "px");
  const el = $("#wallBlurVal");
  if (el) el.textContent = toFaNum(v) + "px";
});

updateLibModeUI();
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
$("#selDupBtn")?.addEventListener("click", bulkDuplicate);
$("#selDelBtn")?.addEventListener("click", bulkDelete);
$("#selCancelBtn")?.addEventListener("click", exitSelectMode);
$("#bulkMoveCancelBtn")?.addEventListener("click", closeBulkMove);
$("#bulkMoveBack")?.addEventListener("click", (e) => {
  if (e.target.id === "bulkMoveBack") closeBulkMove();
});
/* ═══════════ رویدادهای سطل آشغال ═══════════ */
$("#trashList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-trash-act]");
  if (!btn) return;
  const item = btn.closest(".trash-item");
  if (!item) return;
  const id = item.dataset.id;
  const act = btn.dataset.trashAct;
  if (act === "restore") restoreFromTrash(id);
  else if (act === "purge") purgeFromTrash(id);
});
$("#trashEmptyBtn")?.addEventListener("click", emptyTrash);
$("#trashRestoreAllBtn")?.addEventListener("click", restoreAllTrash);

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

  /* کانتکست منو فقط دسکتاپ (در موبایل long-press معنایی نداره) */
  const isTouchDevice = matchMedia("(hover: none)").matches;

  /* راست-کلیک روی کارت → منوی عملیات */
  $("#grid").addEventListener("contextmenu", (e) => {
    if (isTouchDevice) return;
    if (selectMode) return;
    const card = e.target.closest(".card");
    if (!card) return; /* فضای خالی: بی‌عمل */
    e.preventDefault();
    const p = DATA.prompts.find((x) => x.id === card.dataset.id);
    if (p) show(e.clientX, e.clientY, p);
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

/* ═══════════ کتابخانه: رندر + پیش‌نمایش ═══════════ */
let libPreviewIdx = -1;
let _libSwapTimer = null;

function isLibItemAdded(item) {
  return DATA.prompts.some(
    (p) => p.title === item.title && p.content === item.content
  );
}

/* توضیح حالت پیشنهاد حالا تو خود duo هست — نیازی به hint جداگانه نیست. */
function updateLibModeHint() {}
function updateLibModeUI() {
  const manual = PREFS.libMode === "manual";
  const refreshBtn = $("#libRefreshBtn");
  if (refreshBtn) refreshBtn.hidden = !manual;
  updateLibModeHint();
}
function openLibSettings() {
  $("#libSettingsBack").classList.add("open");
  _navPush("overlay", "libSettingsBack");
  refreshFocusTrap();
  /* اسلایدر رو چند بار موقعیت‌دهی کن — برای layout و فونت async */
  const el = document.querySelector('.pswitch[data-pref="libMode"]');
  if (el) {
    const sched = _pswInstances.get(el);
    if (sched) {
      requestAnimationFrame(sched);
      setTimeout(sched, 60);
      setTimeout(sched, 200);
    }
  }
}
function closeLibSettings() {
  if (!$("#libSettingsBack")?.classList.contains("open")) return;
  _CLOSE_RAW.libSettingsBack();
  _navSilentBack();
}
function refreshLibrary() {
  PREFS.libOffset = (PREFS.libOffset || 0) + 1;
  savePrefs();
  renderLibrary();
  SFX.play("tick");
  toast("کتابخانه آپدیت شد");
}

async function renderLibrary() {
  const grid = $("#libGrid");
  if (!grid) return;

  /* فقط بار اول که کش خالیه loading نشون بده؛ رفرش دستی نباید پرش کنه */
  const coldStart = !_libraryCache;
  if (coldStart) {
    grid.innerHTML = `<div class="lib-loading">در حال بارگذاری…</div>`;
  }

  const all = await loadLibrary();
  if (!all.length) {
    grid.innerHTML = `<div class="lib-empty">کتابخانه در دسترس نیست</div>`;
    const allBtn = $("#libAddAll");
    if (allBtn) allBtn.disabled = true;
    return;
  }

  currentLibItems = pickDailyItems(all, LIBRARY_SHOWN);

  const html = currentLibItems
    .map((item, i) => {
      const cat = catById(item.category);
      const added = isLibItemAdded(item);
      const tags = (item.tags || [])
        .map(
          (t) =>
            `<span class="tag"><span class="th">#</span><span class="tw">${esc(
              t
            )}</span></span>`
        )
        .join("");
      return `
<button class="lib-card" type="button" data-lib="${i}">
  <div class="lib-card-head">
    <span class="lib-card-cat"><span class="dot ${esc(
      cat.color
    )}"></span>${esc(cat.name)}</span>
    <span class="lib-card-b">${esc(item.title)}</span>
    ${added ? '<span class="lib-card-added">افزوده شده</span>' : ""}
  </div>
  ${
    item.description
      ? `<div class="lib-card-desc">${esc(item.description)}</div>`
      : ""
  }
  ${tags ? `<div class="lib-card-tags">${tags}</div>` : ""}
  <div class="lib-card-foot">
    <span class="lib-card-hint">برای پیش‌نمایش بزن</span>
    <span class="btn sm ${added ? "" : "g"}" data-lib-add="${i}">${
        added ? "افزوده شده" : "افزودن"
      }</span>
      </div>
    </button>`;
    })
    .join("");

  if (coldStart) {
    grid.innerHTML = html;
  } else {
    /* دو فاز: ۱) blur-out ۲) swap + blur-in
       timing باید با CSS هماهنگ باشه (خروج ۱۴۰ms) */
    clearTimeout(_libSwapTimer);
    grid.classList.add("swapping");
    _libSwapTimer = setTimeout(() => {
      grid.innerHTML = html;
      requestAnimationFrame(() => grid.classList.remove("swapping"));
    }, 140);
  }

  const allBtn = $("#libAddAll");
  if (allBtn) {
    const allAdded = currentLibItems.every(isLibItemAdded);
    allBtn.disabled = allAdded;
    const lbl = allBtn.querySelector("span");
    if (lbl) lbl.textContent = allAdded ? "همه افزوده شدن" : "افزودن همه";
  }
}

function openLibPreview(idx) {
  const item = currentLibItems[idx];
  if (!item) return;
  libPreviewIdx = idx;
  const cat = catById(item.category);
  $("#libPreviewTitle").textContent = item.title;
  const meta = [];
  meta.push(`<span class="pcat ${esc(cat.color)}">${esc(cat.name)}</span>`);
  (item.tags || []).forEach((t) => {
    meta.push(
      `<span class="tag"><span class="th">#</span><span class="tw">${esc(
        t
      )}</span></span>`
    );
  });
  $("#libPreviewMeta").innerHTML = meta.join("");

  /* آمار متن */
  const content = item.content || "";
  const lines = content.split("\n").length;
  const words = countWords(content);
  const chars = content.length;
  const tokens = estimateTokens(content);
  const statsEl = $("#libPreviewStats");
  if (statsEl) {
    statsEl.innerHTML = `
<span class="lps-item"><b>${toFaNum(lines)}</b><span>خط</span></span>
<span class="lps-item"><b>${toFaNum(words)}</b><span>کلمه</span></span>
<span class="lps-item"><b>${toFaNum(chars)}</b><span>کاراکتر</span></span>
<span class="lps-item"><b>~${toFaNum(tokens)}</b><span>توکن</span></span>`;
  }

  $("#libPreviewContent").textContent = content;
  const addBtn = $("#libPreviewAdd");
  const added = isLibItemAdded(item);
  addBtn.textContent = added ? "افزوده شده" : "افزودن به لیست من";
  addBtn.disabled = added;
  $("#libPreviewBack").classList.add("open");
  _navPush("overlay", "libPreviewBack");
  refreshFocusTrap();
}

function closeLibPreview() {
  if (!$("#libPreviewBack")?.classList.contains("open")) return;
  _CLOSE_RAW.libPreviewBack();
  _navSilentBack();
}

function addLibByIndex(idx) {
  const item = currentLibItems[idx];
  if (!item) return;
  const n = addLibraryItems([item]);
  if (n > 0) {
    SFX.play("copy");
    toast("به لیست تو اضافه شد");
  } else {
    toast("قبلاً اضافه شده بود", "warn");
  }
  renderLibrary();
  if (libPreviewIdx === idx) {
    const addBtn = $("#libPreviewAdd");
    if (addBtn) {
      addBtn.textContent = "افزوده شده";
      addBtn.disabled = true;
    }
  }
}

$("#libGrid")?.addEventListener("click", (e) => {
  const addBtn = e.target.closest("[data-lib-add]");
  if (addBtn) {
    e.preventDefault();
    e.stopPropagation();
    addLibByIndex(Number(addBtn.dataset.libAdd));
    return;
  }
  const card = e.target.closest("[data-lib]");
  if (!card) return;
  openLibPreview(Number(card.dataset.lib));
});

$("#libAddAll")?.addEventListener("click", () => {
  if (!currentLibItems.length) return;
  const n = addLibraryItems(currentLibItems);
  if (n > 0) {
    SFX.play("copy");
    toast(`${toFaNum(n)} پرامپت افزوده شد`);
  }
  renderLibrary();
});

$("#libRefreshBtn")?.addEventListener("click", refreshLibrary);
$("#libSettingsBtn")?.addEventListener("click", openLibSettings);
$("#libSettingsClose")?.addEventListener("click", closeLibSettings);
$("#libSettingsBack")?.addEventListener("click", (e) => {
  if (e.target.id === "libSettingsBack") closeLibSettings();
});

$("#libPreviewAdd")?.addEventListener("click", () => {
  if (libPreviewIdx >= 0) addLibByIndex(libPreviewIdx);
});
$("#libPreviewClose")?.addEventListener("click", closeLibPreview);
$("#libPreviewX")?.addEventListener("click", closeLibPreview);
$("#libPreviewBack")?.addEventListener("click", (e) => {
  if (e.target.id === "libPreviewBack") closeLibPreview();
});

/* ═══ چنج‌لاگ ═══ */
const CHANGELOG = [
    {
    version: "1.6",
    date: "1405/07/03",
    items: [
      "هشت ظاهر تازه برای اپ در [ظاهر](appearance): از مینیمال و شیشه‌ای تا ترمینال فسفری و مجله‌ای — هرکدام شخصیت خودش را دارد.",
      "والپیپر: تصویر ثابت یا پس‌زمینهٔ زندهٔ متحرک، با گالری آماده و کنترل تیرگی و محو. روی [ظاهر](appearance) → تصویر امتحان کن.",
      "پیش‌نمایش Markdown در ادیتور پرامپت — با دکمهٔ چشم یا Ctrl+M. تیترها، لیست‌ها و کد بلوکی همان‌طور که در AI دیده می‌شوند.",
      "کتابخانه حالا دو حالت دارد: پیشنهاد خودکار روزانه، یا انتخاب دستی با دکمهٔ ↻. پیش از افزودن، آمار متن (خط، کلمه، کاراکتر، تخمین توکن) را می‌بینی.",
      "پس‌زمینه چهار حالت مستقل گرفت: بدون، پترن، تصویر، زنده — دیگر لازم نیست بین پترن و والپیپر یکی را انتخاب کنی.",
      "راهنمای کامل استفاده در [درباره](about) → راهنما؛ از متغیرها و کتابخانه تا میان‌برهای کیبورد.",
      "منوی راست‌کلیک روی کارت حالا زیرمنو دارد: باز کردن مستقیم در هر سرویس AI، و انتقال سریع به هر دسته.",
      "در تنظیمات دسکتاپ، جابه‌جایی بین بخش‌ها با انیمیشن نرم و دکمهٔ بازگشت انجام می‌شود.",
      "کارت‌ها در لیست‌های بزرگ روان‌تر اسکرول می‌شوند و جست‌وجو سریع‌تر نتیجه می‌دهد.",
      "شمارهٔ نسخه در فوتر و صفحهٔ درباره نمایش داده می‌شود و با هر به‌روزرسانی خودکار عوض می‌شود.",
    ],
  },
  {
    version: "1.5",
    date: "1404/06/28",
    items: [
      "کتابخانه دو حالت دارد: چرخش روزانه و دستی. در حالت دستی، دکمهٔ ↻ در کنار «افزودن همه» هشت پیشنهاد تازه ارائه می‌کند. تنظیمات از دکمهٔ ? در دسترس است.",
      "راهنمای استفاده به بخش [درباره](about) افزوده شد؛ شامل متغیرها، کتابخانه، باز کردن در AI، سطل آشغال، پشتیبان‌گیری و میان‌برهای کیبورد. راهنمای متغیرها اکنون تنها یک بار در پیش‌نمایش نمایش داده می‌شود.",
      "بهبود کارایی گرید کارت ها: content-visibility روی کارت‌ها، کش جست‌وجو و محدودسازی انیمیشن ورود به بیست کارت نخست.",
      "افزودن انیمیشن blur در به‌روزرسانی کتابخانه",
      "ترنزیشن جهت‌دار میان شاخه‌های تنظیمات؛ دکمهٔ بازگشت در دسکتاپ برای [سطل آشغال](trash) و راهنما.",
      "افزودن دکمهٔ «رفتن به کتابخانه» در حالت خالی.",
      "تغییر محتوا در تنظیمات حالا با یک بلور جزئی و محو کوتاه همراه است؛ جهت ورود و خروج نیز حفظ شده.",
    ],
  },
  {
    version: "1.4",
    date: "1404/06/27",
    items: [
      "افزودن [سطل آشغال](trash)؛ پرامپت‌های حذف‌شده تا سی روز قابل بازیابی هستند.",
      "شش پس‌زمینه در بخش [ظاهر](appearance): شفق، رنگین، شبکه، نقطه‌ای، راه‌راه و ساده.",
      "افزودن تم صوتی «زنگی» و بهبود کیفیت صدا برای هدفون و ایرباد در بخش [صدا](sound).",
      "نمایش آمار متن (خط، کلمه، کاراکتر و تخمین توکن) در پیش‌نمایش [کتابخانه](library).",
      "ثابت‌سازی دکمهٔ «افزودن همه» در [کتابخانه](library)؛ تنها کارت‌ها اسکرول می‌شوند.",
      "یکپارچه‌سازی رنگ‌ها، اندازه‌ها و پس‌زمینه‌ها در بخش [ظاهر](appearance).",
      "بازطراحی پیش‌نمایش متغیرها: کارت کنار مودال در دسکتاپ، تمام‌صفحه در موبایل.",
      "نمایش مونواسپیس برای متن لاتین و Vazirmatn برای فارسی در ادیتور پرامپت.",
      "افزودن پیوند به موارد چنج‌لاگ برای دسترسی مستقیم.",
      "تمیزکاری CSS و حذف کدهای مرده.",
    ],
  },
  {
    version: "1.3",
    date: "1404/06/27",
    items: [
      "انتخاب چندگانه با FAB: سنجاق، انتقال، تکثیر و حذف گروهی.",
      "منوی زمینه در دسکتاپ با راست‌کلیک روی کارت.",
      "مرتب‌سازی صعودی/نزولی با دکمهٔ کنار فیلتر.",
      "نمایش افقی و اسکرول‌پذیر چیپس‌های دسته در موبایل.",
      "پشتیبان‌گیری خودکار از دادهٔ خام پیش از مهاجرت.",
      "افزودن پیوندهای کاربردی درون چنج‌لاگ.",
    ],
  },
  {
    version: "1.2",
    date: "1404/06/26",
    items: [
      "نصب به‌صورت PWA با پشتیبانی آفلاین.",
      "به‌روزرسانی یک‌کلیکی از [تنظیمات](home).",
      "دسترسی به تاریخچهٔ تغییرات از [درباره](about).",
      "بهبود ظاهر کارت‌ها و سرعت بارگذاری.",
      "پس‌زمینهٔ تازه و ادیتور مناسب موبایل.",
    ],
  },
  {
    version: "1.1",
    date: "1404/06/25",
    items: [
      "پشتیبانی از متغیرها با {{نام}} و فرم پر کردن هنگام کپی.",
      "باز کردن مستقیم پرامپت در ChatGPT، Claude و هفت سرویس دیگر.",
      "پشتیبان‌گیری و بازیابی با فایل JSON از [داده و پشتیبان](data).",
    ],
  },
  {
    version: "1.0",
    date: "1404/06/24",
    items: ["نسخهٔ نخست؛ همراه با جست‌وجو، دسته‌بندی و سنجاق."],
  },
];

let currentAppVer = null;

/* لینک‌های inline تو چنج‌لاگ: [کلمه](view) */
const CHLOG_LINK_RE = /\[([^\]]+)\]\(([a-z]+)\)/g;

function renderChlogItemText(raw) {
  const s = String(raw == null ? "" : raw);
  CHLOG_LINK_RE.lastIndex = 0;
  let out = "",
    last = 0,
    m;
  while ((m = CHLOG_LINK_RE.exec(s))) {
    out += esc(s.slice(last, m.index));
    const label = m[1];
    const view = m[2];
    if (ST_VIEWS[view]) {
      out += `<button type="button" class="chlog-link" data-chlog-nav="${esc(
        view,
      )}">${esc(label)}</button>`;
    } else {
      out += esc(label);
    }
    last = m.index + m[0].length;
  }
  out += esc(s.slice(last));
  return out;
}

function renderChangelog() {
  const el = $("#chlogList");
  if (!el) return;
  el.innerHTML = CHANGELOG.map((c, i) => {
    const isCurrent = currentAppVer && c.version === currentAppVer;
    const itemsHtml = c.items
      .map((it) => `<li>${renderChlogItemText(it)}</li>`)
      .join("");
    return `
<div class="chlog-item">
  <div class="chlog-head">
    <span class="chlog-ver">
      <span class="chlog-ver-label">نسخه</span>
      <span class="chlog-ver-num" dir="ltr">${esc(c.version)}</span>
      ${
        isCurrent || (!currentAppVer && i === 0)
          ? '<span class="chlog-current">فعلی</span>'
          : ""
      }
    </span>
    <span class="chlog-date">${esc(toFaDigits(c.date || ""))}</span>
  </div>
  <ul>${itemsHtml}</ul>
</div>`;
  }).join("");
}
function openChangelog() {
  renderChangelog();
  $("#chlogBack").classList.add("open");
  _navPush("overlay", "chlogBack");
  refreshFocusTrap();
}
function closeChangelog() {
  if (!$("#chlogBack")?.classList.contains("open")) return;
  _CLOSE_RAW.chlogBack();
  _navSilentBack();
}
$("#helpBtn")?.addEventListener("click", () => {
  navigateSettings("help");
});
$("#chlogBtn")?.addEventListener("click", openChangelog);
$("#chlogCloseBtn")?.addEventListener("click", closeChangelog);
$("#chlogList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-chlog-nav]");
  if (!btn) return;
  const view = btn.dataset.chlogNav;
  closeChangelog();
  setTimeout(() => openDrawer(view), 160);
});
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
      if ($("#drawer")?.classList.contains("open")) renderSettingsValues();
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
  if (grp) grp.hidden = false;
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

      /* ── بکاپ اضطراری قبل از reload ──
         حتی اگه کاربر دستی بکاپ نگرفته، موقع آپدیت یه نسخه
         از داده‌های فعلی رو نگه‌دار. اگر migrate خراب شد،
         این fallback در دسترسه. */
      try {
        const currentData = localStorage.getItem("promptManager_public_v1");
        if (currentData) {
          localStorage.setItem(
            "promptManager_public_v1_autobackup",
            currentData
          );
          /* فقط آخرین ۲ نسخه رو نگه‌دار تا حجم نره بالا */
          const oldKey = "promptManager_public_v1_autobackup_prev";
          const prev = localStorage.getItem("promptManager_public_v1_autobackup");
          if (prev) {
            try {
              localStorage.setItem(oldKey, prev);
            } catch (_) { /* quota */ }
          }
        }
      } catch (_) { /* quota — نادیده */ }

      /* حالا reload */
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
  if (grp) grp.hidden = true;
  toast("به‌روزرسانی در حال اعمال…");
});

/* دکمهٔ پیش‌نمایش موبایل */
$("#varPreviewBtn")?.addEventListener("click", () => {
  const deck = document.getElementById("varDeck");
  if (!deck) return;
  const open = !deck.classList.contains("preview-open");
  setVarPreviewOpen(open);
  const btn = $("#varPreviewBtn");
  if (btn) {
    btn.classList.toggle("on", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
});