// The cut-paper golf course. One spec (lib/holes.js) draws each hole twice: small on the
// course map and large in the hole view. Condition, upgrades, damage and drops all change
// the drawing, so the course visibly reacts to how you're doing.
import { useId, useMemo } from 'react';
import {
  MAP_W, MAP_H, HOLES, CLUBHOUSE_AT, LAKE_AT, CENTRE_BOX, holeLayout, holeFrame, bez, normalAt,
  blob, holePath, mix, rng, SIZE, fairwayOutline, fairwaySpan,
} from '../lib/holes.js';

const INK = '#161616';
const ROUGH = '#5E9E4E';
const ROUGH_DARK = '#4E8A40';

function fairwayColour(cond) {
  return cond >= 55 ? mix('#C3B862', '#76C656', (cond - 55) / 45) : mix('#A9874C', '#C3B862', (cond - 10) / 45);
}
function greenColour(cond) {
  return cond >= 55 ? mix('#B9BE62', '#8CE068', (cond - 55) / 45) : mix('#A68D52', '#B9BE62', (cond - 10) / 45);
}

/** Filters shared by the map and hole view. */
function Defs({ id }) {
  return (
    <defs>
      <filter id={id('sh')} x="-20%" y="-20%" width="150%" height="150%">
        <feDropShadow dx="2" dy="3" stdDeviation="0" floodColor={INK} floodOpacity="0.3" />
      </filter>
      <filter id={id('grain')} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0.1 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
    </defs>
  );
}

