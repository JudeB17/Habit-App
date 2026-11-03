import { useState } from 'react';
import Icon, { ChestArt } from '../components/Icons.jsx';
import { fx } from '../components/fx.jsx';
import { useStore, isDueOn, actions } from '../lib/store.js';
import { dayKey, addDays, parseKey, daysBetween } from '../lib/dates.js';
import { CATEGORIES, GOAL_SIZES, CHESTS, goalChest } from '../lib/game.js';
import { sfx } from '../lib/sound.js';

export default function Plan() {
  const s = useStore();
  const today = dayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const [title, setTitle] = useState('');
  const [size, setSize] = useState('small');
  const [due, setDue] = useState(addDays(today, 1));
  const minDue = addDays(today, GOAL_SIZES[size].minDays);
  const pickSize = (k) => { setSize(k); const m = addDays(today, GOAL_SIZES[k].minDays); if (due < m) setDue(m); };
  const [confirmDel, setConfirmDel] = useState(null);

  const open = s.goals.filter((g) => !g.doneAt).sort((a, b) => (a.due < b.due ? -1 : 1));
  const done = s.goals.filter((g) => g.doneAt).sort((a, b) => (a.doneAt < b.doneAt ? 1 : -1)).slice(0, 5);

  function add() {
    if (!title.trim()) return;
    actions.addGoal(title.trim(), due < minDue ? minDue : due, size);
    sfx.tap();
    setTitle('');
  }
  function complete(g) {
    const r = actions.completeGoal(g.id);
    if (r?.kind === 'same-day') fx.toast('Done. Goals set today pay no chest.');
    else if (r?.kind === 'chest') { sfx.check(); fx.toast(`${CHESTS[r.chest].label} sent to the barn${r.late ? ' (late, one size down)' : ''}`); }
  }

  return (
    <main className="screen">
      <header className="top">
        <div><span className="eyebrow">GOALS AND DEADLINES</span><h1>Plan</h1></div>
      </header>

      <div className="section-head"><h2>Goals</h2><span className="count">{open.length} open</span></div>
      <p className="muted small">Goals are how you get materials to keep the course up. Finish one and a chest goes to the barn. Bigger goals need longer deadlines and pay bigger chests. They only pay if set on an earlier day; late ones pay a size down.</p>
      <div className="goal-add">
        <input className="field grow" placeholder="e.g. Finish CFA reading 12" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Goal" />
        <div className="size-pick" role="radiogroup" aria-label="Goal size">
          {Object.entries(GOAL_SIZES).map(([k, g]) => (
            <button key={k} role="radio" aria-checked={size === k} className={size === k ? 'on' : ''} onClick={() => pickSize(k)}>
              <ChestArt kind={g.chest} size={34} />
              <strong>{g.label}</strong>
              <span>{CHESTS[g.chest].label}</span>
              <small>{g.hint}</small>
            </button>
          ))}
        </div>
        <div className="row gap">
          <input className="field grow" type="date" value={due} min={minDue} onChange={(e) => setDue(e.target.value < minDue ? minDue : e.target.value)} aria-label="Deadline" />
          <button className="btn dark" disabled={!title.trim()} onClick={add}>Add</button>
        </div>
      </div>

      <div className="list-card" style={{ marginTop: 12 }}>
        {open.map((g) => {
          const left = daysBetween(today, g.due);
          return (
            <div key={g.id} className="list-row">
              <button className="act box goal-box" onClick={() => complete(g)} aria-label={`Complete ${g.title}`} />
              <span className="goal-chest" title={CHESTS[goalChest(g.size ?? 'medium', left < 0)].label}><ChestArt kind={goalChest(g.size ?? 'medium', left < 0)} size={30} /></span>
              <span className="grow">
                <strong>{g.title}</strong>
                <span className={`small ${left < 0 ? 'late' : left <= 2 ? 'soon' : 'muted'}`}>
                  {left < 0 ? `${-left} day${left === -1 ? '' : 's'} late` : left === 0 ? 'Due today' : `${left} day${left === 1 ? '' : 's'} left`} · {parseKey(g.due).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
              </span>
              <button className="icon-btn sm" aria-label={`Delete ${g.title}`} onClick={() => (confirmDel === g.id ? actions.deleteGoal(g.id) : setConfirmDel(g.id))}>
                <Icon name={confirmDel === g.id ? 'check' : 'x'} size={18} />
              </button>
            </div>
          );
        })}
        {open.length === 0 && <p className="muted pad">No open goals.</p>}
        {done.map((g) => (
          <div key={g.id} className="list-row done-row">
            <span className="act box on goal-box"><Icon name="check" size={18} stroke={3.2} /></span>
            <span className="grow"><strong className="strike-done">{g.title}</strong></span>
          </div>
        ))}
      </div>

      <div className="section-head"><h2>This week</h2></div>
      <div className="week">
        {days.map((d) => {
          const dueH = s.habits.filter((h) => !h.archived && (h.schedule.kind === 'weekly' ? false : isDueOn(s, h, d)));
          const goals = open.filter((g) => g.due === d);
          const date = parseKey(d);
          return (
            <div key={d} className={`week-row ${d === today ? 'today' : ''}`}>
              <div className="week-date">
                <strong>{date.toLocaleDateString('en-AU', { weekday: 'short' })}</strong>
                <span>{date.getDate()}</span>
              </div>
              <div className="week-items">
                {dueH.length === 0 && goals.length === 0 && <span className="muted small">Free</span>}
                {goals.map((g) => <span key={g.id} className="week-pill goal"><Icon name="flag" size={12} /> {g.title}</span>)}
                {dueH.map((h) => (
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
