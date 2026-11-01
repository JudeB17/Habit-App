import { useEffect, useRef, useState } from 'react';
import { CourseMap } from './Course.jsx';
import Icon from './Icons.jsx';
import { payout } from './fx.jsx';
import { actions, timerElapsedMs, useStore } from '../lib/store.js';
import { formatDuration } from '../lib/dates.js';
import { MIN_VERIFIED_SESSION_S, CATEGORIES } from '../lib/game.js';
import { sfx } from '../lib/sound.js';

/**
 * Full-screen focus timer. The session is stored as timestamps, so closing the app
 * doesn't lose it: reopen and the clock is still right. iOS suspends background JS, so
 * there's no lock screen countdown and the end chime only plays if the app is open.
 */
export default function TimerScreen({ onClose }) {
  const s = useStore();
  const t = s.timer;
  const habit = s.habits.find((h) => h.id === t?.habitId);
  const [, tick] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const chimed = useRef(false);

  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 250);
    let lock;
    navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { clearInterval(iv); lock?.release?.(); };
  }, []);

  const elapsedS = timerElapsedMs(t) / 1000;
  const plannedS = t?.plannedMin ? t.plannedMin * 60 : null;
  const over = plannedS !== null && elapsedS >= plannedS;

  useEffect(() => {
    if (over && !chimed.current) { chimed.current = true; sfx.done(); }
  }, [over]);

  if (!t || !habit) return null;

  const shown = plannedS && !over ? plannedS - elapsedS : elapsedS;
  const progress = plannedS ? Math.min(1, elapsedS / plannedS) : (elapsedS % 3600) / 3600;
  const verified = elapsedS >= MIN_VERIFIED_SESSION_S;
  const R = 118;
  const C = 2 * Math.PI * R;

  function end() {
    const res = actions.stopTimer();
    onClose();
    // Let the Today screen render the card before flying tokens from it.
    setTimeout(() => payout(habit, res?.gained ?? 0), 60);
  }

  return (
    <div className="timer-screen" role="dialog" aria-modal="true" aria-label={`${habit.name} timer`}>
      <div className="timer-island">
        <CourseMap course={s.course} items={s.items} barn={s.barn} label="Your course" />
      </div>

      <div className="timer-top">
        <button className="icon-btn light" onClick={onClose} aria-label="Minimise timer"><Icon name="down" /></button>
        <span className="timer-tag" style={{ background: CATEGORIES[habit.category].tint }}>{habit.name}</span>
        <span style={{ width: 44 }} />
      </div>

      <div className="timer-card">
        <div className="ring">
          <svg viewBox="0 0 280 280" aria-hidden="true">
            <circle cx="140" cy="140" r={R} fill="#FFF" stroke="#161616" strokeWidth="3" />
            <circle
              cx="140" cy="140" r={R} fill="none"
              stroke={CATEGORIES[habit.category].tint} strokeWidth="18"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
              transform="rotate(-90 140 140)" strokeLinecap="butt"
              className="ring-fill"
            />
            <circle cx="140" cy="140" r={R - 9} fill="none" stroke="#161616" strokeWidth="2" />
            <circle cx="140" cy="140" r={R + 9} fill="none" stroke="#161616" strokeWidth="2" />
          </svg>
          <div className="ring-center">
            <span className="ring-label">{over ? 'Overtime' : plannedS ? 'Remaining' : 'Elapsed'}</span>
            <span className="ring-time" aria-live="off">{over ? '+' : ''}{formatDuration(over ? elapsedS - plannedS : shown)}</span>
            <span className={`ring-status ${verified ? 'ok' : ''}`}>
              {verified ? 'Verified session' : `Verified in ${formatDuration(MIN_VERIFIED_SESSION_S - elapsedS)}`}
            </span>
          </div>
        </div>

        {!t.running && <p className="paused-note">Paused</p>}

        <div className="timer-actions">
          <button className="btn round" onClick={() => (t.running ? actions.pauseTimer() : actions.resumeTimer())} aria-label={t.running ? 'Pause' : 'Resume'}>
            <Icon name={t.running ? 'pause' : 'play'} size={26} />
          </button>
          <button className="btn dark grow tall" onClick={end}>{elapsedS < 60 ? 'End' : 'End and save'}</button>
        </div>
        {elapsedS < 60 && <p className="muted small center-text">Sessions under 1 min aren't saved.</p>}
        <button
          className={`btn full ${confirmCancel ? 'danger' : 'ghost'}`}
          onClick={() => (confirmCancel ? (actions.cancelTimer(), onClose()) : setConfirmCancel(true))}
        >
          {confirmCancel ? 'Tap again to discard this session' : 'Discard session'}
        </button>
      </div>
    </div>
  );
}
