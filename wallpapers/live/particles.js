/* ═══ ذرات واکنشی ═══
   ذرات شناور با پیوندهای کهکشانی.
   موس = دفع · نگه‌داشتن = جذب · کلیک = موج ضربه‌ای. */

import {
  TAU, clamp, rgba, makeCanvas, fit2d, watchSize, localPointer,
} from "../shared/canvas.js";

export default {
  meta: {
    title: "ذرات واکنشی",
    category: "abstract",
    tags: ["canvas", "particles", "interactive"],
    engine: "Canvas 2D",
    cost: "light",
  },

  mount(container, ctx) {
    const cv = makeCanvas(container);
    const g = cv.getContext("2d");
    const RM = ctx.RM;
    let pal = ctx.pal;

    let W = 0, H = 0, raf = 0, last = 0;
    let parts = [], pulses = [], wasDown = false;

    /* ── ساخت ذرات ── */
    function build() {
      const n = RM ? 80 : clamp(Math.round((W * H) / 8000), 60, 220);
      parts = [];
      for (let i = 0; i < n; i++) {
        parts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          ox: 0, oy: 0, vx: 0, vy: 0,
          dx: (Math.random() - 0.5) * 0.22,
          dy: (Math.random() - 0.5) * 0.22,
          z: Math.random(),
          ph: Math.random() * TAU,
          cyn: Math.random() < 0.28,
        });
      }
    }

    /* ── اندازه‌گیری ── */
    function resize() {
      const f = fit2d(cv, g);
      W = f.w; H = f.h;
      build();
    }
    const stopWatch = watchSize(container, resize);
    resize();

    /* ── حلقهٔ اصلی ── */
    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = clamp((t - last) || 16, 1, 50) / 1000;
      last = t;
      g.clearRect(0, 0, W, H);

      const ptr = localPointer(container, ctx.pointer);

      /* کلیک = موج ضربه‌ای (edge detection) */
      if (ptr.active && ptr.down && !wasDown) {
        pulses.push({ x: ptr.x, y: ptr.y, r: 0, a: 1 });
      }
      wasDown = ptr.active && ptr.down;

      /* به‌روزرسانی موج‌ها */
      for (const pu of pulses) {
        pu.r += 340 * dt;
        pu.a = Math.max(0, 1 - pu.r / 520);
      }
      pulses = pulses.filter((pu) => pu.a > 0);

      /* رندر موج‌ها */
      for (const pu of pulses) {
        g.strokeStyle = rgba(pal.acc, pu.a * 0.35);
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(pu.x, pu.y, pu.r, 0, TAU);
        g.stroke();
      }

      /* فیزیک ذرات */
      for (const p of parts) {
        p.x += (p.dx + Math.sin(t * 0.0004 + p.ph) * 0.06) * dt * 60;
        p.y += (p.dy + Math.cos(t * 0.00033 + p.ph) * 0.06) * dt * 60;
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;

        let fx = 0, fy = 0;

        /* دفع/جذب موس */
        if (ptr.active) {
          const dx = p.x + p.ox - ptr.x;
          const dy = p.y + p.oy - ptr.y;
          const d2 = dx * dx + dy * dy;
          const R = 160;
          if (d2 < R * R && d2 > 1) {
            const d = Math.sqrt(d2);
            const s = (1 - d / R) * (ptr.down ? -260 : 300);
            fx += (dx / d) * s;
            fy += (dy / d) * s;
          }
        }

        /* نیروی موج‌های ضربه‌ای */
        for (const pu of pulses) {
          const dx = p.x + p.ox - pu.x;
          const dy = p.y + p.oy - pu.y;
          const d = Math.hypot(dx, dy);
          const gg = Math.exp(-((d - pu.r) ** 2) / (2 * 45 * 45)) * pu.a * 380;
          if (d > 1) {
            fx += (dx / d) * gg;
            fy += (dy / d) * gg;
          }
        }

        /* فنر به موقعیت پایه */
        p.vx += (-p.ox * 9 + fx) * dt;
        p.vy += (-p.oy * 9 + fy) * dt;
        const dmp = Math.exp(-3 * dt);
        p.vx *= dmp;
        p.vy *= dmp;
        p.ox += p.vx * dt * 3;
        p.oy += p.vy * dt * 3;
      }

      /* خطوط بین ذرات نزدیک */
      g.lineWidth = 1;
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i];
        const ax = a.x + a.ox;
        const ay = a.y + a.oy;
        for (let j = i + 1; j < parts.length; j++) {
          const b = parts[j];
          const dx = ax - b.x - b.ox;
          const dy = ay - b.y - b.oy;
          const d2 = dx * dx + dy * dy;
          if (d2 < 12100) {
            g.strokeStyle = rgba(pal.acc, (1 - Math.sqrt(d2) / 110) * 0.3);
            g.beginPath();
            g.moveTo(ax, ay);
            g.lineTo(b.x + b.ox, b.y + b.oy);
            g.stroke();
          }
        }
        /* خط به موس */
        if (ptr.active) {
          const d = Math.hypot(ax - ptr.x, ay - ptr.y);
          if (d < 170) {
            g.strokeStyle = rgba(pal.acc, (1 - d / 170) * 0.5);
            g.beginPath();
            g.moveTo(ax, ay);
            g.lineTo(ptr.x, ptr.y);
            g.stroke();
          }
        }
      }

      /* هالهٔ موس */
      if (ptr.active) {
        const gr = g.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, 90);
        gr.addColorStop(0, rgba(pal.acc, ptr.down ? 0.16 : 0.09));
        gr.addColorStop(1, rgba(pal.acc, 0));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(ptr.x, ptr.y, 90, 0, TAU);
        g.fill();
      }

      /* رندر ذرات — دو پاس: acc و cyn */
      for (const pass of [0, 1]) {
        g.fillStyle = pass ? pal.cyn : pal.acc;
        for (const p of parts) {
          if ((p.cyn ? 1 : 0) !== pass) continue;
          g.globalAlpha = 0.35 + p.z * 0.55;
          const rr =
            (1 + p.z * 1.9) * (1 + 0.25 * Math.sin(t * 0.0012 + p.ph));
          g.beginPath();
          g.arc(p.x + p.ox, p.y + p.oy, rr, 0, TAU);
          g.fill();
        }
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
      },
      unmount() {
        this.stop();
        cv.remove();
        stopWatch();
      },
    };
  },
};