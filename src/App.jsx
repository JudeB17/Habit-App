import { useEffect, useRef, useState } from 'react';
import Today from './screens/Today.jsx';
import CourseScreen from './screens/CourseScreen.jsx';
import Stats from './screens/Stats.jsx';
import Plan from './screens/Plan.jsx';
import Me from './screens/Me.jsx';
import Feed from './screens/Feed.jsx';
import FriendView from './screens/FriendView.jsx';
import { startSocial, useSocial, configured, restoreBackup, ago } from './lib/social.js';
import { AuthCard } from './screens/Feed.jsx';
import HabitEditor from './components/HabitEditor.jsx';
import TimerScreen from './components/TimerScreen.jsx';
import PomodoroScreen from './components/PomodoroScreen.jsx';
import { CourseMap, DropIcon } from './components/Course.jsx';
import { ChestArt, MaterialToken } from './components/Icons.jsx';
import { CountSheet, BucketSheet, StartTimerSheet } from './components/LogSheets.jsx';
import { payout, fx } from './components/fx.jsx';
import { useStore, actions, timerElapsedMs, getState, heartbeat, lastSeen, bus, phaseEnd, balance, recoverLocal } from './lib/store.js';
import { formatDuration } from './lib/dates.js';
import { RARITY, money, newCourse, CHESTS, MATERIALS, TIERS } from './lib/game.js';
import { sfx } from './lib/sound.js';

const TABS = [
  ['today', 'Today'],
  ['course', 'Course'],
  ['feed', 'Feed'],
  ['stats', 'Stats'],
  ['plan', 'Plan'],
  ['me', 'Me'],
];

/**
 * Leave detection for Pomodoro. A heartbeat is written every second while the app is on
 * screen. When it comes back (or is reopened), the time since the last heartbeat is the gap,
 * and the store checks it against the running focus block.
 */
function usePresence() {
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const hb = lastSeen();
      actions.decay();
      if (getState().timer?.kind === 'pomo') {
        actions.tickPomo(hb && now - hb > 1500 ? { from: hb, to: now } : undefined);
      }
      heartbeat(now);
    };
    check();
    const iv = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const hb = lastSeen();
      const now = Date.now();
      // A long gap while "visible" means the JS was frozen (phone locked without an event).
      if (hb && now - hb > 3000) return check();
      heartbeat(now);
      if (getState().timer?.kind === 'pomo') actions.tickPomo();
    }, 1000);
    const onVis = () => (document.visibilityState === 'hidden' ? heartbeat() : check());
    const onHide = () => heartbeat();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', check);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', check);
    };
  }, []);
}

