import { useState } from 'react';
import { CourseMap } from '../components/Course.jsx';
import HabitCard from '../components/HabitCard.jsx';
import Icon, { MoneyToken } from '../components/Icons.jsx';
import { useStore, isDueOn, isDone, overallStreak, balance, upkeepAll } from '../lib/store.js';
import { dayKey, headerDate, greeting } from '../lib/dates.js';
import { money } from '../lib/game.js';

export default function Today({ onOpenHabit, onCount, onBucket, onTimer, onNewHabit, goCourse }) {
  const s = useStore();
  const day = dayKey();
  const [showRest, setShowRest] = useState(false);
  const due = s.habits.filter((h) => isDueOn(s, h, day));
  const rest = s.habits.filter((h) => !h.archived && !isDueOn(s, h, day));
  const doneCount = due.filter((h) => isDone(s, h.id, day)).length;
  const streak = overallStreak(s, day);
  const bal = balance(s);
  const avg = Math.round(s.course.holes.reduce((a, h) => a + h.cond, 0) / 18);
  const dmg = s.course.holes.reduce((a, h) => a + h.damage.length, 0);
  const upkeep = upkeepAll(s).money;
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

      <button className="island-card" onClick={goCourse} aria-label="Open your course">
        <CourseMap course={s.course} items={s.items} barn={s.barn} />
        <div className="res-row">
          <span className="res-chip" data-res-target="money"><MoneyToken size={16} /> {money(bal)}</span>
          <span className={`res-chip ${avg < 45 ? 'warn' : ''}`}>{avg}% kept</span>
          {dmg > 0 && <span className="res-chip warn">{dmg} to repair</span>}
          {s.chests.length > 0 && <span className="res-chip chest">{s.chests.length} chest{s.chests.length === 1 ? '' : 's'} to open</span>}
          {upkeep > 0 && avg < 75 && <span className="res-chip">Upkeep {money(upkeep)}</span>}
        </div>
      </button>

      <div className="section-head">
        <h2>Today</h2>
        <span className={`count ${allDone ? 'all' : ''}`}>{doneCount} / {due.length}</span>
      </div>

      {allDone && <p className="all-done">Everything's done. Go spend it on the course.</p>}

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
