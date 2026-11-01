// Geometry for the 18 holes. Each hole lives in one cell of a 5 x 4 grid on the course map;
// the two middle cells hold the clubhouse and the lake. The same spec draws the hole small on
// the map and large in the hole view, so the two always match.

export const MAP_W = 520;
export const MAP_H = 700;
const COLS = 4;
const ROWS = 5;
const ORIGIN = 10;
const CELL_W = (MAP_W - 2 * ORIGIN) / COLS;
const CELL_H = (MAP_H - 2 * ORIGIN) / ROWS;
const MARGIN = 16;

export const cellCenter = (c, r) => [ORIGIN + CELL_W * c + CELL_W / 2, ORIGIN + CELL_H * r + CELL_H / 2];
export const CLUBHOUSE_AT = cellCenter(1, 2);
export const LAKE_AT = cellCenter(2, 2);
/** The middle band (clubhouse and lake cells) where no trees grow. */
export const CENTRE_BOX = { x0: ORIGIN + CELL_W, x1: ORIGIN + CELL_W * 3, y0: ORIGIN + CELL_H * 2, y1: ORIGIN + CELL_H * 3 };

// cell, par, angle (degrees, screen space: 0 points right, -90 up), dogleg side,
// bunkers [t along hole, side], water { t, side } (side 0 = carry across the line).
// Front nine loops the left half, back nine the right, both finishing by the clubhouse.
export const HOLES = [
  { cell: [1, 3], par: 4, a: -60,  dog: 0,  bunkers: [[0.55, -1], [0.95, 1]] },
  { cell: [1, 4], par: 5, a: 140,  dog: -1, bunkers: [[0.62, 1], [0.95, -1]] },
  { cell: [0, 4], par: 3, a: -95,  dog: 0,  bunkers: [[0.95, 1]], water: { t: 0.45, side: 0 } },
  { cell: [0, 3], par: 4, a: -105, dog: 1,  bunkers: [[0.95, -1]] },
  { cell: [0, 2], par: 4, a: -70,  dog: 0,  bunkers: [[0.6, 1], [0.95, 1]] },
  { cell: [0, 1], par: 3, a: -115, dog: 0,  bunkers: [[0.95, -1], [0.95, 1]] },
  { cell: [0, 0], par: 5, a: -40,  dog: 1,  bunkers: [[0.45, -1], [0.95, 1]] },
  { cell: [1, 0], par: 4, a: 75,   dog: 0,  bunkers: [[0.95, 1]], water: { t: 0.6, side: -1 } },
  { cell: [1, 1], par: 4, a: 105,  dog: -1, bunkers: [[0.7, 1], [0.95, -1]] },
  { cell: [2, 1], par: 4, a: -75,  dog: 0,  bunkers: [[0.5, 1], [0.95, -1]] },
  { cell: [2, 0], par: 4, a: 20,   dog: 1,  bunkers: [[0.95, 1]] },
  { cell: [3, 0], par: 3, a: 95,   dog: 0,  bunkers: [[0.95, -1]], water: { t: 0.5, side: 0 } },
  { cell: [3, 1], par: 5, a: 130,  dog: 1,  bunkers: [[0.4, 1], [0.7, -1], [0.95, 1]] },
  { cell: [3, 2], par: 4, a: 75,   dog: -1, bunkers: [[0.95, 1]], water: { t: 0.55, side: 1 } },
  { cell: [3, 3], par: 4, a: 105,  dog: 1,  bunkers: [[0.6, -1], [0.95, -1]] },
  { cell: [3, 4], par: 3, a: 165,  dog: 0,  bunkers: [[0.95, 1], [0.95, -1]] },
  { cell: [2, 4], par: 5, a: -130, dog: -1, bunkers: [[0.5, 1], [0.95, 1]], water: { t: 0.75, side: -1 } },
  { cell: [2, 3], par: 4, a: -100, dog: 1,  bunkers: [[0.95, -1], [0.95, 1]] },
];

