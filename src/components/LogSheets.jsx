import { useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icons.jsx';
import { BUCKETS, bucketPasses } from '../lib/game.js';
import { actions, getLog, getState } from '../lib/store.js';
import { dayKey, formatMinutes } from '../lib/dates.js';

/** Number entry for count habits. Quick steps plus a "hit target" shortcut. */
export function CountSheet({ habit, onClose, onResult }) {
  const day = dayKey();
  const [value, setValue] = useState(getLog(getState(), habit.id, day)?.value ?? 0);
  const step = habit.target >= 20 ? 5 : 1;
  const save = (v, close) => { onResult(actions.setCount(habit.id, v)); close(); };

  return (
    <Sheet title={habit.name} onClose={onClose}>
      {(close) => (
        <>
          <div className="stepper">
            <button className="step" aria-label={`Minus ${step}`} onClick={() => setValue((v) => Math.max(0, v - step))}><Icon name="minus" size={26} /></button>
            <div className="step-value">
              <input
                type="number"
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(Math.max(0, Number(e.target.value) || 0))}
                aria-label={`${habit.unit || 'count'} today`}
              />
              <span>of {habit.target} {habit.unit}</span>
            </div>
            <button className="step" aria-label={`Plus ${step}`} onClick={() => setValue((v) => v + step)}><Icon name="plus" size={26} /></button>
          </div>
          <div className="row gap">
            <button className="btn ghost grow" onClick={() => setValue(habit.target)}>Hit target</button>
            <button className="btn dark grow" onClick={() => save(value, close)}>Save</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Screen time bucket tap. Honour system: friends see the answer, that's the check. */
export function BucketSheet({ habit, onClose, onResult }) {
  const current = getLog(getState(), habit.id, dayKey())?.bucket;
  return (
    <Sheet title={`How was ${habit.name} today?`} onClose={onClose}>
      {(close) => (
        <>
          <p className="muted small">Check your phone's Screen Time page. Limit: {formatMinutes(habit.target)}.</p>
          <div className="bucket-list">
            {BUCKETS.map((b) => {
              const pass = bucketPasses(b.id, habit.target);
              return (
                <button
                  key={b.id}
                  className={`bucket ${current === b.id ? 'on' : ''} ${pass ? 'pass' : 'fail'}`}
                  onClick={() => { onResult(actions.setBucket(habit.id, b.id)); close(); }}
                >
                  <span>{b.label}</span>
                  <span className="bucket-tag">{pass ? 'Under limit' : 'Over'}</span>
                </button>
              );
            })}
          </div>
          {current && (
            <button className="btn ghost full" onClick={() => { actions.clearLog(habit.id); onResult(0); close(); }}>Clear today's answer</button>
          )}
        </>
      )}
    </Sheet>
  );
}

const PRESETS = [25, 50, 90];

/** Start a focus session, or add minutes manually (honour). */
export function StartTimerSheet({ habit, onClose, onStart, onResult }) {
  const [manual, setManual] = useState('');
  const log = getLog(getState(), habit.id, dayKey());
  const doneMin = Math.round(log?.value ?? 0);

  return (
    <Sheet title={habit.name} onClose={onClose}>
      {(close) => (
        <>
          <p className="muted small">{doneMin} of {formatMinutes(habit.target)} today. Timer sessions of 10 min or more count as verified (1.5x).</p>
          <div className="preset-grid">
            {PRESETS.map((m) => (
              <button key={m} className="preset" onClick={() => { onStart(m); close(); }}>
                <strong>{m}</strong><span>min</span>
              </button>
            ))}
            <button className="preset dark" onClick={() => { onStart(null); close(); }}>
              <strong>Open</strong><span>no end</span>
            </button>
          </div>
          <div className="divider"><span>or log manually</span></div>
          <div className="row gap">
            <input
              className="field grow"
              type="number"
              inputMode="numeric"
              placeholder="Minutes"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              aria-label="Minutes to add"
            />
            <button
              className="btn dark"
              disabled={!Number(manual)}
              onClick={() => { onResult(actions.addMinutes(habit.id, Number(manual))); close(); }}
            >Add</button>
          </div>
          {doneMin > 0 && (
            <button className="btn ghost full" onClick={() => { actions.clearLog(habit.id); onResult(0); close(); }}>Reset today</button>
          )}
        </>
      )}
    </Sheet>
  );
}
