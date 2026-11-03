// Friends, feed and cloud backup over Supabase. The phone stays the source of truth: this
// module only publishes what's local (card, feed events, backup) and reads friends' data.
// Every write is an upsert keyed by the client, so a retry after a dropped connection can't
// duplicate anything.

import { createClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { getState, subscribe, clearOutbox, actions, isFresh } from './store.js';
import { buildCard, dayPayload } from './card.js';
import { dayKey } from './dates.js';

// Both values are public by design (row level security does the protecting), so the
// project's own pair is the fallback when the build variables are missing or malformed.
const ENV_URL = import.meta.env.VITE_SUPABASE_URL;
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const okUrl = (u) => /^https?:\/\/[^/]+\.supabase\.co\/?$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(u ?? '');
const URL = okUrl(ENV_URL) ? ENV_URL : 'https://ewxzobteztmhmmciqklg.supabase.co';
const KEY = ENV_KEY || 'sb_publishable_EeU3mFiIBAi_g235ge6lqg_-6rJoLVe';
export const configured = !!(URL && KEY);

export const sb = configured
  ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fairway.auth', detectSessionInUrl: false } })
  : null;

export const REACTIONS = ['🔥', '👏', '⛳', '😮', '😬'];
const CACHE = 'fairway.social';
const EVENT_TTL_MS = 48 * 3600_000;   // queued events older than this are dropped, not posted
const BACKUP_EVERY_MS = 2 * 60_000;
const POLL_MS = 90_000;

// ---------- state ----------

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE)) ?? {}; } catch { return {}; }
}
const cached = loadCache();

let st = {
  ready: !configured,
  user: null,              // { id, email }
  groups: cached.groups ?? [],
  friends: cached.friends ?? [],   // [{ id, name, card, updatedAt }] including you
  feed: cached.feed ?? [],
  sync: { status: 'idle', at: cached.syncAt ?? null, error: null },
  loading: false,
  backup: null,            // { updatedAt } of the cloud backup, if any
  fetched: false,          // a refresh has succeeded this session
};
const subs = new Set();
function set(patch) {
  st = { ...st, ...patch };
  subs.forEach((l) => l());
}
function persist() {
  try {
    localStorage.setItem(CACHE, JSON.stringify({ groups: st.groups, friends: st.friends, feed: st.feed.slice(0, 40), syncAt: st.sync.at }));
  } catch { /* quota */ }
}
export const getSocial = () => st;
export function useSocial() {
  return useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => st);
}

const errText = (e) => (e?.message || String(e)).replace(/^AuthApiError: /, '');
function check({ data, error }) { if (error) throw error; return data; }

// ---------- auth ----------

export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(errText(error));
  if (!data.session) throw new Error('Account made, but email confirmation is switched on in Supabase. Turn it off (Auth > Providers > Email) or confirm the email, then sign in.');
}

export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password' : errText(error));
}

export async function signOut() {
  await sb.auth.signOut();
  try { localStorage.removeItem(CACHE); } catch { /* ignore */ }
  last = {};
  set({ user: null, fetched: false, groups: [], friends: [], feed: [], backup: null, sync: { status: 'idle', at: null, error: null } });
}

// ---------- groups ----------

export async function createGroup(name) {
  check(await sb.rpc('create_group', { group_name: name }));
  await refresh();
}

export async function joinGroup(code) {
  const { error } = await sb.rpc('join_group', { code });
  if (error) throw new Error(errText(error));
  await refresh();
  await publish(true);
  await refresh();
}