export default function App() {
  const s = useStore();
  const [tab, setTab] = useState('today');
  const [sheet, setSheet] = useState(null); // { kind, habit }
  const [timerOpen, setTimerOpen] = useState(!!s.timer);
  const [opened, setOpened] = useState(null);
  const [friend, setFriend] = useState(null);
  usePresence();
  useEffect(() => { startSocial(); recoverLocal().then((ok) => ok && fx.toast('Your course was recovered from this phone\'s backup copy')); }, []);

  useEffect(() => {
    const onChest = (e) => { if (!e.detail.reason.startsWith('Goal')) fx.toast(`${CHESTS[e.detail.kind].label} earned: ${e.detail.reason}`); };
    const onBlock = (e) => { if (e.detail.pay) fx.toast(`Block done · +${money(e.detail.pay)}`); };
    bus.addEventListener('chest-earned', onChest);
    bus.addEventListener('block', onBlock);
    return () => { bus.removeEventListener('chest-earned', onChest); bus.removeEventListener('block', onBlock); };
  }, []);

  // A focus block can't be minimised, so reopen the screen if one is running.
  const pomoFocus = s.timer?.kind === 'pomo' && ['focus', 'failed', 'ready', 'done'].includes(s.timer.phase);
  useEffect(() => { if (pomoFocus) setTimerOpen(true); }, [pomoFocus]);

  const open = (kind) => (habit) => setSheet({ kind, habit });
  const close = () => setSheet(null);
  const result = (habit) => (gained) => setTimeout(() => payout(habit, gained), 200);

  function onTimer(habit) {
    if (s.timer) return setTimerOpen(true); // one session at a time
    setSheet({ kind: 'timer', habit });
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    if (tab === 'feed') try { localStorage.setItem('fairway.feedSeen', String(Date.now())); } catch { /* ignore */ }
  }, [tab]);

  if (!s.profile.onboarded) return <Onboarding />;

  const screenProps = {
    onOpenHabit: open('edit'),
    onNewHabit: () => setSheet({ kind: 'edit', habit: null }),
  };

  return (
    <div className={`app ${s.timer && !timerOpen ? 'has-pill' : ''}`}>
      {tab === 'today' && (
        <Today
          {...screenProps}
          onCount={open('count')}
          onBucket={open('bucket')}
          onTimer={onTimer}
          goCourse={() => setTab('course')}
        />
      )}
      {tab === 'course' && <CourseScreen onOpenChest={(id) => setOpened({ id, result: null })} />}
      {tab === 'feed' && <Feed onFriend={setFriend} />}
      {tab === 'stats' && <Stats />}
      {tab === 'plan' && <Plan />}
      {tab === 'me' && <Me {...screenProps} goFeed={() => setTab('feed')} />}
      {friend && <FriendView id={friend} onClose={() => setFriend(null)} />}

      {s.timer && !timerOpen && <TimerPill onOpen={() => setTimerOpen(true)} />}

      <nav className="tabbar" aria-label="Main">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'on' : ''}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => { if (tab !== id) sfx.tap(); setTab(id); }}
          >{label}{id === 'feed' && <FeedDot />}</button>
        ))}
      </nav>

      {sheet?.kind === 'edit' && <HabitEditor habit={sheet.habit} onClose={close} />}
      {sheet?.kind === 'count' && <CountSheet habit={sheet.habit} onClose={close} onResult={result(sheet.habit)} />}
      {sheet?.kind === 'bucket' && <BucketSheet habit={sheet.habit} onClose={close} onResult={result(sheet.habit)} />}
      {sheet?.kind === 'timer' && (
        <StartTimerSheet
          habit={sheet.habit}
          onClose={close}
          onResult={result(sheet.habit)}
          onStart={(min) => { actions.startTimer(sheet.habit.id, min); sfx.tap(); setTimerOpen(true); }}
          onStartPomo={(cfg) => { actions.startPomo(sheet.habit.id, cfg); sfx.tap(); setTimerOpen(true); }}
        />
      )}
      {s.timer?.kind === 'pomo' && timerOpen && <PomodoroScreen onClose={() => setTimerOpen(false)} />}
      {s.timer && s.timer.kind !== 'pomo' && timerOpen && <TimerScreen onClose={() => setTimerOpen(false)} />}
      {opened && <ChestOpen chestId={opened.id} onClose={() => setOpened(null)} />}
      {s.report && !(s.timer?.kind === 'pomo' && timerOpen) && !opened && <DailyBill report={s.report} onClose={() => { actions.dismissReport(); if (s.report.tier) setTab('course'); }} />}
    </div>
  );
}