/** One hole, drawn in either frame. */
export function HoleArt({ i, h, frame = 'map', gold = false, ball, sh, number = true }) {
  const { f, u, fw, gr, bunkers, water } = holeLayout(i, frame);
  const detail = frame === 'detail';
  const ink = detail ? 3 : 2;
  const lv = h.lv;
  const fc = fairwayColour(h.cond);
  const gc = greenColour(h.cond);
  const path = holePath(f);
  const outline = fairwayOutline(i, frame);
  const clip = `fw${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [s0, s1] = fairwaySpan(i);
  const rand = rng(1000 + i * 97);
  const ang = Math.atan2(f.green[1] - f.tee[1], f.green[0] - f.tee[0]) * 180 / Math.PI;

  const patches = [];
  const nPatch = Math.max(0, Math.min(6, Math.round((82 - h.cond) / 12)));
  for (let k = 0; k < nPatch; k++) {
    const t = s0 + 0.05 + rand() * (s1 - s0 - 0.12);
    const p = bez(f, t);
    const n = normalAt(f, t);
    const off = (rand() - 0.5) * fw * 0.5;
    patches.push(<path key={k} d={blob(p[0] + n[0] * off, p[1] + n[1] * off, fw * (0.18 + rand() * 0.14), 50 + k + i * 7, 0.4)} fill="#9C7743" opacity="0.7" />);
  }
  const tufts = [];
  if (h.cond < 45 || lv.fairway === 0) {
    const nT = h.cond < 45 ? 7 : 4;
    for (let k = 0; k < nT; k++) {
      const t = s0 + rand() * (s1 - s0);
      const p = bez(f, t);
      const n = normalAt(f, t);
      const side = rand() < 0.5 ? -1 : 1;
      const x = p[0] + n[0] * side * fw * 0.45;
      const y = p[1] + n[1] * side * fw * 0.45;
      const s = u * 1.6;
      tufts.push(<path key={k} d={`M${x - s} ${y} l${s * 0.5} ${-s * 2} l${s * 0.5} ${s * 1.2} l${s * 0.5} ${-s * 2.2} l${s * 0.5} ${s * 3}Z`} fill={h.cond < 45 ? '#8A9A3A' : ROUGH_DARK} stroke={INK} strokeWidth={detail ? 1.5 : 0.8} strokeLinejoin="round" />);
    }
  }

  const sideWater = water && !water.carry;
  const waterEl = water && (
    <g>
      <path d={blob(water.x, water.y, water.r, 300 + i, 0.25, 10, water.carry ? 0.75 : 1)} fill="#5AA8D6" stroke={INK} strokeWidth={ink} strokeLinejoin="round" />
      <g stroke="#FFFFFF" strokeWidth={detail ? 2.5 : 1.2} strokeLinecap="round" opacity="0.8">
        <path d={`M${water.x - water.r * 0.45} ${water.y - water.r * 0.15} h${water.r * 0.3}`} />
        <path d={`M${water.x + water.r * 0.05} ${water.y + water.r * 0.25} h${water.r * 0.35}`} />
      </g>
    </g>
  );

  const flagH = detail ? 52 : 13;
  const pin = [f.green[0] + gr * 0.15, f.green[1]];
  const flagCol = gold ? '#FFC83D' : '#EF4F3A';

  return (
    <g className="hole">
      <defs><clipPath id={clip}><path d={outline} /></clipPath></defs>
      {sideWater && waterEl}
      {lv.fairway >= 2 && <path d={outline} fill="none" stroke="#6CB458" strokeWidth={8 * u} strokeLinejoin="round" />}
      <path d={outline} fill={fc} stroke={INK} strokeWidth={ink} strokeLinejoin="round" />
      {lv.fairway >= 1 && (
        <path d={path} clipPath={`url(#${clip})`} fill="none" stroke={mix(fc, '#FFFFFF', 0.2)} strokeWidth={fw * 1.4} strokeDasharray={`${5 * u} ${5 * u}`} strokeLinecap="butt" />
      )}
      {lv.fairway >= 3 && [0.35, 0.55, 0.75].map((t) => {
        const p = bez(f, t);
        return <circle key={t} cx={p[0]} cy={p[1]} r={detail ? 3.5 : 1.2} fill="#FFFFFF" stroke={INK} strokeWidth={detail ? 1.2 : 0.5} />;
      })}
      {patches}
      {water?.carry && waterEl}
      {tufts}

      {bunkers.map((b, k) => (
        <g key={k}>
          <path d={blob(b.x, b.y, b.r, 500 + i * 11 + k, 0.35, 8)} fill={['#D3B983', '#EED39A', '#F5DDA8', '#FBEFD2'][lv.bunkers]} stroke={INK} strokeWidth={ink} strokeLinejoin="round" />
          {lv.bunkers >= 2 && detail && (
            <g stroke="#C9A86A" strokeWidth="1.5" fill="none" strokeLinecap="round">
              <path d={`M${b.x - b.r * 0.5} ${b.y - b.r * 0.2} q${b.r * 0.25} ${-b.r * 0.15} ${b.r * 0.5} 0 t${b.r * 0.5} 0`} />
              <path d={`M${b.x - b.r * 0.5} ${b.y + b.r * 0.2} q${b.r * 0.25} ${-b.r * 0.15} ${b.r * 0.5} 0 t${b.r * 0.5} 0`} />
            </g>
          )}
          {lv.bunkers === 0 && (
            <circle cx={b.x + b.r * 0.3} cy={b.y - b.r * 0.1} r={b.r * 0.18} fill={ROUGH_DARK} />
          )}
        </g>
      ))}

      {/* tee box */}
      <g transform={`rotate(${ang + 90} ${f.tee[0]} ${f.tee[1]})`}>
        <rect
          x={f.tee[0] - SIZE.tee * u} y={f.tee[1] - SIZE.tee * u * 0.6}
          width={SIZE.tee * u * 2} height={SIZE.tee * u * 1.2} rx={u * 1.5}
          fill={lv.tee === 0 ? '#C9A16A' : mix('#8FD86A', fc, 0.3)} stroke={INK} strokeWidth={ink}
        />
        {lv.tee >= 2 && (
          <g stroke={INK} strokeWidth={detail ? 1.2 : 0.6}>
            <circle cx={f.tee[0] - SIZE.tee * u * 0.55} cy={f.tee[1] - SIZE.tee * u * 0.25} r={u * 0.9} fill={lv.tee >= 3 ? '#3B5FD0' : '#EF4F3A'} />
            <circle cx={f.tee[0] + SIZE.tee * u * 0.55} cy={f.tee[1] - SIZE.tee * u * 0.25} r={u * 0.9} fill={lv.tee >= 3 ? '#3B5FD0' : '#EF4F3A'} />
          </g>
        )}
      </g>

      {/* green */}
      {lv.green >= 1 && <path d={blob(f.green[0], f.green[1], gr + 2.2 * u, 700 + i, 0.15, 10)} fill={mix(fc, '#A6E07A', 0.4)} stroke={INK} strokeWidth={ink} />}
      <path d={blob(f.green[0], f.green[1], gr * (lv.green === 0 ? 0.88 : 1), 800 + i, 0.18, 10)} fill={gc} stroke={INK} strokeWidth={ink} />
      {lv.green >= 3 && (
        <g fill="none" stroke={mix(gc, '#FFFFFF', 0.22)} strokeWidth={detail ? 3 : 1}>
          <circle cx={f.green[0]} cy={f.green[1]} r={gr * 0.65} />
          <circle cx={f.green[0]} cy={f.green[1]} r={gr * 0.32} />
        </g>
      )}
      {lv.green >= 2 && h.cond >= 55 && detail && (
        <path d={blob(f.green[0] - gr * 0.3, f.green[1] - gr * 0.25, gr * 0.25, 900 + i, 0.2)} fill={mix(gc, '#FFFFFF', 0.25)} />
      )}

      {/* damage */}
      {h.damage.map((d, k) => <DamageMark key={d.id} d={d} f={f} fw={fw} u={u} detail={detail} k={k} water={water} />)}

      {/* flag */}
      <ellipse cx={pin[0]} cy={pin[1]} rx={detail ? 4 : 1.6} ry={detail ? 2.2 : 0.9} fill={INK} />
      <g filter={sh}>
        <path d={`M${pin[0]} ${pin[1]} V${pin[1] - flagH}`} stroke={INK} strokeWidth={detail ? 3 : 1.3} />
        {lv.green >= 1 || detail ? (
          <path className="flag" d={`M${pin[0]} ${pin[1] - flagH} l${flagH * 0.45} ${flagH * 0.16} l${-flagH * 0.45} ${flagH * 0.16} Z`} fill={flagCol} stroke={INK} strokeWidth={detail ? 2 : 0.9} strokeLinejoin="round" />
        ) : (
          <path d={`M${pin[0]} ${pin[1] - flagH} l${flagH * 0.3} ${flagH * 0.1} l${-flagH * 0.3} ${flagH * 0.1} Z`} fill={gold ? flagCol : '#E9DFCB'} stroke={INK} strokeWidth="0.8" />
        )}
      </g>

      {number && !detail && (() => {
        const d0 = normalAt(f, 0);
        const bx = f.tee[0] + d0[0] * 11;
        const by = f.tee[1] + d0[1] * 11;
        return (
          <g>
            <circle cx={bx} cy={by} r="7" fill="#FFFFFF" stroke={INK} strokeWidth="1.6" />
            <text x={bx} y={by + 3.2} textAnchor="middle" fontSize="9" fontWeight="800" fill={INK} fontFamily="Bricolage Grotesque, system-ui, sans-serif">{i + 1}</text>
          </g>
        );
      })()}

      {ball}
    </g>
  );
}