export const PAR_TOTAL = HOLES.reduce((n, h) => n + h.par, 0);
// Rough yardages from par, for flavour only.
export const yards = (i) => [0, 0, 0, 165, 390, 520][HOLES[i].par] + ((i * 37) % 40);

const LEN = { 3: 74, 4: 108, 5: 140 };

function fitLength(par, a) {
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const maxW = CELL_W - 2 * MARGIN;
  const maxH = CELL_H - 2 * MARGIN;
  return Math.min(LEN[par], c > 1e-3 ? maxW / c : Infinity, s > 1e-3 ? maxH / s : Infinity);
}

/**
 * Key points for hole i in map space: tee, control, green, plus `u`, the size of one
 * "hole unit" (fairway width is 15u). `frame` 'map' or 'detail'.
 */
export function holeFrame(i, frame = 'map') {
  const h = HOLES[i];
  const a = (h.a * Math.PI) / 180;
  if (frame === 'map') {
    const [cx, cy] = cellCenter(...h.cell);
    const L = fitLength(h.par, a);
    const d = [Math.cos(a), Math.sin(a)];
    const n = [-d[1], d[0]];
    const tee = [cx - (d[0] * L) / 2, cy - (d[1] * L) / 2];
    const green = [cx + (d[0] * L) / 2, cy + (d[1] * L) / 2];
    const ctrl = [cx + n[0] * h.dog * 0.28 * L, cy + n[1] * h.dog * 0.28 * L];
    return { tee, ctrl, green, u: 1, L };
  }
  // Detail: tee at the bottom, green at the top, longer holes take more of the height.
  const L = { 3: 300, 4: 400, 5: 450 }[h.par];
  const tee = [180, 520];
  const green = [180, 520 - L];
  const ctrl = [180 + h.dog * 0.28 * L, 520 - L / 2];
  return { tee, ctrl, green, u: L / fitLength(h.par, a), L };
}

export function bez(f, t) {
  const m = 1 - t;
  return [
    m * m * f.tee[0] + 2 * m * t * f.ctrl[0] + t * t * f.green[0],
    m * m * f.tee[1] + 2 * m * t * f.ctrl[1] + t * t * f.green[1],
  ];
}

