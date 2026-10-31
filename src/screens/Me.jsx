import { useRef, useState } from 'react';
import Icon from '../components/Icons.jsx';
import { fx } from '../components/fx.jsx';
import { useStore, actions } from '../lib/store.js';
import { CATEGORIES } from '../lib/game.js';

export default function Me({ onOpenHabit, onNewHabit }) {
  const s = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const file = useRef(null);

  function exportData() {
    const blob = new Blob([actions.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `isle-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importData(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { actions.importData(await f.text()); fx.toast('Backup restored'); }
    catch (err) { fx.toast(err.message || 'Could not read that file'); }
    e.target.value = '';
  }

  const schedule = (h) =>
    h.schedule.kind === 'daily' ? 'Every day'
      : h.schedule.kind === 'weekly' ? `${h.schedule.times}x a week`
      : `${h.schedule.days.length} days a week`;

  return (
    <main className="screen">
      <header className="top"><div><span className="eyebrow">SETTINGS</span><h1>Me</h1></div></header>

      <label className="label" htmlFor="me-name">Display name</label>
      <input id="me-name" className="field" value={s.profile.name} onChange={(e) => actions.setProfile({ name: e.target.value })} />

      <div className="section-head"><h2>Habits</h2><button className="link" onClick={onNewHabit}>Add</button></div>
      <div className="list-card">
        {s.habits.map((h, i) => (
          <div key={h.id} className="list-row">
            <span className="tile sm" style={{ background: CATEGORIES[h.category].tint }}><Icon name={CATEGORIES[h.category].icon} size={16} /></span>
            <button className="grow list-main" onClick={() => onOpenHabit(h)}>
              <strong>{h.name}</strong>
              <span className="muted small">{schedule(h)} · {CATEGORIES[h.category].resource}</span>
            </button>
            <button className="icon-btn sm" aria-label={`Move ${h.name} up`} disabled={i === 0} onClick={() => actions.moveHabit(h.id, -1)}><Icon name="up" size={18} /></button>
            <button className="icon-btn sm" aria-label={`Move ${h.name} down`} disabled={i === s.habits.length - 1} onClick={() => actions.moveHabit(h.id, 1)}><Icon name="down" size={18} /></button>
          </div>
        ))}
        {s.habits.length === 0 && <p className="muted pad">No habits yet.</p>}
      </div>

      <div className="section-head"><h2>App</h2></div>
      <div className="list-card">
        <label className="list-row toggle-row">
          <span className="grow"><strong>Sounds</strong><span className="muted small">Check-off and build effects</span></span>
          <input type="checkbox" className="toggle" checked={s.settings.sound} onChange={(e) => actions.setSettings({ sound: e.target.checked })} />
        </label>
        <button className="list-row" onClick={exportData}><span className="grow"><strong>Export backup</strong><span className="muted small">Everything lives on this phone until sync arrives</span></span></button>
        <button className="list-row" onClick={() => file.current?.click()}><span className="grow"><strong>Import backup</strong></span></button>
        <input ref={file} type="file" accept="application/json" hidden onChange={importData} />
        <button className={`list-row ${confirmReset ? 'danger-row' : ''}`} onClick={() => (confirmReset ? (actions.reset(), setConfirmReset(false)) : setConfirmReset(true))}>
          <span className="grow"><strong>{confirmReset ? 'Tap again to wipe everything' : 'Reset all data'}</strong></span>
        </button>
      </div>
      <p className="muted small center-text">Isle 0.1 · local only</p>
    </main>
  );
}
