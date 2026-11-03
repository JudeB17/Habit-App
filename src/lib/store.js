// Local-first store. The phone is the source of truth. lib/social.js publishes a public card,
// feed events from `outbox`, and a private backup to Supabase when signed in.

import { useSyncExternalStore } from 'react';
import { dayKey, addDays, weekday, weekStart, daysBetween, parseKey } from './dates.js';
import {
  yieldFor, bucketPasses, MIN_VERIFIED_SESSION_S, LEAVE_GRACE_MS, blockPay, STACK_BONUS,
  STACK_DROP_CHANCE, newCourse, DECAY_PER_DAY, DECAY_FLOOR, DAMAGE_HIT, DAMAGE_FLOOR,
  DAMAGE_KINDS, REPAIR_COST, maintainCost, PART_COST, PART_MAX, CLUBHOUSE, rollDrop,
  dropById, RARITY, STREAK_MILESTONES, HOLE_COUNT, POMO_PRESETS, upkeepCost, REPAIR_MATS,
  START_MATERIALS, MATERIAL_KEYS, BARN, OVERFLOW_PRICE, rollChest, CHESTS, GOAL_SIZES, goalChest,
  AMENITIES, AMENITY_KEYS, AMENITY_MAX, TIERS, PROMOTE_DAYS, DEMOTE_DAYS, CONSISTENCY_DAYS, HIT_FADE_DAYS,
  qualityScore, consistencyMult, courseRating, facilitiesScore, FINES, DAILY_FINE_CAP, POP_HITS,
  MAX_FINE_DAYS, NEGLECT, PARTS,
} from './game.js';

const KEY = 'isle.v1'; // kept so existing data on the phone carries over
const HB_KEY = 'fairway.hb';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Game events (drops, failures) for the UI to show. Not persisted. */
export const bus = new EventTarget();
const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

function seedHabits() {
  const now = dayKey();
  return [
    { id: uid(), name: 'Study', type: 'duration', category: 'study', target: 120, unit: 'min',
      schedule: { kind: 'days', days: [1, 2, 3, 4, 5] }, visibility: 'friends', createdAt: now },
    { id: uid(), name: 'Read', type: 'count', category: 'reading', target: 20, unit: 'pages',
      schedule: { kind: 'daily' }, visibility: 'friends', createdAt: now },
    { id: uid(), name: 'Gym', type: 'check', category: 'fitness', target: 1, unit: '',
      schedule: { kind: 'weekly', times: 3 }, visibility: 'friends', createdAt: now },
    { id: uid(), name: 'Instagram', type: 'limit', category: 'screen', target: 60, unit: 'min',
      schedule: { kind: 'daily' }, visibility: 'friends', createdAt: now },
  ];
}

function initialState() {
  const p = POMO_PRESETS[0];
  return {
    v: 2,
    installId: uid(), // tells this phone's backup apart from another phone's
    profile: { name: '', onboarded: false },
    settings: { sound: true, pomo: { focus: p.focus, brk: p.brk, long: p.long, every: p.every, blocks: p.blocks } },
    habits: seedHabits(),
    logs: {},        // { [habitId]: { [day]: { value, trust, bucket, done, yield, source } } }
    sessions: [],    // { id, habitId, startedAt, endedAt, durationS, kind: 'open' | 'pomo', runId? }
    runs: [],        // Pomodoro runs: { id, habitId, startedAt, focusMin, planned, results: ['ok' | 'fail'] }
    timer: null,
    earned: 0,       // money from outside habit logs: blocks, bonuses, duplicate drops
    spent: 0,
    course: newCourse(dayKey()),
    items: {},       // { [dropId]: count }
    goals: [],       // { id, title, due, createdAt, doneAt }
    milestones: {},  // { [habitId]: [7, 21] } streak drops already paid
    materials: { ...START_MATERIALS },
    barn: 0,
    chests: [],      // unopened: { id, kind, reason, at }
    outbox: [],      // feed events waiting to publish: { key, kind, payload, at }
    ...freshRep(dayKey()),
  };
}

/** Popularity, tier, penalty and amenity state. `since` stops fines reaching back past install. */
function freshRep(today) {
  return {
    amen: { carts: 0, shop: 0, range: 0 },
    rep: { tier: 0, up: 0, down: 0, evalFrom: today, since: today, neglect: 0 },
    hits: [],        // popularity hits: { day, pts, why }, fade over HIT_FADE_DAYS
    fines: [],       // recent fines for the UI: { id, day, amount, label }
    finesTotal: 0,   // all fines ever, subtracted from the balance
    report: null,    // the last daily bill, shown once
  };
}

/** v1 was the island. Logs and habits carry over; island spending is refunded as money. */
function migrate(raw) {
  if (raw.v === 2) {
    const out = { ...initialState(), ...raw };
    out.goals = out.goals.map((g) => ({ size: 'medium', ...g }));
    if (!raw.rep) {
      // First open with tiers: nothing before today gets fined, and overdue goals are let off.
      const today = dayKey();
      Object.assign(out, freshRep(today));
      out.goals = out.goals.map((g) => (!g.doneAt && g.due < today ? { ...g, fined: true } : g));
    }
    return out;
  }
  const base = initialState();
  const keep = ['profile', 'habits', 'logs', 'sessions'];
  const out = { ...base };
  for (const k of keep) if (raw[k] !== undefined) out[k] = raw[k];
  out.settings = { ...base.settings, ...(raw.settings ?? {}), pomo: base.settings.pomo };
  out.sessions = (out.sessions ?? []).map((x) => ({ kind: 'open', ...x }));
  return out;
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (raw) {
    try { return migrate(JSON.parse(raw)); } catch {
      // Never let a fresh state silently replace data we couldn't read: park it first.
      try { localStorage.setItem(`${KEY}.broken.${Date.now()}`, raw); } catch { /* full */ }
    }
  }
  return initialState();
}

