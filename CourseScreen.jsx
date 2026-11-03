import { useState } from 'react';
import { CourseMap, HoleView, DropIcon } from '../components/Course.jsx';
import Sheet from '../components/Sheet.jsx';
import Icon, { MoneyToken, MaterialToken, ChestArt } from '../components/Icons.jsx';
import { fx } from '../components/fx.jsx';
import { useStore, actions, balance, canAfford, repairCost, upkeepAll, barnCap, tierStatus } from '../lib/store.js';
import { AmenityArt, golfersOut } from '../components/Crowd.jsx';
import {
  PARTS, PART_COST, PART_MAX, CLUBHOUSE, DROPS, RARITY, DAMAGE_KINDS, MATERIALS, MATERIAL_KEYS,
  maintainCost, courseRating, holeLevel, money, DECAY_PER_DAY, DECAY_FLOOR, BARN, CHESTS, shortfall,
  AMENITIES, AMENITY_KEYS, AMENITY_MAX, TIERS, PROMOTE_DAYS, DEMOTE_DAYS, NEGLECT, crowd, FINES, DAILY_FINE_CAP, POP_HITS,
} from '../lib/game.js';
import { HOLES, PAR_TOTAL, yards } from '../lib/holes.js';
import { sfx } from '../lib/sound.js';

const condClass = (c) => (c >= 75 ? 'good' : c >= 45 ? 'ok' : 'bad');

/** Inline cost: $27 · 3 fuel · 3 water ... with short items marked. */
export function Cost({ cost, s }) {
  const short = shortfall(cost, balance(s), s.materials);
  return (
    <span className="cost">
      {cost.money > 0 && <span className={`ci ${short.money ? 'short' : ''}`}><MoneyToken size={14} />{cost.money}</span>}
      {Object.entries(cost.mats ?? {}).map(([k, v]) => (
        <span key={k} className={`ci ${short[k] ? 'short' : ''}`} title={MATERIALS[k].label}><MaterialToken kind={k} size={14} />{v}</span>
      ))}
    </span>
  );
}

/** Explains what's missing on a disabled button. */
function shortText(cost, s) {
  const sh = shortfall(cost, balance(s), s.materials);
  const parts = Object.entries(sh).map(([k, v]) => (k === 'money' ? money(v) : `${v} ${MATERIALS[k].label.toLowerCase()}`));
  return parts.length ? `Need ${parts.join(', ')}` : '';
}

