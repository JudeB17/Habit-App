import { useEffect, useRef, useState } from 'react';
import { HoleView } from './Course.jsx';
import Icon from './Icons.jsx';
import { actions, useStore, phaseEnd, breakLength, blockHole } from '../lib/store.js';
import { formatDuration, formatMinutes } from '../lib/dates.js';
import { CATEGORIES, LEAVE_GRACE_MS, DAMAGE_KINDS, REPAIR_COST, REPAIR_MATS, MATERIALS, money, blockPay } from '../lib/game.js';
import { HOLES } from '../lib/holes.js';
import { sfx } from '../lib/sound.js';

/**
 * Full-screen Pomodoro. Each focus block is played on the next hole: the ball moves from tee
 * to cup as the block runs. Leaving the app for more than 10 s during focus fails the block
 * and damages that hole. Breaks are free time.
 */
export default function PomodoroScreen({ onClose }) {
  const s = useStore();
  const t = s.timer;
  const habit = s.habits.find((h) => h.id === t?.habitId);
  const [, tick] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const lastPhase = useRef(t?.phase);

  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 250);
    let lock;
    const req = () => navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    req();
    const onVis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(iv); lock?.release?.(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    const prev = lastPhase.current;
    lastPhase.current = t?.phase;
    if (!t || prev === t.phase) return;
    if (t.phase === 'break' || t.phase === 'done') sfx.done();
    else if (t.phase === 'focus' && prev) sfx.tap();
    else if (t.phase === 'failed') sfx.fail();
    else if (t.phase === 'ready') sfx.done();
    setConfirm(null);
  }, [t?.phase]);

  if (!t || t.kind !== 'pomo' || !habit) return null;

  const now = Date.now();
  const end = phaseEnd(t);
  const remaining = end ? Math.max(0, (end - now) / 1000) : 0;
  const len = t.phase === 'focus' ? t.cfg.focus * 60 : t.phase === 'break' ? breakLength(t) * 60 : 1;
  const progress = end ? Math.min(1, 1 - remaining / len) : 1;

  // Which hole to show, and where the ball is.
  let holeIdx = blockHole(t);
  let ball = { p: 0, state: 'play' };
  if (t.phase === 'focus') ball = { p: progress, state: 'play' };
  else if (t.phase === 'break' || t.phase === 'done') { holeIdx = (holeIdx + 17) % 18; ball = { p: 1, state: 'sunk' }; }
  else if (t.phase === 'failed') ball = { p: 0.5, state: 'wet' };
  const hole = s.course.holes[holeIdx];
  const par = HOLES[holeIdx].par;

  const isLong = t.phase === 'break' && breakLength(t) === t.cfg.long && t.cfg.long !== t.cfg.brk;
  const canMinimise = t.phase !== 'focus';
  const R = 104;
  const C = 2 * Math.PI * R;
  const paused = t.phase === 'focus' && !!t.pausedAt;
  const tint = t.phase === 'focus' ? CATEGORIES[habit.category].tint : '#A9C3FF';

  const run = s.runs.find((r) => r.id === t.runId);
  const results = run?.results ?? [];
  const dots = Array.from({ length: t.blocks }, (_, k) => results[k] ?? (k === results.length && t.phase === 'focus' ? 'live' : 'todo'));

  const dotRow = (
          <div className="block-dots" aria-label={`Block ${Math.min(t.blocks, results.length + 1)} of ${t.blocks}`}>
          {dots.map((d, k) => <span key={k} className={`bdot ${d}`}>{d === 'ok' ? <Icon name="check" size={12} stroke={3.4} /> : d === 'fail' ? <Icon name="x" size={12} stroke={3.4} /> : null}</span>)}
        </div>
  );

  const twice = (key, fn) => () => (confirm === key ? (fn(), setConfirm(null)) : setConfirm(key));

  return (
    <div className={`pomo-screen phase-${t.phase} ${paused ? 'paused' : ''}`} role="dialog" aria-modal="true" aria-label={`${habit.name} Pomodoro`}>
      <div className="pomo-hole">
        <HoleView i={holeIdx} h={hole} gold={(s.items.goldflags ?? 0) > 0} ball={ball} padBottom={110} />
        <span className="pomo-hole-tag">Hole {holeIdx + 1} · Par {par}</span>
      </div>

      <div className="timer-top">
        {canMinimise
          ? <button className="icon-btn light" onClick={onClose} aria-label="Minimise"><Icon name="down" /></button>
          : <span style={{ width: 44 }} />}
        <span className="timer-tag" style={{ background: CATEGORIES[habit.category].tint }}>{habit.name}</span>
        <span style={{ width: 44 }} />
      </div>

      <div className="timer-card pomo-card">
        {!['focus', 'break'].includes(t.phase) && dotRow}

        {(t.phase === 'focus' || t.phase === 'break') && (
          <>
            <div className="ring pomo-ring">
              <svg viewBox="0 0 240 240" aria-hidden="true">
                <circle cx="120" cy="120" r={R} fill="#FFF" stroke="#161616" strokeWidth="3" />
                <circle
                  cx="120" cy="120" r={R} fill="none" stroke={tint} strokeWidth="16"
                  strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
                  transform="rotate(-90 120 120)" className="ring-fill"
                />
                <circle cx="120" cy="120" r={R - 8} fill="none" stroke="#161616" strokeWidth="2" />
                <circle cx="120" cy="120" r={R + 8} fill="none" stroke="#161616" strokeWidth="2" />
              </svg>
              <div className="ring-center">
                <span className="ring-label">{paused ? 'Paused' : t.phase === 'focus' ? `Block ${results.length + 1} of ${t.blocks}` : isLong ? 'Long break' : 'Break'}</span>
                <span className="ring-time" aria-live="off">{formatDuration(remaining)}</span>
                <span className="ring-status">{paused ? 'Clock stopped' : t.phase === 'focus' ? `${money(blockPay(t.cfg.focus))} on finish` : 'Phone is fine now'}</span>
              </div>
            </div>
            {dotRow}
            {t.phase === 'focus' && (
              <p className="leave-note">
                <Icon name="lock" size={15} /> {paused
                  ? `Paused, but you still can't leave: more than ${LEAVE_GRACE_MS / 1000} s out of the app fails the block.`
                  : `Leave the app for more than ${LEAVE_GRACE_MS / 1000} s and this block fails. Locking the phone counts.`}
              </p>
            )}
          </>
        )}

        {t.phase === 'ready' && (
          <div className="pomo-msg">
            <h2>Break's over</h2>
            <p className="muted">Block {results.length + 1} of {t.blocks} starts when you tap. Hole {holeIdx + 1}, par {par}.</p>
            <button className="btn dark full tall" onClick={() => { sfx.tap(); actions.startNextBlock(); }}>Start block {results.length + 1}</button>
          </div>
        )}

        {t.phase === 'done' && (
          <div className="pomo-msg">
            <h2>{t.endedEarly ? 'Run ended' : 'Stack finished'}</h2>
            <p className="muted">
              {t.completed} block{t.completed === 1 ? '' : 's'} · {formatMinutes(t.completed * t.cfg.focus)} focus · {money(t.pay)}
              {t.bonus ? ` + ${money(t.bonus)} stack bonus` : ''}
            </p>
            {t.endedEarly && t.completed > 0 && <p className="muted small">The stack bonus needs every planned block.</p>}
            <button className="btn dark full tall" onClick={() => { actions.dismissTimer(); onClose(); }}>Done</button>
          </div>
        )}

        {t.phase === 'failed' && (
          <div className="pomo-msg fail">
            <h2>Block failed</h2>
            <p>
              {t.failReason === 'quit' ? 'You gave up the block.' : 'You left the app during focus.'}{' '}
              Hole {t.damage.hole + 1} took damage: {DAMAGE_KINDS[t.damage.kind].toLowerCase()}. Repair it on the Course tab: {money(REPAIR_COST)} plus {Object.entries(REPAIR_MATS[t.damage.kind]).map(([k, v]) => `${v} ${MATERIALS[k].label.toLowerCase()}`).join(' and ')}.
            </p>
            {t.completed > 0 && <p className="muted small">The {t.completed} block{t.completed === 1 ? '' : 's'} before it still count ({money(t.pay)}).</p>}
            <button className="btn dark full tall" onClick={() => { actions.dismissTimer(); onClose(); }}>Close</button>
          </div>
        )}

        {t.phase === 'focus' && (
          <div className="row gap pomo-actions">
            <button className={`btn grow ${paused ? 'dark' : 'ghost'}`} onClick={() => { sfx.tap(); paused ? actions.resumePomo() : actions.pausePomo(); }}>
              <Icon name={paused ? 'play' : 'pause'} size={18} /> {paused ? 'Resume' : 'Pause'}
            </button>
            <button className="btn ghost" onClick={() => { sfx.tap(); actions.addBlock(); }} aria-label="Add a block"><Icon name="plus" size={18} /></button>
            <button className={`btn grow ${confirm === 'quit' ? 'danger' : 'ghost'}`} onClick={twice('quit', actions.giveUpBlock)}>
              {confirm === 'quit' ? 'Tap again: fails block' : 'Give up'}
            </button>
          </div>
        )}
        {t.phase === 'break' && (
          <div className="row gap pomo-actions">
            <button className="btn dark grow" onClick={() => { sfx.tap(); actions.startNextBlock(); }}>Skip break</button>
            <button className="btn ghost" onClick={() => { sfx.tap(); actions.addBlock(); }} aria-label="Add a block"><Icon name="plus" size={18} /></button>
            <button className={`btn ${confirm === 'end' ? 'danger' : 'ghost'}`} onClick={twice('end', actions.endRun)}>{confirm === 'end' ? 'Sure?' : 'End'}</button>
          </div>
        )}
        {t.phase === 'ready' && (
          <button className={`btn full ${confirm === 'end' ? 'danger' : 'ghost'}`} onClick={twice('end', actions.endRun)}>{confirm === 'end' ? 'Tap again to end the run' : 'End run'}</button>
        )}
      </div>
    </div>
  );
}