let state = load();
const listeners = new Set();

// ---------- second copy in IndexedDB ----------
// localStorage is the working copy. A mirror in IndexedDB survives the localStorage key being
// lost or corrupted, and the app asks the browser to treat its storage as persistent.
const IDB = { db: 'fairway', store: 'kv', key: 'state' };
function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const open = indexedDB.open(IDB.db, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(IDB.store);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(IDB.store, mode);
      const req = fn(tx.objectStore(IDB.store));
      tx.oncomplete = () => { resolve(req?.result ?? null); open.result.close(); };
      tx.onerror = () => { reject(tx.error); open.result.close(); };
    };
  });
}
let mirrorTimer = null;
function mirror() {
  if (!state.profile.onboarded) return; // never mirror an empty phone over a real copy
  clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(() => {
    const { timer, ...data } = state;
    idb('readwrite', (os) => os.put(JSON.stringify({ ...data, timer }), IDB.key)).catch(() => {});
  }, 800);
}

/** On start: ask for persistent storage, and if this phone looks empty, recover from the mirror. */
export async function recoverLocal() {
  try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
  if (state.profile.onboarded) { mirror(); return false; }
  try {
    const raw = await idb('readonly', (os) => os.get(IDB.key));
    if (!raw) return false;
    const saved = migrate(JSON.parse(raw));
    if (!saved.profile?.onboarded) return false;
    commit(saved);
    emit('recovered', {});
    return true;
  } catch { return false; }
}

function commit(next) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota or private mode */ }
  mirror();
  listeners.forEach((l) => l());
}

export const getState = () => state;
/** Plain subscription for non-React code (the sync layer). */
export function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }
/** True for a phone with nothing logged yet, e.g. a fresh install before restoring a backup. */
export const isFresh = (s = state) => !Object.values(s.logs).some((d) => Object.keys(d).length) && !s.sessions.length && !s.goals.length;
export function useStore(selector = (s) => s) {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => selector(state),
  );
}

// ---------- scheduling and completion ----------

export function isScheduledDay(habit, day) {
  const s = habit.schedule;
  if (s.kind === 'days') return s.days.includes(weekday(day));
  return true; // daily, and weekly quotas are offered every day
}

export const getLog = (s, habitId, day) => s.logs[habitId]?.[day];
export const isDone = (s, habitId, day) => !!getLog(s, habitId, day)?.done;

/** Completions in the week containing `day`, optionally excluding `day` itself. */
export function weekCount(s, habit, day, excludeDay = false) {
  const start = weekStart(day);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (d > day || (excludeDay && d === day)) break;
    if (isDone(s, habit.id, d)) n++;
  }
  return n;
}

/** Should this habit appear on the Today list for `day`? */
export function isDueOn(s, habit, day) {
  if (habit.archived) return false;
  if (habit.schedule.kind === 'weekly') {
    return isDone(s, habit.id, day) || weekCount(s, habit, day, true) < habit.schedule.times;
  }
  return isScheduledDay(habit, day);
}

function completes(habit, log) {
  if (!log) return false;
  switch (habit.type) {
    case 'check': return (log.value ?? 0) >= 1;
    case 'count': return (log.value ?? 0) >= habit.target;
    case 'duration': return (log.value ?? 0) >= habit.target;
    case 'limit': return !!log.bucket && bucketPasses(log.bucket, habit.target);
    default: return false;
  }
}

/**
 * Streak ending at `day`. Daily and weekday habits count days; weekly habits count weeks
 * where the quota was met. If `day` itself isn't done yet the count starts from the
 * previous period, so an unfinished today doesn't read as a broken streak.
 */
export function habitStreak(s, habit, day = dayKey()) {
  const floor = addDays(habit.createdAt, -1);
  if (habit.schedule.kind === 'weekly') {
    let wk = weekStart(day);
    const metWeek = (ws) => weekCount(s, habit, addDays(ws, 6)) >= habit.schedule.times;
    if (!metWeek(wk)) wk = addDays(wk, -7);
    let n = 0;
    while (wk > floor && metWeek(wk) && n < 200) { n++; wk = addDays(wk, -7); }
    return n;
  }
  let d = isDone(s, habit.id, day) ? day : addDays(day, -1);
  let n = 0;
  for (let i = 0; i < 400 && d > floor; i++, d = addDays(d, -1)) {
    if (!isScheduledDay(habit, d)) continue;
    if (isDone(s, habit.id, d)) n++; else break;
  }
  return n;
}

/** Longest streak ever, in the same units as habitStreak. */
export function bestStreak(s, habit, today = dayKey()) {
  let best = 0;
  let run = 0;
  if (habit.schedule.kind === 'weekly') {
    for (let wk = weekStart(habit.createdAt); wk <= today; wk = addDays(wk, 7)) {
      const met = weekCount(s, habit, addDays(wk, 6)) >= habit.schedule.times;
      run = met ? run + 1 : (wk === weekStart(today) ? run : 0);
      best = Math.max(best, run);
    }
    return best;
  }
  for (let d = habit.createdAt; d <= today; d = addDays(d, 1)) {
    if (!isScheduledDay(habit, d)) continue;
    if (isDone(s, habit.id, d)) { run++; best = Math.max(best, run); } else if (d !== today) run = 0;
  }
  return best;
}

