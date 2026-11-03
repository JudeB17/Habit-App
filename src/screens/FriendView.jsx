import { useEffect, useState } from 'react';
import Icon from '../components/Icons.jsx';
import Sheet from '../components/Sheet.jsx';
import { CourseMap, HoleView, DropIcon } from '../components/Course.jsx';
import { useSocial, ago } from '../lib/social.js';
import { friendCourse } from '../lib/card.js';
import { HOLES, PAR_TOTAL, yards } from '../lib/holes.js';
import { PARTS, PART_MAX, CLUBHOUSE, BARN, DROPS, RARITY, DAMAGE_KINDS, CATEGORIES, TRUST, holeLevel, money, TIERS, AMENITIES, AMENITY_KEYS } from '../lib/game.js';
import { formatMinutes, dayKey } from '../lib/dates.js';
import { Avatar } from './Feed.jsx';

const condClass = (c) => (c >= 75 ? 'good' : c >= 45 ? 'ok' : 'bad');

/** A friend's club, read-only: their course as of now (snapshot plus decay since). */
export default function FriendView({ id, onClose }) {
  const so = useSocial();
  const [hole, setHole] = useState(null);
  const [closing, setClosing] = useState(false);
  const f = so.friends.find((x) => x.id === id);
  const close = () => { setClosing(true); setTimeout(onClose, 200); };

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const card = f?.card;
  const fc = friendCourse(card);
  const me = id === so.user?.id;
  const name = me ? 'Your' : `${f?.name ?? 'Friend'}'s`;
  const t = card?.today;
  const isToday = t?.day === dayKey();
  const items = card?.items ?? {};
  const owned = DROPS.filter((d) => (items[d.id] ?? 0) > 0);
  const recent = so.feed.filter((e) => e.user_id === id && e.kind !== 'day').slice(0, 5);

  return (
    <div className={`friend-view ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label={`${name} course`}>
      <header className="fv-top">
        <button className="icon-btn" aria-label="Back" onClick={close}><Icon name="x" /></button>
        <Avatar id={id} name={f?.name} size={36} />
        <div className="grow">
          <strong>{me ? 'Your club' : `${f?.name ?? 'Friend'}'s club`}</strong>
          <span className="muted small">Par {PAR_TOTAL} · updated {ago(f?.updatedAt)}</span>
        </div>
      </header>

      <div className="fv-body">
        {!fc ? (
          <p className="muted">They haven't synced a course yet.</p>
        ) : (
          <>
            <div className="course-hero">
              <CourseMap course={fc.course} items={items} barn={card.barn ?? 0} amen={card.amen} pop={card.pop ?? 0} tier={card.tier ?? 0} onHole={setHole} highlight={hole} label={`${name} course`} />
              <span className="hero-tag">Tap a hole</span>
            </div>
            {fc.staleDays > 0 && <p className="muted small fv-note">Not opened for {fc.staleDays} day{fc.staleDays > 1 ? 's' : ''}, so the grass has been browning since.</p>}

            <div className="stat-tiles four">
              <div className="stile"><strong>{card.pop ?? '·'}</strong><span>{TIERS[card.tier ?? 0].name}</span></div>
              <div className={`stile ${condClass(fc.avg)}`}><strong>{fc.avg}%</strong><span>Condition</span></div>
              <div className={`stile ${fc.damaged ? 'bad' : ''}`}><strong>{fc.damaged}</strong><span>Damage</span></div>
              <div className="stile"><strong>{owned.length}</strong><span>Items</span></div>
            </div>

            <div className="list-card fv-builds">
              <div className="list-row"><span className="grow"><strong>{CLUBHOUSE[fc.course.clubhouse]?.name}</strong><span className="muted small">Clubhouse {fc.course.clubhouse + 1}/{CLUBHOUSE.length}</span></span></div>
              {card.amen && AMENITY_KEYS.map((k) => (
                <div key={k} className="list-row"><span className="grow"><strong>{AMENITIES[k].levels[card.amen[k] ?? 0]}</strong><span className="muted small">{AMENITIES[k].label} {card.amen[k] ?? 0}/3</span></span></div>
              ))}
              <div className="list-row"><span className="grow"><strong>{BARN[card.barn ?? 0]?.name}</strong><span className="muted small">Barn, holds {BARN[card.barn ?? 0]?.cap} of each material</span></span></div>
              <div className="list-row"><span className="grow"><strong>{money(card.worth ?? 0)}</strong><span className="muted small">In the bank</span></span></div>
            </div>
          </>
        )}

        <div className="section-head"><h2>Today</h2>{isToday && <span className="count">{t.done}/{Math.max(t.due, t.done)}</span>}</div>
        {isToday && (t.lines.length || t.hidden || t.focusMin) ? (
          <div className="feed-card flat">
            <ul className="feed-lines">
              {t.lines.map((l, i) => (
                <li key={i}>
                  <span className="dot" style={{ background: CATEGORIES[l.cat]?.tint }} />
                  <span className="grow">{l.name}{l.detail ? <span className="muted">: {l.detail}</span> : null}</span>
                  <span className={`trust ${l.trust}`}>{TRUST[l.trust]?.label}</span>
                </li>
              ))}
              {t.hidden > 0 && <li className="muted"><Icon name="lock" size={14} /> {t.hidden} private</li>}
            </ul>
            <div className="day-foot">
              {t.focusMin > 0 && <span><b>{formatMinutes(t.focusMin)}</b> focus</span>}
              {(t.blocks.ok > 0 || t.blocks.fail > 0) && <span><b>{t.blocks.ok}</b> blocks{t.blocks.fail ? ` · ${t.blocks.fail} failed` : ''}</span>}
              {t.streak > 0 && <span><b>{t.streak}</b> day streak</span>}
            </div>
          </div>
        ) : <p className="muted">Nothing logged today yet.</p>}

        {card?.week && (
          <>
            <div className="section-head"><h2>Last 7 days</h2></div>
            <div className="stat-tiles">
              <div className="stile"><strong>{formatMinutes(card.week.focusMin)}</strong><span>Focus</span></div>
              <div className="stile"><strong>{card.week.hit ?? '–'}{card.week.hit != null ? '%' : ''}</strong><span>Habits hit</span></div>
              <div className="stile"><strong>{t?.streak ?? 0}</strong><span>Streak</span></div>
            </div>
          </>
        )}

        {owned.length > 0 && (
          <>
            <div className="section-head"><h2>Collection</h2><span className="count">{owned.length} / {DROPS.length}</span></div>
            <div className="drop-grid">
              {owned.map((d) => (
                <div key={d.id} className="drop-card" style={{ '--rar': RARITY[d.rarity].tint }}>
                  <DropIcon id={d.id} size={52} />
                  <strong>{d.name}</strong>
                  <span className="rar">{RARITY[d.rarity].label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {recent.length > 0 && (
          <>
            <div className="section-head"><h2>Recently</h2></div>
            <div className="list-card">
              {recent.map((e) => <div key={e.id} className="list-row"><span className="grow"><strong>{shortLine(e)}</strong><span className="muted small">{ago(e.created_at)}</span></span></div>)}
            </div>
          </>
        )}
      </div>

      {hole !== null && fc && <FriendHole i={hole} h={fc.course.holes[hole]} gold={(items.goldflags ?? 0) > 0} onClose={() => setHole(null)} />}
    </div>
  );
}

function shortLine(e) {
  const p = e.payload ?? {};
  if (e.kind === 'stack') return p.failed ? `Failed a block · hole ${p.hole} damaged` : `${p.blocks} block stack`;
  if (e.kind === 'goal') return `${p.size[0].toUpperCase()}${p.size.slice(1)} goal${p.title ? `: ${p.title}` : ''}`;
  if (e.kind === 'item') return `Found the ${p.name}`;
  if (e.kind === 'milestone') return `${p.n} ${p.unit} streak`;
  if (e.kind === 'build') return `Built the ${p.name}`;
  return '';
}

function FriendHole({ i, h, gold, onClose }) {
  return (
    <Sheet title={`Hole ${i + 1} · Par ${HOLES[i].par} · ${yards(i)} m`} onClose={onClose} tall>
      <div className="hole-sheet-art">
        <HoleView i={i} h={h} gold={gold} />
        <span className={`hero-tag cond-tag ${condClass(h.cond)}`}>{Math.round(h.cond)}% condition</span>
      </div>
      <div className="maint-box">
        <span className={`cond-bar ${condClass(h.cond)}`}><span style={{ width: `${h.cond}%` }} /></span>
        {h.damage.length > 0
          ? <span className="muted small">Needs repair: {h.damage.map((d) => DAMAGE_KINDS[d.kind]).join(', ')}</span>
          : <span className="muted small">No damage.</span>}
      </div>
      <div className="section-head"><h2>Upgrades</h2><span className="count">{holeLevel(h)} / 12</span></div>
      <div className="list-card">
        {PARTS.map((p) => (
          <div key={p.id} className="list-row">
            <span className="grow">
              <strong>{p.label}</strong>
              <span className="lv-pips">{Array.from({ length: PART_MAX }, (_, k) => <span key={k} className={k < h.lv[p.id] ? 'on' : ''} />)}</span>
            </span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
