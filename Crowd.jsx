// Golfers, carts and the entrance strip. Everything here scales from popularity and the
// amenities, so the same numbers draw the same busy (or empty) course on a friend's phone.
// Same cut-paper rules as Course.jsx: ink outlines, flat fills, hard offset shadows.
import { useMemo } from 'react';
import { MAP_W, MAP_H, holeLayout, bez, normalAt, fairwaySpan, rng, blob, mix } from '../lib/holes.js';
import { crowd, TIERS, cartsOwned } from '../lib/game.js';

const INK = '#161616';
export const BAND_H = 128;
const SHIRTS = ['#EF4F3A', '#3B5FD0', '#FFD23F', '#FFFFFF', '#2F9E44', '#F58FB0', '#A9C3FF', '#FF8A3D'];
const PANTS = ['#161616', '#E6D3B3', '#3B5FD0', '#FFFFFF', '#8A5528'];
const SKIN = ['#F3CFA6', '#D9A174', '#A86E44', '#F7DCC0'];
const pick = (r, a) => a[Math.floor(r() * a.length)];
const f1 = (v) => Math.round(v * 10) / 10;

export function Golfer({ x, y, look, s = 0.9, club = true }) {
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${s})`} stroke={INK} strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round">
      <rect x="-2.6" y="-5" width="5.2" height="5" fill={look.p} />
      <rect x="-3.4" y="-11" width="6.8" height="6.8" rx="2" fill={look.s} />
      <circle cx="0" cy="-13.8" r="2.7" fill={look.k} />
      <path d="M-3 -14.6 q3 -3.6 6 0 Z" fill={look.c} />
      {club && <path d="M3 -7 L6.5 -0.5" strokeWidth="1" />}
    </g>
  );
}

export function MiniCart({ x, y, canopy = '#2F9E44', s = 0.55 }) {
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${s})`} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <rect x="-13" y="-12" width="26" height="9" rx="2" fill="#FFFFFF" />
      <path d="M-11 -12 V-24 M9 -12 V-24" />
      <rect x="-14" y="-27" width="28" height="4" rx="1.5" fill={canopy} />
      <rect x="4" y="-11" width="6" height="5" fill="#A9C3FF" strokeWidth="1.2" />
      <circle cx="-8" cy="-2" r="3.4" fill={INK} />
      <circle cx="8" cy="-2" r="3.4" fill={INK} />
    </g>
  );
}

function Car({ x, y, col }) {
  return (
    <g stroke={INK} strokeWidth="1.2" strokeLinejoin="round">
      <path d={`M${x - 9} ${y - 2} v-4 q0 -2 2 -2 h3 l3 -4 h7 l3 4 h1 q2 0 2 2 v4 Z`} fill={col} />
      <path d={`M${x - 3} ${y - 8} l2.4 -3 h3.2 v3 Z`} fill="#A9C3FF" strokeWidth="0.8" />
      <circle cx={x - 5} cy={y - 1.5} r="2" fill={INK} />
      <circle cx={x + 6} cy={y - 1.5} r="2" fill={INK} />
    </g>
  );
}

const look = (r) => ({ s: pick(r, SHIRTS), p: pick(r, PANTS), k: pick(r, SKIN), c: pick(r, SHIRTS) });