/** Unit normal of the curve at t (left of travel direction is negative side). */
export function normalAt(f, t) {
  const m = 1 - t;
  const dx = 2 * m * (f.ctrl[0] - f.tee[0]) + 2 * t * (f.green[0] - f.ctrl[0]);
  const dy = 2 * m * (f.ctrl[1] - f.tee[1]) + 2 * t * (f.green[1] - f.ctrl[1]);
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

export const SIZE = { fairway: 17, green: 8.5, bunker: 4.6, tee: 5.5, water: 9.5 };

/** Where the features of hole i sit, in the given frame. */
export function holeLayout(i, frame = 'map') {
  const h = HOLES[i];
  const f = holeFrame(i, frame);
  const u = f.u;
  const fw = SIZE.fairway * u;
  const gr = SIZE.green * u;
  const br = SIZE.bunker * u;
  const bunkers = h.bunkers.map(([t, side]) => {
    if (t >= 0.9) {
      const n = normalAt(f, 1);
      return { x: f.green[0] + n[0] * side * (gr + br * 0.7), y: f.green[1] + n[1] * side * (gr + br * 0.7), r: br };
    }
    const p = bez(f, t);
    const n = normalAt(f, t);
    return { x: p[0] + n[0] * side * (fw / 2 + br * 0.4), y: p[1] + n[1] * side * (fw / 2 + br * 0.4), r: br };
  });
  let water = null;
  if (h.water) {
    const p = bez(f, h.water.t);
    const n = normalAt(f, h.water.t);
    const r = SIZE.water * u * (h.water.side === 0 ? 1.1 : 1);
    const off = h.water.side === 0 ? 0 : fw / 2 + r * 0.75;
    water = { x: p[0] + n[0] * h.water.side * off, y: p[1] + n[1] * h.water.side * off, r, carry: h.water.side === 0 };
  }
  return { f, u, fw, gr, bunkers, water };
}

/** Deterministic random numbers so the course looks the same every render. */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Wobbly closed blob around a point, like a cut-out shape. */
export function blob(x, y, r, seed, wobble = 0.18, n = 9, squash = 1) {
  const rand = rng(seed);
  const pts = Array.from({ length: n }, (_, k) => {
    const ang = (k / n) * Math.PI * 2;
    const rr = r * (1 - wobble / 2 + rand() * wobble);
    return [x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * squash];
  });
  // Smooth through midpoints with quadratic curves.
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let d = `M${mid(pts[n - 1], pts[0]).map((v) => v.toFixed(1)).join(' ')}`;
  for (let k = 0; k < n; k++) {
    const p = pts[k];
    const m = mid(p, pts[(k + 1) % n]);
    d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

/** Quadratic bezier path string for the hole line. */
export const holePath = (f) =>
  `M${f.tee[0].toFixed(1)} ${f.tee[1].toFixed(1)} Q${f.ctrl[0].toFixed(1)} ${f.ctrl[1].toFixed(1)} ${f.green[0].toFixed(1)} ${f.green[1].toFixed(1)}`;

/** Mix two hex colours. */
export function mix(a, b, t) {
  const pa = [1, 3, 5].map((k) => parseInt(a.slice(k, k + 2), 16));
  const pb = [1, 3, 5].map((k) => parseInt(b.slice(k, k + 2), 16));
  const c = pa.map((v, k) => Math.round(v + (pb[k] - v) * Math.max(0, Math.min(1, t))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Where the mown fairway starts and ends along the hole. Par 3s only get a short apron. */
export const fairwaySpan = (i) => (HOLES[i].par === 3 ? [0.62, 0.93] : [0.2, 0.93]);

/**
 * Closed outline of the fairway: narrow off the tee, widest in the landing zone,
 * pinching in before the green.
 */
export function fairwayOutline(i, frame = 'map') {
  const { f, fw } = holeLayout(i, frame);
  const [t0, t1] = fairwaySpan(i);
  const rand = rng(600 + i);
  const N = 14;
  const left = [];
  const right = [];
  for (let k = 0; k <= N; k++) {
    const s = k / N;
    const t = t0 + (t1 - t0) * s;
    const p = bez(f, t);
    const n = normalAt(f, t);
    const prof = 0.72 + 0.42 * Math.sin(Math.PI * Math.min(1, s * 1.15)) ** 0.7;
    const wl = (fw / 2) * prof * (0.94 + rand() * 0.12);
    const wr = (fw / 2) * prof * (0.94 + rand() * 0.12);
    left.push([p[0] + n[0] * wl, p[1] + n[1] * wl]);
    right.push([p[0] - n[0] * wr, p[1] - n[1] * wr]);
  }
  // Round the two ends with a point just beyond each.
  const cap = (t, sign) => {
    const p = bez(f, t);
    const q = bez(f, t + sign * 0.01);
    const d = [q[0] - p[0], q[1] - p[1]];
    const len = Math.hypot(d[0], d[1]) || 1;
    return [p[0] + (d[0] / len) * fw * 0.32, p[1] + (d[1] / len) * fw * 0.32];
  };
  const pts = [...left, cap(t1, 1), ...right.reverse(), cap(t0, -1)];
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${mid(pts[n - 1], pts[0]).map((v) => v.toFixed(1)).join(' ')}`;
  for (let k = 0; k < n; k++) {
    const m = mid(pts[k], pts[(k + 1) % n]);
    d += ` Q${pts[k][0].toFixed(1)} ${pts[k][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return `${d} Z`;
}
