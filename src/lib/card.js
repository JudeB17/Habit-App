// What friends can see. Built from local state on every publish, so it can never drift from
// what's on the phone. Habit visibility: 'friends' shows the name and number, 'summary'
// counts as "a private habit", 'private' is left out entirely.

import { getLog, isDone, overallStreak, isDueOn, balance } from './store.js';
import { dayKey, addDays, daysBetween, formatMinutes } from './dates.js';
import { bucketById, courseRating, DECAY_PER_DAY, DECAY_FLOOR } from './game.js';

function habitLine(h, log) {
  if (h.type === 'count') return `${log.value} ${h.unit}`.trim();
  if (h.type === 'duration') return formatMinutes(log.value);
  if (h.type === 'limit') return bucketById(log.bucket)?.label.toLowerCase() ?? '';
  return '';
}

/** Today's habits as friends see them, plus focus totals. */
export function dayPayload(s, day = dayKey()) {
  const due = s.habits.filter((h) => !h.archived && h.visibility !== 'private' && isDueOn(s, h, day));
  const lines = [];
  let hidden = 0;
  for (const h of s.habits) {
    if (h.archived || h.visibility === 'private' || !isDone(s, h.id, day)) continue;
    if (h.visibility === 'summary') { hidden++; continue; }
    const log = getLog(s, h.id, day);
    lines.push({ name: h.name, cat: h.category, detail: habitLine(h, log), trust: log.trust });
  }
  const sessions = s.sessions.filter((x) => dayKey(new Date(x.endedAt)) === day);
  const focusMin = Math.round(sessions.reduce((a, x) => a + x.durationS, 0) / 60);
  const runs = s.runs.filter((r) => dayKey(new Date(r.startedAt)) === day);
  const ok = runs.reduce((a, r) => a + r.results.filter((x) => x === 'ok').length, 0);
  const fail = runs.reduce((a, r) => a + r.results.filter((x) => x === 'fail').length, 0);
  return { day, lines, hidden, done: lines.length + hidden, due: due.length, focusMin, blocks: { ok, fail }, streak: overallStreak(s, day) };
}

/** Week focus minutes and habit hit rate, for the friends list. */
function weekSummary(s, today) {
  const from = addDays(today, -6);
  const focusMin = Math.round(s.sessions.filter((x) => dayKey(new Date(x.endedAt)) >= from).reduce((a, x) => a + x.durationS, 0) / 60);
  let due = 0;
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    for (const h of s.habits) {
      if (h.archived || h.visibility === 'private' || h.createdAt > d || !isDueOn(s, h, d)) continue;
      due++;
      if (isDone(s, h.id, d)) done++;
    }
  }
  return { focusMin, hit: due ? Math.round((100 * done) / due) : null };
}

/** The whole public snapshot. The course is sent as-is so friends can render it. */
export function buildCard(s) {
  const today = dayKey();
  const c = s.course;
  return {
    v: 1,
    name: s.profile.name || 'Golfer',
    today: dayPayload(s, today),
    week: weekSummary(s, today),
    course: {
      holes: c.holes.map((h) => ({ cond: Math.round(h.cond * 10) / 10, lv: h.lv, damage: h.damage })),
      clubhouse: c.clubhouse,
      lastDecay: c.lastDecay,
    },
    barn: s.barn,
    items: s.items,
    worth: Math.round(balance(s)),
    at: Date.now(),
  };
}

/**
 * A friend's course as of now: their snapshot, plus the decay that has happened since
 * they last opened the app. Same rule as the local store.
 */
export function friendCourse(card, today = dayKey()) {
  const c = card?.course;
  if (!c?.holes) return null;
  const days = Math.max(0, daysBetween(c.lastDecay, today));
  const holes = c.holes.map((h) => ({
    ...h,
    damage: h.damage ?? [],
    cond: days && h.cond > DECAY_FLOOR ? Math.max(DECAY_FLOOR, h.cond - DECAY_PER_DAY * days) : h.cond,
  }));
  const course = { holes, clubhouse: c.clubhouse ?? 0, lastDecay: today, nextHole: 0 };
  const avg = Math.round(holes.reduce((a, h) => a + h.cond, 0) / holes.length);
  return { course, avg, rating: courseRating(course), damaged: holes.reduce((a, h) => a + h.damage.length, 0), staleDays: days };
}