// Spots for up to 22 groups and 12 carts, fixed per map so they don't jump between renders.
// Filled in order, and the order spreads across holes, so a quiet course has a group here and
// there and a busy one has every hole in play.
let spots;
function getSpots() {
  if (spots) return spots;
  const r = rng(4711);
  const groups = [];
  for (let k = 0; k < 22; k++) {
    const i = (k * 7 + 3) % 18;
    const { f, fw, gr } = holeLayout(i, 'map');
    const [s0, s1] = fairwaySpan(i);
    const n = 2 + Math.floor(r() * 3);
    const where = r();
    let x;
    let y;
    if (where < 0.22) { x = f.green[0] - gr * 0.2; y = f.green[1] + gr * 0.55; }
    else if (where < 0.32) { const q = normalAt(f, 0); x = f.tee[0] - q[0] * 9; y = f.tee[1] - q[1] * 9 + 3; }
    else {
      const t = s0 + 0.08 + r() * Math.max(0.05, s1 - s0 - 0.16);
      const p = bez(f, t);
      const q = normalAt(f, t);
      const o = (r() - 0.5) * fw * 0.35;
      x = p[0] + q[0] * o; y = p[1] + q[1] * o + 4;
    }
    groups.push({ x: x - n * 2.5, y, n, looks: Array.from({ length: n }, () => look(r)), hole: i });
  }
  const carts = [];
  for (let k = 0; k < 12; k++) {
    const i = (k * 5 + 1) % 18;
    const { f, fw } = holeLayout(i, 'map');
    const [s0, s1] = fairwaySpan(i);
    const t = s0 + 0.1 + r() * Math.max(0.05, s1 - s0 - 0.2);
    const p = bez(f, t);
    const q = normalAt(f, t);
    const sd = r() < 0.5 ? -1 : 1;
    carts.push({ x: p[0] + q[0] * sd * (fw * 0.5 + 8), y: p[1] + q[1] * sd * (fw * 0.5 + 8) + 3, d: 4 + r() * 4 });
  }
  spots = { groups, carts };
  return spots;
}

/** Golfers and carts out on the 18 holes, plus the grandstand at Championship. */
export function CourseCrowd({ pop = 0, amen = {}, tier = 0, sh }) {
  const sp = useMemo(getSpots, []);
  const c = crowd(pop, amen);
  const canopy = tier >= 3 ? '#161616' : '#2F9E44';
  return (
    <g className="crowd">
      <g filter={sh}>
        {sp.carts.slice(0, c.cartsOut).map((p, k) => (
          <g key={k} className="drive" style={{ animationDuration: `${p.d}s`, animationDelay: `${-k * 0.7}s` }}>
            <MiniCart x={p.x} y={p.y} canopy={canopy} />
          </g>
        ))}
        {sp.groups.slice(0, c.groups).map((g, k) => (
          <g key={k}>
            {g.looks.map((lk, m) => <Golfer key={m} x={g.x + m * 5} y={g.y + (m % 2) * 1.5} look={lk} />)}
          </g>
        ))}
      </g>
      {tier >= 4 && <Grandstand sh={sh} />}
    </g>
  );
}

/** Where the Championship grandstand goes: right of the 18th green. Trees keep clear of it. */
export function standSpot() {
  const g = holeLayout(17, 'map').f.green;
  const sx = g[0] + 44;
  const sy = g[1] + 16;
  return { sx, sy, box: { x0: sx - 26, x1: sx + 26, y0: sy - 40, y1: sy + 8 } };
}

/** Stand and gallery around the 18th green, and a leaderboard. Championship only. */
function Grandstand({ sh }) {
  const els = useMemo(() => {
    const { f, gr } = holeLayout(17, 'map');
    const g = f.green;
    const r = rng(55);
    const { sx, sy } = standSpot();
    const seats = [];
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 7; k++) seats.push({ x: sx - 16 + k * 5.5 + row * 1.5, y: sy - 2 - k * 2.3 - row * 5, look: look(r) });
    }
    const ring = [];
    for (let k = 0; k < 16; k++) {
      const a = Math.PI * (-0.45 + (k / 15) * 1.05);
      ring.push({ x: g[0] + Math.cos(a) * (gr + 11), y: g[1] + Math.sin(a) * (gr + 7) + 5, look: look(r) });
    }
    return { sx, sy, seats, ring };
  }, []);
  const { sx, sy } = els;
  return (
    <g filter={sh}>
      <g stroke={INK} strokeWidth="1.6" strokeLinejoin="round">
        <path d={`M${sx - 20} ${sy} L${sx - 20} ${sy - 6} L${sx + 20} ${sy - 22} L${sx + 20} ${sy} Z`} fill="#E6D3B3" />
        <path d={`M${sx - 20} ${sy - 6} L${sx + 20} ${sy - 22}`} fill="none" />
      </g>
      {els.seats.map((p, k) => <Golfer key={k} x={p.x} y={p.y + 4} look={p.look} s={0.55} club={false} />)}
      {els.ring.map((p, k) => <Golfer key={`r${k}`} x={p.x} y={p.y} look={p.look} s={0.6} club={false} />)}
    </g>
  );
}

