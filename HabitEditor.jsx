import { useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icons.jsx';
import { CATEGORIES } from '../lib/game.js';
import { actions, useStore, isDone, isScheduledDay, habitStreak } from '../lib/store.js';
import { dayKey, addDays, WEEKDAY_LETTERS } from '../lib/dates.js';

const TYPES = [
  { id: 'check',    label: 'Check',    hint: 'Done or not' },
  { id: 'count',    label: 'Count',    hint: 'Pages, reps' },
  { id: 'duration', label: 'Time',     hint: 'Timer' },
  { id: 'limit',    label: 'Limit',    hint: 'Screen time' },
];

const DEFAULTS = {
  check:    { target: 1,   unit: '' },
  count:    { target: 20,  unit: 'pages' },
  duration: { target: 60,  unit: 'min' },
  limit:    { target: 60,  unit: 'min' },
};

const blank = { name: '', type: 'check', category: 'other', target: 1, unit: '', schedule: { kind: 'daily' }, visibility: 'friends' };

export default function HabitEditor({ habit, onClose }) {
  const [h, setH] = useState(habit ?? blank);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch) => setH((x) => ({ ...x, ...patch }));
  const setSchedule = (patch) => setH((x) => ({ ...x, schedule: { ...x.schedule, ...patch } }));
  const isNew = !habit;
  const valid = h.name.trim() && (h.type === 'check' || h.target > 0) &&
    (h.schedule.kind !== 'days' || h.schedule.days?.length);

  return (
    <Sheet title={isNew ? 'New habit' : h.name || 'Habit'} onClose={onClose} tall>
      {(close) => (
        <div className="form">
          {!isNew && <History habit={habit} />}

          <label className="label" htmlFor="habit-name">Name</label>
          <input id="habit-name" className="field" value={h.name} placeholder="e.g. Read, Study, TikTok" onChange={(e) => set({ name: e.target.value })} />

          <span className="label">Type</span>
          <div className="seg four">
            {TYPES.map((t) => (
              <button
                key={t.id}
                className={h.type === t.id ? 'on' : ''}
                onClick={() => set({ type: t.id, ...DEFAULTS[t.id], ...(t.id === 'limit' ? { category: 'screen' } : {}) })}
              >
                <strong>{t.label}</strong><span>{t.hint}</span>
              </button>
            ))}
          </div>

          <span className="label">Category</span>
          <div className="chips">
            {Object.entries(CATEGORIES).map(([id, c]) => (
              <button key={id} className={`chip ${h.category === id ? 'on' : ''}`} style={{ '--tint': c.tint }} onClick={() => set({ category: id })}>
                <Icon name={c.icon} size={16} /> {c.label}
              </button>
            ))}
          </div>

          {h.type !== 'check' && (
            <>
              <span className="label">{h.type === 'limit' ? 'Daily limit' : 'Daily target'}</span>
              <div className="row gap">
                <input className="field grow" type="number" inputMode="numeric" min="1" value={h.target} onChange={(e) => set({ target: Number(e.target.value) })} aria-label="Target" />
                {h.type === 'count'
                  ? <input className="field grow" value={h.unit} placeholder="unit" onChange={(e) => set({ unit: e.target.value })} aria-label="Unit" />
                  : <span className="unit-fixed">minutes</span>}
              </div>
            </>
          )}

          <span className="label">Schedule</span>
          <div className="seg three">
            {[['daily', 'Every day'], ['days', 'Some days'], ['weekly', 'X per week']].map(([k, l]) => (
              <button
                key={k}
                className={h.schedule.kind === k ? 'on' : ''}
                onClick={() => setSchedule({ kind: k, days: h.schedule.days ?? [1, 2, 3, 4, 5], times: h.schedule.times ?? 3 })}
              ><strong>{l}</strong></button>
            ))}
          </div>
          {h.schedule.kind === 'days' && (
            <div className="days">
              {WEEKDAY_LETTERS.map((l, i) => {
                const on = h.schedule.days?.includes(i);
                return (
                  <button
                    key={i}
                    className={on ? 'on' : ''}
                    aria-pressed={on}
                    aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}
                    onClick={() => setSchedule({ days: on ? h.schedule.days.filter((d) => d !== i) : [...h.schedule.days, i].sort() })}
                  >{l}</button>
                );
              })}
            </div>
          )}
          {h.schedule.kind === 'weekly' && (
            <div className="row gap center">
              <button className="step sm" aria-label="Fewer" onClick={() => setSchedule({ times: Math.max(1, h.schedule.times - 1) })}><Icon name="minus" /></button>
              <strong className="big-num">{h.schedule.times}</strong>
              <span className="muted">times a week</span>
              <button className="step sm" aria-label="More" onClick={() => setSchedule({ times: Math.min(7, h.schedule.times + 1) })}><Icon name="plus" /></button>
            </div>
          )}

          <span className="label">Friends see <em>used once the feed is live</em></span>
          <div className="seg three">
            {[['friends', 'Full detail'], ['summary', 'Summary'], ['private', 'Nothing']].map(([k, l]) => (
              <button key={k} className={h.visibility === k ? 'on' : ''} onClick={() => set({ visibility: k })}><strong>{l}</strong></button>
            ))}
          </div>

          <button className="btn dark full" disabled={!valid} onClick={() => { actions.saveHabit({ ...h, name: h.name.trim() }); close(); }}>
            {isNew ? 'Add habit' : 'Save'}
          </button>
          {!isNew && (
            <button
              className={`btn full ${confirmDelete ? 'danger' : 'ghost'}`}
              onClick={() => (confirmDelete ? (actions.deleteHabit(habit.id), close()) : setConfirmDelete(true))}
            >
              {confirmDelete ? 'Tap again to delete, history included' : 'Delete habit'}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Last 5 weeks as paper squares, plus the current streak. */
function History({ habit }) {
  const s = useStore();
  const today = dayKey();
  const days = Array.from({ length: 35 }, (_, i) => addDays(today, i - 34));
  const streak = habitStreak(s, habit, today);
  const unit = habit.schedule.kind === 'weekly' ? 'week' : 'day';
  return (
    <div className="history">
      <div className="row between">
        <span className="label nomargin">Last 5 weeks</span>
        <span className="streak-pill"><Icon name="flame" size={14} /> {streak} {unit}{streak === 1 ? '' : 's'}</span>
      </div>
      <div className="history-grid">
        {days.map((d) => {
          const done = isDone(s, habit.id, d);
          const off = habit.schedule.kind === 'days' && !isScheduledDay(habit, d);
          const before = d < habit.createdAt;
          return <span key={d} title={d} className={`hcell ${done ? 'done' : ''} ${off || before ? 'off' : ''} ${d === today ? 'today' : ''}`} />;
        })}
      </div>
    </div>
  );
}
