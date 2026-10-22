// Generates src/app/sketch-frames.css: hand-drawn outlines for the sketchbook look.
//
// Each frame is a small SVG drawn as an ink ribbon (a filled shape, so the line can
// thicken and thin like a pen), with gently bowed edges and one corner where the pen
// overshoots its starting point and lifts off. The CSS uses them as 9-slice masks
// (mask-border): the corners are drawn 1:1 and the edges stretch, so any box gets a
// smooth vector line at full resolution, coloured by CSS (the mask only carries shape).
//
//   node scripts/sketch-frames.mjs
//
// Per corner radius group it emits: --sk-fill-R (the inside, for the fill layer),
// --sk-l1/2/3-R (solid lines, light/regular/strong) and --sk-d1/2-R (dashed lines).

import { writeFileSync } from "node:fs";

const RADII = { sm: 10, md: 16, lg: 22, xl: 27 };
const WEIGHTS = { 1: 1.45, 2: 1.8, 3: 2.35 };
const DASH_WEIGHTS = { 1: 1.4, 2: 1.75 };

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const f = (n) => (Math.round(n * 10) / 10).toString();
// Compact numbers for relative path steps: "-0.4" -> "-.4".
const g = (n) => f(n).replace(/^(-?)0\./, "$1.");

/** A closed polygon as a compact path: rounded absolute points, written as relative
 * steps (which keeps the generated CSS small). */
function path(points) {
  let px = Math.round(points[0][0] * 10) / 10;
  let py = Math.round(points[0][1] * 10) / 10;
  let d = `M${f(px)} ${f(py)}l`;
  const steps = [];
  for (const [x, y] of points.slice(1)) {
    const rx = Math.round(x * 10) / 10;
    const ry = Math.round(y * 10) / 10;
    const dx = g(rx - px);
    const dy = g(ry - py);
    steps.push(dy.startsWith("-") ? `${dx}${dy}` : `${dx} ${dy}`);
    px = rx;
    py = ry;
  }
  return d + steps.join(" ").replace(/ -/g, "-") + "z";
}

/** Points along a rounded rectangle (clockwise from a point on the top edge), with
 * cumulative arc length. */
function roundedRect(x0, y0, x1, y1, r, step, startX) {
  const segs = [];
  const line = (ax, ay, bx, by) => segs.push({ kind: "line", ax, ay, bx, by, len: Math.hypot(bx - ax, by - ay) });
  const arc = (cx, cy, a0) => segs.push({ kind: "arc", cx, cy, a0, len: (Math.PI / 2) * r });
  line(startX, y0, x1 - r, y0);
  arc(x1 - r, y0 + r, -Math.PI / 2);
  line(x1, y0 + r, x1, y1 - r);
  arc(x1 - r, y1 - r, 0);
  line(x1 - r, y1, x0 + r, y1);
  arc(x0 + r, y1 - r, Math.PI / 2);
  line(x0, y1 - r, x0, y0 + r);
  arc(x0 + r, y0 + r, Math.PI);
  line(x0 + r, y0, startX, y0);
  const total = segs.reduce((n, s) => n + s.len, 0);
  const at = (t) => {
    // t in [0, total) wraps; returns point and unit tangent.
    let d = ((t % total) + total) % total;
    for (const s of segs) {
      if (d <= s.len) {
        if (s.kind === "line") {
          const u = s.len ? d / s.len : 0;
          return { x: s.ax + (s.bx - s.ax) * u, y: s.ay + (s.by - s.ay) * u, tx: (s.bx - s.ax) / s.len, ty: (s.by - s.ay) / s.len };
        }
        const a = s.a0 + d / r;
        return { x: s.cx + r * Math.cos(a), y: s.cy + r * Math.sin(a), tx: -Math.sin(a), ty: Math.cos(a) };
      }
      d -= s.len;
    }
    return at(0);
  };
  return { total, at, step };
}