function DamageMark({ d, f, fw, u, detail, k, water }) {
  const rand = rng(d.seed || 1);
  const t = 0.3 + rand() * 0.45;
  const p = bez(f, t);
  const n = normalAt(f, t);
  const off = (rand() - 0.5) * fw * 0.4;
  const x = p[0] + n[0] * off;
  const y = p[1] + n[1] * off;
  const r = fw * 0.3;
  const sw = detail ? 2 : 1;
  let mark;
  if (d.kind === 'divot') {
    mark = (
      <g>
        <path d={blob(x, y, r, d.seed, 0.5, 7, 0.55)} fill="#6B4A2A" stroke={INK} strokeWidth={sw} />
        <path d={blob(x + r * 1.1, y - r * 0.5, r * 0.35, d.seed + 1, 0.4, 6)} fill="#7FB65A" stroke={INK} strokeWidth={sw * 0.8} />
      </g>
    );
  } else if (d.kind === 'water') {
    const wx = water ? water.x : x;
    const wy = water ? water.y : y;
    mark = (
      <g>
        {!water && <path d={blob(wx, wy, r * 1.1, d.seed, 0.3, 8, 0.7)} fill="#5AA8D6" stroke={INK} strokeWidth={sw} />}
        <circle cx={wx + r * 0.2} cy={wy} r={r * 0.7} fill="none" stroke="#FFFFFF" strokeWidth={sw} />
        <circle cx={wx + r * 0.2} cy={wy} r={r * 0.28} fill="#FFFFFF" stroke={INK} strokeWidth={sw * 0.8} />
      </g>
    );
  } else {
    mark = <path d={blob(x, y, r * 1.2, d.seed, 0.6, 9)} fill="#5A3F22" stroke={INK} strokeWidth={sw} opacity="0.9" />;
  }
  return (
    <g className="damage">
      {mark}
      {!detail && (
        <g>
          <circle cx={x + 6} cy={y - 7 - k * 2} r="4.2" fill="#EF4F3A" stroke={INK} strokeWidth="1.2" />
          <path d={`M${x + 6} ${y - 9.2 - k * 2} v2.6`} stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx={x + 6} cy={y - 4.9 - k * 2} r="0.7" fill="#FFFFFF" />
        </g>
      )}
    </g>
  );
}

// ---------- trees ----------

function Tree({ x, y, s = 1, kind = 0, autumn = false }) {
  const greenA = autumn ? '#B8A040' : '#2F8F3E';
  const greenB = autumn ? '#C9B048' : '#3BA64C';
  if (kind === 1) {
    return (
      <g stroke={INK} strokeWidth={1.4 * Math.min(1.8, s)} strokeLinejoin="round">
        <rect x={x - 1.5 * s} y={y - 4 * s} width={3 * s} height={5 * s} fill="#8A5528" />
        <path d={`M${x - 8 * s} ${y - 3 * s} L${x} ${y - 22 * s} L${x + 8 * s} ${y - 3 * s} Z`} fill={greenA} />
        <path d={`M${x - 6 * s} ${y - 11 * s} L${x} ${y - 26 * s} L${x + 6 * s} ${y - 11 * s} Z`} fill={greenB} />
      </g>
    );
  }
  return (
    <g stroke={INK} strokeWidth={1.4 * Math.min(1.8, s)} strokeLinejoin="round">
      <rect x={x - 1.6 * s} y={y - 5 * s} width={3.2 * s} height={6 * s} fill="#8A5528" />
      <circle cx={x} cy={y - 11 * s} r={8 * s} fill={greenB} />
      <circle cx={x - 3 * s} cy={y - 14 * s} r={2.8 * s} fill="#5CC46A" stroke="none" />
    </g>
  );
}