export async function leaveGroup(groupId) {
  check(await sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', st.user.id));
  await refresh();
}

// ---------- reading ----------

let refreshing = null;
/** Groups, friends (with their cards) and the feed. Safe to call often. */
export function refresh() {
  if (!sb || !st.user) return Promise.resolve();
  if (refreshing) return refreshing;
  set({ loading: true });
  refreshing = (async () => {
    try {
      const [groups, people, events, backup] = await Promise.all([
        sb.from('groups').select('id, name, invite_code, created_by, group_members(user_id)').order('created_at'),
        sb.from('profiles').select('id, name, cards(card, updated_at)'),
        sb.from('events')
          .select('id, user_id, key, kind, payload, created_at, updated_at, reactions(user_id, emoji), comments(id, user_id, body, created_at)')
          .order('updated_at', { ascending: false })
          .limit(60),
        sb.from('backups').select('updated_at, install:data->>installId').maybeSingle(),
      ]);
      const friends = check(people).map((p) => {
        const c = Array.isArray(p.cards) ? p.cards[0] : p.cards;
        return { id: p.id, name: p.name || c?.card?.name || 'Golfer', card: c?.card ?? null, updatedAt: c?.updated_at ?? null };
      });
      const feed = check(events).map((e) => ({
        ...e,
        comments: [...(e.comments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      }));
      set({
        groups: check(groups).map((g) => ({ ...g, members: (g.group_members ?? []).map((m) => m.user_id) })),
        friends,
        feed,
        backup: backup.data ? { updatedAt: backup.data.updated_at, install: backup.data.install } : null,
        sync: { ...st.sync, error: null },
        fetched: true,
      });
      persist();
    } catch (e) {
      set({ sync: { ...st.sync, status: 'error', error: errText(e) } });
    } finally {
      set({ loading: false });
      refreshing = null;
    }
  })();
  return refreshing;
}

// ---------- writing ----------

let last = {};          // fingerprints of what was last uploaded, to skip no-op writes
let publishing = null;

const strip = (card) => JSON.stringify({ ...card, at: 0 });

/** Push card, today's feed card, queued events and (throttled) the backup. */
export function publish(force = false, backupNow = false) {
  if (!sb || !st.user) return Promise.resolve();
  if (publishing) return publishing.then(() => publish(force, backupNow));
  publishing = (async () => {
    const s = getState();
    const uid = st.user.id;
    set({ sync: { ...st.sync, status: 'syncing' } });
    try {
      const name = s.profile.name || 'Golfer';
      if (force || last.name !== name) {
        check(await sb.from('profiles').upsert({ id: uid, name }));
        last.name = name;
      }

      // The cloud backup was made by another install (a reinstall, Safari vs the home screen
      // app, a second phone). Publishing now would put this phone's course over the real one,
      // and logging a single habit used to be enough to overwrite the backup. Hold everything
      // until the backup is restored, or the user says this phone's data is the one to keep.
      const holdBack = otherInstall(s);

      const card = buildCard(s);
      const fp = strip(card);
      if (!holdBack && (force || last.card !== fp)) {
        check(await sb.from('cards').upsert({ user_id: uid, card }));
        last.card = fp;
      }

      // One feed card per day, updated in place as habits get ticked off.
      const day = dayKey();
      const dp = dayPayload(s, day);
      const dfp = JSON.stringify(dp);
      if (!holdBack && (force || last.day !== dfp)) {
        const key = `day:${day}`;
        if (dp.done > 0 || dp.focusMin > 0) {
          check(await sb.from('events').upsert({ user_id: uid, key, kind: 'day', payload: dp }, { onConflict: 'user_id,key' }));
        } else {
          check(await sb.from('events').delete().eq('user_id', uid).eq('key', key));
        }
        last.day = dfp;
      }

      const queue = s.outbox ?? [];
      if (queue.length) {
        const fresh = queue.filter((e) => Date.now() - e.at < EVENT_TTL_MS);
        if (fresh.length) {
          const rows = fresh.map((e) => ({ user_id: uid, key: e.key, kind: e.kind, payload: e.payload, created_at: new Date(e.at).toISOString(), updated_at: new Date(e.at).toISOString() }));
          check(await sb.from('events').upsert(rows, { onConflict: 'user_id,key', ignoreDuplicates: true }));
        }
        clearOutbox(queue.map((e) => e.key));
      }

      // A fresh install never overwrites a backup: restore first, or log something.
      if (!holdBack && (!isFresh(s) || s.settings.claimBackup) && (force || backupNow || !last.backupAt || Date.now() - last.backupAt > BACKUP_EVERY_MS)) {
        const { timer, outbox, ...data } = s;
        check(await sb.from('backups').upsert({ user_id: uid, data: { ...data, savedAt: Date.now() } }));
        last.backupAt = Date.now();
      }

      set({ sync: { status: 'idle', at: Date.now(), error: null } });
      persist();
    } catch (e) {
      set({ sync: { ...st.sync, status: 'error', error: errText(e) } });
    } finally {
      publishing = null;
    }
  })();
  return publishing;
}

/** True when the cloud backup belongs to another install and this phone hasn't claimed it. */
export function otherInstall(s = getState()) {
  return !!(st.backup && st.backup.install !== s.installId && !s.settings.claimBackup);
}

/** Keep this phone's data and replace the cloud backup with it. */
export async function keepThisPhone() {
  actions.claimBackup();
  last = {};
  await publish(true);
  await refresh();
}

export async function restoreBackup() {
  const { data } = check(await sb.from('backups').select('data').single());
  const { savedAt, ...rest } = data;
  actions.importData(JSON.stringify(rest));
  last = {};
  await publish(true);
  await refresh();
}

// ---------- reactions and comments ----------
// Optimistic: the feed updates immediately and rolls back if the write fails.

function patchEvent(id, fn) {
  set({ feed: st.feed.map((e) => (e.id === id ? fn(e) : e)) });
}

export async function toggleReaction(eventId, emoji) {
  const me = st.user.id;
  const ev = st.feed.find((e) => e.id === eventId);
  const had = ev?.reactions.some((r) => r.user_id === me && r.emoji === emoji);
  const before = ev;
  patchEvent(eventId, (e) => ({
    ...e,
    reactions: had ? e.reactions.filter((r) => !(r.user_id === me && r.emoji === emoji)) : [...e.reactions, { user_id: me, emoji }],
  }));
  const res = had
    ? await sb.from('reactions').delete().match({ event_id: eventId, user_id: me, emoji })
    : await sb.from('reactions').insert({ event_id: eventId, user_id: me, emoji });
  if (res.error && res.error.code !== '23505') { patchEvent(eventId, () => before); throw new Error(errText(res.error)); }
}

export async function addComment(eventId, body) {
  const text = body.trim().slice(0, 500);
  if (!text) return;
  const row = check(await sb.from('comments').insert({ event_id: eventId, user_id: st.user.id, body: text }).select('id, user_id, body, created_at').single());
  patchEvent(eventId, (e) => ({ ...e, comments: [...e.comments, row] }));
}

export async function deleteComment(eventId, commentId) {
  check(await sb.from('comments').delete().eq('id', commentId));
  patchEvent(eventId, (e) => ({ ...e, comments: e.comments.filter((c) => c.id !== commentId) }));
}

// ---------- lifecycle ----------

let started = false;
/** Called once at app start. Wires auth, auto-publish on local changes, and polling. */
export function startSocial() {
  if (!sb || started) return;
  started = true;

  const onUser = (session) => {
    const u = session?.user ? { id: session.user.id, email: session.user.email } : null;
    const changed = u?.id !== st.user?.id;
    set({ user: u, ready: true });
    // Refresh first: it tells publish whether a cloud backup exists.
    if (u && changed) { last = {}; refresh().then(() => publish(true)).then(refresh); }
  };
  sb.auth.getSession().then(({ data }) => onUser(data.session));
  sb.auth.onAuthStateChange((_evt, session) => onUser(session));

  // Debounced publish whenever local state changes.
  let timer = null;
  subscribe(() => {
    if (!st.user) return;
    clearTimeout(timer);
    timer = setTimeout(() => publish(), 4000);
  });

  const visible = () => document.visibilityState === 'visible';
  document.addEventListener('visibilitychange', () => {
    if (!st.user) return;
    if (visible()) refresh();
    else publish(false, true); // last chance before iOS freezes the page: back up now
  });
  setInterval(() => { if (st.user && visible()) refresh(); }, POLL_MS);
  window.addEventListener('online', () => { if (st.user) publish().then(refresh); });
}

/** Friendly "x ago" for timestamps (ms or ISO). */
export function ago(t) {
  if (!t) return 'never';
  const ms = Date.now() - (typeof t === 'number' ? t : Date.parse(t));
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
