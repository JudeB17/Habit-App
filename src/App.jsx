import { useEffect, useState } from 'react';
import Today from './screens/Today.jsx';
import IslandScreen from './screens/IslandScreen.jsx';
import Feed from './screens/Feed.jsx';
import Plan from './screens/Plan.jsx';
import Me from './screens/Me.jsx';
import HabitEditor from './components/HabitEditor.jsx';
import TimerScreen from './components/TimerScreen.jsx';
import Island from './components/Island.jsx';
import { CountSheet, BucketSheet, StartTimerSheet } from './components/LogSheets.jsx';
import { payout } from './components/fx.jsx';
import { useStore, actions, timerElapsedMs } from './lib/store.js';
import { formatDuration } from './lib/dates.js';
import { sfx } from './lib/sound.js';

const TABS = [
  ['today', 'Today'],
  ['island', 'Island'],
  ['feed', 'Feed'],
  ['plan', 'Plan'],
  ['me', 'Me'],
];

export default function App() {
  const s = useStore();
  const [tab, setTab] = useState('today');
  const [sheet, setSheet] = useState(null); // { kind, habit }
  const [timerOpen, setTimerOpen] = useState(!!s.timer);

  const open = (kind) => (habit) => setSheet({ kind, habit });
  const close = () => setSheet(null);
  const result = (habit) => (gained) => setTimeout(() => payout(habit, gained), 200); // after the sheet slides away

  function onTimer(habit) {
    if (s.timer) return setTimerOpen(true); // one session at a time
    setSheet({ kind: 'timer', habit });
  }

  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

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
          goIsland={() => setTab('island')}
        />
      )}
      {tab === 'island' && <IslandScreen />}
      {tab === 'feed' && <Feed />}
      {tab === 'plan' && <Plan />}
      {tab === 'me' && <Me {...screenProps} />}

      {s.timer && !timerOpen && <TimerPill onOpen={() => setTimerOpen(true)} />}

      <nav className="tabbar" aria-label="Main">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'on' : ''}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => { if (tab !== id) sfx.tap(); setTab(id); }}
          >{label}</button>
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
        />
      )}
      {s.timer && timerOpen && <TimerScreen onClose={() => setTimerOpen(false)} />}
    </div>
  );
}

function TimerPill({ onOpen }) {
  const s = useStore();
  const [, tick] = useState(0);
  useEffect(() => { const iv = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(iv); }, []);
  const habit = s.habits.find((h) => h.id === s.timer.habitId);
  return (
    <button className="timer-pill" onClick={onOpen}>
      <span className={`live-dot ${s.timer.running ? '' : 'paused'}`} />
      <strong>{habit?.name ?? 'Timer'}</strong>
      <span className="mono">{formatDuration(timerElapsedMs(s.timer) / 1000)}</span>
      <span className="pill-open">Open</span>
    </button>
  );
}

function Onboarding() {
  const [name, setName] = useState('');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <main className="onboard">
      <div className="onboard-art"><Island built={['house', 'trees', 'garden']} label="A small island with a cottage" /></div>
      <h1>Build an island by doing the things you said you'd do.</h1>
      <p className="muted">Every habit you finish earns materials. Materials become buildings. Your friends' islands sit next to yours.</p>
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
    </main>
  );
}