/** Days in a row with at least one completed habit. */
export function overallStreak(s, day = dayKey()) {
  const anyDone = (d) => s.habits.some((h) => isDone(s, h.id, d));
  let d = anyDone(day) ? day : addDays(day, -1);
  let n = 0;
  while (anyDone(d) && n < 1000) { n++; d = addDays(d, -1); }
  return n;
}

export function balance(s) {
  let total = s.earned - s.spent - (s.finesTotal ?? 0);
  for (const byDay of Object.values(s.logs)) for (const log of Object.values(byDay)) total += log.yield ?? 0;
  return total;
}

// ---------- popularity ----------

/** 0 to 1: share of scheduled habits hit over the last 14 days (not today), blended with
 *  Pomodoro completion. null when there's no history yet. */
export function consistency(s, today = dayKey()) {
  const from = addDays(today, -CONSISTENCY_DAYS);
  let due = 0;
  let done = 0;
  for (let d = from; d < today; d = addDays(d, 1)) {
    for (const h of s.habits) {
      if (h.archived || h.createdAt >= d) continue;
      if (h.schedule.kind === 'weekly') {
        // Count a weekly habit once, on the last day of a week that's over.
        if (addDays(weekStart(d), 6) !== d || h.createdAt > weekStart(d)) continue;
        due += h.schedule.times;
        done += Math.min(h.schedule.times, weekCount(s, h, d));
        continue;
      }
      if (!isScheduledDay(h, d)) continue;
      due++;
      if (isDone(s, h.id, d)) done++;
    }
  }
  const t0 = parseKey(from).getTime();
  let ok = 0;
  let fail = 0;
  for (const r of s.runs) {
    if (r.startedAt < t0) continue;
    for (const x of r.results) x === 'ok' ? ok++ : fail++;
  }
  const hit = due ? done / due : null;
  const pomo = ok + fail ? ok / (ok + fail) : null;
  if (hit === null && pomo === null) return null;
  if (hit === null) return pomo;
  if (pomo === null) return hit;
  return 0.75 * hit + 0.25 * pomo;
}

export function hitPoints(s, today = dayKey()) {
  return (s.hits ?? []).reduce((a, x) => a + x.pts * Math.max(0, 1 - daysBetween(x.day, today) / HIT_FADE_DAYS), 0);
}

/** Popularity and what it's made of. */
export function popularity(s, today = dayKey()) {
  const amen = s.amen ?? {};
  const rating = courseRating(s.course);
  const facilities = facilitiesScore(s.course.clubhouse, amen);
  const quality = qualityScore(s.course, amen);
  const c = consistency(s, today);
  const mult = consistencyMult(c ?? 0.5);
  const hits = hitPoints(s, today);
  const pop = Math.max(0, Math.min(100, Math.round(quality * mult - hits)));
  return { pop, rating, facilities: Math.round(facilities), quality: Math.round(quality), consistency: c, mult, hits: Math.round(hits * 10) / 10 };
}

/** Where you are on the tier ladder and how close the next move is. */
export function tierStatus(s, today = dayKey()) {
  const r = s.rep ?? { tier: 0, up: 0, down: 0 };
  const p = popularity(s, today);
  const tier = TIERS[r.tier];
  const next = TIERS[r.tier + 1] ?? null;
  return { ...p, tierIdx: r.tier, tier, next, up: r.up, down: r.down };
}

// ---------- internal mutations ----------

/** Merge a patch into a log, recompute done and yield. Returns the change in yield. */
function writeLog(habitId, day, patch) {
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) return 0;
  const prev = getLog(state, habitId, day) ?? { value: 0, trust: 'honour', source: 'manual' };
  const log = { ...prev, ...patch };
  log.done = completes(habit, log);

  // Yield uses the streak *before* this day so the bonus can't feed itself.
  const streakBefore = log.done ? habitStreak(state, habit, addDays(day, -1)) : 0;
  log.yield = log.done ? yieldFor(log.trust, streakBefore) : 0;

  commit({
    ...state,
    logs: { ...state.logs, [habitId]: { ...(state.logs[habitId] ?? {}), [day]: log } },
  });
  if (log.done && !prev.done) checkMilestone(habit, day);
  return (log.yield ?? 0) - (prev.yield ?? 0);
}

function checkMilestone(habit, day) {
  const n = habitStreak(state, habit, day);
  const list = habit.schedule.kind === 'weekly' ? STREAK_MILESTONES.weeks : STREAK_MILESTONES.days;
  const paid = state.milestones[habit.id] ?? [];
  const hit = list.find((m) => n >= m && !paid.includes(m));
  if (!hit) return;
  commit({ ...state, milestones: { ...state.milestones, [habit.id]: [...paid, hit] } });
  const unit = habit.schedule.kind === 'weekly' ? 'week' : 'day';
  giveChest('chest', `${hit} ${unit} ${habit.name} streak`);
  post('milestone', { habit: habit.visibility === 'friends' ? habit.name : null, n: hit, unit });
}

/** Adds a random drop to the collection. Duplicates convert to money. */
function giveItem(boost = false) {
  const d = rollDrop(Math.random, boost);
  const owned = state.items[d.id] ?? 0;
  const dupe = owned > 0 ? RARITY[d.rarity].dupe : 0;
  commit({ ...state, items: { ...state.items, [d.id]: owned + 1 }, earned: state.earned + dupe });
  return { item: d, dupe };
}

