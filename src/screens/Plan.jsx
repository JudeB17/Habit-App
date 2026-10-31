import { useStore, isDueOn } from '../lib/store.js';
import { dayKey, addDays, parseKey } from '../lib/dates.js';
import { CATEGORIES } from '../lib/game.js';

/** Goals and deadlines land in phase 5. For now: the next 7 days of scheduled habits. */
export default function Plan() {
  const s = useStore();
  const today = dayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <main className="screen">
      <header className="top">
        <div><span className="eyebrow">GOALS AND DEADLINES</span><h1>Plan</h1></div>
      </header>
      <p className="muted">Goals with pace lines come later. Here's what's scheduled this week.</p>

      <div className="week">
        {days.map((d) => {
          const due = s.habits.filter((h) => !h.archived && (h.schedule.kind === 'weekly' ? false : isDueOn(s, h, d)));
          const date = parseKey(d);
          return (
            <div key={d} className={`week-row ${d === today ? 'today' : ''}`}>
              <div className="week-date">
                <strong>{date.toLocaleDateString('en-AU', { weekday: 'short' })}</strong>
                <span>{date.getDate()}</span>
              </div>
              <div className="week-items">
                {due.length === 0 && <span className="muted small">Free</span>}
                {due.map((h) => (
                  <span key={h.id} className="week-pill" style={{ background: CATEGORIES[h.category].tint }}>{h.name}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {s.habits.some((h) => h.schedule.kind === 'weekly') && (
        <p className="muted small">Weekly quota habits ({s.habits.filter((h) => h.schedule.kind === 'weekly').map((h) => `${h.name} ${h.schedule.times}x`).join(', ')}) can land on any day.</p>
      )}
    </main>
  );
}
