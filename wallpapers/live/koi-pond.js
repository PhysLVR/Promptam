/* @wallpaper
   title: حوض کوی
   category: nature
   tags: canvas, koi, fish, pond, calm
   engine: Canvas 2D
   cost: medium
*/

import {
  TAU, clamp, wrapAng, toRgb, rgba, makeCanvas, fit2d, watchSize, localPointer,
} from "../shared/canvas.js";

/* ═══════════════════════ ابزارها ═══════════════════════ */

const N = 13;

/* پروفایل بدن کوی (نسبت عرض در هر مهره):
   پوزهٔ گردِ پهن → بیشینهٔ عرض ~۲۵٪ طول → ساقهٔ دم باریک */
const PROFILE = new Float32Array([
  0.64, 0.92, 1.04, 1.10, 1.08, 1.02, 0.94,
  0.82, 0.68, 0.53, 0.39, 0.26, 0.17,
]);

let C = {};

function mix(a, b, k) {
  const A = toRgb(a), B = toRgb(b);
  return "rgb(" +
    Math.round(A[0] + (B[0] - A[0]) * k) + "," +
    Math.round(A[1] + (B[1] - A[1]) * k) + "," +
    Math.round(A[2] + (B[2] - A[2]) * k) + ")";
}

/* نویز مقدار نرم — فقط برای سرگردانیِ فرکانس‑پایین */
function h2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi), b = h2(xi + 1, yi);
  const c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

/* Chaikin روی چندضلعی بسته */
function chaikin(src, sn, dst) {
  let d = 0;
  for (let i = 0; i < sn; i++) {
    const j = i + 1 === sn ? 0 : i + 1;
    const ax = src[i * 2], ay = src[i * 2 + 1];
    const bx = src[j * 2], by = src[j * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    dst[d++] = ax + dx * 0.25; dst[d++] = ay + dy * 0.25;
    dst[d++] = ax + dx * 0.75; dst[d++] = ay + dy * 0.75;
  }
  return d >> 1;
}

function pathFrom(g, pts, n) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 1; i < n; i++) g.lineTo(pts[i * 2], pts[i * 2 + 1]);
  g.closePath();
}

/* ═══════════════════════ ماهی ═══════════════════════ */
class Fish {
  constructor(x, y, size) {
    this.maxR = size;
    this.link = size * 1.02;
    this.len = this.link * (N - 1);      /* طول بدن — مبنای شعاع چرخش */
    this.jx = new Float32Array(N);
    this.jy = new Float32Array(N);
    this.ja = new Float32Array(N);
    this.jr = new Float32Array(N);
    for (let i = 0; i < N; i++) this.jr[i] = PROFILE[i] * size;

    this.head = Math.random() * TAU;
    this.hx = x; this.hy = y;
    for (let i = 0; i < N; i++) {
      this.ja[i] = this.head;
      this.jx[i] = x - Math.cos(this.head) * this.link * i;
      this.jy[i] = y - Math.sin(this.head) * this.link * i;
    }

    this.spd0 = size * (2.3 + Math.random() * 1.2);
    this.spd = this.spd0 * 0.5;
    this.wander = this.head;
    this.seed = Math.random() * 97;
    this.phase = Math.random() * TAU;
    this.boost = 0;

    /* ماشین حالت: ۰ = گشت‌زنی، ۱ = ایست‌وشنا (hover) */
    this.mode = 0;
    this.modeT = 4 + Math.random() * 8;

    this.raw = new Float32Array(256);
    this.bufA = new Float32Array(1024);
    this.bufB = new Float32Array(1024);
    this.sil = this.bufA;
    this.silN = 0;

    this.buildPattern();
  }

  /* ── الگوی کوی: سه سبک واقعی ── */
  buildPattern() {
    const rand = Math.random;
    const P = [];

    const blob = (r0) => {
      const arr = [{ du: 0, dv: 0, dr: r0 }];
      const bn = 2 + (rand() * 3 | 0);
      for (let k = 0; k < bn; k++) {
        arr.push({
          du: (rand() - 0.5) * 0.14,
          dv: (rand() - 0.5) * 0.45,
          dr: r0 * (0.55 + rand() * 0.45),
        });
      }
      return arr;
    };
    const add = (color, n, rmin, rmax, umin, umax) => {
      for (let i = 0; i < n; i++) {
        P.push({
          color,
          u: umin + rand() * (umax - umin),
          v: (rand() - 0.5) * 1.0,
          blobs: blob(rmin + rand() * (rmax - rmin)),
        });
      }
    };

    const style = rand();
    if (style < 0.42) {
      /* کوهاکو: کرم + قرمز (گاهی سیاه، گاهی کلاه تانچو) */
      this.baseKey = "koiBase";
      add("red", 2 + (rand() * 2 | 0), 0.20, 0.34, 0.10, 0.85);
      if (rand() < 0.22) add("red", 1, 0.15, 0.19, -0.02, 0.06);
      if (rand() < 0.5) add("black", 1, 0.08, 0.14, 0.20, 0.80);
    } else if (style < 0.75) {
      /* یامابوکی: طلایی + سیاه */
      this.baseKey = "koiGold";
      add("black", 2 + (rand() * 3 | 0), 0.14, 0.30, 0.08, 0.90);
      if (rand() < 0.45) add("red", 1 + (rand() * 2 | 0), 0.16, 0.26, 0.15, 0.80);
    } else {
      /* شووا: بدنهٔ تیره + کرم/قرمز */
      this.baseKey = "koiBlack";
      add("white", 2 + (rand() * 2 | 0), 0.18, 0.30, 0.05, 0.90);
      add("red", 1 + (rand() * 2 | 0), 0.14, 0.24, 0.10, 0.85);
    }
    this.patches = P;
  }