// ---------- entrance strip ----------

const Y0 = MAP_H;
const ROAD_Y = Y0 + 12;

function Range({ lv, people, sh }) {
  const r = useMemo(() => rng(31), []);
  if (lv === 0) {
    const tufts = Array.from({ length: 9 }, (_, k) => [24 + ((k * 53) % 150), Y0 + 34 + ((k * 29) % 56)]);
    return (
      <g>
        <path d={blob(98, Y0 + 62, 78, 61, 0.2, 11, 0.42)} fill="#9DA45A" stroke={INK} strokeWidth="2" strokeDasharray="5 4" />
        {tufts.map(([x, y], k) => <path key={k} d={`M${x - 2.2} ${y} l1.1 -4.4 l1.1 2.6 l1.1 -4.8 l1.1 6.6Z`} fill="#8A9A3A" stroke={INK} strokeWidth="0.8" />)}
      </g>
    );
  }
  const bays = [0, 3, 6, 9][lv];
  const balls = Array.from({ length: lv * 7 }, () => [36 + r() * 124, Y0 + 30 + r() * 34]);
  return (
    <g>
      <path d={blob(98, Y0 + 56, 86, 61, 0.12, 12, 0.4)} fill={lv >= 2 ? '#86C86A' : '#9DBA5E'} stroke={INK} strokeWidth="2" />
      {lv >= 2 && [0, 1, 2].map((k) => <path key={k} d={`M${28 + k * 10} ${Y0 + 66 - k * 13} h${140 - k * 20}`} stroke="#FFF" strokeWidth="1" opacity="0.7" strokeDasharray="3 4" />)}
      {lv >= 3 && [[62, Y0 + 40, 9], [112, Y0 + 32, 11], [150, Y0 + 44, 8]].map(([x, y, rr], k) => (
        <g key={k}>
          <path d={blob(x, y, rr, 900 + k, 0.15, 9, 0.6)} fill="#A6E07A" stroke={INK} strokeWidth="1.4" />
          <path d={`M${x} ${y} v-10`} stroke={INK} strokeWidth="1.1" />
          <path d={`M${x} ${y - 10} l5 1.8 l-5 1.8 Z`} fill={['#EF4F3A', '#FFD23F', '#3B5FD0'][k]} stroke={INK} strokeWidth="0.7" />
        </g>
      ))}
      {lv === 1 && <path d={`M30 ${Y0 + 76} V${Y0 + 34} H166 V${Y0 + 76}`} fill="none" stroke={INK} strokeWidth="1.4" strokeDasharray="1.5 2.5" />}
      {balls.map(([x, y], k) => <circle key={k} cx={f1(x)} cy={f1(y)} r="1.3" fill="#FFF" stroke={INK} strokeWidth="0.5" />)}
      {lv >= 3 && <rect x="24" y={Y0 + 76} width="150" height="6" rx="2" fill="#3B5FD0" stroke={INK} strokeWidth="1.6" />}
      <rect x="24" y={Y0 + 82} width="150" height="9" rx="2" fill="#F2E2BE" stroke={INK} strokeWidth="1.6" />
      {Array.from({ length: bays - 1 }, (_, k) => <path key={k} d={`M${24 + ((k + 1) * 150) / bays} ${Y0 + 82} v9`} stroke={INK} strokeWidth="0.8" />)}
      <g filter={sh}>
        {Array.from({ length: people }, (_, k) => <Golfer key={k} x={24 + (150 / bays) * (k + 0.5)} y={Y0 + 90} look={look(rng(300 + k))} s={0.85} />)}
      </g>
    </g>
  );
}