// Tree spots on the map: sampled once, kept clear of fairways, greens, clubhouse and lake.
let mapTrees;
function getMapTrees() {
  if (mapTrees) return mapTrees;
  const rand = rng(4242);
  const pts = [];
  HOLES.forEach((_, i) => {
    const L = holeLayout(i, 'map');
    for (let t = 0; t <= 1.0001; t += 0.05) pts.push([...bez(L.f, t), L.fw / 2 + 9]);
    pts.push([...L.f.green, L.gr + 10]);
    L.bunkers.forEach((b) => pts.push([b.x, b.y, b.r + 8]));
    if (L.water) pts.push([L.water.x, L.water.y, L.water.r + 8]);
    const f = L.f;
    const n0 = normalAt(f, 0);
    pts.push([f.tee[0] + n0[0] * 11, f.tee[1] + n0[1] * 11, 10]);
  });
  const out = [];
  for (let k = 0; k < 1200 && out.length < 95; k++) {
    const x = 10 + rand() * (MAP_W - 20);
    const y = 26 + rand() * (MAP_H - 30);
    if (x > CENTRE_BOX.x0 - 4 && x < CENTRE_BOX.x1 + 4 && y > CENTRE_BOX.y0 - 4 && y < CENTRE_BOX.y1 + 14) continue;
    if (pts.some(([px, py, r]) => Math.hypot(px - x, py - y) < r)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.y - y) < 15)) continue;
    out.push({ x, y, s: 0.6 + rand() * 0.35, kind: rand() < 0.35 ? 1 : 0 });
  }
  mapTrees = out.sort((a, b) => a.y - b.y);
  return mapTrees;
}

// ---------- clubhouse ----------

export function Clubhouse({ level, x, y, sh }) {
  const t = `translate(${x} ${y})`;
  const st = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' };
  if (level === 0) {
    return (
      <g transform={t} filter={sh} {...st}>
        <rect x="-16" y="-20" width="32" height="20" fill="#B9773E" />
        <path d="M-20 -18 L0 -32 L20 -18 Z" fill="#8A5528" />
        <rect x="-5" y="-13" width="10" height="13" fill="#6B3E1C" />
      </g>
    );
  }
  return (
    <g transform={t} filter={sh} {...st}>
      {level >= 3 && (
        <g>
          <rect x="-60" y="-14" width="120" height="14" fill="#E6D3B3" />
          {[-48, 34].map((ux) => (
            <g key={ux}>
              <path d={`M${ux} -14 v-8`} />
              <path d={`M${ux - 10} -22 q10 -10 20 0 Z`} fill={ux < 0 ? '#EF4F3A' : '#FFD23F'} />
            </g>
          ))}
        </g>
      )}
      {level >= 4 && (
        <g>
          <rect x="-34" y="-62" width="68" height="22" fill="#FFF8EC" />
          <rect x="-26" y="-56" width="10" height="10" fill="#A9C3FF" />
          <rect x="16" y="-56" width="10" height="10" fill="#A9C3FF" />
          <rect x="-7" y="-84" width="14" height="26" fill="#FFF8EC" />
          <circle cx="0" cy="-72" r="5" fill="#FFFFFF" />
          <path d="M0 -72 v-3 M0 -72 h2.5" strokeWidth="1.2" />
          <path d="M-10 -84 L0 -96 L10 -84 Z" fill="#2F9E44" />
          <path d="M0 -96 v-12" />
          <path d="M0 -108 l10 3 l-10 3 Z" fill="#EF4F3A" />
        </g>
      )}
      <rect x={level >= 2 ? -44 : -26} y="-40" width={level >= 2 ? 88 : 52} height="30" fill="#FFFFFF" />
      <path
        d={level >= 2 ? 'M-52 -38 L-36 -54 L36 -54 L52 -38 Z' : 'M-32 -38 L0 -56 L32 -38 Z'}
        fill={level >= 2 ? '#3B5FD0' : '#EF4F3A'}
      />
      {level >= 2 && <rect x="22" y="-62" width="8" height="12" fill="#B9773E" />}
      <rect x="-6" y="-28" width="12" height="18" fill="#3B5FD0" />
      <rect x={level >= 2 ? -36 : -20} y="-33" width="10" height="9" fill="#FFD23F" />
      <rect x={level >= 2 ? 26 : 10} y="-33" width="10" height="9" fill="#FFD23F" />
      {level >= 2 && <rect x="-20" y="-33" width="8" height="9" fill="#FFD23F" />}
      {level >= 2 && <rect x="12" y="-33" width="8" height="9" fill="#FFD23F" />}
      <rect x="-14" y="-48" width="28" height="7" fill="#FFD23F" strokeWidth="1.5" />
      <rect x={level >= 2 ? -48 : -30} y="-11" width={level >= 2 ? 96 : 60} height="4" fill="#E6D3B3" />
    </g>
  );
}

// ---------- barn ----------