  update(dt, W, H, px, py, pActive, foods, fishes, t) {
    /* ── ۱) سرگردانی: نویز فرکانس‑پایین، بدون لرزش ── */
    this.wander = wrapAng(this.wander +
      (vnoise(t * 0.055 + this.seed, this.seed * 0.37) - 0.5) * 2.0 * dt);
    let sx = Math.cos(this.wander);
    let sy = Math.sin(this.wander);

    /* ── ۲) ماشین حالت: گشت / ایست‌وشنا ── */
    this.modeT -= dt;
    if (this.modeT <= 0) {
      if (this.mode === 0) { this.mode = 1; this.modeT = 1.6 + Math.random() * 2.4; }
      else { this.mode = 0; this.modeT = 5 + Math.random() * 9; }
    }
    if (this.boost > 0.3 && this.mode === 1) {
      this.mode = 0; this.modeT = 3 + Math.random() * 2;
    }

    /* ── ۳) مرز: پیش‌بینی مسیر (look-ahead)، نه نیروی واکنشی ── */
    const m = Math.min(150, Math.min(W, H) * 0.20);
    const la = 1.6 + this.spd * 0.018;
    const fx = this.hx + Math.cos(this.head) * this.spd * la;
    const fy = this.hy + Math.sin(this.head) * this.spd * la;
    let wall = 0;
    if (fx < m) wall = Math.max(wall, (m - fx) / m);
    if (fx > W - m) wall = Math.max(wall, (fx - (W - m)) / m);
    if (fy < m) wall = Math.max(wall, (m - fy) / m);
    if (fy > H - m) wall = Math.max(wall, (fy - (H - m)) / m);
    if (wall > 0) {
      const dx = W * 0.5 - this.hx, dy = H * 0.5 - this.hy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const w = wall * 3.4;
      sx += (dx / d) * w; sy += (dy / d) * w;
      if (wall > 0.3 && this.mode === 1) { this.mode = 0; this.modeT = 4; }
    }

    /* ── ۴) گریز از اشاره‌گر ── */
    if (pActive) {
      const ax = this.hx - px, ay = this.hy - py;
      const d2 = ax * ax + ay * ay;
      const R = 230;
      if (d2 < R * R && d2 > 4) {
        const d = Math.sqrt(d2);
        const w = 1 - d / R;
        sx += (ax / d) * w * 5;
        sy += (ay / d) * w * 5;
        this.boost = Math.max(this.boost, w * 0.9);
      }
    }

    /* ── ۵) غذا: تعقیب سریع و پرتعهد ── */
    let best = null, bd = Infinity;
    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      const dx = f.x - this.hx, dy = f.y - this.hy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = f; }
    }
    const eatR = this.maxR * 2.6;
    const chaseR = 640;
    let foodD = Infinity;
    if (best) {
      foodD = Math.sqrt(bd) || 1;
      if (foodD < chaseR) {
        /* وزن بالا + رشد نمایی با نزدیک شدن → هجوم سریع */
        const w = 3.0 + 8.0 * Math.pow(1 - foodD / chaseR, 1.5);
        sx += ((best.x - this.hx) / foodD) * w;
        sy += ((best.y - this.hy) / foodD) * w;
        if (this.mode === 1) { this.mode = 0; this.modeT = 6; }
        /* بوست تهاجمی */
        if (foodD < 180) this.boost = Math.max(this.boost, 1.35);
        else if (foodD < 380) this.boost = Math.max(this.boost, 0.75);
        else this.boost = Math.max(this.boost, 0.35);
        /* شروع باز شدن دهان */
        if (foodD < eatR * 3.2) this.eatT = 0.55;
      }
    }

    /* ── ۶) جدایی اجتماعی (بر اساس مجموع اندازه‌ها) ── */
    for (let i = 0; i < fishes.length; i++) {
      const o = fishes[i];
      if (o === this) continue;
      const ax = this.hx - o.hx, ay = this.hy - o.hy;
      const d2 = ax * ax + ay * ay;
      const R = this.maxR + o.maxR + 46;
      if (d2 < R * R && d2 > 0.5) {
        const d = Math.sqrt(d2);
        const w = (1 - d / R) * 2.4;
        sx += (ax / d) * w; sy += (ay / d) * w;
      }
    }

    /* ── ۷) چرخش — هنگام تعقیب غذا سریع‌تر ── */
    const desired = Math.atan2(sy, sx);
    const da = wrapAng(desired - this.head);
    const chasing = foodD < chaseR;
    const baseTurn = this.spd / (this.len * 0.42);
    const turnCap = clamp(baseTurn * (chasing ? 2.6 : 1.0), 0.35, 8.0);
    this.head = wrapAng(this.head + clamp(da, -turnCap * dt, turnCap * dt));

    /* ── ۸) سرعت: شتاب نرم، ترمز کشیده، کند شدن در پیچ ── */
    const turnSlow = 1 - 0.45 * Math.min(1, Math.abs(da) / 1.5);
    const modeF = this.mode === 1 ? 0.16 : 1;
    const target = this.spd0 * modeF * (1 + this.boost) * turnSlow;
    const k = target < this.spd ? 1.6 : 3.0;
    this.spd += (target - this.spd) * Math.min(1, dt * k);
    this.boost *= Math.exp(-dt * 1.7);

    this.hx += Math.cos(this.head) * this.spd * dt;
    this.hy += Math.sin(this.head) * this.spd * dt;
    this.hx = clamp(this.hx, 24, Math.max(24, W - 24));
    this.hy = clamp(this.hy, 24, Math.max(24, H - 24));

    /* ── ۹) ستون فقرات: موج حرکتی متناسب با سرعت ── */
    const gait = clamp(this.spd / this.spd0, 0.12, 1.5);
    this.phase += dt * (1.8 + gait * 4.2);
    const amp = 0.05 + 0.13 * gait;
    this.ja[0] = this.head;
    this.jx[0] = this.hx;
    this.jy[0] = this.hy;

    const kS = 1 - Math.exp(-dt * 14);
    for (let i = 1; i < N; i++) {
      const env = 0.18 + 0.82 * Math.pow(i / (N - 1), 1.35);
      const bend = Math.sin(this.phase - i * 0.55) * amp * env;
      this.ja[i] = wrapAng(this.ja[i] +
        wrapAng(this.ja[i - 1] + bend - this.ja[i]) * kS);
      this.jx[i] = this.jx[i - 1] - Math.cos(this.ja[i]) * this.link;
      this.jy[i] = this.jy[i - 1] - Math.sin(this.ja[i]) * this.link;
    }

    /* ── ۱۰) دهان: باز/بسته با خوردن ── */
    if (this.eatT > 0) this.eatT -= dt;
    const eatN = clamp(this.eatT / 0.55, 0, 1);
    this.mouthOpen = eatN > 0 ? clamp(eatN * 2.5, 0, 1) : 0;
  }

  buildSil() {
    const raw = this.raw;
    let n = 0;

    /* سرِ گرد با پوزهٔ پهن */
    const a0 = this.ja[0], r0 = this.jr[0];
    const cA = Math.cos(a0), sA = Math.sin(a0);
    const HEAD_STEPS = 6;
    for (let k = 0; k <= HEAD_STEPS; k++) {
      const phi = -Math.PI / 2 + (k / HEAD_STEPS) * Math.PI;
      const fwd = Math.cos(phi) * 1.06;
      const lat = Math.sin(phi);
      raw[n++] = this.jx[0] + cA * r0 * fwd - sA * r0 * lat;
      raw[n++] = this.jy[0] + sA * r0 * fwd + cA * r0 * lat;
    }

    /* ضلع A */
    for (let i = 1; i < N; i++) {
      const a = this.ja[i], r = this.jr[i];
      raw[n++] = this.jx[i] - Math.sin(a) * r;
      raw[n++] = this.jy[i] + Math.cos(a) * r;
    }

    /* انتهای ساقهٔ دم — کلاهک گرد (قوس صحیح از ضلع A به ضلع B) */
    const aT = this.ja[N - 1], rT = this.jr[N - 1];
    const cT = Math.cos(aT), sT = Math.sin(aT);
    const TAIL_STEPS = 4;
    for (let k = 1; k < TAIL_STEPS; k++) {
      const beta = Math.PI / 2 - (k / TAIL_STEPS) * Math.PI;
      const cb = Math.cos(beta), sb = Math.sin(beta);
      raw[n++] = this.jx[N - 1] + (-cT * cb - sT * sb) * rT * 1.05;
      raw[n++] = this.jy[N - 1] + (-sT * cb + cT * sb) * rT * 1.05;
    }

    /* ضلع B (برگشت) */
    for (let i = N - 1; i >= 1; i--) {
      const a = this.ja[i], r = this.jr[i];
      raw[n++] = this.jx[i] + Math.sin(a) * r;
      raw[n++] = this.jy[i] - Math.cos(a) * r;
    }

    let sn = n >> 1;
    let src = raw, dst = this.bufA, tmp;
    for (let p = 0; p < 3; p++) {
      sn = chaikin(src, sn, dst);
      tmp = src; src = dst; dst = tmp;
    }
    this.sil = src;
    this.silN = sn;
  }

  /* ── لکه‌های الگو، کلیپ‌شده به بدنه ── */
  drawPattern(g) {
    const P = this.patches;
    for (let pi = 0; pi < P.length; pi++) {
      const patch = P[pi];
      g.fillStyle =
        patch.color === "red" ? C.koiRed :
        patch.color === "black" ? C.koiBlack : C.koiBase;
      for (let bi = 0; bi < patch.blobs.length; bi++) {
        const b = patch.blobs[bi];
        const u = clamp(patch.u + b.du, -0.05, 1.05);
        const v = patch.v + b.dv;

        const iF = u * (N - 1);
        const i0 = Math.max(0, Math.min(N - 2, Math.floor(iF)));
        const i1 = Math.min(N - 1, i0 + 1);
        const tt = clamp(iF - i0, 0, 1);

        const jx = this.jx[i0] * (1 - tt) + this.jx[i1] * tt;
        const jy = this.jy[i0] * (1 - tt) + this.jy[i1] * tt;
        const a = Math.atan2(this.jy[i1] - this.jy[i0],
                             this.jx[i1] - this.jx[i0]);
        const r = this.jr[i0] * (1 - tt) + this.jr[i1] * tt;

        const px = jx - Math.sin(a) * v * r;
        const py = jy + Math.cos(a) * v * r;
        const rad = b.dr * this.maxR;

        g.beginPath();
        g.ellipse(px, py, rad * 1.5, rad, a, 0, TAU);
        g.fill();
      }
    }
  }

  /* ── دمِ خطی و پهن (نمای از بالا): پهن‌تر از طول، بدون فرم قلب ── */
  drawTail(g) {
    const R = this.maxR;
    const i = N - 1;
    const bx = this.jx[i], by = this.jy[i];
    const sway = Math.sin(this.phase * 0.9 - 0.9) * 0.22;
    const a = this.ja[i] + Math.PI + sway;
    const c = Math.cos(a), s = Math.sin(a);
    const nx = -s, ny = c;

    const r0 = R * 0.30;
    /* از نمای بالا: عرض عمود >> طول محوری */
    const L = R * 1.05;
    const Wd = R * 1.95;

    const X = (f, l) => bx + c * f + nx * l;
    const Y = (f, l) => by + s * f + ny * l;

    g.beginPath();
    g.moveTo(X(0, r0), Y(0, r0));
    /* لوب بالا */
    g.quadraticCurveTo(
      X(L * 0.25, Wd * 0.85), Y(L * 0.25, Wd * 0.85),
      X(L * 0.72, Wd * 0.98), Y(L * 0.72, Wd * 0.98)
    );
    g.quadraticCurveTo(
      X(L * 1.05, Wd * 0.78), Y(L * 1.05, Wd * 0.78),
      X(L * 0.98, Wd * 0.40), Y(L * 0.98, Wd * 0.40)
    );
    /* شکاف با کفِ گرد — از یک لوب نرم به لوب دیگر */
    g.quadraticCurveTo(
      X(L * 0.56, Wd * 0.14), Y(L * 0.56, Wd * 0.14),
      X(L * 0.52, 0), Y(L * 0.52, 0)
    );
    g.quadraticCurveTo(
      X(L * 0.56, -Wd * 0.14), Y(L * 0.56, -Wd * 0.14),
      X(L * 0.98, -Wd * 0.40), Y(L * 0.98, -Wd * 0.40)
    );
    g.quadraticCurveTo(
      X(L * 1.05, -Wd * 0.78), Y(L * 1.05, -Wd * 0.78),
      X(L * 0.72, -Wd * 0.98), Y(L * 0.72, -Wd * 0.98)
    );
    g.quadraticCurveTo(
      X(L * 0.25, -Wd * 0.85), Y(L * 0.25, -Wd * 0.85),
      X(0, -r0), Y(0, -r0)
    );
    g.quadraticCurveTo(X(R * 0.16, 0), Y(R * 0.16, 0), X(0, r0), Y(0, r0));
    g.closePath();

    g.fillStyle = C.fin;
    g.fill();
    g.strokeStyle = C.finEdge;
    g.lineWidth = Math.max(0.8, R * 0.045);
    g.stroke();

    g.save();
    g.clip();
    g.strokeStyle = C.finRay;
    g.lineWidth = Math.max(0.7, R * 0.035);
    for (let k = -2; k <= 2; k++) {
      const l = k * 0.42;
      g.beginPath();
      g.moveTo(X(R * 0.10, l * r0 * 1.7), Y(R * 0.10, l * r0 * 1.7));
      g.quadraticCurveTo(
        X(L * 0.40, l * Wd * 0.55), Y(L * 0.40, l * Wd * 0.55),
        X(L * 0.90, l * Wd * 0.85), Y(L * 0.90, l * Wd * 0.85)
      );
      g.stroke();
    }
    g.restore();
  }

  /* ── چهار بالهٔ کناری: یک جفت سینه‌ای (نزدیک سر) + یک جفت لگنی (نزدیک دم) ── */
  drawSideFins(g) {
    const R = this.maxR;
    const specs = [
      { idx: 2, size: 1.00, flapAmp: 0.28, flapOff: 0.0 },   /* سینه‌ای — یک‌چهارم ابتدایی */
      { idx: 9, size: 0.80, flapAmp: 0.20, flapOff: 1.6 },   /* لگنی — یک‌چهارم انتهایی */
    ];

    for (let si = 0; si < specs.length; si++) {
      const sp = specs[si];
      const idx = sp.idx;
      const a = this.ja[idx];
      const bx = this.jx[idx], by = this.jy[idx];
      const r = this.jr[idx];

      for (let side = -1; side <= 1; side += 2) {
        const fl = Math.sin(
          this.phase * 0.85 + (side > 0 ? 0 : 1.2) + sp.flapOff
        ) * sp.flapAmp;

        g.save();
        g.translate(bx, by);
        g.rotate(a + fl);

        const L = R * 1.85 * sp.size;
        const w = R * 0.58 * sp.size;
        const y0 = side * r * 0.22;

        g.beginPath();
        g.moveTo(R * 0.50 * sp.size, y0 + side * w * 0.55);
        g.quadraticCurveTo(
          R * 0.40 * sp.size,
          y0 + side * (r * 0.22 + L * 0.62),
          -R * 0.30 * sp.size,
          y0 + side * (r * 0.22 + L)
        );
        g.quadraticCurveTo(
          -R * 0.55 * sp.size,
          y0 + side * (r * 0.22 + L * 0.55),
          -R * 0.52 * sp.size,
          y0 + side * w * 0.38
        );
        g.quadraticCurveTo(
          -R * 0.02 * sp.size,
          y0 + side * r * 0.10,
          R * 0.50 * sp.size,
          y0 + side * w * 0.55
        );
        g.closePath();

        g.fillStyle = C.fin;
        g.fill();
        g.strokeStyle = C.finEdge;
        g.lineWidth = Math.max(0.7, R * 0.04);
        g.stroke();

        g.save();
        g.clip();
        g.strokeStyle = C.finRay;
        g.lineWidth = Math.max(0.6, R * 0.03);
        for (let k = -1; k <= 1; k++) {
          g.beginPath();
          g.moveTo(
            R * 0.20 * sp.size,
            y0 + side * (r * 0.30 + w * 0.20 * (k + 1))
          );
          g.quadraticCurveTo(
            -R * 0.08 * sp.size,
            y0 + side * (r * 0.24 + L * 0.48 * (1 + k * 0.16)),
            -R * 0.28 * sp.size,
            y0 + side * (r * 0.22 + L * (0.72 + k * 0.14))
          );
          g.stroke();
        }
        g.restore();
        g.restore();
      }
    }
  }

  /* ── بالهٔ پشتی: از نمای بالا فقط یک نوار باریک روی ستونِ بدن.
     (کوی نهنگ نیست — بالهٔ پشتی‌اش بلند و باریک است، نه بالِ کناری) ── */
  drawDorsalFin(g) {
    const R = this.maxR;
    const i0 = 3, i1 = 9;
    const len = i1 - i0;

    /* نیم‌عرضِ جانبی خیلی کوچک — این نوار روی بدن می‌خوابد */
    const halfW = 0.22;
    /* جابه‌جایی کوچک به یک سمت برای طبیعی‌بودن */
    const bias = 0.06;

    const top = [];
    const bot = [];
    for (let i = i0; i <= i1; i++) {
      const u = (i - i0) / len;
      const a = this.ja[i];
      const nx = -Math.sin(a), ny = Math.cos(a);
      const jx = this.jx[i], jy = this.jy[i];
      /* پروفایل باریک: از دو سر نزدیک صفر، در میانه بیشینه */
      const bump = Math.pow(Math.sin(u * Math.PI), 0.75);
      const h = R * halfW * bump;
      top.push([jx + nx * (h + R * bias * bump), jy + ny * (h + R * bias * bump)]);
      bot.push([jx - nx * (h - R * bias * bump), jy - ny * (h - R * bias * bump)]);
    }

    /* پر کردن */
    g.beginPath();
    g.moveTo(top[0][0], top[0][1]);
    for (let k = 1; k < top.length; k++) g.lineTo(top[k][0], top[k][1]);
    for (let k = bot.length - 1; k >= 0; k--) g.lineTo(bot[k][0], bot[k][1]);
    g.closePath();

    g.fillStyle = C.fin;
    g.globalAlpha = 0.55;
    g.fill();
    g.globalAlpha = 1;

    /* شعاع‌های عرضی — خط‌های کوتاه عمود بر ستون */
    g.save();
    g.clip();
    g.strokeStyle = C.finRay;
    g.lineWidth = Math.max(0.6, R * 0.035);
    g.lineCap = "round";
    for (let i = i0; i <= i1; i++) {
      const u = (i - i0) / len;
      const a = this.ja[i];
      const nx = -Math.sin(a), ny = Math.cos(a);
      const jx = this.jx[i], jy = this.jy[i];
      const bump = Math.pow(Math.sin(u * Math.PI), 0.75);
      const h = R * halfW * bump;
      if (h < 0.8) continue;
      g.beginPath();
      g.moveTo(jx + nx * (h + R * bias * bump), jy + ny * (h + R * bias * bump));
      g.lineTo(jx - nx * (h - R * bias * bump), jy - ny * (h - R * bias * bump));
      g.stroke();
    }
    g.restore();

    /* خط دور */
    g.beginPath();
    g.moveTo(top[0][0], top[0][1]);
    for (let k = 1; k < top.length; k++) g.lineTo(top[k][0], top[k][1]);
    for (let k = bot.length - 1; k >= 0; k--) g.lineTo(bot[k][0], bot[k][1]);
    g.closePath();
    g.strokeStyle = C.finEdge;
    g.lineWidth = Math.max(0.7, R * 0.04);
    g.stroke();
  }

  /* ── دهان: از نمای بالا تقریباً دیده نمی‌شود — فقط یک برجستگی نرم
     در لبهٔ جلویی سر که با خوردن کمی جلو می‌آید و کمی پهن‌تر می‌شود.
     رنگش هم‌خانوادهٔ بدن است، نه یک سوراخ. ── */
  drawMouth(g) {
    const R = this.maxR;
    const a0 = this.ja[0];
    const cA = Math.cos(a0), sA = Math.sin(a0);
    const hx = this.jx[0], hy = this.jy[0];
    const r0 = this.jr[0];
    const open = this.mouthOpen;

    /* مرکز، درست روی لبهٔ جلویی سر — نه بیرون‌زده، نه داخل */
    const fwd = r0 * (1.02 + open * 0.10);
    const cx = hx + cA * fwd;
    const cy = hy + sA * fwd;

    /* پایه کوچک؛ با خوردن کمی پهن‌تر و کمی جلوتر */
    const halfW = r0 * (0.26 + open * 0.26);
    const depth = r0 * (0.10 + open * 0.16);

    g.save();
    g.translate(cx, cy);
    g.rotate(a0);

    /* بیضی کوچک، کشیده در جهت عرض سر */
    g.beginPath();
    g.ellipse(0, 0, depth, halfW, 0, 0, TAU);
    g.fillStyle = C.mouth;
    g.fill();

    /* با خوردن، یک ته‌رنگ کمی تیره‌تر (مثل حفرهٔ زیر لب) اضافه می‌شود */
    if (open > 0.05) {
      g.beginPath();
      g.ellipse(0, 0, depth * 0.55, halfW * 0.60, 0, 0, TAU);
      g.fillStyle = C.mouthOpen;
      g.fill();
    }

    /* یک چینِ نرم روی لب — مثل خط دهانِ بسته که با خوردن کمی پررنگ‌تر می‌شود */
    g.beginPath();
    g.moveTo(-depth * 0.85, 0);
    g.quadraticCurveTo(0, -halfW * 0.85, depth * 0.55, 0);
    g.quadraticCurveTo(0, halfW * 0.85, -depth * 0.85, 0);
    g.closePath();
    g.strokeStyle = C.mouthCrease;
    g.lineWidth = Math.max(0.6, R * 0.03);
    g.lineCap = "round";
    g.stroke();

    g.restore();
  }

  /* ── سر: فقط چشم و آبشش (بدون سبیلک) ── */
  drawHead(g) {
    const R = this.maxR;

    const t = 0.32;
    const px = this.jx[0] * (1 - t) + this.jx[1] * t;
    const py = this.jy[0] * (1 - t) + this.jy[1] * t;
    const pa = Math.atan2(this.jy[1] - this.jy[0], this.jx[1] - this.jx[0]);
    const nx = -Math.sin(pa), ny = Math.cos(pa);
    const rr = this.jr[0] * (1 - t) + this.jr[1] * t;
    const er = R * 0.15;

    for (let side = -1; side <= 1; side += 2) {
      const ex = px + nx * side * rr * 0.66;
      const ey = py + ny * side * rr * 0.66;

      g.beginPath();
      g.arc(ex, ey, er, 0, TAU);
      g.fillStyle = C.eyeRing;
      g.fill();
      g.beginPath();
      g.arc(ex, ey, er * 0.60, 0, TAU);
      g.fillStyle = C.eye;
      g.fill();
      g.beginPath();
      g.arc(ex - er * 0.26, ey - er * 0.26, er * 0.26, 0, TAU);
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.fill();
    }

    /* آبشش */
    const ga = this.ja[2];
    const gfx = Math.cos(ga), gfy = Math.sin(ga);
    const gnx = -Math.sin(ga), gny = Math.cos(ga);
    const gr = this.jr[2];
    g.strokeStyle = C.gill;
    g.lineWidth = Math.max(0.8, R * 0.05);
    g.lineCap = "round";
    for (let side = -1; side <= 1; side += 2) {
      g.beginPath();
      g.moveTo(this.jx[2] + gfx * gr * 0.55 + gnx * side * gr * 0.92,
               this.jy[2] + gfy * gr * 0.55 + gny * side * gr * 0.92);
      g.quadraticCurveTo(
        this.jx[2] + gnx * side * gr * 0.95,
        this.jy[2] + gny * side * gr * 0.95,
        this.jx[2] - gfx * gr * 0.48 + gnx * side * gr * 0.62,
        this.jy[2] - gfy * gr * 0.48 + gny * side * gr * 0.62);
      g.stroke();
    }
  }

  draw(g) {
    this.buildSil();
    const s = this.sil, n = this.silN;
    g.lineJoin = "round";

    /* سایه روی بستر */
    g.save();
    g.translate(5, 9);
    pathFrom(g, s, n);
    g.fillStyle = C.shadow;
    g.fill();
    g.restore();

    /* ۱) دم — پشت بدنه */
    this.drawTail(g);

    /* ۲) باله‌های کناری (۴ عدد) — زیر بدنه */
    this.drawSideFins(g);

    /* ۳) بدنه: زمینه + الگو + حجم */
    g.save();
    pathFrom(g, s, n);
    g.clip();

    g.fillStyle = C[this.baseKey];
    g.fill();

    this.drawPattern(g);

    /* سایهٔ لبه (حجم‌دهی) */
    pathFrom(g, s, n);
    g.strokeStyle = C.rimShade;
    g.lineWidth = this.maxR * 0.5;
    g.stroke();

    /* برجستگی ستون فقرات */
    g.beginPath();
    g.moveTo(this.jx[0], this.jy[0]);
    for (let i = 1; i < N; i++) g.lineTo(this.jx[i], this.jy[i]);
    g.lineCap = "round";
    g.strokeStyle = C.spineHi;
    g.lineWidth = this.maxR * 0.62;
    g.stroke();

    g.restore();

    /* ۳.۵) بالهٔ پشتی — نازک، روی ستون */
    this.drawDorsalFin(g);

    /* خط دور ظریف */
    pathFrom(g, s, n);
    g.strokeStyle = C.outline;
    g.lineWidth = Math.max(1, this.maxR * 0.055);
    g.stroke();

    /* ۴) دهان — جلوی سر */
    this.drawMouth(g);

    /* ۵) چشم و آبشش */
    this.drawHead(g);
  }
}

