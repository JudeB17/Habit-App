import { useState } from 'react';
import Island from '../components/Island.jsx';
import { ResourceToken } from '../components/Icons.jsx';
import { fx } from '../components/fx.jsx';
import { useStore, actions, resources, idleDays } from '../lib/store.js';
import { BUILDINGS, RESOURCES, RESOURCE_KEYS, shortfall, costLabel } from '../lib/game.js';
import { sfx } from '../lib/sound.js';

export default function IslandScreen() {
  const s = useStore();
  const [fresh, setFresh] = useState(null);
  const res = resources(s);
  const idle = idleDays(s);
  const next = BUILDINGS.filter((b) => !s.buildings.includes(b.id));

  function build(b) {
    if (actions.build(b.id)) {
      sfx.build();
      setFresh(b.id);
      fx.toast(`${b.name} built`);
      document.querySelector('.island-hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => setFresh(null), 900);
    }
  }

  return (
    <main className="screen">
      <header className="top">
        <div>
          <span className="eyebrow">{s.profile.name ? `${s.profile.name.toUpperCase()}'S PLOT` : 'YOUR PLOT'}</span>
          <h1>Island</h1>
        </div>
        <div className="seg-mini" role="tablist" aria-label="Island view">
          <button className="on" role="tab" aria-selected="true">Mine</button>
          <button role="tab" aria-selected="false" disabled title="Arrives with friends in phase 2">Group</button>
        </div>
      </header>

      <div className="island-hero">
        <Island built={s.buildings} idle={idle} fresh={fresh} />
        <span className="hero-tag">Level {s.buildings.length} · {s.buildings.length} building{s.buildings.length === 1 ? '' : 's'}</span>
        {idle >= 2 && <span className="hero-warn">Weeds after {idle} quiet days. One done habit clears them.</span>}
      </div>

      <div className="res-grid">
        {RESOURCE_KEYS.map((k) => (
          <div key={k} className="res-tile" style={{ background: RESOURCES[k].tint }}>
            <ResourceToken resource={k} size={20} />
            <strong>{res[k]}</strong>
            <span>{k}</span>
          </div>
        ))}
      </div>

      <div className="section-head"><h2>Build next</h2><span className="count">{next.length} left</span></div>
      {next.length === 0 && <p className="all-done">Everything's built. More buildings land with the group island.</p>}
      <div className="build-grid">
        {next.map((b) => {
          const short = shortfall(b.cost, res);
          const can = Object.keys(short).length === 0;
          return (
            <div key={b.id} className="build-card">
              <strong>{b.name}</strong>
              <span className="muted small">{costLabel(b.cost)}</span>
              <button className={`btn ${can ? 'dark' : 'locked'} full`} disabled={!can} onClick={() => build(b)}>
                {can ? 'Build' : `${Object.entries(short).map(([k, v]) => `${v} ${k}`).join(', ')} short`}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
