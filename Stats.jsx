import { useState } from 'react';
import Icon from '../components/Icons.jsx';
import { useStore, getLog, isDone, isScheduledDay, weekCount, habitStreak, bestStreak } from '../lib/store.js';
import { dayKey, addDays, weekStart, parseKey, formatMinutes } from '../lib/dates.js';
import { CATEGORIES } from '../lib/game.js';

const BLUE = '#3B5FD0';
const RED = '#EF4F3A';

/** Focus minutes on a day: everything logged against duration habits (timer, Pomodoro, manual). */
function focusOn(s, day) {
  return s.habits.filter((h) => h.type === 'duration').reduce((a, h) => a + (getLog(s, h.id, day)?.value ?? 0), 0);
}

/** Share of scheduled days (or weeks) hit in the last 30 days. */
function hitRate(s, h, today) {
  const from = h.createdAt > addDays(today, -29) ? h.createdAt : addDays(today, -29);
  if (h.schedule.kind === 'weekly') {
    let met = 0, total = 0;
    for (let wk = weekStart(from); wk <= today; wk = addDays(wk, 7)) {
      const ok = weekCount(s, h, addDays(wk, 6)) >= h.schedule.times;
      if (wk === weekStart(today) && !ok) continue; // this week isn't over
      total++; if (ok) met++;
    }
    return total ? met / total : null;
  }
  let met = 0, total = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (!isScheduledDay(h, d)) continue;
    const ok = isDone(s, h.id, d);
    if (d === today && !ok) continue; // today isn't over
    total++; if (ok) met++;
  }
  return total ? met / total : null;
}

export default function Stats() {
  const s = useStore();
  const today = dayKey();
  const [range, setRange] = useState('days');

  // ----- focus series -----
  let series;
  if (range === 'days') {
    series = Array.from({ length: 14 }, (_, k) => {
      const d = addDays(today, k - 13);
      return { key: d, label: parseKey(d).toLocaleDateString('en-AU', { weekday: 'narrow' }), sub: parseKey(d).getDate(), v: focusOn(s, d), now: d === today };
    });
  } else {
    const ws = weekStart(today);
    series = Array.from({ length: 8 }, (_, k) => {
      const w = addDays(ws, (k - 7) * 7);
      let v = 0;
      for (let j = 0; j < 7; j++) v += focusOn(s, addDays(w, j));
      return { key: w, label: `${parseKey(w).getDate()}/${parseKey(w).getMonth() + 1}`, v, now: w === ws };
    });
  }
  const half = series.length / 2;
  const recent = series.slice(half).reduce((a, x) => a + x.v, 0);
  const prior = series.slice(0, half).reduce((a, x) => a + x.v, 0);
  const change = prior > 0 ? Math.round(((recent - prior) / prior) * 100) : null;
  const total = series.reduce((a, x) => a + x.v, 0);

  // ----- Pomodoro -----
  const blocks = s.runs.flatMap((r) => r.results);
  const ok = blocks.filter((b) => b === 'ok').length;
  const fail = blocks.length - ok;
  const rate = blocks.length ? Math.round((ok / blocks.length) * 100) : null;
  let longest = 0;
  for (const r of s.runs) {
    let run = 0;
    for (const b of r.results) { run = b === 'ok' ? run + 1 : 0; longest = Math.max(longest, run); }
  }
  const pomoDays = Array.from({ length: 14 }, (_, k) => {
    const d = addDays(today, k - 13);
    let o = 0, f = 0;
    for (const r of s.runs) {
      if (dayKey(new Date(r.startedAt)) !== d) continue;
      for (const b of r.results) b === 'ok' ? o++ : f++;
    }
    return { key: d, ok: o, fail: f, label: parseKey(d).toLocaleDateString('en-AU', { weekday: 'narrow' }), now: d === today };
  });

  const habits = s.habits.filter((h) => !h.archived);

  return (
    <main className="screen">
      <header className="top"><div><span className="eyebrow">HOW IT'S GOING</span><h1>Stats</h1></div></header>

      <section className="stat-card">
        <div className="stat-head">
          <div>
            <h2>Focus time</h2>
            <span className="muted small">
              {formatMinutes(total)} in {range === 'days' ? '14 days' : '8 weeks'}
              {change !== null && <> · <b className={change >= 0 ? 'up' : 'down'}>{change >= 0 ? '+' : ''}{change}%</b> vs the {range === 'days' ? 'week' : '4 weeks'} before</>}
            </span>
          </div>
          <div className="seg-mini" role="tablist">
            <button className={range === 'days' ? 'on' : ''} onClick={() => setRange('days')} role="tab" aria-selected={range === 'days'}>Days</button>
            <button className={range === 'weeks' ? 'on' : ''} onClick={() => setRange('weeks')} role="tab" aria-selected={range === 'weeks'}>Weeks</button>
          </div>
        </div>
        <BarChart data={series.map((x) => ({ ...x, parts: [{ v: x.v, c: BLUE }], tip: `${x.label === x.sub ? '' : ''}${range === 'days' ? parseKey(x.key).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : `Week of ${x.label}`}: ${formatMinutes(x.v)}` }))} unit="min" />
      </section>

      <section className="stat-card">
        <div className="stat-head"><div><h2>Pomodoro</h2><span className="muted small">All time</span></div></div>
        <div className="stat-tiles four">
          <div className="stile"><strong>{ok}</strong><span>Finished</span></div>
          <div className={`stile ${fail ? 'bad' : ''}`}><strong>{fail}</strong><span>Failed</span></div>
          <div className="stile"><strong>{rate === null ? '·' : `${rate}%`}</strong><span>Completion</span></div>
          <div className="stile"><strong>{longest}</strong><span>Best stack</span></div>
        </div>
        {blocks.length > 0 ? (
          <>
            <div className="legend">
              <span><i style={{ background: BLUE }} /> Finished</span>
              <span><i style={{ background: RED }} className="hatch" /> Failed</span>
              <span className="muted">Last 14 days</span>
            </div>
            <BarChart
              data={pomoDays.map((x) => ({ ...x, parts: [{ v: x.ok, c: BLUE }, { v: x.fail, c: RED, hatch: true }], tip: `${parseKey(x.key).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' })}: ${x.ok} finished, ${x.fail} failed` }))}
              unit="blocks" integer
            />
          </>
        ) : <p className="muted small">No Pomodoro blocks yet. Start one from a timed habit on Today.</p>}
      </section>

      <section className="stat-card">
        <div className="stat-head"><div><h2>Habits</h2><span className="muted small">Hit rate over the last 30 days</span></div></div>
        <div className="habit-stats">
          {habits.map((h) => {
            const r = hitRate(s, h, today);
            const unit = h.schedule.kind === 'weekly' ? 'wk' : 'd';
            return (
              <div key={h.id} className="hstat">
                <span className="tile sm" style={{ background: CATEGORIES[h.category].tint }}><Icon name={CATEGORIES[h.category].icon} size={16} /></span>
                <div className="grow">
                  <div className="hstat-top"><strong>{h.name}</strong><span className="mono">{r === null ? 'New' : `${Math.round(r * 100)}%`}</span></div>
                  <span className="rate-bar"><span style={{ width: `${(r ?? 0) * 100}%` }} /></span>
                  <span className="muted small"><Icon name="flame" size={12} /> {habitStreak(s, h, today)}{unit} now · best {bestStreak(s, h, today)}{unit}</span>
                </div>
              </div>
            );
          })}
          {habits.length === 0 && <p className="muted small">No habits yet.</p>}
        </div>
      </section>
    </main>
  );
}