export function Barn({ level = 0, x, y, sh }) {
  const st = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' };
  if (level === 0) {
    return (
      <g transform={`translate(${x} ${y})`} filter={sh} {...st}>
        <rect x="-12" y="-16" width="24" height="16" fill="#C9C3B6" />
        <path d="M-14 -15 L0 -24 L14 -15 Z" fill="#8A8A8A" />
        <rect x="-5" y="-10" width="10" height="10" fill="#6E6E6E" />
      </g>
    );
  }
  const w = level >= 2 ? 22 : 17;
  return (
    <g transform={`translate(${x} ${y})`} filter={sh} {...st}>
      {level >= 2 && (
        <g>
          <rect x={w - 2} y="-34" width="12" height="34" fill="#E6D3B3" />
          <path d={`M${w - 2} -34 q6 -8 12 0`} fill="#8A8A8A" />
          <path d={`M${w - 2} -22 h12 M${w - 2} -11 h12`} strokeWidth="1.2" />
        </g>
      )}
      {level >= 3 && (
        <g>
          <rect x={-w - 22} y="-14" width="20" height="14" fill="#C9C3B6" />
          <path d={`M${-w - 24} -13 L${-w - 12} -20 L${-w} -13 Z`} fill="#3B5FD0" />
          <rect x={-w - 18} y="-9" width="10" height="9" fill="#6E6E6E" />
        </g>
      )}
      <path d={`M${-w} 0 V-18 L${-w * 0.6} -28 L0 -33 L${w * 0.6} -28 L${w} -18 V0 Z`} fill="#D9483A" />
      <path d={`M${-w - 3} -17 L${-w * 0.6} -29 L0 -35 L${w * 0.6} -29 L${w + 3} -17`} fill="none" stroke={INK} strokeWidth="3" />
      <rect x="-7" y="-14" width="14" height="14" fill="#FFF8EC" />
      <path d="M-7 -14 L7 0 M7 -14 L-7 0" strokeWidth="1.6" />
      <rect x="-3" y="-25" width="6" height="5" fill="#FFF8EC" strokeWidth="1.4" />
    </g>
  );
}

// ---------- drops ----------