/** Chests wait unopened in the barn until you tap them. */
/** Queue a feed event. social.js flushes it when signed in; stale ones are dropped there. */
function post(kind, payload) {
  const ev = { key: `ev:${uid()}`, kind, payload, at: Date.now() };
  commit({ ...state, outbox: [...(state.outbox ?? []), ev].slice(-60) });
}

/** Habit name as friends may see it. Private and summary habits stay anonymous. */
const publicName = (habitId) => {
  const h = state.habits.find((x) => x.id === habitId);
  return h?.visibility === 'friends' ? h.name : null;
};

export function clearOutbox(keys) {
  commit({ ...state, outbox: (state.outbox ?? []).filter((e) => !keys.includes(e.key)) });
}

function giveChest(kind, reason) {
  const c = { id: uid(), kind, reason, at: Date.now() };
  commit({ ...state, chests: [...state.chests, c] });
  emit('chest-earned', c);
}

export const barnCap = (s) => BARN[s.barn].cap;

/** Add materials, capped by the barn. Overflow is sold. Returns { added, sold }. */
function stock(mats) {
  const cap = barnCap(state);
  const next = { ...state.materials };
  const added = {};
  let sold = 0;
  for (const [k, v] of Object.entries(mats)) {
    const room = Math.max(0, cap - (next[k] ?? 0));
    added[k] = Math.min(room, v);
    sold += v - added[k];
    next[k] = (next[k] ?? 0) + added[k];
  }
  commit({ ...state, materials: next, earned: state.earned + sold * OVERFLOW_PRICE });
  return { added, sold };
}

function addHit(pts, why, day = dayKey()) {
  commit({ ...state, hits: [...(state.hits ?? []), { day, pts, why }] });
}

function setHole(i, patch) {
  const holes = state.course.holes.map((h, j) => (j === i ? { ...h, ...patch } : h));
  commit({ ...state, course: { ...state.course, holes } });
}

/** The hole a block is played on: each block in a run is the next hole. */
export const blockHole = (t) => (t.hole + t.completed) % HOLE_COUNT;

function damageHole(i) {
  const holes = state.course.holes;
  const kinds = Object.keys(DAMAGE_KINDS);
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const h = holes[i];
  setHole(i, {
    cond: Math.max(DAMAGE_FLOOR, h.cond - DAMAGE_HIT),
    damage: [...h.damage, { id: uid(), kind, seed: Math.floor(Math.random() * 1e6) }],
  });
  return { hole: i, kind };
}

// ---------- Pomodoro engine ----------
// Everything is stored as timestamps so the run survives the app being closed. A heartbeat
// in its own storage key records when the app was last on screen. On return, the time away
// is checked against every focus window it overlaps.

export function heartbeat(now = Date.now()) {
  try { localStorage.setItem(HB_KEY, String(now)); } catch { /* ignore */ }
}
export function lastSeen() {
  try { return Number(localStorage.getItem(HB_KEY)) || null; } catch { return null; }
}

export const breakLength = (t) => {
  const done = t.completed;
  return done > 0 && done % t.cfg.every === 0 ? t.cfg.long : t.cfg.brk;
};
/** Time spent paused in the current focus block, including a pause that's still going. */
export const pausedFor = (t, now = Date.now()) => (t.pausedMs ?? 0) + (t.pausedAt ? now - t.pausedAt : 0);
export function phaseEnd(t) {
  if (t.phase === 'focus') return t.phaseStart + t.cfg.focus * 60_000 + pausedFor(t);
  if (t.phase === 'break') return t.phaseStart + breakLength(t) * 60_000;
  return null;
}

function updateRun(runId, result) {
  const runs = state.runs.map((r) => (r.id === runId ? { ...r, results: [...r.results, result] } : r));
  commit({ ...state, runs });
}

function completeBlock(t, end) {
  const pay = blockPay(t.cfg.focus);
  const durationS = t.cfg.focus * 60;
  const session = { id: uid(), habitId: t.habitId, startedAt: t.phaseStart, endedAt: end, durationS, kind: 'pomo', runId: t.runId };
  commit({ ...state, sessions: [...state.sessions, session], earned: state.earned + pay });
  updateRun(t.runId, 'ok');
  const day = dayKey(new Date(end));
  const prev = getLog(state, t.habitId, day);
  const verified = durationS >= MIN_VERIFIED_SESSION_S;
  const gained = writeLog(t.habitId, day, {
    value: (prev?.value ?? 0) + t.cfg.focus,
    trust: verified || prev?.trust === 'verified' ? 'verified' : prev?.trust ?? 'honour',
    source: 'timer',
  });
  const course = state.course;
  commit({ ...state, course: { ...course, nextHole: (course.nextHole + 1) % HOLE_COUNT } });
  emit('block', { pay, gained, habitId: t.habitId });
  return { ...t, completed: t.completed + 1, pay: t.pay + pay };
}

function failBlock(t, reason) {
  updateRun(t.runId, 'fail');
  addHit(POP_HITS.block, 'Failed a Pomodoro block');
  const dmg = damageHole(blockHole(t));
  const course = state.course;
  commit({ ...state, course: { ...course, nextHole: (course.nextHole + 1) % HOLE_COUNT } });
  emit('fail', { ...dmg, reason });
  post('stack', { habit: publicName(t.habitId), blocks: t.completed, planned: t.blocks, focus: t.cfg.focus, failed: true, hole: dmg.hole + 1, why: reason });
  return { ...t, phase: 'failed', failReason: reason, damage: dmg, phaseStart: Date.now(), pausedAt: null };
}

