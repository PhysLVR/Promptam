/* ═══════════ Wallpaper Canvas Helpers ═══════════
   ابزار مشترک والپیپرهای زنده. بدون وابستگی خارجی. */

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const wrapAng = (a) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};

/* ── تبدیل رنگ CSS به [r,g,b] ── */
let _probe = null;
function _p() {
  if (_probe) return _probe;
  _probe = document.createElement("i");
  _probe.style.cssText = "display:none;position:absolute;pointer-events:none";
  document.body.appendChild(_probe);
  return _probe;
}
export function toRgb(c) {
  if (!c) return [128, 128, 128];
  const p = _p();
  p.style.color = "#000";
  p.style.color = c;
  const m = getComputedStyle(p).color.match(/[\d.]+/g);
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
}
export function rgba(c, a) {
  const [r, g, b] = toRgb(c);
  return `rgba(${r},${g},${b},${a})`;
}

/* ── Canvas setup ── */
export function makeCanvas(container) {
  const cv = document.createElement("canvas");
  cv.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
  container.appendChild(cv);
  return cv;
}

export function fit2d(cv, g, dprCap = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const w = Math.max(1, cv.parentElement.clientWidth);
  const h = Math.max(1, cv.parentElement.clientHeight);
  const W = Math.round(w * dpr),
    H = Math.round(h * dpr);
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  if (g) g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, dpr };
}

/* دِبونس‌شده برای جلوگیری از rebuild پشت‌سرهم */
export function watchSize(el, cb) {
  let t = 0;
  const fire = () => {
    clearTimeout(t);
    t = setTimeout(cb, 120);
  };
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(fire);
    ro.observe(el);
    return () => ro.disconnect();
  }
  window.addEventListener("resize", fire);
  return () => window.removeEventListener("resize", fire);
}

/* ── Pointer محلی از ctx.pointer (engine روی window گوش می‌ده) ── */
export function localPointer(container, ep) {
  if (!ep || !ep.inside) return { x: 0, y: 0, active: false, down: false };
  const r = container.getBoundingClientRect();
  return {
    x: ep.x - r.left,
    y: ep.y - r.top,
    active: true,
    down: !!ep.down,
  };
}