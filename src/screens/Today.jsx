import { useState } from 'react';
import Island from '../components/Island.jsx';
import HabitCard from '../components/HabitCard.jsx';
import Icon, { ResourceToken } from '../components/Icons.jsx';
import { useStore, isDueOn, isDone, overallStreak, resources, idleDays } from '../lib/store.js';
import { dayKey, headerDate, greeting } from '../lib/dates.js';
import { RESOURCE_KEYS } from '../lib/game.js';

export default function Today({ onOpenHabit, onCount, onBucket, onTimer, onNewHabit, goIsland }) {
  const s = useStore();
  const day = dayKey();
  const [showRest, setShowRest] = useState(false);
  const due = s.habits.filter((h) => isDueOn(s, h, day));
  const rest = s.habits.filter((h) => !h.archived && !isDueOn(s, h, day));
  const doneCount = due.filter((h) => isDone(s, h.id, day)).length;
  const streak = overallStreak(s, day);
  const res = resources(s);
  const allDone = due.length > 0 && doneCount === due.length;

  const cardProps = { s, day, onOpen: onOpenHabit, onCount, onBucket, onTimer };

  return (
    <main className="screen">
      <header className="top">
        <div>
          <span className="eyebrow">{headerDate()}</span>
          <h1>{greeting()}{s.profile.name ? `, ${s.profile.name}` : ''}</h1>
        </div>
        <div className={`streak-badge ${streak ? '' : 'zero'}`} aria-label={`${streak} day streak`}>
          <Icon name="flame" size={18} /> {streak}<span className="streak-unit"> day{streak === 1 ? '' : 's'}</span>
        </div>
      </header>

      <button className="island-card" onClick={goIsland} aria-label="Open your island">
        <Island built={s.buildings} idle={idleDays(s, day)} />
        <div className="res-row">
          {RESOURCE_KEYS.map((k) => (
            <span key={k} className="res-chip" data-res-target={k} title={k}>
              <ResourceToken resource={k} size={16} /> {res[k]}
            </span>
          ))}
        </div>
      </button>

      <div className="section-head">
        <h2>Today</h2>
        <span className={`count ${allDone ? 'all' : ''}`}>{doneCount} / {due.length}</span>
      </div>

      {allDone && <p className="all-done">Everything's done. The island's doing its thing.</p>}

      <div className="habit-list">
        {due.map((h) => (
          <HabitCard key={h.id} habit={h} timerActive={s.timer?.habitId === h.id} {...cardProps} />
        ))}
        {due.length === 0 && (
          <div className="empty">
            <p>Nothing scheduled today.</p>
          </div>
        )}
      </div>

      {rest.length > 0 && (
        <>
          <button className="rest-toggle" onClick={() => setShowRest((x) => !x)} aria-expanded={showRest}>
            Not today ({rest.length}) <Icon name={showRest ? 'up' : 'down'} size={16} />
          </button>
          {showRest && (
            <div className="habit-list faded">
              {rest.map((h) => <HabitCard key={h.id} habit={h} timerActive={s.timer?.habitId === h.id} {...cardProps} />)}
            </div>
          )}
        </>
      )}

      <button className="add-habit" onClick={onNewHabit}><Icon name="plus" /> New habit</button>
    </main>
  );
}