function finishRun(t) {
  let bonus = 0;
  if (t.blocks >= 2) bonus = Math.round(t.pay * STACK_BONUS);
  if (bonus) commit({ ...state, earned: state.earned + bonus });
  const out = { ...t, phase: 'done', bonus, phaseStart: Date.now() };
  post('stack', { habit: publicName(t.habitId), blocks: t.completed, planned: t.blocks, focus: t.cfg.focus, failed: false });
  if (t.blocks >= 4 && Math.random() < STACK_DROP_CHANCE) {
    commit({ ...state, timer: out });
    giveChest('crate', `${t.blocks} block stack`);
  }
  return out;
}

/**
 * Move the run forward to `now`. `gap` is a stretch the app was off screen
 * ({ from, to }). Returns nothing; commits the new timer state.
 */
function advancePomo(now, gap) {
  let t = state.timer;
  if (!t || t.kind !== 'pomo') return;
  for (let guard = 0; guard < 50; guard++) {
    if (t.phase === 'focus') {
      const end = phaseEnd(t);
      if (gap) {
        const away = Math.min(gap.to, end) - Math.max(gap.from, t.phaseStart);
        if (away > LEAVE_GRACE_MS) { t = failBlock(t, 'left'); break; }
      }
      if (now < end) break;
      t = completeBlock(t, end);
      if (t.completed >= t.blocks) { t = finishRun(t); break; }
      t = { ...t, phase: 'break', phaseStart: end, pausedMs: 0, pausedAt: null };
      continue;
    }
    if (t.phase === 'break') {
      const end = phaseEnd(t);
      if (now < end) break;
      // Away when the break ran out: wait for a tap, so the next block can't fail before you're back.
      const awayAtEnd = gap && gap.from <= end;
      t = awayAtEnd ? { ...t, phase: 'ready', phaseStart: end } : { ...t, phase: 'focus', phaseStart: end, pausedMs: 0, pausedAt: null };
      if (t.phase === 'ready') break;
      continue;
    }
    break;
  }
  if (t !== state.timer) commit({ ...state, timer: t });
}

// ---------- course upkeep ----------

function applyDecay(today = dayKey()) {
  const c = state.course;
  const days = daysBetween(c.lastDecay, today);
  if (days <= 0) return;
  const holes = c.holes.map((h) => ({
    ...h,
    cond: h.cond <= DECAY_FLOOR ? h.cond : Math.max(DECAY_FLOOR, h.cond - DECAY_PER_DAY * days),
  }));
  commit({ ...state, course: { ...c, holes, lastDecay: today } });
}

// ---------- the daily bill ----------
// Runs on open. Every full day since the last run is judged: missed habits and blown limits
// are fined, overdue goals are fined, neglected holes and amenities lose levels, and the tier
// counters move. The result is kept in state.report so the app can show it once.

const fineId = () => uid();

function judgeDay(d, rep, out) {
  const habitFines = [];
  for (const h of state.habits) {
    if (h.archived || h.createdAt >= d) continue;
    if (h.schedule.kind === 'weekly') {
      const ws = weekStart(d);
      if (addDays(ws, 6) !== d || h.createdAt > ws) continue;
      const short = h.schedule.times - weekCount(state, h, d);
      for (let k = 0; k < short; k++) habitFines.push({ amount: FINES.missed, pts: POP_HITS.missed, label: `${h.name}: weekly quota short` });
      continue;
    }
    if (!isScheduledDay(h, d) || isDone(state, h.id, d)) continue;
    const log = getLog(state, h.id, d);
    if (h.type === 'limit' && log?.bucket) habitFines.push({ amount: FINES.limit, pts: POP_HITS.limit, label: `${h.name}: over the limit` });
    else habitFines.push({ amount: FINES.missed, pts: POP_HITS.missed, label: `${h.name}: missed` });
  }
  let room = DAILY_FINE_CAP;
  for (const f of habitFines) {
    const amount = Math.min(room, f.amount);
    room -= amount;
    if (amount < f.amount) out.capped = true;
    out.fines.push({ id: fineId(), day: d, amount, label: f.label });
    out.hits.push({ day: d, pts: f.pts, why: f.label });
  }

  const goals = state.goals.map((g) => {
    if (g.fined || g.due !== d || (g.doneAt && g.doneAt <= d)) return g;
    const size = g.size ?? 'medium';
    const label = `Missed ${size} goal: ${g.title}`;
    out.fines.push({ id: fineId(), day: d, amount: FINES.goal[size], label });
    out.hits.push({ day: d, pts: POP_HITS.goal[size], why: label });
    return { ...g, fined: true };
  });
  commit({ ...state, goals });

  // Neglect. Uses today's condition for every day judged, so a long absence counts in full.
  const holes = state.course.holes.map((h, i) => {
    const floorDays = h.cond <= DECAY_FLOOR ? (h.floorDays ?? 0) + 1 : 0;
    if (floorDays < NEGLECT.holeDays) return { ...h, floorDays };
    const part = ['fairway', 'green', 'bunkers', 'tee'].sort((a, b) => h.lv[b] - h.lv[a])[0];
    if (h.lv[part] === 0) return { ...h, floorDays: 0 };
    out.regress.push(`Hole ${i + 1} ${PARTS.find((p) => p.id === part).label.toLowerCase()} dropped to level ${h.lv[part] - 1}`);
    return { ...h, floorDays: 0, lv: { ...h.lv, [part]: h.lv[part] - 1 } };
  });
  commit({ ...state, course: { ...state.course, holes } });

  const avg = holes.reduce((a, h) => a + h.cond, 0) / holes.length;
  rep.neglect = avg <= NEGLECT.amenityCond ? (rep.neglect ?? 0) + 1 : 0;
  if (rep.neglect >= NEGLECT.amenityDays) {
    rep.neglect = 0;
    const amen = state.amen;
    const best = [...AMENITY_KEYS].sort((a, b) => amen[b] - amen[a])[0];
    if (amen[best] > 0) {
      out.regress.push(`${AMENITIES[best].label} dropped to ${AMENITIES[best].levels[amen[best] - 1].toLowerCase()}`);
      commit({ ...state, amen: { ...amen, [best]: amen[best] - 1 } });
    }
  }
}