/* ═══════════════════════ والپیپر ═══════════════════════ */

export default {
  meta: {
    title: "حوض کوی",
    category: "nature",
    tags: ["canvas", "koi", "fish", "pond"],
    engine: "Canvas 2D",
    cost: "medium",
  },

  mount(container, ctx) {
    const cv = makeCanvas(container);
    const g = cv.getContext("2d");

    let W = 0, H = 0, DPR = 1;
    let running = false, raf = 0, last = 0, t = 0;
    let PAL = ctx.pal;

    let pondCv = null, blobCv = null;

    let fishes = [];
    let pads = [];
    let lotuses = [];
    let foods = [];
    let ripples = [];
    let blobs = [];

    let prevDown = false;
    let lastRX = -1e9, lastRY = -1e9;
    let autoRipple = 0.8;
    let ptr = { x: 0, y: 0, active: false, down: false };

    /* ---------- رنگ‌ها ---------- */
    function buildColors(pal) {
      const dark = !pal.light;
      C = {
        pondZero: rgba(pal.deep, 0),
        pondMid: rgba(pal.deep, dark ? 0.30 : 0.15),
        pondDeep: rgba(pal.deep, dark ? 0.62 : 0.36),
        dust: dark ? "#cfe8ff" : "#3a5a8a",
        vig0: rgba(pal.deep, 0),
        vig1: rgba(pal.deep, dark ? 0.46 : 0.24),
        blob: pal.cyn,
        pad: mix(pal.cyn, dark ? "#08251c" : "#1d5c3a", dark ? 0.62 : 0.35),
        padEdge: mix(pal.cyn, dark ? "#02110c" : "#0f3d26", dark ? 0.85 : 0.60),
        padVein: rgba(pal.deep, dark ? 0.45 : 0.28),
        petal: pal.ros,
        petalDeep: mix(pal.ros, pal.vio, 0.40),
        pollen: pal.amb,

        fin: dark ? "rgba(238,230,212,0.50)" : "rgba(255,250,238,0.60)",
        finEdge: rgba(pal.deep, dark ? 0.42 : 0.30),
        finRay: rgba(pal.deep, dark ? 0.20 : 0.14),
        outline: dark ? "rgba(20,24,36,0.55)" : "rgba(45,55,85,0.40)",
        rimShade: rgba(pal.deep, dark ? 0.20 : 0.13),
        spineHi: "rgba(255,255,255,0.16)",
        eye: "#171923",
        eyeRing: dark ? "#b98d3e" : "#caa14e",
        gill: rgba(pal.deep, dark ? 0.30 : 0.22),
        /* دهان: فقط یک درجه تیره‌تر از زمینهٔ بدن — مثل سایهٔ لب */
        mouth: dark ? "#d9cfb8" : "#e4dac2",
        mouthCrease: dark ? "rgba(80,60,45,0.42)" : "rgba(95,75,55,0.35)",
        mouthOpen: dark ? "#b8a68a" : "#c8b598",
        koiBase: dark ? "#efe7d2" : "#f6efdc",
        koiGold: dark ? "#e8cf96" : "#f2d9a0",
        koiRed: dark ? "#d64a2a" : "#dd4f2b",
        koiBlack: dark ? "#1d1f28" : "#232630",
        shadow: dark ? "rgba(2,6,16,0.32)" : "rgba(40,60,110,0.16)",
        food: pal.amb,
        foodGlow: rgba(pal.amb, 0.55),
        ripple: dark ? pal.cyn : pal.blu,
      };
    }

    function buildBlob() {
      const S = 192;
      if (!blobCv) {
        blobCv = document.createElement("canvas");
        blobCv.width = S; blobCv.height = S;
      }
      const b = blobCv.getContext("2d");
      b.clearRect(0, 0, S, S);
      const gr = b.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, rgba(C.blob, 0.85));
      gr.addColorStop(0.50, rgba(C.blob, 0.30));
      gr.addColorStop(1, rgba(C.blob, 0));
      b.fillStyle = gr;
      b.fillRect(0, 0, S, S);
    }

    /* ---------- حوض (یک‌بار) ---------- */
    function bakePond() {
      if (!W || !H) return;
      if (!pondCv) pondCv = document.createElement("canvas");
      const pw = Math.max(1, Math.round(W * DPR));
      const ph = Math.max(1, Math.round(H * DPR));
      if (pondCv.width !== pw) pondCv.width = pw;
      if (pondCv.height !== ph) pondCv.height = ph;

      const p = pondCv.getContext("2d");
      p.setTransform(DPR, 0, 0, DPR, 0, 0);
      p.clearRect(0, 0, W, H);

      p.fillStyle = PAL.bg;
      p.fillRect(0, 0, W, H);
      const grd = p.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, C.pondZero);
      grd.addColorStop(0.55, C.pondMid);
      grd.addColorStop(1, C.pondDeep);
      p.fillStyle = grd;
      p.fillRect(0, 0, W, H);

      const count = clamp(Math.round((W * H) / 8000), 40, 260);
      p.fillStyle = C.dust;
      for (let i = 0; i < count; i++) {
        p.globalAlpha = 0.10 + Math.random() * 0.30;
        p.beginPath();
        p.arc(Math.random() * W, Math.random() * H,
          0.35 + Math.random() * 1.6, 0, TAU);
        p.fill();
      }
      p.globalAlpha = 1;

      const vg = p.createRadialGradient(
        W / 2, H / 2, Math.min(W, H) * 0.22,
        W / 2, H / 2, Math.max(W, H) * 0.70
      );
      vg.addColorStop(0, C.vig0);
      vg.addColorStop(1, C.vig1);
      p.fillStyle = vg;
      p.fillRect(0, 0, W, H);
    }

    /* ---------- چیدمان ---------- */
    function buildDecor() {
      const area = W * H;

      const padCount = clamp(Math.round(area / 260000), 3, 7);
      pads = [];
      for (let i = 0; i < padCount; i++) {
        pads.push({
          x: 50 + Math.random() * Math.max(1, W - 100),
          y: 50 + Math.random() * Math.max(1, H - 100),
          r: clamp(Math.min(W, H) * (0.045 + Math.random() * 0.045), 22, 92),
          a: Math.random() * TAU,
          spin: (Math.random() - 0.5) * 0.07,
          ph: Math.random() * TAU,
          gap: 0.30 + Math.random() * 0.26,
          veins: 6 + ((Math.random() * 6) | 0),
        });
      }

      const loCount = clamp(Math.round(area / 700000), 1, 3);
      lotuses = [];
      for (let i = 0; i < loCount; i++) {
        lotuses.push({
          x: 70 + Math.random() * Math.max(1, W - 140),
          y: 70 + Math.random() * Math.max(1, H - 140),
          r: clamp(Math.min(W, H) * (0.035 + Math.random() * 0.025), 16, 54),
          a: Math.random() * TAU,
          ph: Math.random() * TAU,
          spin: (Math.random() - 0.5) * 0.05,
        });
      }

      blobs = [];
      for (let i = 0; i < 9; i++) {
        blobs.push({
          x: Math.random(), y: Math.random(),
          s: 0.18 + Math.random() * 0.30,
          ph: Math.random() * TAU,
          sp: 0.05 + Math.random() * 0.09,
        });
      }
    }

    function buildFish() {
      const area = W * H;
      const count = clamp(Math.round(area / 340000) + 3, 4, 8);
      const base = clamp(Math.min(W, H) * 0.025, 10, 24);
      fishes = [];
      for (let i = 0; i < count; i++) {
        fishes.push(new Fish(
          70 + Math.random() * Math.max(1, W - 140),
          70 + Math.random() * Math.max(1, H - 140),
          base * (0.76 + Math.random() * 0.48)
        ));
      }
    }

    function layout() {
      const f = fit2d(cv, g);
      W = f.w; H = f.h; DPR = f.dpr;
      bakePond();
      buildDecor();
      if (!fishes.length) buildFish();
    }

    /* ---------- رندر ---------- */
    function drawPad(g2, p2, tt) {
      const bob = Math.sin(tt * 0.5 + p2.ph) * 2.2;
      g2.save();
      g2.translate(p2.x + bob * 0.6, p2.y + bob);
      g2.rotate(p2.a + tt * p2.spin);

      g2.beginPath();
      g2.moveTo(0, 0);
      g2.arc(0, 0, p2.r, p2.gap, TAU - p2.gap);
      g2.closePath();
      g2.fillStyle = C.pad;
      g2.fill();

      g2.strokeStyle = C.padVein;
      g2.lineWidth = Math.max(0.8, p2.r * 0.045);
      const vn = Math.max(4, p2.veins);
      for (let i = 0; i < vn; i++) {
        const a = p2.gap + (TAU - 2 * p2.gap) * (i / (vn - 1));
        g2.beginPath();
        g2.moveTo(0, 0);
        g2.lineTo(Math.cos(a) * p2.r * 0.92, Math.sin(a) * p2.r * 0.92);
        g2.stroke();
      }

      g2.beginPath();
      g2.arc(0, 0, p2.r, p2.gap, TAU - p2.gap);
      g2.strokeStyle = C.padEdge;
      g2.lineWidth = Math.max(1.2, p2.r * 0.07);
      g2.stroke();

      g2.restore();
    }

    function petalPath(g2, a, len, w) {
      const dx = Math.cos(a), dy = Math.sin(a);
      const nx = -dy, ny = dx;
      const c1x = dx * len * 0.45 + nx * w;
      const c1y = dy * len * 0.45 + ny * w;
      const c2x = dx * len * 0.45 - nx * w;
      const c2y = dy * len * 0.45 - ny * w;
      g2.beginPath();
      g2.moveTo(0, 0);
      g2.quadraticCurveTo(c1x, c1y, dx * len, dy * len);
      g2.quadraticCurveTo(c2x, c2y, 0, 0);
      g2.closePath();
    }

    function drawLotus(g2, L, tt) {
      const bob = Math.sin(tt * 0.42 + L.ph) * 2.0;
      g2.save();
      g2.translate(L.x, L.y + bob);
      g2.rotate(L.a + tt * L.spin);

      for (let ring = 0; ring < 3; ring++) {
        const rr = L.r * (1 - ring * 0.26);
        const cnt = 8 - ring * 2;
        const off = ring * 0.36;
        g2.fillStyle = ring === 0 ? C.petal : C.petalDeep;
        for (let i = 0; i < cnt; i++) {
          petalPath(g2, off + TAU * i / cnt, rr, rr * 0.44);
          g2.fill();
        }
      }

      g2.beginPath();
      g2.arc(0, 0, L.r * 0.24, 0, TAU);
      g2.fillStyle = C.pollen;
      g2.fill();

      g2.restore();
    }

    /* ---------- گام ---------- */
    function step(dt) {
      ptr = localPointer(container, ctx.pointer);
      const pActive = ptr.active || ptr.down;

      if (ptr.down && !prevDown && foods.length < 8) {
        foods.push({ x: ptr.x, y: ptr.y, t: 0, life: 7 });
        ripples.push({ x: ptr.x, y: ptr.y, t: 0, life: 1.9 });
      }
      prevDown = ptr.down;

      if (pActive) {
        const dx = ptr.x - lastRX, dy = ptr.y - lastRY;
        if (dx * dx + dy * dy > 1600) {
          lastRX = ptr.x; lastRY = ptr.y;
          if (ripples.length < 26) {
            ripples.push({ x: ptr.x, y: ptr.y, t: 0, life: 1.9 });
          }
        }
      }

      autoRipple -= dt;
      if (autoRipple <= 0) {
        autoRipple = 1 + Math.random();
        if (ripples.length < 26) {
          ripples.push({
            x: 40 + Math.random() * Math.max(1, W - 80),
            y: 40 + Math.random() * Math.max(1, H - 80),
            t: 0, life: 1.9,
          });
        }
      }

      for (let i = 0; i < fishes.length; i++) {
        fishes[i].update(dt, W, H, ptr.x, ptr.y, pActive, foods, fishes, t);
      }

      for (let i = foods.length - 1; i >= 0; i--) {
        const f = foods[i];
        f.t += dt;
        if (f.t > f.life) { foods.splice(i, 1); continue; }
        for (let k = 0; k < fishes.length; k++) {
          const fi = fishes[k];
          const dx = fi.hx - f.x, dy = fi.hy - f.y;
          const rr = fi.maxR * 1.3 + 8;
          if (dx * dx + dy * dy < rr * rr) {
            foods.splice(i, 1);
            fi.boost = 0.85;
            if (ripples.length < 26) {
              ripples.push({ x: f.x, y: f.y, t: 0, life: 1.9 });
            }
            break;
          }
        }
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].t += dt;
        if (ripples[i].t > ripples[i].life) ripples.splice(i, 1);
      }
    }

    /* ---------- رندر فریم ---------- */
    function render(rm) {
      if (pondCv) g.drawImage(pondCv, 0, 0, W, H);
      else { g.clearRect(0, 0, W, H); }

      const mn = Math.min(W, H);
      g.globalAlpha = 0.055;
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        let bx = b.x * W, by = b.y * H;
        if (!rm) {
          bx += Math.cos(t * b.sp + b.ph) * W * 0.03;
          by += Math.sin(t * b.sp * 0.8 + b.ph) * H * 0.03;
        }
        const s = b.s * mn * 2.2;
        g.drawImage(blobCv, bx - s / 2, by - s / 2, s, s);
      }
      g.globalAlpha = 1;

      g.lineCap = "round";
      for (let i = 0; i < ripples.length; i++) {
        const r = ripples[i];
        const p = r.t / r.life;
        const rad = 8 + p * 88;
        const a = (1 - p) * (1 - p) * 0.42;
        g.globalAlpha = a;
        g.strokeStyle = C.ripple;
        g.lineWidth = 1.6;
        g.beginPath(); g.arc(r.x, r.y, rad, 0, TAU); g.stroke();
        g.globalAlpha = a * 0.55;
        g.lineWidth = 1.1;
        g.beginPath(); g.arc(r.x, r.y, rad * 0.62, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;

      for (let i = 0; i < foods.length; i++) {
        const f = foods[i];
        const pulse = 0.5 + 0.5 * Math.sin(f.t * 7);
        const fade = clamp((f.life - f.t) / 1.2, 0, 1);
        const rr = 3.0 + pulse * 1.6;
        g.globalAlpha = fade;
        g.fillStyle = C.food;
        g.beginPath(); g.arc(f.x, f.y, rr, 0, TAU); g.fill();
        g.globalAlpha = fade * 0.45;
        g.strokeStyle = C.foodGlow;
        g.lineWidth = 1.4;
        g.beginPath(); g.arc(f.x, f.y, rr * 2.6, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;

      for (let i = 0; i < fishes.length; i++) fishes[i].draw(g);

      for (let i = 0; i < pads.length; i++) drawPad(g, pads[i], t);
      for (let i = 0; i < lotuses.length; i++) drawLotus(g, lotuses[i], t);
    }

    /* ---------- حلقه ---------- */
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);

      let dt = (now - last) / 1000;
      last = now;
      if (!(dt > 0)) dt = 0.016;
      if (dt > 0.05) dt = 0.05;

      const rm = !!ctx.RM;
      dt *= rm ? 0.6 : 1;
      t += dt;

      step(dt);
      render(rm);
    }

    /* ---------- API ---------- */
    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function pal(newPal) {
      PAL = newPal;
      buildColors(newPal);
      buildBlob();
      bakePond();
    }

    function unmount() {
      stop();
      if (cleanupSize) cleanupSize();
      cv.remove();
    }

    /* ---------- راه‌اندازی ---------- */
    buildColors(PAL);
    buildBlob();
    const cleanupSize = watchSize(container, layout);
    layout();

    return { start, stop, resize: layout, pal, unmount };
  },
};