export default function CourseScreen({ onOpenChest }) {
  const s = useStore();
  const [hole, setHole] = useState(null);
  const c = s.course;
  const bal = balance(s);
  const rating = courseRating(c);
  const avg = Math.round(c.holes.reduce((a, h) => a + h.cond, 0) / c.holes.length);
  const all = upkeepAll(s);
  const allPts = c.holes.reduce((a, h) => a + (100 - h.cond), 0);
  const damaged = c.holes.reduce((a, h) => a + h.damage.length, 0);
  const nextClub = CLUBHOUSE[c.clubhouse + 1];
  const owned = DROPS.filter((d) => (s.items[d.id] ?? 0) > 0).length;
  const anyHole = c.holes.some((h) => h.cond < 100 && canAfford(s, maintainCost(h.cond)));
  const ts = tierStatus(s);

  function maintainAll() {
    const n = actions.maintainAll();
    if (n) { sfx.build(); fx.toast(n === c.holes.filter((h) => h.cond < 100).length ? 'Course mown, watered, fed and raked' : `${n} holes done, ran short`); }
  }
  function club() {
    if (actions.upgradeClubhouse()) { sfx.build(); fx.toast(`${CLUBHOUSE[c.clubhouse + 1]?.name ?? 'Clubhouse'} built`); }
  }

  return (
    <main className="screen">
      <header className="top">
        <div>
          <span className="eyebrow">{s.profile.name ? `${s.profile.name.toUpperCase()}'S CLUB` : 'YOUR CLUB'} · PAR {PAR_TOTAL}</span>
          <h1>Course</h1>
        </div>
        <span className="money-chip big" data-res-target="money"><MoneyToken size={20} /> {money(bal)}</span>
      </header>

      <div className="course-hero">
        <CourseMap course={c} items={s.items} barn={s.barn} amen={s.amen} pop={ts.pop} tier={ts.tierIdx} onHole={setHole} highlight={hole} />
        <span className="hero-tag">Tap a hole</span>
      </div>

      {bal < 0 && (
        <div className="debt-box">
          <strong>{money(-bal)} in debt</strong>
          <span>Everything you earn pays this off first. Nothing can be built, maintained or repaired until it's cleared.</span>
        </div>
      )}

      <PopularityCard ts={ts} amen={s.amen} />

      <div className="stat-tiles">
        <div className="stile"><strong>{rating}</strong><span>Rating</span></div>
        <div className={`stile ${condClass(avg)}`}><strong>{avg}%</strong><span>Condition</span></div>
        <div className={`stile ${damaged ? 'bad' : ''}`}><strong>{damaged}</strong><span>Damage</span></div>
      </div>

      <div className="upkeep">
        <div className="upkeep-top">
          <div className="grow">
            <strong>Daily upkeep</strong>
            <span className="muted small">Every hole loses {DECAY_PER_DAY}% a day, down to {DECAY_FLOOR}%. Upkeep takes money and materials from the barn.</span>
          </div>
        </div>
        {allPts > 0 ? (
          <div className="upkeep-bottom">
            <Cost cost={all} s={s} />
            <button className={`btn ${anyHole ? 'dark' : 'locked'}`} disabled={!anyHole} onClick={maintainAll}>
              {canAfford(s, all) ? 'Maintain all' : anyHole ? 'Maintain what I can' : 'Short'}
            </button>
          </div>
        ) : <span className="muted small">All 18 holes are perfect.</span>}
      </div>

      <div className="section-head"><h2>Amenities</h2><span className="count">{AMENITY_KEYS.reduce((a, k) => a + s.amen[k], 0)} / {AMENITY_KEYS.length * AMENITY_MAX}</span></div>
      <div className="list-card">
        {AMENITY_KEYS.map((k) => {
          const A = AMENITIES[k];
          const lv = s.amen[k];
          const price = A.cost[lv];
          return (
            <div key={k} className="list-row amen-row">
              <span className="amen-art"><AmenityArt k={k} lv={lv} size={40} /></span>
              <span className="grow">
                <strong>{A.label}</strong>
                <span className="muted small">{A.levels[lv]}{lv < AMENITY_MAX ? ` · next: ${A.levels[lv + 1].toLowerCase()}` : ''}</span>
                <span className="lv-pips">{Array.from({ length: AMENITY_MAX }, (_, i) => <span key={i} className={i < lv ? 'on' : ''} />)}</span>
              </span>
              {lv < AMENITY_MAX ? (
                <button className={`btn ${bal >= price ? 'dark' : 'locked'}`} disabled={bal < price} onClick={() => { if (actions.buildAmenity(k)) { sfx.build(); fx.toast(`${A.label}: ${A.levels[lv + 1]}`); } }}>{money(price)}</button>
              ) : <span className="muted small">Max</span>}
            </div>
          );
        })}
      </div>
      {s.rep.neglect > 0 ? (
        <p className="short-note">Course average is {avg}%. {NEGLECT.amenityDays - s.rep.neglect} more day{NEGLECT.amenityDays - s.rep.neglect === 1 ? '' : 's'} at {NEGLECT.amenityCond}% or under and your best amenity loses a level.</p>
      ) : (
        <p className="muted small">Amenities lift popularity and fill the entrance strip. Let the course average sit at {NEGLECT.amenityCond}% or under for {NEGLECT.amenityDays} days and the best one loses a level.</p>
      )}

      <div className="section-head"><h2>Barn</h2><span className="count">{BARN[s.barn].name} · cap {barnCap(s)}</span></div>
      <div className="barn-card">
        {s.chests.length > 0 && (
          <div className="chest-row">
            {s.chests.map((ch) => (
              <button key={ch.id} className={`chest-btn ${ch.kind}`} onClick={() => onOpenChest(ch.id)} aria-label={`Open ${CHESTS[ch.kind].label}: ${ch.reason}`}>
                <ChestArt kind={ch.kind} size={54} />
                <span>{CHESTS[ch.kind].label}</span>
              </button>
            ))}
            <span className="muted small chest-hint">Tap to open</span>
          </div>
        )}
        <div className="mat-list">
          {MATERIAL_KEYS.map((k) => {
            const n = s.materials[k] ?? 0;
            return (
              <div key={k} className="mat-row">
                <MaterialToken kind={k} size={26} />
                <div className="grow">
                  <div className="mat-top"><strong>{MATERIALS[k].label}</strong><span className="muted small">{MATERIALS[k].job}</span><span className="mono mat-n">{n}/{barnCap(s)}</span></div>
                  <span className="mat-bar"><span style={{ width: `${(n / barnCap(s)) * 100}%`, background: MATERIALS[k].tint }} /></span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="muted small">Materials only come from chests. Finish goals on the Plan tab to earn them; streak milestones and long Pomodoro stacks drop them too. A full barn sells the overflow for $1 a unit.</p>
        {BARN[s.barn + 1] && (
          <button className={`btn full ${bal >= BARN[s.barn + 1].cost ? 'dark' : 'locked'}`} disabled={bal < BARN[s.barn + 1].cost} onClick={() => { if (actions.upgradeBarn()) { sfx.build(); fx.toast(`${BARN[s.barn].name} built`); } }}>
            {bal >= BARN[s.barn + 1].cost ? `Build ${BARN[s.barn + 1].name} (cap ${BARN[s.barn + 1].cap}) · ${money(BARN[s.barn + 1].cost)}` : `${BARN[s.barn + 1].name}: ${money(BARN[s.barn + 1].cost - bal)} short`}
          </button>
        )}
      </div>

      <div className="section-head"><h2>Holes</h2><span className="count">18</span></div>
      <div className="hole-list">
        {c.holes.map((h, i) => (
          <button key={i} className="hole-row" onClick={() => setHole(i)}>
            <span className="hole-num">{i + 1}</span>
            <span className="grow hole-row-main">
              <span className="hole-row-top">
                <strong>Par {HOLES[i].par}</strong>
                <span className="muted small">Lv {holeLevel(h)}/12</span>
                {h.damage.length > 0 && <span className="dmg-pill">{h.damage.length} to repair</span>}
                {(h.floorDays ?? 0) > 0 && holeLevel(h) > 0 && <span className="dmg-pill warn">{h.floorDays}/{NEGLECT.holeDays} days neglected</span>}
              </span>
              <span className={`cond-bar ${condClass(h.cond)}`}><span style={{ width: `${h.cond}%` }} /></span>
            </span>
            <span className="cond-num">{Math.round(h.cond)}%</span>
          </button>
        ))}
      </div>

      <div className="section-head"><h2>Clubhouse</h2><span className="count">{c.clubhouse + 1} / {CLUBHOUSE.length}</span></div>
      <div className="build-card wide">
        <div className="grow">
          <strong>{CLUBHOUSE[c.clubhouse].name}</strong>
          <span className="muted small">{nextClub ? `Next: ${nextClub.name}` : 'Fully built'}</span>
        </div>
        {nextClub && (
          <button className={`btn ${bal >= nextClub.cost ? 'dark' : 'locked'}`} disabled={bal < nextClub.cost} onClick={club}>
            {bal >= nextClub.cost ? `Build ${money(nextClub.cost)}` : `${money(nextClub.cost - bal)} short`}
          </button>
        )}
      </div>

      <Penalties s={s} />

      <div className="section-head"><h2>Collection</h2><span className="count">{owned} / {DROPS.length}</span></div>
      <p className="muted small">Items come out of chests: 10% of crates, 35% of chests, every big chest. They can't be bought.</p>
      <div className="drop-grid">
        {DROPS.map((d) => {
          const n = s.items[d.id] ?? 0;
          return (
            <div key={d.id} className={`drop-card ${n ? '' : 'locked'}`} style={{ '--rar': RARITY[d.rarity].tint }}>
              <DropIcon id={d.id} owned={n > 0} size={52} />
              <strong>{n ? d.name : '???'}</strong>
              <span className="rar">{RARITY[d.rarity].label}{n > 1 ? ` · x${n}` : ''}</span>
            </div>
          );
        })}
      </div>

      {hole !== null && <HoleSheet i={hole} onClose={() => setHole(null)} />}
    </main>
  );
}

function HoleSheet({ i, onClose }) {
  const s = useStore();
  const h = s.course.holes[i];
  const bal = balance(s);
  const cost = maintainCost(h.cond);
  const need = h.cond < 100;
  const ok = need && canAfford(s, cost);

  function maintain() { if (actions.maintain(i)) { sfx.build(); fx.toast(`Hole ${i + 1} mown, watered, fed and raked`); } }
  function repair(d) { if (actions.repair(i, d.id)) { sfx.build(); fx.toast(`${DAMAGE_KINDS[d.kind]} fixed`); } }
  function upgrade(p) { if (actions.upgrade(i, p.id)) { sfx.build(); fx.toast(`${p.label} upgraded`); } }

  return (
    <Sheet title={`Hole ${i + 1} · Par ${HOLES[i].par} · ${yards(i)} m`} onClose={onClose} tall>
      <div className="hole-sheet-art">
        <HoleView i={i} h={h} gold={(s.items.goldflags ?? 0) > 0} />
        <span className={`hero-tag cond-tag ${condClass(h.cond)}`}>{Math.round(h.cond)}% condition</span>
      </div>

      <div className="maint-box">
        <span className={`cond-bar ${condClass(h.cond)}`}><span style={{ width: `${h.cond}%` }} /></span>
        {need ? (
          <div className="row gap">
            <span className="grow"><Cost cost={cost} s={s} /></span>
            <button className={`btn ${ok ? 'dark' : 'locked'}`} disabled={!ok} onClick={maintain}>Maintain</button>
          </div>
        ) : <span className="muted small">Perfect condition.</span>}
        {need && !ok && <span className="short-note">{shortText(cost, s)}. Maintaining all holes at once rounds costs better.</span>}
      </div>

      {h.damage.length > 0 && (
        <div className="list-card" style={{ marginTop: 12 }}>
          {h.damage.map((d) => {
            const rc = repairCost(d.kind);
            const can = canAfford(s, rc);
            return (
              <div key={d.id} className="list-row">
                <span className="tile sm dmg"><Icon name="wrench" size={16} /></span>
                <span className="grow"><strong>{DAMAGE_KINDS[d.kind]}</strong><Cost cost={rc} s={s} /></span>
                <button className={`btn ${can ? 'dark' : 'locked'}`} disabled={!can} onClick={() => repair(d)}>Fix</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="section-head"><h2>Upgrades</h2><span className="count">{holeLevel(h)} / 12</span></div>
      <div className="list-card">
        {PARTS.map((p) => {
          const lv = h.lv[p.id];
          const price = PART_COST[lv];
          return (
            <div key={p.id} className="list-row">
              <span className="grow">
                <strong>{p.label}</strong>
                <span className="lv-pips">{Array.from({ length: PART_MAX }, (_, k) => <span key={k} className={k < lv ? 'on' : ''} />)}</span>
              </span>
              {lv < PART_MAX ? (
                <button className={`btn ${bal >= price ? 'dark' : 'locked'}`} disabled={bal < price} onClick={() => upgrade(p)}>{money(price)}</button>
              ) : <span className="muted small">Max</span>}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

function PopularityCard({ ts, amen }) {
  const { pop, tier, next, tierIdx, up, down } = ts;
  const prev = TIERS[tierIdx - 1];
  const c = crowd(pop, amen);
  let status;
  if (next && pop >= next.min) status = <>Above the {next.name} line. Hold it <b>{PROMOTE_DAYS - up} more day{PROMOTE_DAYS - up === 1 ? '' : 's'}</b> to move up.</>;
  else if (pop < tier.min && prev) status = <>Below the {tier.name} line{down ? ` for ${down} day${down === 1 ? '' : 's'}` : ''}. <b>{DEMOTE_DAYS - down} more</b> and you drop to {prev.name}.</>;
  else if (next) status = <>{next.min - pop} points to {next.name}. Hold {next.min}+ for {PROMOTE_DAYS} days to move up.</>;
  else status = <>Top of the ladder. Drop under {tier.min} for {DEMOTE_DAYS} days and you lose it.</>;
  const hit = ts.consistency === null ? null : Math.round(ts.consistency * 100);
  return (
    <section className={`pop-card tier-${tierIdx}`}>
      <div className="pop-head">
        <span className="tier-badge" style={{ background: tier.sign, color: tier.ink }}>{tier.name}</span>
        <span className="pop-num"><strong>{pop}</strong><span>/100 popularity</span></span>
      </div>
      <div className="pop-bar" aria-label={`Popularity ${pop} of 100`}>
        <span className="pop-fill" style={{ width: `${pop}%` }} />
        {TIERS.slice(1).map((t, i) => (
          <span key={t.name} className={`pop-tick ${i + 1 <= tierIdx ? 'past' : ''}`} style={{ left: `${t.min}%` }}><i>{t.min}</i></span>
        ))}
      </div>
      <p className="pop-status">{status}</p>
      <div className="pop-parts">
        <div><strong>{ts.quality}</strong><span>Quality</span></div>
        <div><strong>x{ts.mult.toFixed(2)}</strong><span>{hit === null ? 'No history' : `${hit}% hit, 14 d`}</span></div>
        <div className={ts.hits ? 'bad' : ''}><strong>-{Math.round(ts.hits)}</strong><span>Penalties</span></div>
      </div>
      <p className="muted small pop-crowd">
        {golfersOut(pop, amen)} golfers out, {c.cartsOut} of {c.owned} carts, {c.cars} cars in the lot{c.rangeBays ? `, ${c.atRange} at the range` : ''}.
        Quality is the course and its facilities. Missed habits and failed blocks pull the multiplier and penalties down.
      </p>
    </section>
  );
}

function Penalties({ s }) {
  const [open, setOpen] = useState(false);
  const list = s.fines ?? [];
  const recent = open ? list : list.slice(0, 4);
  return (
    <>
      <div className="section-head"><h2>Penalties</h2><span className="count">{money(s.finesTotal ?? 0)} fined</span></div>
      <div className="list-card">
        {recent.map((f) => (
          <div key={f.id} className="list-row fine-row">
            <span className="grow"><strong>{f.label}</strong><span className="muted small">{f.day}</span></span>
            <span className="fine-amt">-{money(f.amount)}</span>
          </div>
        ))}
        {list.length === 0 && <p className="muted pad">No fines yet.</p>}
        {list.length > 4 && <button className="btn ghost full" onClick={() => setOpen(!open)}>{open ? 'Show less' : `Show all ${list.length}`}</button>}
      </div>
      <p className="muted small">
        Each morning the app bills yesterday: {money(FINES.missed)} per missed habit, {money(FINES.limit)} for going over a limit (capped at {money(DAILY_FINE_CAP)} a day),
        and {money(FINES.goal.small)} / {money(FINES.goal.medium)} / {money(FINES.goal.big)} for a missed small, medium or big goal. Failed blocks cost {POP_HITS.block} popularity and damage a hole.
        A hole left at {DECAY_FLOOR}% for {NEGLECT.holeDays} days loses an upgrade level.
      </p>
    </>
  );
}