export function DropPiece({ id, x = 0, y = 0, s = 1 }) {
  const st = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round', strokeLinecap: 'round' };
  const t = `translate(${x} ${y}) scale(${s})`;
  switch (id) {
    case 'cart':
      return (
        <g transform={t} {...st}>
          <rect x="-13" y="-12" width="26" height="9" rx="2" fill="#FFFFFF" />
          <path d="M-11 -12 V-24 M9 -12 V-24" />
          <rect x="-14" y="-27" width="28" height="4" rx="1.5" fill="#2F9E44" />
          <rect x="4" y="-11" width="6" height="5" fill="#A9C3FF" strokeWidth="1.2" />
          <circle cx="-8" cy="-2" r="3.4" fill={INK} />
          <circle cx="8" cy="-2" r="3.4" fill={INK} />
        </g>
      );
    case 'bench':
      return (
        <g transform={t} {...st}>
          <rect x="-12" y="-14" width="24" height="4" fill="#B9773E" />
          <rect x="-13" y="-8" width="26" height="3.5" fill="#B9773E" />
          <path d="M-10 -4.5 V0 M10 -4.5 V0 M-10 -10 V-8 M10 -10 V-8" strokeWidth="2" />
        </g>
      );
    case 'washer':
      return (
        <g transform={t} {...st}>
          <path d="M0 0 V-14" strokeWidth="2.2" />
          <rect x="-5" y="-24" width="10" height="10" rx="2" fill="#3B5FD0" />
          <path d="M5 -20 h4" strokeWidth="2" />
          <rect x="-4" y="-2" width="8" height="2" fill="#2F9E44" />
        </g>
      );
    case 'ducks':
      return (
        <g transform={t} {...st} strokeWidth="1.3">
          {[[-8, 0, '#FFFFFF'], [8, -3, '#FFD23F']].map(([dx, dy, c]) => (
            <g key={dx}>
              <path d={`M${dx - 6} ${dy} q0 -5 6 -5 q2 -5 5 -4 q1 2 -1 4 q3 1 1 5 Z`} fill={c} />
              <path d={`M${dx + 5} ${dy - 8} l2.5 0.8 l-2.4 0.8`} fill="#EF8A2A" />
              <circle cx={dx + 3.4} cy={dy - 7.6} r="0.6" fill={INK} stroke="none" />
            </g>
          ))}
        </g>
      );
    case 'sprinkler':
      return (
        <g transform={t} {...st}>
          <g className="spray" fill="none" stroke="#A9DFF5" strokeWidth="1.8">
            <path d="M0 -6 q-10 -10 -16 0" /><path d="M0 -6 q10 -10 16 0" /><path d="M0 -6 q-4 -14 -9 -2" /><path d="M0 -6 q4 -14 9 -2" />
          </g>
          <rect x="-2.5" y="-7" width="5" height="7" fill="#FFD23F" />
        </g>
      );
    case 'kangaroos':
      return (
        <g transform={t} {...st} strokeWidth="1.3">
          {[[-7, 1, 1], [9, -2, 0.75]].map(([dx, dy, k]) => (
            <g key={dx} transform={`translate(${dx} ${dy}) scale(${k})`}>
              <path d="M-12 0 q4 -2 8 -1" fill="none" strokeWidth="2.2" />
              <path d="M-5 -1 q-2 -10 4 -14 q4 -2 5 2 q0 6 -2 10 q3 2 4 3 h-10 Z" fill="#C98A4B" />
              <path d="M1 -15 q1 -6 5 -6 q2 0 2 2 q0 2 -3 3 q-1 2 -2 3 Z" fill="#C98A4B" />
              <path d="M3 -21 l0 -4 l2 3 Z" fill="#C98A4B" />
              <circle cx="5.5" cy="-19" r="0.6" fill={INK} stroke="none" />
            </g>
          ))}
        </g>
      );
    case 'windmill':
      return (
        <g transform={t} {...st}>
          <path d="M-8 0 L-5 -26 L5 -26 L8 0 Z" fill="#FFFFFF" />
          <rect x="-3" y="-9" width="6" height="9" fill="#3B5FD0" />
          <path d="M-7 -26 L0 -33 L7 -26 Z" fill="#EF4F3A" />
          <g className="spin" style={{ transformOrigin: '0px -28px' }}>
            {[0, 90, 180, 270].map((r) => (
              <rect key={r} x="-2.4" y="-46" width="4.8" height="16" fill="#FFF8EC" transform={`rotate(${r} 0 -28)`} strokeWidth="1.2" />
            ))}
          </g>
          <circle cx="0" cy="-28" r="2" fill={INK} />
        </g>
      );
    case 'fountain':
      return (
        <g transform={t} {...st}>
          <g className="spray" fill="none" stroke="#FFFFFF" strokeWidth="2">
            <path d="M0 -2 V-20" /><path d="M0 -18 q-7 0 -9 10" /><path d="M0 -18 q7 0 9 10" />
          </g>
          <ellipse cx="0" cy="-1" rx="9" ry="3" fill="#A9DFF5" />
        </g>
      );
    case 'gazebo':
      return (
        <g transform={t} {...st}>
          <rect x="-15" y="-4" width="30" height="4" fill="#E6D3B3" />
          <path d="M-11 -4 V-17 M0 -4 V-17 M11 -4 V-17" strokeWidth="2" />
          <path d="M-17 -16 L0 -30 L17 -16 Z" fill="#EF4F3A" />
          <path d="M-17 -16 h34" />
          <circle cx="0" cy="-31" r="1.8" fill="#FFD23F" />
        </g>
      );
    case 'goldflags':
      return (
        <g transform={t} {...st}>
          <ellipse cx="0" cy="0" rx="12" ry="3.5" fill="#8CE068" />
          <path d="M0 0 V-28" strokeWidth="2" />
          <path d="M0 -28 l13 4.5 l-13 4.5 Z" fill="#FFC83D" />
        </g>
      );
    case 'balloon':
      return (
        <g transform={t} {...st} className="float">
          <path d="M0 -50 C-15 -50 -17 -32 -7 -22 L-4 -16 L4 -16 L7 -22 C17 -32 15 -50 0 -50 Z" fill="#FFD23F" />
          <path d="M0 -50 C-6 -46 -6 -28 -4 -16 M0 -50 C6 -46 6 -28 4 -16" fill="none" />
          <path d="M-7 -22 C-4 -30 4 -30 7 -22" fill="#EF4F3A" />
          <path d="M-4 -16 L-3 -10 M4 -16 L3 -10" strokeWidth="1" />
          <rect x="-4" y="-10" width="8" height="6" fill="#B9773E" />
        </g>
      );
    case 'trophy':
      return (
        <g transform={t} {...st}>
          <rect x="-8" y="-6" width="16" height="6" fill="#8A5528" />
          <path d="M-3 -6 V-10 H3 V-6" fill="#FFC83D" />
          <path d="M-8 -26 H8 Q8 -12 0 -10 Q-8 -12 -8 -26 Z" fill="#FFC83D" />
          <path d="M-8 -23 q-5 0 -4 5 q1 3 5 3 M8 -23 q5 0 4 5 q-1 3 -5 3" fill="none" />
        </g>
      );
    default:
      return null;
  }
}

/** A drop drawn on its own, for the collection grid and the drop card. */
export function DropIcon({ id, owned = true, size = 64 }) {
  const box = { balloon: '-22 -56 44 56', windmill: '-20 -50 40 54' }[id] ?? '-20 -34 40 38';
  return (
    <svg viewBox={box} width={size} height={size} className={`drop-icon ${owned ? '' : 'locked'}`} aria-hidden="true">
      <DropPiece id={id} />
    </svg>
  );
}