/** Chest opening: tap to open, materials count up into the barn, then any item. */
function ChestOpen({ chestId, onClose }) {
  const s = useStore();
  const [res, setRes] = useState(null);
  const [step, setStep] = useState(0); // 0 closed, 1 materials, 2 item
  const chest = res?.chest ?? s.chests.find((c) => c.id === chestId);
  if (!chest) return null;

  function open() {
    sfx.build();
    const r = actions.openChest(chestId);
    setRes(r);
    setTimeout(() => setStep(1), 450);
  }
  const next = () => {
    if (step === 1 && res?.item) { sfx.drop(); setStep(2); }
    else onClose();
  };

  const item = res?.item?.item;
  return (
    <div className="drop-wrap" onClick={step ? next : undefined}>
      <div className="drop-modal" role="dialog" aria-modal="true" aria-label={CHESTS[chest.kind].label} onClick={(e) => e.stopPropagation()} style={{ '--rar': item ? RARITY[item.rarity].tint : '#FFE58A' }}>
        <span className="eyebrow">{chest.reason}</span>
        {step < 2 ? (
          <>
            <button className={`chest-stage ${res ? 'opening' : 'shake'}`} onClick={res ? undefined : open} aria-label="Open">
              <ChestArt kind={chest.kind} open={!!res} size={140} />
            </button>
            <h2>{CHESTS[chest.kind].label}</h2>
            {step === 0 && <p className="muted">Tap it to open.</p>}
            {step === 1 && (
              <div className="loot">
                {Object.entries(res.mats).map(([k, v], i) => (
                  <div key={k} className="loot-row" style={{ animationDelay: `${i * 0.12}s` }}>
                    <MaterialToken kind={k} size={28} />
                    <strong>{MATERIALS[k].label}</strong>
                    <span className="mono">+{res.added[k]}{res.added[k] < v ? ` (${v - res.added[k]} sold)` : ''}</span>
                  </div>
                ))}
                {res.sold > 0 && <p className="muted small">Barn was full: overflow sold for {money(res.sold)}.</p>}
              </div>
            )}
            {step === 1 && <button className="btn dark full tall" onClick={next}>{res.item ? 'Something else in here...' : 'Into the barn'}</button>}
          </>
        ) : (
          <>
            <div className="drop-burst"><DropIcon id={item.id} size={120} /></div>
            <span className="rar big">{RARITY[item.rarity].label}</span>
            <h2>{item.name}</h2>
            <p className="muted">{res.item.dupe ? `Already had one, so it's sold for ${money(res.item.dupe)}.` : 'Added to your course.'}</p>
            <button className="btn dark full tall" onClick={onClose}>Nice</button>
          </>
        )}
      </div>
    </div>
  );
}

