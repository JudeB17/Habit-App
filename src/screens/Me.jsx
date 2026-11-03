import { useRef, useState } from 'react';
import Icon from '../components/Icons.jsx';
import { fx } from '../components/fx.jsx';
import { useStore, actions } from '../lib/store.js';
import { CATEGORIES } from '../lib/game.js';
import { configured, useSocial, signOut, publish, refresh, leaveGroup, restoreBackup, ago } from '../lib/social.js';
import { GroupSetup } from './Feed.jsx';

export default function Me({ onOpenHabit, onNewHabit, goFeed }) {
  const s = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const file = useRef(null);

  function exportData() {
    const blob = new Blob([actions.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fairway-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
              <span className="muted small">{schedule(h)}</span>
            </button>
            <button className="icon-btn sm" aria-label={`Move ${h.name} up`} disabled={i === 0} onClick={() => actions.moveHabit(h.id, -1)}><Icon name="up" size={18} /></button>
            <button className="icon-btn sm" aria-label={`Move ${h.name} down`} disabled={i === s.habits.length - 1} onClick={() => actions.moveHabit(h.id, 1)}><Icon name="down" size={18} /></button>
          </div>
        ))}
        {s.habits.length === 0 && <p className="muted pad">No habits yet.</p>}
      </div>

      {configured && <Account goFeed={goFeed} />}

      <div className="section-head"><h2>App</h2></div>
      <div className="list-card">
        <label className="list-row toggle-row">
          <span className="grow"><strong>Sounds</strong><span className="muted small">Check-off, timer and course effects</span></span>
          <input type="checkbox" className="toggle" checked={s.settings.sound} onChange={(e) => actions.setSettings({ sound: e.target.checked })} />
        </label>
        <label className="list-row toggle-row">
          <span className="grow"><strong>Share goal names</strong><span className="muted small">Off: friends see “hit a medium goal” without the title</span></span>
          <input type="checkbox" className="toggle" checked={s.settings.shareGoals !== false} onChange={(e) => actions.setSettings({ shareGoals: e.target.checked })} />
        </label>
        <button className="list-row" onClick={exportData}><span className="grow"><strong>Export backup</strong><span className="muted small">A JSON file of everything on this phone</span></span></button>
        <button className="list-row" onClick={() => file.current?.click()}><span className="grow"><strong>Import backup</strong></span></button>
        <input ref={file} type="file" accept="application/json" hidden onChange={importData} />
        <button className={`list-row ${confirmReset ? 'danger-row' : ''}`} onClick={() => (confirmReset ? (actions.reset(), setConfirmReset(false)) : setConfirmReset(true))}>
          <span className="grow"><strong>{confirmReset ? 'Tap again to wipe everything' : 'Reset all data'}</strong></span>
        </button>
      </div>
      <p className="muted small center-text">Fairway {__APP_VERSION__} · built {new Date(__BUILT_AT__).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
    </main>
  );
}

function Account({ goFeed }) {
  const so = useSocial();
  const [confirm, setConfirm] = useState(null);
  const [adding, setAdding] = useState(false);
  if (!so.user) {
    return (
      <>
        <div className="section-head"><h2>Friends</h2></div>
        <div className="list-card"><button className="list-row" onClick={goFeed}><span className="grow"><strong>Sign in</strong><span className="muted small">Share your card and course with friends, plus a cloud backup</span></span></button></div>
      </>
    );
  }
  const st = so.sync;
  return (
    <>
      <div className="section-head"><h2>Friends</h2><span className="count">{so.user.email}</span></div>
      <div className="list-card">
        <button className="list-row" onClick={() => publish(true).then(refresh).then(() => fx.toast(so.sync.error ? 'Sync failed' : 'Synced'))}>
          <span className="grow">
            <strong>{st.status === 'syncing' ? 'Syncing…' : st.status === 'error' ? 'Sync failed, tap to retry' : 'Synced'}</strong>
            <span className="muted small">{st.error ?? `Last ${ago(st.at)}. Backup ${so.backup ? `saved ${ago(so.backup.updatedAt)}` : 'not saved yet'}`}</span>
          </span>
        </button>
        {so.groups.map((g) => (
          <div key={g.id} className="list-row">
            <span className="grow"><strong>{g.name}</strong><span className="muted small">Code <b className="mono">{g.invite_code}</b> · {g.members.length} members</span></span>
            <button className={`btn ${confirm === g.id ? 'danger' : ''}`} onClick={() => (confirm === g.id ? leaveGroup(g.id).then(() => setConfirm(null)) : setConfirm(g.id))}>{confirm === g.id ? 'Sure?' : 'Leave'}</button>
          </div>
        ))}
        <button className="list-row" onClick={() => setAdding(!adding)}><span className="grow"><strong>{adding ? 'Cancel' : 'Join or start another group'}</strong></span></button>
        {so.backup && (
          <button className={`list-row ${confirm === 'restore' ? 'danger-row' : ''}`} onClick={() => (confirm === 'restore' ? restoreBackup().then(() => { setConfirm(null); fx.toast('Backup restored'); }).catch((e) => fx.toast(e.message)) : setConfirm('restore'))}>
            <span className="grow"><strong>{confirm === 'restore' ? 'Tap again: replaces everything on this phone' : 'Restore from cloud backup'}</strong><span className="muted small">For a new phone. Saved {ago(so.backup.updatedAt)}</span></span>
          </button>
        )}
        <button className="list-row" onClick={() => signOut()}><span className="grow"><strong>Sign out</strong><span className="muted small">Your data stays on this phone</span></span></button>
      </div>
      {adding && <div style={{ marginTop: 12 }}><GroupSetup onDone={() => setAdding(false)} /></div>}
    </>
  );
}