// Where each drop sits on the map.
const [CX, CY] = CLUBHOUSE_AT;
const [LX, LY] = LAKE_AT;
const DROP_SPOTS = {
  cart:      [CX + 40, CY + 54],
  bench:     [CX - 40, CY + 54],
  washer:    [CX - 46, CY - 30],
  trophy:    [CX + 4, CY + 58],
  sprinkler: [CX + 30, CY - 40],
  ducks:     [LX - 20, LY + 4],
  fountain:  [LX + 8, LY + 6],
  windmill:  [LX + 42, LY - 26],
  gazebo:    [LX - 34, LY - 32],
  kangaroos: [LX + 20, LY + 52],
  goldflags: null,
  balloon:   [MAP_W / 2, 62],
};

// ---------- map ----------

export function CourseMap({ course, items = {}, onHole, className = '', label, highlight, barn = 0 }) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n) => `${n}${raw}`;
  const sh = `url(#${id('sh')})`;
  const trees = useMemo(getMapTrees, []);
  const gold = (items.goldflags ?? 0) > 0;
  const avg = course.holes.reduce((a, h) => a + h.cond, 0) / course.holes.length;
  const autumn = avg < 45;
  const has = (k) => (items[k] ?? 0) > 0;

  const mottles = useMemo(() => {
    const rand = rng(99);
    return Array.from({ length: 26 }, (_, k) => blob(rand() * MAP_W, rand() * MAP_H, 30 + rand() * 50, 1200 + k, 0.4, 9));
  }, []);

  return (
    <svg className={`course ${className}`} viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label ?? 'Your 18 hole course'}>
      <Defs id={id} />
      <rect width={MAP_W} height={MAP_H} fill={ROUGH} />
      {mottles.map((d, k) => <path key={k} d={d} fill={ROUGH_DARK} opacity="0.35" />)}

      {/* lake and clubhouse lawn */}
      <path d={blob(LAKE_AT[0], LAKE_AT[1] + 2, 48, 77, 0.22, 11, 0.7)} fill="#5AA8D6" stroke={INK} strokeWidth="2.5" />
      <g stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.8" className="waves">
        <path d={`M${LAKE_AT[0] - 28} ${LAKE_AT[1] - 10} h12`} /><path d={`M${LAKE_AT[0] + 14} ${LAKE_AT[1] + 18} h12`} />
      </g>
      <path d={blob(CLUBHOUSE_AT[0], CLUBHOUSE_AT[1] + 10, 56, 31, 0.15, 10, 0.75)} fill="#86C86A" stroke={INK} strokeWidth="2" />
      <path d={`M${CLUBHOUSE_AT[0]} ${CLUBHOUSE_AT[1] + 30} Q${CLUBHOUSE_AT[0] - 30} ${CLUBHOUSE_AT[1] + 70} ${CLUBHOUSE_AT[0] - 20} ${CLUBHOUSE_AT[1] + 78}`} fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <path d={`M${CLUBHOUSE_AT[0]} ${CLUBHOUSE_AT[1] + 30} Q${CLUBHOUSE_AT[0] - 30} ${CLUBHOUSE_AT[1] + 70} ${CLUBHOUSE_AT[0] - 20} ${CLUBHOUSE_AT[1] + 78}`} fill="none" stroke="#F2E2BE" strokeWidth="4" strokeLinecap="round" />
      <path d={`M${CLUBHOUSE_AT[0]} ${CLUBHOUSE_AT[1] + 30} Q${CLUBHOUSE_AT[0] + 60} ${CLUBHOUSE_AT[1] + 40} ${CLUBHOUSE_AT[0] + 72} ${CLUBHOUSE_AT[1] + 64}`} fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <path d={`M${CLUBHOUSE_AT[0]} ${CLUBHOUSE_AT[1] + 30} Q${CLUBHOUSE_AT[0] + 60} ${CLUBHOUSE_AT[1] + 40} ${CLUBHOUSE_AT[0] + 72} ${CLUBHOUSE_AT[1] + 64}`} fill="none" stroke="#F2E2BE" strokeWidth="4" strokeLinecap="round" />

      {course.holes.map((h, i) => (
        <g
          key={i}
          className={`hole-hit ${highlight === i ? 'hl' : ''}`}
          onClick={onHole ? () => onHole(i) : undefined}
          role={onHole ? 'button' : undefined}
          aria-label={onHole ? `Hole ${i + 1}, condition ${Math.round(h.cond)}%` : undefined}
        >
          <HoleArt i={i} h={h} frame="map" gold={gold} sh={sh} />
        </g>
      ))}

      <g filter={sh}>
        {trees.map((t, k) => <Tree key={k} {...t} autumn={autumn && k % 3 === 0} />)}
      </g>

      <Barn level={barn} x={LAKE_AT[0] - 34} y={LAKE_AT[1] + 62} sh={sh} />
      <Clubhouse level={course.clubhouse} x={CLUBHOUSE_AT[0]} y={CLUBHOUSE_AT[1] + 30} sh={sh} />

      <g filter={sh}>
        {Object.entries(DROP_SPOTS).map(([k, p]) => p && has(k) && <DropPiece key={k} id={k} x={p[0]} y={p[1]} />)}
      </g>

      <rect width={MAP_W} height={MAP_H} fill="#FFF" filter={`url(#${id('grain')})`} pointerEvents="none" />
    </svg>
  );
}