function moveTier(rep, today, out) {
  const { pop } = popularity(state, today);
  const next = TIERS[rep.tier + 1];
  const cur = TIERS[rep.tier];
  if (next && pop >= next.min) { rep.up++; rep.down = 0; }
  else if (pop < cur.min) { rep.down++; rep.up = 0; }
  else { rep.up = 0; rep.down = 0; }
  if (rep.up >= PROMOTE_DAYS) {
    out.tier = { from: rep.tier, to: rep.tier + 1 };
    rep.tier++; rep.up = 0;
  } else if (rep.down >= DEMOTE_DAYS && rep.tier > 0) {
    out.tier = { from: rep.tier, to: rep.tier - 1 };
    rep.tier--; rep.down = 0;
  }
}

function rollover(today = dayKey()) {
  applyDecay(today);
  const rep = { ...state.rep };
  if (rep.evalFrom >= today) return;
  let from = rep.evalFrom < rep.since ? rep.since : rep.evalFrom;
  const skipped = Math.max(0, daysBetween(from, today) - MAX_FINE_DAYS);
  if (skipped) from = addDays(today, -MAX_FINE_DAYS);
  const out = { days: [], fines: [], hits: [], regress: [], tier: null, capped: false, skipped };
  for (let d = from; d < today; d = addDays(d, 1)) {
    out.days.push(d);
    judgeDay(d, rep, out);
    // Hits land before the tier check so the day's misses count against it.
    commit({ ...state, hits: [...(state.hits ?? []), ...out.hits.filter((x) => x.day === d)] });
    moveTier(rep, today, out);
  }
  rep.evalFrom = today;
  const total = out.fines.reduce((a, f) => a + f.amount, 0);
  const hits = (state.hits ?? []).filter((x) => daysBetween(x.day, today) < HIT_FADE_DAYS);
  const any = out.fines.length || out.regress.length || out.tier;
  commit({
    ...state,
    rep,
    hits,
    finesTotal: (state.finesTotal ?? 0) + total,
    fines: [...out.fines, ...(state.fines ?? [])].slice(0, 60),
    report: any ? { ...out, total, at: Date.now() } : state.report,
  });
  if (out.tier) {
    const up = out.tier.to > out.tier.from;
    post('build', { what: 'tier', name: TIERS[out.tier.to].name, up });
  }
}

/** Pay a cost: a number (money only) or { money, mats }. All or nothing. */
function spend(cost) {
  const c = typeof cost === 'number' ? { money: cost, mats: {} } : cost;
  if (!canAfford(state, c)) return false;
  const mats = { ...state.materials };
  for (const [k, v] of Object.entries(c.mats ?? {})) mats[k] -= v;
  commit({ ...state, spent: state.spent + (c.money ?? 0), materials: mats });
  return true;
}

export function canAfford(s, c) {
  if (balance(s) < (c.money ?? 0)) return false;
  return Object.entries(c.mats ?? {}).every(([k, v]) => (s.materials[k] ?? 0) >= v);
}

export const repairCost = (kind) => ({ money: REPAIR_COST, mats: REPAIR_MATS[kind] });

/** Cost to bring every hole to 100, counted as one job. */
export const upkeepAll = (s) => upkeepCost(s.course.holes.reduce((a, h) => a + (100 - h.cond), 0));

// ---------- public actions ----------

