/* ═══ صورت فلکی ═══
   نقاط شناور با چشمک ملایم.
   موس = فرار ذرات + خطوط بین نزدیک‌ها و به نشانگر. */

import {
  TAU, clamp, rgba, makeCanvas, fit2d, watchSize, localPointer,
} from "../shared/canvas.js";

export default {
  meta: {
    title: "صورت فلکی",
    category: "space",
    tags: ["canvas", "stars", "constellation", "interactive"],
    engine: "Canvas 2D",
    cost: "light",
  },

  mount(container, ctx) {
    const cv = makeCanvas(container);
    const g = cv.getContext("2d");
    const RM = ctx.RM;
    let pal = ctx.pal;

    let W = 0, H = 0, raf = 0, last = 0;
    let parts = [];

    function build() {
      const n = RM ? 70 : clamp(Math.round((W * H) / 7200), 60, 240);
      const cols = [pal.acc, pal.vio, pal.blu, pal.cyn];
      parts = [];
      for (let i = 0; i < n; i++) {
        parts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          bx: (Math.random() - 0.5) * 0.35,
          by: (Math.random() - 0.5) * 0.35,
          ix: 0, iy: 0,
          r: 0.9 + Math.random() * 1.9,
          c: cols[(Math.random() * cols.length) | 0],
          tw: Math.random() * TAU,
          ts: 0.6 + Math.random() * 1.2,
        });
      }
    }

    function resize() {
      const f = fit2d(cv, g);
      W = f.w; H = f.h;
      build();
    }
    const stopWatch = watchSize(container, resize);
    resize();

    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = clamp((t - last) || 16, 1, 50);
      last = t;
      g.clearRect(0, 0, W, H);

      const ptr = localPointer(container, ctx.pointer);
      const R = 130, R2 = R * R;
      const LR = 115, LR2 = LR * LR;

      /* ── به‌روزرسانی موقعیت ذرات ── */
      for (const p of parts) {
        p.ix *= 0.9;
        p.iy *= 0.9;
        if (ptr.active) {
          const dx = p.x - ptr.x;
          const dy = p.y - ptr.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / R) * (dt / 16);
            p.ix += (dx / d) * f * 1.6;
            p.iy += (dy / d) * f * 1.6;
          }
        }
        p.x += (p.bx + p.ix) * (dt / 16);
        p.y += (p.by + p.iy) * (dt / 16);
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
      }

      /* ── خطوط بین ذرات نزدیک ── */
      g.lineWidth = 1;
      g.strokeStyle = pal.acc;
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i];
        for (let j = i + 1; j < parts.length; j++) {
          const b = parts[j];
          const dx = a.x - b.x;
          if (dx > LR || dx < -LR) continue;
          const dy = a.y - b.y;
          if (dy > LR || dy < -LR) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 < LR2) {
            g.globalAlpha = (1 - Math.sqrt(d2) / LR) * 0.26;
            g.beginPath();
            g.moveTo(a.x, a.y);
            g.lineTo(b.x, b.y);
            g.stroke();
          }
        }
      }

      /* ── خط به موس ── */
      if (ptr.active) {
        const MR = 175, MR2 = MR * MR;
        g.strokeStyle = pal.cyn;
        for (const p of parts) {
          const dx = p.x - ptr.x;
          const dy = p.y - ptr.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < MR2) {
            g.globalAlpha = (1 - Math.sqrt(d2) / MR) * 0.5;
            g.beginPath();
            g.moveTo(p.x, p.y);
            g.lineTo(ptr.x, ptr.y);
            g.stroke();
          }
        }
      }

      /* ── رندر خود نقاط با چشمک ── */
      for (const p of parts) {
        const a = 0.5 + 0.5 * Math.sin(t * 0.0012 * p.ts + p.tw);
        g.globalAlpha = 0.35 + 0.6 * a;
        g.fillStyle = p.c;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
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
        build();
      },
      unmount() {
        this.stop();
        cv.remove();
        stopWatch();
      },
    };
  },
};