/** A ribbon (filled outline) following centre points with per-point widths. */
function ribbon(pts) {
  const left = [];
  const right = [];
  for (const p of pts) {
    const nx = -p.ty;
    const ny = p.tx;
    left.push([p.x + (nx * p.w) / 2, p.y + (ny * p.w) / 2]);
    right.push([p.x - (nx * p.w) / 2, p.y - (ny * p.w) / 2]);
  }
  const all = [...left, ...right.reverse()];
  return path(all);
}

function frame(r, seed) {
  const c = r + 5; // slice: the corner region drawn 1:1
  const m = 14; // the middle of each edge, stretched to fit
  const W = 2 * c + m;
  const d = 2.4; // keep the widest line inside the box
  const rr = r - 1;
  const rect = roundedRect(d, d, W - d, W - d, rr, 1, d + rr);
  const R = rng(seed);
  const ph = [R(), R(), R(), R()].map((v) => v * Math.PI * 2);
  const L = rect.total;
  const arcLen = (Math.PI / 2) * rr;
  // The line wanders off the true shape in eight runs, split at the 9-slice seams: each
  // corner and each edge middle gets one smooth bulge (sin², so it starts and ends flat
  // on the true line). However much a box stretches or squeezes the edge middles, the
  // runs still meet cleanly. (+ is inward.)
  const side = W - 2 * d - 2 * rr; // straight length of each side
  const a = c - d - rr; // from the end of a corner's arc to its seam
  const runs = [];
  for (let k = 0; k < 4; k++) {
    const base = k * (side + arcLen);
    // Edge middles: a whisker of bow only. A box barely taller than its two corners
    // squeezes this run into a pixel or so, where a bigger bow would poke out as a spike.
    runs.push({ from: base + a, to: base + side - a, amp: (R() < 0.5 ? -1 : 1) * 0.3 });
    // Corners carry the character: each swings a little wide or tight.
    runs.push({ from: base + side - a, to: base + side + arcLen + a, amp: (R() < 0.5 ? -1 : 1) * (0.55 + 0.5 * R()) });
  }
  const off = (t) => {
    const tt = ((t % L) + L) % L;
    for (const r of runs) {
      for (const shift of [0, -L]) {
        const x = tt + shift;
        if (x >= r.from && x <= r.to) return r.amp * Math.sin((Math.PI * (x - r.from)) / (r.to - r.from)) ** 2;
      }
      if (tt + L >= r.from && tt + L <= r.to) return r.amp * Math.sin((Math.PI * (tt + L - r.from)) / (r.to - r.from)) ** 2;
    }
    return 0;
  };
  // The pen starts halfway round the top-left corner and runs on past its start (still
  // inside the corner's slice), then lifts.
  const t0 = L - arcLen / 2;
  const over = arcLen / 2 + a - 0.6;
  const centre = (t, extra = 0) => {
    const p = rect.at(t);
    const o = off(t) + extra;
    return { x: p.x - p.ty * o, y: p.y + p.tx * o, tx: p.tx, ty: p.ty };
  };
  const fillPts = [];
  for (let t = 0; t < L; t += 1.4) fillPts.push(centre(t));
  const fill = path(fillPts.map((p) => [p.x, p.y]));

  const line = (bw) => {
    const pts = [];
    for (let s = 0; s <= L + over; s += 1.1) {
      const t = t0 + s;
      const u = s > L ? (s - L) / over : 0;
      // The overshoot drifts a hair inside the first pass and thins to a point.
      const p = centre(t, u * 0.8);
      const swell = 1 + 0.2 * Math.sin((2 * Math.PI * s) / L * 3 + ph[2]);
      const start = Math.min(1, 0.4 + s / 5);
      const end = u > 0.3 ? Math.max(0.1, 1 - (u - 0.3) / 0.7) : 1;
      pts.push({ ...p, w: bw * swell * start * end });
    }
    // A faint second pass around the bottom-right corner, just outside the line, like
    // a pencil going over its own mark.
    const echo = [];
    const straight = c - d - rr; // the bit of edge inside the corner's slice
    const br = L / 2 - straight * 0.7; // starts just before the corner's arc
    const span = arcLen + straight * 1.4;
    for (let s = 0; s <= span; s += 1.1) {
      const u = s / span;
      const p = centre(br + s, -1.25);
      echo.push({ ...p, w: bw * 0.55 * Math.sin(Math.PI * u) + 0.05 });
    }
    return ribbon(pts) + "' /><path fill-opacity='0.4' d='" + ribbon(echo);
  };

  // Dashed: the middle slices tile (repeat: round), so each holds exactly one dash and
  // the edges stay straight there; the corners carry their own evenly spaced dashes.
  const period = m;
  const dashed = (bw) => {
    const dashes = [];
    const straight = (t) => {
      const p = rect.at(t);
      return { x: p.x, y: p.y, tx: p.tx, ty: p.ty };
    };
    // Arc-length positions of the middle slices' centres on each edge.
    const mids = [];
    for (let t = 0; t < L; t += 0.5) {
      const p = rect.at(t);
      const onTop = Math.abs(p.y - d) < 0.01 && Math.abs(p.x - W / 2) < 0.26;
      const onRight = Math.abs(p.x - (W - d)) < 0.01 && Math.abs(p.y - W / 2) < 0.26;
      const onBottom = Math.abs(p.y - (W - d)) < 0.01 && Math.abs(p.x - W / 2) < 0.26;
      const onLeft = Math.abs(p.x - d) < 0.01 && Math.abs(p.y - W / 2) < 0.26;
      if ((onTop || onRight || onBottom || onLeft) && (!mids.length || t - mids[mids.length - 1] > 5)) mids.push(t);
    }
    const dashLen = period * 0.55;
    for (let i = 0; i < mids.length; i++) {
      const a = mids[i];
      const b = i + 1 < mids.length ? mids[i + 1] : mids[0] + L;
      // One dash centred in this middle slice.
      dashes.push([a - dashLen / 2, a + dashLen / 2]);
      // The corner run between this middle slice and the next.
      const from = a + period / 2;
      const to = b - period / 2;
      const k = Math.max(1, Math.round((to - from) / period));
      const p = (to - from) / k;
      for (let j = 0; j < k; j++) {
        const cMid = from + p * (j + 0.5);
        dashes.push([cMid - (p * 0.55) / 2, cMid + (p * 0.55) / 2]);
      }
    }
    return dashes
      .map(([s, e]) => {
        const pts = [];
        for (let t = s; t <= e + 0.01; t += 0.8) {
          const u = (t - s) / (e - s);
          pts.push({ ...straight(t), w: bw * (0.75 + 0.25 * Math.sin(Math.PI * u)) });
        }
        return ribbon(pts);
      })
      .join("");
  };

  return { W, c, fill, line, dashed };
}