export const actions = {
  toggleCheck(habitId, day = dayKey()) {
    const done = isDone(state, habitId, day);
    return writeLog(habitId, day, { value: done ? 0 : 1, trust: 'honour', source: 'manual' });
  },
  setCount(habitId, value, day = dayKey()) {
    return writeLog(habitId, day, { value: Math.max(0, value), source: 'manual' });
  },
  addMinutes(habitId, minutes, day = dayKey()) {
    const prev = getLog(state, habitId, day);
    return writeLog(habitId, day, { value: Math.max(0, (prev?.value ?? 0) + minutes) });
  },
  setBucket(habitId, bucket, day = dayKey()) {
    return writeLog(habitId, day, { bucket, value: bucket ? 1 : 0, trust: 'honour', source: 'manual' });
  },
  clearLog(habitId, day = dayKey()) {
    const habitLogs = { ...(state.logs[habitId] ?? {}) };
    delete habitLogs[day];
    commit({ ...state, logs: { ...state.logs, [habitId]: habitLogs } });
  },

  // ----- open timer -----
  startTimer(habitId, plannedMin) {
    commit({ ...state, timer: { kind: 'open', habitId, startedAt: Date.now(), accumMs: 0, running: true, plannedMin, day: dayKey() } });
  },
  pauseTimer() {
    const t = state.timer;
    if (!t?.running) return;
    commit({ ...state, timer: { ...t, running: false, accumMs: t.accumMs + (Date.now() - t.startedAt) } });
  },
  resumeTimer() {
    const t = state.timer;
    if (!t || t.running) return;
    commit({ ...state, timer: { ...t, running: true, startedAt: Date.now() } });
  },
  cancelTimer() { commit({ ...state, timer: null }); },
  /** Ends an open session and credits it. Returns { durationS, verified, gained }. */
  stopTimer() {
    const t = state.timer;
    if (!t || t.kind === 'pomo') return null;
    const durationS = Math.round(timerElapsedMs(t) / 1000);
    const verified = durationS >= MIN_VERIFIED_SESSION_S;
    const session = { id: uid(), habitId: t.habitId, startedAt: t.startedAt, endedAt: Date.now(), durationS, kind: 'open' };
    commit({ ...state, timer: null, sessions: [...state.sessions, session] });
    if (durationS < 60) return { durationS, verified: false, gained: 0 };
    const prev = getLog(state, t.habitId, t.day);
    const gained = writeLog(t.habitId, t.day, {
      value: (prev?.value ?? 0) + durationS / 60,
      trust: verified || prev?.trust === 'verified' ? 'verified' : prev?.trust ?? 'honour',
      source: 'timer',
    });
    return { durationS, verified, gained };
  },

  // ----- Pomodoro -----
  startPomo(habitId, cfg) {
    const now = Date.now();
    const run = { id: uid(), habitId, startedAt: now, focusMin: cfg.focus, planned: cfg.blocks, results: [] };
    heartbeat(now);
    commit({
      ...state,
      settings: { ...state.settings, pomo: cfg },
      runs: [...state.runs, run],
      timer: {
        kind: 'pomo', habitId, runId: run.id, hole: state.course.nextHole,
        cfg: { focus: cfg.focus, brk: cfg.brk, long: cfg.long, every: cfg.every },
        blocks: cfg.blocks, completed: 0, pay: 0, phase: 'focus', phaseStart: now,
      },
    });
  },
  /** Called every second while on screen, and once with `gap` when the app comes back. */
  tickPomo(gap) { advancePomo(Date.now(), gap); },
  /** Start the next block after a break you were away for, or skip a break early. */
  startNextBlock() {
    const t = state.timer;
    if (t?.kind !== 'pomo' || !['ready', 'break'].includes(t.phase)) return;
    commit({ ...state, timer: { ...t, phase: 'focus', phaseStart: Date.now(), pausedMs: 0, pausedAt: null } });
  },
  /** Pause a focus block. The clock stops, but leaving the app still fails the block. */
  pausePomo() {
    const t = state.timer;
    if (t?.kind !== 'pomo' || t.phase !== 'focus' || t.pausedAt) return;
    commit({ ...state, timer: { ...t, pausedAt: Date.now() } });
  },
  resumePomo() {
    const t = state.timer;
    if (t?.kind !== 'pomo' || !t.pausedAt) return;
    commit({ ...state, timer: { ...t, pausedMs: (t.pausedMs ?? 0) + (Date.now() - t.pausedAt), pausedAt: null } });
  },
  addBlock() {
    const t = state.timer;
    if (t?.kind !== 'pomo' || !['focus', 'break', 'ready'].includes(t.phase)) return;
    commit({ ...state, timer: { ...t, blocks: t.blocks + 1 } });
    const runs = state.runs.map((r) => (r.id === t.runId ? { ...r, planned: r.planned + 1 } : r));
    commit({ ...state, runs });
  },
  /** Quit during focus: counts as a failed block. */
  giveUpBlock() {
    const t = state.timer;
    if (t?.kind !== 'pomo' || t.phase !== 'focus') return;
    const next = failBlock(t, 'quit'); // commits run and course changes first
    commit({ ...state, timer: next });
  },
  /** End a run between blocks. No penalty; the stack bonus needs every planned block. */
  endRun() {
    const t = state.timer;
    if (t?.kind !== 'pomo') return;
    if (['break', 'ready'].includes(t.phase)) {
      const runs = state.runs.map((r) => (r.id === t.runId ? { ...r, planned: t.completed } : r));
      commit({ ...state, runs, timer: { ...t, phase: 'done', bonus: 0, endedEarly: true, phaseStart: Date.now() } });
      if (t.completed > 0) post('stack', { habit: publicName(t.habitId), blocks: t.completed, planned: t.blocks, focus: t.cfg.focus, failed: false, early: true });
      return;
    }
    commit({ ...state, timer: null });
  },
  dismissTimer() { commit({ ...state, timer: null }); },

  // ----- course -----
  /** Daily upkeep: decay, then the bill for any days since the last open. */
  decay() { rollover(); },
  dismissReport() { commit({ ...state, report: null }); },
  buildAmenity(key) {
    const lv = state.amen[key];
    if (lv >= AMENITY_MAX || !spend(AMENITIES[key].cost[lv])) return false;
    commit({ ...state, amen: { ...state.amen, [key]: lv + 1 } });
    post('build', { what: 'amenity', name: `${AMENITIES[key].label}: ${AMENITIES[key].levels[lv + 1]}` });
    return true;
  },
  maintain(i) {
    const h = state.course.holes[i];
    if (!spend(maintainCost(h.cond))) return false;
    setHole(i, { cond: 100, floorDays: 0 });
    return true;
  },
  /** Maintain worst holes first, as many as money and materials cover. Returns holes done. */
  maintainAll() {
    const holes = state.course.holes;
    const order = holes.map((h, i) => i).filter((i) => holes[i].cond < 100).sort((a, b) => holes[a].cond - holes[b].cond);
    const fixed = [];
    let pts = 0;
    for (const i of order) {
      const next = pts + (100 - holes[i].cond);
      if (!canAfford(state, upkeepCost(next))) break;
      pts = next;
      fixed.push(i);
    }
    if (!fixed.length || !spend(upkeepCost(pts))) return 0;
    commit({ ...state, course: { ...state.course, holes: state.course.holes.map((h, i) => (fixed.includes(i) ? { ...h, cond: 100, floorDays: 0 } : h)) } });
    return fixed.length;
  },
  repair(i, damageId) {
    const h = state.course.holes[i];
    const d = h.damage.find((x) => x.id === damageId);
    if (!d || !spend(repairCost(d.kind))) return false;
    setHole(i, { damage: state.course.holes[i].damage.filter((x) => x.id !== damageId) });
    return true;
  },
  upgradeBarn() {
    const next = state.barn + 1;
    if (next >= BARN.length || !spend(BARN[next].cost)) return false;
    commit({ ...state, barn: next });
    post('build', { what: 'barn', name: BARN[next].name });
    return true;
  },
  /** Open a chest: materials into the barn, maybe an item. Returns what came out. */
  openChest(id) {
    const c = state.chests.find((x) => x.id === id);
    if (!c) return null;
    commit({ ...state, chests: state.chests.filter((x) => x.id !== id) });
    const roll = rollChest(c.kind, state.materials, barnCap(state));
    const { added, sold } = stock(roll.mats);
    const item = roll.item ? giveItem(CHESTS[c.kind].boost) : null;
    if (item && !item.dupe) post('item', { id: item.item.id, name: item.item.name, rarity: item.item.rarity });
    return { chest: c, mats: roll.mats, added, sold, item };
  },
  upgrade(i, part) {
    const h = state.course.holes[i];
    const lv = h.lv[part];
    if (lv >= PART_MAX || !spend(PART_COST[lv])) return false;
    setHole(i, { lv: { ...h.lv, [part]: lv + 1 } });
    return true;
  },
  upgradeClubhouse() {
    const next = state.course.clubhouse + 1;
    if (next >= CLUBHOUSE.length || !spend(CLUBHOUSE[next].cost)) return false;
    commit({ ...state, course: { ...state.course, clubhouse: next } });
    post('build', { what: 'clubhouse', name: CLUBHOUSE[next].name });
    return true;
  },

  // ----- goals -----
  /** Size sets the chest and the shortest allowed deadline. */
  addGoal(title, due, size = 'small') {
    const today = dayKey();
    const min = addDays(today, GOAL_SIZES[size].minDays);
    const d = due < min ? min : due;
    commit({ ...state, goals: [...state.goals, { id: uid(), title, due: d, size, createdAt: today, doneAt: null }] });
  },
  /** A goal set on an earlier day pays a chest; one size smaller if it's late. */
  completeGoal(id) {
    const g = state.goals.find((x) => x.id === id);
    if (!g || g.doneAt) return null;
    const today = dayKey();
    commit({ ...state, goals: state.goals.map((x) => (x.id === id ? { ...x, doneAt: today } : x)) });
    if (g.createdAt >= today) return { kind: 'same-day' };
    const late = today > g.due;
    const chest = goalChest(g.size ?? 'medium', late);
    giveChest(chest, `Goal: ${g.title}`);
    post('goal', { title: state.settings.shareGoals === false ? null : g.title, size: g.size ?? 'medium', late });
    return { kind: 'chest', chest, late };
  },
  deleteGoal(id) { commit({ ...state, goals: state.goals.filter((x) => x.id !== id) }); },

  // ----- habits -----
  saveHabit(habit) {
    const exists = state.habits.some((h) => h.id === habit.id);
    const habits = exists
      ? state.habits.map((h) => (h.id === habit.id ? habit : h))
      : [...state.habits, { ...habit, id: uid(), createdAt: dayKey() }];
    commit({ ...state, habits });
  },
  deleteHabit(habitId) {
    const logs = { ...state.logs };
    delete logs[habitId];
    commit({ ...state, habits: state.habits.filter((h) => h.id !== habitId), logs });
  },
  moveHabit(habitId, dir) {
    const i = state.habits.findIndex((h) => h.id === habitId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= state.habits.length) return;
    const habits = [...state.habits];
    [habits[i], habits[j]] = [habits[j], habits[i]];
    commit({ ...state, habits });
  },

  // ----- profile and data -----
  setProfile(patch) { commit({ ...state, profile: { ...state.profile, ...patch } }); },
  setSettings(patch) { commit({ ...state, settings: { ...state.settings, ...patch } }); },
  exportData() { return JSON.stringify(state, null, 2); },
  importData(json) {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed.habits) || typeof parsed.logs !== 'object') throw new Error('Not a Fairway backup');
    commit({ ...migrate(parsed), outbox: [] });
  },
  reset() {
    idb('readwrite', (os) => os.delete(IDB.key)).catch(() => {});
    commit(initialState());
  },
  /** This phone's data is the real copy: let it publish over a cloud backup from another install. */
  claimBackup() { commit({ ...state, settings: { ...state.settings, claimBackup: true } }); },
};

export function timerElapsedMs(t) {
  if (!t || t.kind === 'pomo') return 0;
  return t.accumMs + (t.running ? Date.now() - t.startedAt : 0);
}

export const dropOwned = (s, id) => (s.items[id] ?? 0) > 0;
export { dropById };