function ProShop({ lv, parked, canopy, sh }) {
  const x = 186;
  const y = Y0 + 70;
  if (lv === 0) {
    return (
      <g>
        <rect x={x + 2} y={y - 34} width="72" height="40" rx="3" fill="#C9A16A" stroke={INK} strokeWidth="1.6" strokeDasharray="4 3" />
        <g filter={sh} stroke={INK} strokeWidth="1.4">
          <path d={`M${x + 38} ${y} v-14`} />
          <rect x={x + 26} y={y - 26} width="24" height="13" rx="1.5" fill="#FFF" />
          <path d={`M${x + 30} ${y - 21} h16 M${x + 30} ${y - 17} h11`} strokeWidth="1" />
        </g>
        <ParkedCarts x={x + 6} y={y + 26} n={parked} canopy={canopy} sh={sh} />
      </g>
    );
  }
  const w = [0, 38, 52, 66][lv];
  const bx = x + 38 - w / 2;
  const roof = ['', '#8A5528', '#EF4F3A', '#161616'][lv];
  return (
    <g>
      <g filter={sh} stroke={INK} strokeWidth="2" strokeLinejoin="round">
        <rect x={bx} y={y - 26} width={w} height="26" fill="#FFFFFF" />
        <path d={`M${bx - 4} ${y - 24} L${bx + 6} ${y - 36} H${bx + w - 6} L${bx + w + 4} ${y - 24} Z`} fill={roof} />
        <rect x={x + 33} y={y - 15} width="10" height="15" fill="#3B5FD0" />
        {lv >= 1 && <rect x={bx + 4} y={y - 20} width="9" height="8" fill="#FFD23F" />}
        {lv >= 2 && <rect x={bx + w - 13} y={y - 20} width="9" height="8" fill="#FFD23F" />}
        {lv >= 2 && Array.from({ length: Math.floor(w / 6) }, (_, k) => (
          <path key={k} d={`M${bx + k * 6} ${y - 24} h6 v4 q-3 2.5 -6 0 Z`} fill={k % 2 ? '#FFFFFF' : '#2F9E44'} strokeWidth="1" />
        ))}
        {lv >= 3 && [0, 1].map((k) => (
          <g key={k}>
            <path d={`M${bx - 8 + k * (w + 16)} ${y} V${y - 44}`} strokeWidth="1.2" />
            <path d={`M${bx - 8 + k * (w + 16)} ${y - 44} l8 3 l-8 3 Z`} fill={k ? '#FFD23F' : '#EF4F3A'} strokeWidth="1" />
          </g>
        ))}
      </g>
      <ParkedCarts x={x + 6} y={y + 26} n={parked} canopy={canopy} sh={sh} />
    </g>
  );
}

function ParkedCarts({ x, y, n, canopy, sh }) {
  if (!n) return null;
  return (
    <g filter={sh}>
      {Array.from({ length: n }, (_, k) => <MiniCart key={k} x={x + 6 + (k % 6) * 11} y={y - (k >= 6 ? 0 : 11)} canopy={canopy} s={0.42} />)}
    </g>
  );
}

const CAR_COLS = ['#EF4F3A', '#3B5FD0', '#FFFFFF', '#FFD23F', '#2F9E44', '#161616', '#F58FB0', '#FF8A3D'];

/** Road, driving range, pro shop with its cart bay, car park and the tier sign. */
export function Entrance({ pop = 0, amen = {}, tier = 0, sh }) {
  const c = crowd(pop, amen);
  const canopy = tier >= 3 ? '#161616' : '#2F9E44';
  const T = TIERS[tier] ?? TIERS[0];
  const paved = tier > 0;
  const lot = { x: 300, y: Y0 + 52, w: 210, h: 68 };
  return (
    <g className="entrance">
      <path d={`M0 ${ROAD_Y} H${MAP_W}`} stroke={INK} strokeWidth="11" />
      <path d={`M0 ${ROAD_Y} H${MAP_W}`} stroke={paved ? '#C9C3B6' : '#C9A16A'} strokeWidth="7" />
      {paved && <path d={`M0 ${ROAD_Y} H${MAP_W}`} stroke="#FFF" strokeWidth="1" strokeDasharray="8 8" />}

      <g transform="translate(0 8)">
        <Range lv={amen.range ?? 0} people={c.atRange} sh={sh} />
        <ProShop lv={amen.shop ?? 0} parked={Math.max(0, c.owned - c.cartsOut)} canopy={canopy} sh={sh} />
      </g>

      <rect x={lot.x} y={lot.y} width={lot.w} height={lot.h} rx="5" fill={paved ? '#B8B2A3' : '#C9A16A'} stroke={INK} strokeWidth="2" />
      {paved && Array.from({ length: 9 }, (_, k) => (
        <path key={k} d={`M${lot.x + 12 + k * 23} ${lot.y + 3} v18 M${lot.x + 12 + k * 23} ${lot.y + lot.h - 21} v18`} stroke="#FFF" strokeWidth="1.4" />
      ))}
      <g filter={sh}>
        {Array.from({ length: c.cars }, (_, k) => {
          const col = Math.floor(k / 2);
          return <Car key={k} x={lot.x + 24 + col * 23} y={k % 2 ? lot.y + lot.h - 4 : lot.y + 20} col={CAR_COLS[(k * 3) % CAR_COLS.length]} />;
        })}
      </g>

      <g filter={sh} stroke={INK} strokeWidth="1.8" strokeLinejoin="round">
        <path d={`M${lot.x + 30} ${lot.y} v-10 M${lot.x + 90} ${lot.y} v-10`} />
        <rect x={lot.x + 18} y={lot.y - 34} width="84" height="24" rx="3" fill={T.sign} />
      </g>
      <text x={lot.x + 60} y={lot.y - 18} textAnchor="middle" fontSize={T.name.length > 10 ? 10 : 11} fontWeight="800" fill={T.ink} fontFamily="Bricolage Grotesque, system-ui, sans-serif" letterSpacing="0.04em">
        {T.name.toUpperCase()}
      </text>
      {tier >= 4 && <Leaderboard x={lot.x + 150} y={lot.y} sh={sh} />}
    </g>
  );
}

