import Icon from './Icons.jsx';
import { payout } from './fx.jsx';
import { CATEGORIES, TRUST, bucketById } from '../lib/game.js';
import { actions, getLog, habitStreak, weekCount } from '../lib/store.js';
import { formatMinutes } from '../lib/dates.js';

/**
 * One habit on Today. The square button on the right is the one-tap action;
 * tapping the rest of the card opens the editor and history.
 */
export default function HabitCard({ s, habit, day, timerActive, onOpen, onCount, onBucket, onTimer }) {
  const cat = CATEGORIES[habit.category];
  const log = getLog(s, habit.id, day);
  const done = !!log?.done;
  const streak = habitStreak(s, habit, day);

  function primary() {
    switch (habit.type) {
      case 'check': return payout(habit, actions.toggleCheck(habit.id, day));
      case 'count': return onCount(habit);
      case 'duration': return onTimer(habit);
      case 'limit': return onBucket(habit);
    }
  }

  const value = log?.value ?? 0;
  let sub;
  let progress = null;
  if (habit.type === 'count') {
    sub = `${value} / ${habit.target} ${habit.unit}`;
    progress = value / habit.target;
  } else if (habit.type === 'duration') {
    sub = `${formatMinutes(value)} / ${formatMinutes(habit.target)}`;
    progress = value / habit.target;
  } else if (habit.type === 'limit') {
    sub = log?.bucket ? `${bucketById(log.bucket).label} · limit ${formatMinutes(habit.target)}` : `Under ${formatMinutes(habit.target)} · log tonight`;
  } else if (habit.schedule.kind === 'weekly') {
    sub = `${weekCount(s, habit, day)} / ${habit.schedule.times} this week`;
  }

  const failedLimit = habit.type === 'limit' && log?.bucket && !done;
  const btnLabel = {
    check: done ? `Undo ${habit.name}` : `Mark ${habit.name} done`,
    count: `Log ${habit.name}`,
    duration: timerActive ? 'Timer running' : `Start ${habit.name} timer`,
    limit: `Log ${habit.name} screen time`,
  }[habit.type];

  return (
    <div className={`habit ${done ? 'is-done' : ''}`}>
      <button className="habit-main" onClick={() => onOpen(habit)} aria-label={`Edit ${habit.name}`}>
        <span className="tile" style={{ background: cat.tint }}><Icon name={cat.icon} /></span>
        <span className="habit-text">
          <span className="habit-name"><span className="strike">{habit.name}</span></span>
          {progress !== null && !done && (
            <span className="bar" aria-hidden="true"><span style={{ width: `${Math.min(100, progress * 100)}%`, background: cat.tint }} /></span>
          )}
          <span className="habit-sub">
            {done ? (
              <>
                <b>+{log.yield} {cat.resource}</b>
                {log.trust !== 'honour' && <span className={`trust ${log.trust}`}>{TRUST[log.trust].label}</span>}
                {sub && <span className="dim">{sub}</span>}
              </>
            ) : (
              <>
                {sub}
                {!sub && streak > 0 && <span className="dim"><Icon name="flame" size={13} /> {streak} {habit.schedule.kind === 'weekly' ? 'wk' : 'day'} streak</span>}
                {!sub && !streak && <span className="dim">Tap the box when done</span>}
              </>
            )}
          </span>
        </span>
      </button>

      {habit.type === 'duration' && !done ? (
        <button data-habit-act={habit.id} className={`act start ${timerActive ? 'live' : ''}`} onClick={primary} aria-label={btnLabel}>
          {timerActive ? <span className="live-dot" /> : null}{timerActive ? 'Open' : 'Start'}
        </button>
      ) : (
        <button
          data-habit-act={habit.id}
          className={`act box ${done ? 'on' : ''} ${failedLimit ? 'fail' : ''}`}
          onClick={primary}
          aria-label={btnLabel}
          aria-pressed={habit.type === 'check' ? done : undefined}
        >
          {done && <Icon name="check" size={22} stroke={3.2} className="tick" />}
          {failedLimit && <Icon name="x" size={20} stroke={3.2} />}
          {!done && !failedLimit && habit.type === 'count' && value > 0 && <span className="box-num">{value}</span>}
        </button>
      )}
    </div>
  );
}