/** Small bar chart: rounded data-ends on the baseline, 2px gaps between stacked parts, tap for value. */
function BarChart({ data, unit, integer = false }) {
  const [sel, setSel] = useState(null);
  const W = 340, H = 150, padL = 30, padB = 22, padT = 8;
  const max = Math.max(1, ...data.map((d) => d.parts.reduce((a, p) => a + p.v, 0)));
  const nice = niceMax(max, integer);
  const step = (W - padL) / data.length;
  const bw = Math.min(16, step * 0.55);
  const y = (v) => padT + (H - padT - padB) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  const fmt = (v) => (unit === 'min' ? (nice >= 120 ? `${Math.round(v / 60)}h` : `${Math.round(v)}m`) : Math.round(v));
  const shown = sel !== null ? data[sel] : null;

  return (
    <div className="chart">
      <div className="chart-tip" aria-live="polite">{shown ? shown.tip : 'Tap a bar'}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart">
        <defs>
          <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill={RED} /><path d="M0 0 V5" stroke="#FFFFFF" strokeWidth="1.6" opacity="0.6" />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#161616" strokeOpacity={t === 0 ? 0.6 : 0.12} strokeWidth="1" />
            <text x={padL - 5} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#4A4A4A" fontWeight="700">{fmt(t)}</text>
          </g>
        ))}
        {data.map((d, k) => {
          const cx = padL + step * k + step / 2;
          let acc = 0;
          const segs = d.parts.filter((p) => p.v > 0);
          return (
            <g key={d.key} onClick={() => setSel(sel === k ? null : k)} style={{ cursor: 'pointer' }}>
              <rect x={cx - step / 2} y={padT} width={step} height={H - padT} fill="transparent" />
              {segs.map((p, j) => {
                const y0 = y(acc);
                acc += p.v;
                const y1 = y(acc);
                const top = j === segs.length - 1;
                const h = Math.max(0, y0 - y1 - (j > 0 ? 2 : 0));
                return (
                  <path
                    key={j}
                    d={top ? roundTop(cx - bw / 2, y1, bw, h, Math.min(4, h)) : `M${cx - bw / 2} ${y1} h${bw} v${h} h${-bw} Z`}
                    fill={p.hatch ? 'url(#hatch)' : p.c}
                    opacity={sel === null || sel === k ? 1 : 0.4}
                  />
                );
              })}
              <text x={cx} y={H - 7} textAnchor="middle" fontSize="10" fontWeight={d.now ? 800 : 600} fill={d.now ? '#161616' : '#4A4A4A'}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function roundTop(x, y, w, h, r) {
  if (h <= 0) return '';
  return `M${x} ${y + h} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h} Z`;
}

function niceMax(v, integer) {
  if (integer) return Math.max(2, Math.ceil(v / 2) * 2);
  const steps = [30, 60, 120, 180, 240, 360, 480, 600, 900, 1200, 1800, 2400, 3600];
  return steps.find((x) => x >= v) ?? Math.ceil(v / 600) * 600;
}
