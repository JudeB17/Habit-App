import { useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icons.jsx';
import { BUCKETS, bucketPasses, POMO_PRESETS, blockPay, STACK_BONUS, money } from '../lib/game.js';
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

function NumStep({ label, value, onChange, min, max, step = 1, unit }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="numstep">
      <span className="numstep-label">{label}</span>
      <div className="numstep-ctl">
        <button className="ns-btn" aria-label={`Less ${label}`} onClick={() => set(value - step)} disabled={value <= min}><Icon name="minus" size={18} /></button>
        <span className="ns-val">{value}{unit && <small>{unit}</small>}</span>
        <button className="ns-btn" aria-label={`More ${label}`} onClick={() => set(value + step)} disabled={value >= max}><Icon name="plus" size={18} /></button>
      </div>
    </div>
  );
}

/** Pomodoro setup: presets or custom lengths, and how many blocks to stack. */
function PomoPanel({ habit, onStartPomo, close }) {
  const saved = getState().settings.pomo;
  const [cfg, setCfg] = useState(saved);
  const match = POMO_PRESETS.find((p) => ['focus', 'brk', 'long', 'every'].every((k) => p[k] === cfg[k]));
  const [custom, setCustom] = useState(!match);
  const set = (k) => (v) => setCfg((c) => ({ ...c, [k]: v }));

  const breaks = Array.from({ length: Math.max(0, cfg.blocks - 1) }, (_, k) => ((k + 1) % cfg.every === 0 ? cfg.long : cfg.brk));
  const totalMin = cfg.blocks * cfg.focus + breaks.reduce((a, b) => a + b, 0);
  const pay = cfg.blocks * blockPay(cfg.focus);
  const bonus = cfg.blocks >= 2 ? Math.round(pay * STACK_BONUS) : 0;

  return (
    <>
      <div className="chips pomo-presets">
        {POMO_PRESETS.map((p) => (
          <button key={p.id} className={`chip ${!custom && match?.id === p.id ? 'on' : ''}`} onClick={() => { setCustom(false); setCfg({ ...p, blocks: cfg.blocks }); }}>
            {p.label}
          </button>
        ))}
        <button className={`chip ${custom ? 'on' : ''}`} onClick={() => setCustom(true)}>Custom</button>
      </div>

      {custom && (
        <div className="numstep-grid">
          <NumStep label="Focus" value={cfg.focus} onChange={set('focus')} min={5} max={120} step={5} unit="m" />
          <NumStep label="Break" value={cfg.brk} onChange={set('brk')} min={1} max={30} unit="m" />
          <NumStep label="Long break" value={cfg.long} onChange={set('long')} min={1} max={60} step={5} unit="m" />
          <NumStep label="Long every" value={cfg.every} onChange={set('every')} min={2} max={8} unit=" blk" />
        </div>
      )}

      <div className="stack-row">
        <NumStep label="Blocks to stack" value={cfg.blocks} onChange={set('blocks')} min={1} max={12} />
      </div>

      <p className="muted small">
        {formatMinutes(totalMin)} total · {money(pay)}{bonus ? ` + ${money(bonus)} if you finish every block` : ''}.
        Leaving the app for over 10 s during focus fails that block and damages the hole. Breaks are free.
      </p>
      <button className="btn dark full tall" onClick={() => { onStartPomo(cfg); close(); }}>
        Start {cfg.blocks} x {cfg.focus} min
      </button>
    </>
  );
}

/** Start a Pomodoro, an open timer, or add minutes manually (honour). */
export function StartTimerSheet({ habit, onClose, onStart, onStartPomo, onResult }) {
  const [mode, setMode] = useState('pomo');
  const [manual, setManual] = useState('');
  const log = getLog(getState(), habit.id, dayKey());
  const doneMin = Math.round(log?.value ?? 0);

  return (
    <Sheet title={habit.name} onClose={onClose}>
      {(close) => (
        <>
          <p className="muted small">{doneMin} of {formatMinutes(habit.target)} today.</p>
          <div className="seg-tabs" role="tablist">
            {[['pomo', 'Pomodoro'], ['open', 'Timer'], ['log', 'Log']].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={mode === id} className={mode === id ? 'on' : ''} onClick={() => setMode(id)}>{label}</button>
            ))}
          </div>

          {mode === 'pomo' && <PomoPanel habit={habit} onStartPomo={onStartPomo} close={close} />}

          {mode === 'open' && (
            <>
              <p className="muted small">No leave penalty. Sessions of 10 min or more count as verified (1.5x).</p>
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
            </>
          )}

          {mode === 'log' && (
            <>
              <div className="row gap" style={{ marginTop: 12 }}>
                <input
                  className="field grow" type="number" inputMode="numeric" placeholder="Minutes"
                  value={manual} onChange={(e) => setManual(e.target.value)} aria-label="Minutes to add"
                />
                <button className="btn dark" disabled={!Number(manual)} onClick={() => { onResult(actions.addMinutes(habit.id, Number(manual))); close(); }}>Add</button>
              </div>
              {doneMin > 0 && (
                <button className="btn ghost full" style={{ marginTop: 10 }} onClick={() => { actions.clearLog(habit.id); onResult(0); close(); }}>Reset today</button>
              )}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