// ---------- hole view ----------

/**
 * One hole, large and portrait. `ball` = { p: 0..1 progress, state: 'play' | 'sunk' | 'wet' }
 * moves a ball from tee to cup in `par` shots, which is how Pomodoro blocks show progress.
 */
export function HoleView({ i, h, gold = false, ball, className = '', padBottom = 0 }) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n) => `${n}${raw}`;
  const sh = `url(#${id('sh')})`;
  const L = holeLayout(i, 'detail');

  const trees = useMemo(() => {
    const rand = rng(77 + i * 13);
    const out = [];
    const samples = Array.from({ length: 60 }, (_, k) => bez(L.f, k / 59));
    for (let y = 20; y < 560 + 180; y += 32) {
      for (const side of [-1, 1]) {
        const p = samples.reduce((b, q) => (Math.abs(q[1] - y) < Math.abs(b[1] - y) ? q : b));
        const x = p[0] + side * (L.fw / 2 + 30 + rand() * 45 + (rand() < 0.5 ? 0 : 70 + rand() * 70));
        if (x < -150 || x > 510) continue;
        if (L.water && Math.hypot(L.water.x - x, L.water.y - y) < L.water.r + 20) continue;
        if (y < L.f.green[1] + 60 && Math.abs(x - L.f.green[0]) < L.gr + 40) continue;
        out.push({ x, y: y + rand() * 14, s: 1.6 + rand() * 0.8, kind: rand() < 0.4 ? 1 : 0 });
      }
    }
    return out.sort((a, b) => a.y - b.y);
  }, [i]);

  const mottles = useMemo(() => {
    const rand = rng(31 + i);
    return Array.from({ length: 16 }, (_, k) => blob(-130 + rand() * 620, rand() * 740, 40 + rand() * 50, 2000 + k + i, 0.4, 9));
  }, [i]);

  let ballEl = null;
  if (ball) {
    const par = HOLES[i].par;
    const shot = Math.min(par, Math.floor(ball.p * par + 1e-9));
    // Rest spots: drives and approaches along the line, then on the green, then the cup.
    const t = shot >= par - 1 ? 1 : (shot / (par - 1)) * 0.92;
    const p = bez(L.f, t);
    const n = normalAt(L.f, t);
    const off = shot === 0 || shot >= par - 1 ? 0 : (shot % 2 ? 1 : -1) * L.fw * 0.18;
    let bx = p[0] + n[0] * off;
    let by = p[1] + n[1] * off;
    if (shot === par - 1) { bx = L.f.green[0] - L.gr * 0.45; by = L.f.green[1] + L.gr * 0.35; }
    if (shot >= par || ball.state === 'sunk') { bx = L.f.green[0] + L.gr * 0.15; by = L.f.green[1]; }
    if (ball.state === 'wet' && L.water) { bx = L.water.x; by = L.water.y; }
    const sunk = shot >= par || ball.state === 'sunk';
    ballEl = (
      <g className="ball" style={{ transform: `translate(${bx}px, ${by}px)` }}>
        {ball.state === 'wet' && !L.water ? null : ball.state === 'wet' ? (
          <g>
            <circle r="16" fill="none" stroke="#FFFFFF" strokeWidth="2.5" className="ripple" />
            <circle r="8" fill="none" stroke="#FFFFFF" strokeWidth="2" />
          </g>
        ) : !sunk ? (
          <g>
            <ellipse cx="2" cy="4" rx="6" ry="2.5" fill={INK} opacity="0.25" />
            <circle r="6.5" fill="#FFFFFF" stroke={INK} strokeWidth="2.2" />
            <circle cx="-2" cy="-2" r="1" fill="#C9C3B6" />
            <circle cx="1.5" cy="0.5" r="1" fill="#C9C3B6" />
          </g>
        ) : (
          <circle r="0" />
        )}
      </g>
    );
  }

  return (
    <svg className={`hole-view ${className}`} viewBox={`-130 0 620 ${560 + padBottom}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Hole ${i + 1}, par ${HOLES[i].par}`}>
      <Defs id={id} />
      <rect x="-130" width="620" height={560 + padBottom} fill={ROUGH} />
      {mottles.map((d, k) => <path key={k} d={d} fill={ROUGH_DARK} opacity="0.35" />)}
      <HoleArt i={i} h={h} frame="detail" gold={gold} sh={sh} ball={ballEl} number={false} />
      <g filter={sh}>
        {trees.map((t, k) => <Tree key={k} {...t} />)}
      </g>
      <rect x="-130" width="620" height={560 + padBottom} fill="#FFF" filter={`url(#${id('grain')})`} pointerEvents="none" />
    </svg>
  );
}

export { holeFrame };