/** The morning bill: fines, lost levels and tier moves since the last open. */
function DailyBill({ report: r, onClose }) {
  const s = useStore();
  const up = r.tier && r.tier.to > r.tier.from;
  const down = r.tier && r.tier.to < r.tier.from;
  useEffect(() => { up ? sfx.drop() : r.fines.length || down ? sfx.fail() : null; }, []);
  const grouped = [];
  for (const f of r.fines) {
    const g = grouped.find((x) => x.label === f.label);
    if (g) { g.n++; g.amount += f.amount; } else grouped.push({ label: f.label, n: 1, amount: f.amount });
  }
  const bal = balance(s);
  const away = r.days.length > 1;
  return (
    <div className="drop-wrap">
      <div className={`drop-modal bill ${up ? 'up' : ''}`} role="dialog" aria-modal="true" aria-label="Daily bill">
        <span className="eyebrow">{away ? `${r.days.length} days since you opened the app` : 'Yesterday'}</span>
        {r.tier && (
          <div className={`tier-move ${up ? 'up' : 'down'}`}>
            <span className="tier-badge" style={{ background: TIERS[r.tier.to].sign, color: TIERS[r.tier.to].ink }}>{TIERS[r.tier.to].name}</span>
            <strong>{up ? 'Promoted' : 'Relegated'}</strong>
            <span className="muted small">{up ? `Word got round. More golfers are booking tee times.` : `The course went quiet. You dropped from ${TIERS[r.tier.from].name}.`}</span>
          </div>
        )}
        {r.fines.length > 0 && (
          <>
            <h2>{money(r.total)} in fines</h2>
            <div className="bill-lines">
              {grouped.map((g) => (
                <div key={g.label} className="bill-line"><span className="grow">{g.label}{g.n > 1 ? ` x${g.n}` : ''}</span><span className="fine-amt">-{money(g.amount)}</span></div>
              ))}
            </div>
            {r.capped && <p className="muted small">Habit fines stop at $60 a day.</p>}
          </>
        )}
        {r.regress.length > 0 && (
          <div className="bill-lines regress">
            {r.regress.map((x) => <div key={x} className="bill-line"><span className="grow">{x}</span></div>)}
          </div>
        )}
        {r.skipped > 0 && <p className="muted small">Only the last 7 days were billed.</p>}
        {bal < 0 && <p className="debt-note">You're {money(-bal)} in debt. Building and upkeep are locked until earnings clear it.</p>}
        <button className="btn dark full tall" onClick={onClose}>{r.fines.length ? 'Pay up' : up ? 'Nice' : 'OK'}</button>
      </div>
    </div>
  );
}

/** Dot on the Feed tab when friends have posted since you last looked. */
function FeedDot() {
  const so = useSocial();
  const seen = Number(localStorage.getItem('fairway.feedSeen') || 0);
  const fresh = so.user && so.feed.some((e) => e.user_id !== so.user.id && Date.parse(e.updated_at) > seen);
  return fresh ? <span className="tab-dot" aria-label="new" /> : null;
}

function TimerPill({ onOpen }) {
  const s = useStore();
  const [, tick] = useState(0);
  useEffect(() => { const iv = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(iv); }, []);
  const t = s.timer;
  const habit = s.habits.find((h) => h.id === t.habitId);
  const pomo = t.kind === 'pomo';
  const shown = pomo ? Math.max(0, ((phaseEnd(t) ?? Date.now()) - Date.now()) / 1000) : timerElapsedMs(t) / 1000;
  return (
    <button className="timer-pill" onClick={onOpen}>
      <span className={`live-dot ${pomo || t.running ? '' : 'paused'}`} />
      <strong>{pomo ? (t.phase === 'break' ? 'Break' : t.pausedAt ? 'Paused' : 'Pomodoro') : habit?.name ?? 'Timer'}</strong>
      <span className="mono">{formatDuration(shown)}</span>
      <span className="pill-open">Open</span>
    </button>
  );
}

/** For a phone that's lost its data (reinstalled, or opened in Safari instead of the icon). */
function RestoreStart({ onBack }) {
  const so = useSocial();
  const file = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function fromFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { actions.importData(await f.text()); fx.toast('Backup restored'); } catch (x) { setErr(x.message); }
  }
  async function fromCloud() {
    setBusy(true); setErr('');
    try { await restoreBackup(); fx.toast('Backup restored'); } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (
    <main className="onboard">
      <h1>Get your course back</h1>
      {configured && !so.user && <AuthCard />}
      {configured && so.user && (
        so.backup ? (
          <div className="hint-box restore">
            <span className="grow"><strong>Cloud backup from {ago(so.backup.updatedAt)}</strong> for {so.user.email}.</span>
            <button className="btn dark full tall" disabled={busy} onClick={fromCloud}>{busy ? '…' : 'Restore it'}</button>
          </div>
        ) : <p className="muted">{so.fetched ? 'No cloud backup on this account yet.' : 'Looking for your backup…'}</p>
      )}
      <button className="btn ghost full" onClick={() => file.current?.click()}>Import a backup file instead</button>
      <input ref={file} type="file" accept="application/json" hidden onChange={fromFile} />
      {err && <p className="err">{err}</p>}
      <button className="link center-text" onClick={onBack}>Start a new course instead</button>
    </main>
  );
}

function Onboarding() {
  const [restore, setRestore] = useState(false);
  if (restore) return <RestoreStart onBack={() => setRestore(false)} />;
  return <NewStart onRestore={() => setRestore(true)} />;
}

function NewStart({ onRestore }) {
  const [name, setName] = useState('');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const [demo] = useState(() => newCourse('2026-01-01'));

  return (
    <main className="onboard">
      <div className="onboard-art"><CourseMap course={demo} barn={0} label="A scruffy 18 hole course" /></div>
      <h1>Run a golf course by doing the things you said you'd do.</h1>
      <p className="muted">Habits and Pomodoro blocks earn money. Goals earn chests of fuel, water, seed and more. Keep the course good and keep showing up, and golfers come: Municipal all the way to Championship. Skip habits and you get fined, golfers drift off, and neglected holes lose their upgrades.</p>
      <label className="label" htmlFor="ob-name">What should friends call you?</label>
      <input id="ob-name" className="field" value={name} autoComplete="given-name" onChange={(e) => setName(e.target.value)} placeholder="Name" />
      {ios && !standalone && (
        <p className="hint-box">On iPhone: tap Share, then <b>Add to Home Screen</b>. It runs full screen and works offline from there.</p>
      )}
      <button
        className="btn dark full tall"
        disabled={!name.trim()}
        onClick={() => { sfx.check(); actions.setProfile({ name: name.trim(), onboarded: true }); }}
      >Start with 4 example habits</button>
      <p className="muted small center-text">Edit or delete them any time.</p>
      <button className="btn ghost full" onClick={onRestore}>I already have a course: restore it</button>
    </main>
  );
}
