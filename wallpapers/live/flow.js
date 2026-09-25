/* ═══ جریان ارگانیک ═══
   صدها ذره که در میدان برداری نرم شناورند و ردّ نوری می‌سازند.
   موس = گردابه در مسیرش. */

import {
  clamp, rgba, makeCanvas, fit2d, watchSize, localPointer,
} from "../shared/canvas.js";

export default {
  meta: {
    title: "جریان ارگانیک",
    category: "abstract",
    tags: ["canvas", "flow", "vector-field", "trail"],
    engine: "Canvas 2D",
    cost: "medium",
  },

  mount(container, ctx) {
    const cv = makeCanvas(container);
    const g = cv.getContext("2d");
    const RM = ctx.RM;
    let pal = ctx.pal;

    let W = 0, H = 0, raf = 0, last = 0;
    let pts = [], trail = "";

    /* ── میدان برداری: سه موج سینوسی که با هم جمع می‌شن ──
       نتیجه: خطوط جریان طبیعی، بدون تصادفی بودن. */
    const fieldAngle = (x, y, t) =>
      (Math.sin(x * 0.0021 + t * 0.32) +
        Math.cos(y * 0.0024 - t * 0.26) +
        Math.sin((x + y) * 0.0009 + t * 0.18)) * 1.35;

    function respawn(p) {
      p.x = Math.random() * W;
      p.y = Math.random() * H;
      p.px = p.x;
      p.py = p.y;
      p.ml = 3 + Math.random() * 5;      /* طول عمر */
      p.life = p.ml * Math.random();
      p.spd = 0.5 + Math.random() * 1.1;
      p.w = 0.8 + Math.random() * 1.5;   /* ضخامت خط */
      const cols = [pal.acc, pal.acc, pal.vio, pal.blu, pal.cyn];
      p.c = cols[(Math.random() * cols.length) | 0];
    }

    function build() {
      const n = RM ? 100 : clamp(Math.round((W * H) / 3800), 90, 380);
      pts = [];
      for (let i = 0; i < n; i++) {
        const p = {};
        respawn(p);
        pts.push(p);
      }
      /* از اول یه فریم پاک کن تا trail از صفر شروع شه */
      paint();
    }

    function paint() {
      g.globalAlpha = 1;
      g.fillStyle = pal.bg;
      g.fillRect(0, 0, W, H);
    }

    function setTrail() {
      /* آلفای محو — هر فریم یه لایه از رنگ پس‌زمینه می‌کشه
         که ردّ قبلی رو نرم‌تر می‌کنه. عدد پایین‌تر = trail طولانی‌تر. */
      trail = rgba(pal.bg, pal.light ? 0.09 : 0.075);
    }
    setTrail();

    function resize() {
      const f = fit2d(cv, g);
      W = f.w; H = f.h;
      build();
    }
    const stopWatch = watchSize(container, resize);
    resize();

    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = clamp((t - last) || 16, 1, 50) / 1000;
      last = t;
      const ts = t / 1000;

      /* ── محو تدریجی ── */
      g.globalAlpha = 1;
      g.fillStyle = trail;
      g.fillRect(0, 0, W, H);

      /* در تم تیره additive می‌کشیم تا ذرات روی هم نورانی‌تر شن */
      g.globalCompositeOperation = pal.light ? "source-over" : "lighter";
      g.lineCap = "round";

      const ptr = localPointer(container, ctx.pointer);
      const mr = 160, mr2 = mr * mr;

      for (const p of pts) {
        p.px = p.x;
        p.py = p.y;

        const a = fieldAngle(p.x, p.y, ts);
        let vx = Math.cos(a) * p.spd;
        let vy = Math.sin(a) * p.spd;

        /* ── گردابه: هم دفع شعاعی هم چرخش ── */
        if (ptr.active) {
          const dx = p.x - ptr.x;
          const dy = p.y - ptr.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < mr2 && d2 > 1) {
            const d = Math.sqrt(d2);
            const f = (1 - d / mr) * 1.8;
            vx += (dx / d) * f - (dy / d) * f * 0.9;
            vy += (dy / d) * f + (dx / d) * f * 0.9;
          }
        }

        p.x += vx * dt * 95;
        p.y += vy * dt * 95;
        p.life -= dt;

        /* respawn اگه مرد یا از کادر رفت */
        if (
          p.life <= 0 ||
          p.x < -30 || p.x > W + 30 ||
          p.y < -30 || p.y > H + 30
        ) {
          respawn(p);
          continue;
        }

        /* fading نرم — موج سینوسی بین ۰ و ۱ */
        const e = Math.sin(Math.PI * (1 - p.life / p.ml));
        g.strokeStyle = p.c;
        g.globalAlpha = e * 0.55;
        g.lineWidth = p.w;
        g.beginPath();
        g.moveTo(p.px, p.py);
        g.lineTo(p.x, p.y);
        g.stroke();
      }

      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }

    return {
      start() {
        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      },
      stop() {
        cancelAnimationFrame(raf);
        raf = 0;
      },
      resize,
      pal(newPal) {
        pal = newPal;
        setTrail();
        paint();
      },
      unmount() {
        this.stop();
        cv.remove();
        stopWatch();
      },
    };
  },
};