function Leaderboard({ x, y, sh }) {
  return (
    <g filter={sh} stroke={INK} strokeWidth="1.6" strokeLinejoin="round">
      <path d={`M${x - 12} ${y} v-8 M${x + 12} ${y} v-8`} />
      <rect x={x - 18} y={y - 30} width="36" height="22" rx="2" fill="#2F9E44" />
      {[0, 1, 2].map((k) => (
        <g key={k} stroke="none">
          <rect x={x - 14} y={y - 27 + k * 6} width={18 - k * 3} height="2.6" fill="#FFF" />
          <rect x={x + 8} y={y - 27 + k * 6} width="5" height="2.6" fill="#FFD23F" />
        </g>
      ))}
    </g>
  );
}

export { cartsOwned };

/** Golfers on the course (not counting the range or the gallery) at this popularity. */
export function golfersOut(pop, amen = {}) {
  const sp = getSpots();
  return sp.groups.slice(0, crowd(pop, amen).groups).reduce((a, g) => a + g.n, 0);
}

/** Small picture of an amenity for list rows. */
export function AmenityArt({ k, lv = 1, size = 40 }) {
  const dim = lv === 0;
  return (
    <svg viewBox="-20 -24 40 30" width={size} height={size * 0.75} aria-hidden="true" style={{ opacity: dim ? 0.45 : 1, display: 'block' }}>
      {k === 'carts' && <MiniCart x={0} y={4} s={0.95} canopy="#2F9E44" />}
      {k === 'shop' && (
        <g stroke={INK} strokeWidth="1.6" strokeLinejoin="round">
          <rect x="-13" y="-12" width="26" height="16" fill="#FFF" />
          <path d="M-16 -11 L-10 -20 H10 L16 -11 Z" fill="#EF4F3A" />
          {Array.from({ length: 4 }, (_, i) => <path key={i} d={`M${-13 + i * 6.5} -11 h6.5 v3 q-3.2 2 -6.5 0 Z`} fill={i % 2 ? '#FFF' : '#2F9E44'} strokeWidth="1" />)}
          <rect x="-3" y="-4" width="6" height="8" fill="#3B5FD0" />
        </g>
      )}
      {k === 'range' && (
        <g stroke={INK} strokeLinejoin="round">
          <path d={blob(0, -2, 17, 61, 0.12, 10, 0.45)} fill="#86C86A" strokeWidth="1.6" />
          <path d="M2 -2 v-14" strokeWidth="1.4" />
          <path d="M2 -16 l8 3 l-8 3 Z" fill="#FFD23F" strokeWidth="1.1" />
          {[[-10, 0], [-6, -4], [8, 1], [-2, 2], [12, -3]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#FFF" strokeWidth="0.6" />)}
        </g>
      )}
    </svg>
  );
}
