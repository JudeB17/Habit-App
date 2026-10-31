// Local-first store. The shape mirrors the Supabase tables in supabase/schema.sql
// (habits, habit_logs, study_sessions, plot_state) so a sync layer can be added in phase 2
// without touching the screens.

import { useSyncExternalStore } from 'react';
import { dayKey, addDays, weekday, weekStart } from './dates.js';
import {
  CATEGORIES, RESOURCE_KEYS, yieldFor, bucketPasses, MIN_VERIFIED_SESSION_S,
  buildingById, shortfall,
} from './game.js';

const KEY = 'isle.v1';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

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
  return {
    v: 1,
    profile: { name: '', onboarded: false },
    settings: { sound: true },
    habits: seedHabits(),
    logs: {},        // { [habitId]: { [day]: { value, trust, bucket, done, yield, source } } }
    sessions: [],    // { id, habitId, startedAt, endedAt, durationS }
    timer: null,     // { habitId, startedAt, accumMs, running, plannedMin, day }
    buildings: ['house'],
    spent: {},       // { timber: 40, ... }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initialState(), ...JSON.parse(raw) };
  } catch { /* corrupted or blocked storage: start fresh */ }
  return initialState();
}

let state = load();
const listeners = new Set();

function commit(next) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota or private mode */ }
  listeners.forEach((l) => l());
}

export const getState = () => state;
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

/** Days in a row with at least one completed habit. */
export function overallStreak(s, day = dayKey()) {
  const anyDone = (d) => s.habits.some((h) => isDone(s, h.id, d));
  let d = anyDone(day) ? day : addDays(day, -1);
  let n = 0;
  while (anyDone(d) && n < 1000) { n++; d = addDays(d, -1); }
  return n;
}

/** Days since anything was last completed, used for weeds. */
export function idleDays(s, day = dayKey()) {
  // Never count days before the first habit existed, or a brand new island starts weedy.
  const first = s.habits.reduce((m, h) => (h.createdAt < m ? h.createdAt : m), day);
  for (let i = 0; i < 30; i++) {
    if (addDays(day, -i) < first) return i;
    const d = addDays(day, -i);
    if (s.habits.some((h) => isDone(s, h.id, d))) return i;
  }
  return 30;
}

export function resources(s) {
  const out = Object.fromEntries(RESOURCE_KEYS.map((k) => [k, 0]));
  for (const h of s.habits) {
    const r = CATEGORIES[h.category].resource;
    for (const log of Object.values(s.logs[h.id] ?? {})) out[r] += log.yield ?? 0;
  }
  for (const [k, v] of Object.entries(s.spent)) out[k] -= v;
  return out;
}

// ---------- mutations ----------

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
  return (log.yield ?? 0) - (prev.yield ?? 0);
}

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

  // ----- study timer -----
  startTimer(habitId, plannedMin) {
    commit({ ...state, timer: { habitId, startedAt: Date.now(), accumMs: 0, running: true, plannedMin, day: dayKey() } });
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
  /** Ends the session and credits it. Returns { durationS, verified, gained }. */
  stopTimer() {
    const t = state.timer;
    if (!t) return null;
    const durationS = Math.round(timerElapsedMs(t) / 1000);
    const verified = durationS >= MIN_VERIFIED_SESSION_S;
    const session = { id: uid(), habitId: t.habitId, startedAt: t.startedAt, endedAt: Date.now(), durationS };
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

  // ----- island -----
  build(buildingId) {
    const b = buildingById(buildingId);
    if (!b || state.buildings.includes(buildingId)) return false;
    if (Object.keys(shortfall(b.cost, resources(state))).length) return false;
    const spent = { ...state.spent };
    for (const [k, v] of Object.entries(b.cost)) spent[k] = (spent[k] ?? 0) + v;
    commit({ ...state, spent, buildings: [...state.buildings, buildingId] });
    return true;
  },

  // ----- profile and data -----
  setProfile(patch) { commit({ ...state, profile: { ...state.profile, ...patch } }); },
  setSettings(patch) { commit({ ...state, settings: { ...state.settings, ...patch } }); },
  exportData() { return JSON.stringify(state, null, 2); },
  importData(json) {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed.habits) || typeof parsed.logs !== 'object') throw new Error('Not an Isle backup');
    commit({ ...initialState(), ...parsed });
  },
  reset() { commit(initialState()); },
};

export function timerElapsedMs(t) {
  if (!t) return 0;
  return t.accumMs + (t.running ? Date.now() - t.startedAt : 0);
}
