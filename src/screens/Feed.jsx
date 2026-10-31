import Icon from '../components/Icons.jsx';
import { useStore, getLog, isDone, overallStreak } from '../lib/store.js';
import { dayKey, formatMinutes } from '../lib/dates.js';
import { CATEGORIES, TRUST, bucketById } from '../lib/game.js';

/**
 * Phase 2 brings friends. Until then this shows your own daily card exactly as friends
 * will see it, so the privacy settings can be checked now.
 */
export default function Feed() {
  const s = useStore();
  const day = dayKey();
  const done = s.habits.filter((h) => isDone(s, h.id, day));
  const shown = done.filter((h) => h.visibility === 'friends');
  const summarised = done.filter((h) => h.visibility === 'summary').length;
  const name = s.profile.name || 'You';

  const line = (h) => {
    const log = getLog(s, h.id, day);
    if (h.type === 'count') return `${h.name}: ${log.value} ${h.unit}`;
    if (h.type === 'duration') return `${h.name}: ${formatMinutes(log.value)}`;
    if (h.type === 'limit') return `${h.name}: ${bucketById(log.bucket).label.toLowerCase()}`;
    return h.name;
  };

  return (
    <main className="screen">
      <header className="top">
        <div><span className="eyebrow">FRIENDS</span><h1>Feed</h1></div>
      </header>

      <p className="muted">Friends arrive in the next build. This is your card as they'll see it today.</p>

      <article className="feed-card">
        <div className="feed-head">
          <span className="avatar">{name[0].toUpperCase()}</span>
          <div className="grow">
            <strong>{name}</strong>
            <span className="muted small">Today · {overallStreak(s, day)} day streak</span>
          </div>
        </div>
        {done.length === 0 ? (
          <p className="muted">Nothing logged yet today.</p>
        ) : (
          <ul className="feed-lines">
            {shown.map((h) => {
              const log = getLog(s, h.id, day);
              return (
                <li key={h.id}>
                  <span className="dot" style={{ background: CATEGORIES[h.category].tint }} />
                  <span className="grow">{line(h)}</span>
                  <span className={`trust ${log.trust}`}>{TRUST[log.trust].label}</span>
                </li>
              );
            })}
            {summarised > 0 && (
              <li className="muted"><Icon name="lock" size={14} /> Completed {summarised} private habit{summarised === 1 ? '' : 's'}</li>
            )}
          </ul>
        )}
        <div className="reactions" aria-hidden="true">
          {['Nice', 'Fire', 'Clap', 'Wow', 'Nudge'].map((r) => <span key={r} className="react">{r}</span>)}
        </div>
      </article>
    </main>
  );
}