const svg = (W, d) => `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${W}' viewBox='0 0 ${W} ${W}'><path d='${d}'/></svg>`;
const url = (s) => `url("data:image/svg+xml,${s.replace(/#/g, "%23").replace(/"/g, "'").replace(/</g, "%3C").replace(/>/g, "%3E")}")`;

let css = `/* Generated by scripts/sketch-frames.mjs. Do not edit by hand. */\n:root {\n`;
let seed = 11;
for (const [name, r] of Object.entries(RADII)) {
  const fr = frame(r, seed++);
  const box = (d, repeat) => `${url(svg(fr.W, d))} ${fr.c} / ${fr.c}px ${repeat}`;
  css += `  --sk-fill-${name}: ${box(fr.fill, "stretch")};\n`;
  for (const [k, w] of Object.entries(WEIGHTS)) css += `  --sk-l${k}-${name}: ${box(fr.line(w), "stretch")};\n`;
  for (const [k, w] of Object.entries(DASH_WEIGHTS)) css += `  --sk-d${k}-${name}: ${box(fr.dashed(w), "round")};\n`;
}
css += "}\n";
writeFileSync(new URL("../src/app/sketch-frames.css", import.meta.url), css);
console.log("wrote sketch-frames.css", (css.length / 1024).toFixed(1) + " KB");
