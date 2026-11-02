import { useEffect, useState } from 'react';
import Icon, { ChestArt } from '../components/Icons.jsx';
import { DropIcon, CourseMap } from '../components/Course.jsx';
import { fx } from '../components/fx.jsx';
import { useStore, isFresh } from '../lib/store.js';
import {
  configured, useSocial, signIn, signUp, createGroup, joinGroup, refresh, toggleReaction,
  addComment, deleteComment, restoreBackup, REACTIONS, ago,
} from '../lib/social.js';
import { friendCourse } from '../lib/card.js';
import { CATEGORIES, TRUST, RARITY } from '../lib/game.js';
import { formatMinutes, dayKey, addDays } from '../lib/dates.js';
import { sfx } from '../lib/sound.js';

const TINTS = ['#FFD23F', '#A9C3FF', '#FFB3A7', '#B7E4B9', '#F5C6E8', '#FFE0A3'];
export const tintFor = (id = '') => TINTS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];

export function Avatar({ id, name, size = 42 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42, background: tintFor(id) }}>
      {(name || '?')[0].toUpperCase()}
    </span>
  );
}

export default function Feed({ onFriend }) {
  const so = useSocial();
  useEffect(() => { if (so.user) refresh(); }, [so.user?.id]);

  if (!configured) {
    return (
      <Shell>
        <div className="hint-box">Friends need the Supabase keys in the build. See “Friends setup” in the README.</div>
      </Shell>
    );
  }
  if (!so.ready) return <Shell><p className="muted">Loading…</p></Shell>;
  if (!so.user) return <Shell><AuthCard /></Shell>;
  if (!so.groups.length && so.fetched) return <Shell><GroupSetup first /></Shell>;

  return (
    <Shell right={<button className="icon-btn" aria-label="Refresh" onClick={() => { sfx.tap(); refresh(); }}><span className={so.loading ? 'spin' : ''}>↻</span></button>}>
      <RestoreBanner />
      {so.sync.status === 'error' && <div className="hint-box warn">Offline or sync failed: {so.sync.error}. It'll retry.</div>}
      <FriendsStrip friends={so.friends} me={so.user.id} onFriend={onFriend} />
      {so.groups.length > 0 && <InviteChip group={so.groups[0]} more={so.groups.length - 1} />}
      <div className="section-head"><h2>Feed</h2><span className="count">{so.feed.length ? 'Last 60' : ''}</span></div>
      {so.feed.length === 0 && <p className="muted">Nothing yet. Tick off a habit or finish a Pomodoro and it shows up here.</p>}
      <div className="feed-list">
        {so.feed.map((e) => <FeedItem key={e.id} e={e} so={so} onFriend={onFriend} />)}
      </div>
    </Shell>
  );
}

function Shell({ children, right }) {
  return (
    <main className="screen">
      <header className="top">
        <div><span className="eyebrow">FRIENDS</span><h1>Feed</h1></div>
        {right}
      </header>
      {children}
    </main>
  );
}

// ---------- sign in ----------

function AuthCard() {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try { mode === 'in' ? await signIn(email, pw) : await signUp(email, pw); sfx.check(); }
    catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  }

  return (
    <form className="auth-card" onSubmit={go}>
      <div className="auth-art"><span>⛳</span></div>
      <h2>{mode === 'in' ? 'Sign in to see your friends' : 'Make an account'}</h2>
      <p className="muted small">Your habits stay on this phone. Signing in shares your daily card and your course with your group, and keeps a private backup.</p>
      <label className="label" htmlFor="au-email">Email</label>
      <input id="au-email" className="field" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label className="label" htmlFor="au-pw">Password</label>
      <input id="au-pw" className="field" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required />
      {err && <p className="err">{err}</p>}
      <button className="btn dark full tall" disabled={busy}>{busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      <button type="button" className="link center-text" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); }}>
        {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
      </button>
    </form>
  );
}

// ---------- groups ----------

export function GroupSetup({ first = false, onDone }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function run(fn) {
    setBusy(true); setErr('');
    try { await fn(); sfx.build(); onDone?.(); }
    catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="group-setup">
      {first && <RestoreBanner />}
      {first && <p className="muted">One group per friend circle. Everyone in it sees each other's cards, courses and feed.</p>}
      <div className="list-card pad-card">
        <strong>Got a code from a friend?</strong>
        <div className="row gap">
          <input className="field code-field" placeholder="ABCD2345" value={code} maxLength={9} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn dark" disabled={busy || code.replace(/\W/g, '').length < 8} onClick={() => run(() => joinGroup(code))}>Join</button>
        </div>
      </div>
      <div className="or"><span>or</span></div>
      <div className="list-card pad-card">
        <strong>Start a group</strong>
        <div className="row gap">
          <input className="field" placeholder="Group name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <button className="btn dark" disabled={busy || !name.trim()} onClick={() => run(() => createGroup(name.trim()))}>Create</button>
        </div>
      </div>
      {err && <p className="err">{err}</p>}
    </div>
  );
}

function InviteChip({ group, more }) {
  async function share() {
    const text = `Join my Fairway group “${group.name}”. Code: ${group.invite_code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(group.invite_code); fx.toast('Code copied'); }
    } catch { /* cancelled */ }
  }
  return (
    <button className="invite-chip" onClick={share}>
      <span className="grow"><strong>{group.name}</strong><span className="muted small">{group.members.length} {group.members.length === 1 ? 'member' : 'members'}{more > 0 ? ` · +${more} more group${more > 1 ? 's' : ''}` : ''}</span></span>
      <span className="code mono">{group.invite_code}</span>
      <span className="pill-open">Invite</span>
    </button>
  );
}

function RestoreBanner() {
  const so = useSocial();
  const s = useStore();
  const [busy, setBusy] = useState(false);
  if (!so.backup || !isFresh(s) || so.backup.install === s.installId) return null;
  return (
    <div className="hint-box restore">
      <span className="grow">Found a backup from {ago(so.backup.updatedAt)}. Restore it to this phone?</span>
      <button className="btn dark" disabled={busy} onClick={async () => { setBusy(true); try { await restoreBackup(); fx.toast('Backup restored'); } catch (e) { fx.toast(e.message); } setBusy(false); }}>Restore</button>
    </div>
  );
}

// ---------- friends strip ----------

function FriendsStrip({ friends, me, onFriend }) {
  const ordered = [...friends].sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : (b.card?.today?.done ?? 0) - (a.card?.today?.done ?? 0)));
  const today = dayKey();
  return (
    <div className="friend-strip" role="list">
      {ordered.map((f) => {
        const fc = friendCourse(f.card);
        const t = f.card?.today;
        const isToday = t?.day === today;
        return (
          <button key={f.id} role="listitem" className="friend-tile" onClick={() => onFriend(f.id)}>
            <div className="friend-map">
              {fc ? <CourseMap course={fc.course} items={f.card.items} barn={f.card.barn} label={`${f.name}'s course`} /> : <div className="friend-map-empty">No course yet</div>}
              <span className="friend-rating">{fc ? fc.rating : '–'}</span>
            </div>
            <div className="friend-meta">
              <Avatar id={f.id} name={f.name} size={26} />
              <strong>{f.id === me ? 'You' : f.name}</strong>
            </div>
            <span className="muted small">
              {isToday ? `${t.done}/${Math.max(t.due, t.done)} today` : 'Nothing today'}
              {isToday && t.streak > 1 ? ` · ${t.streak}d` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- feed items ----------

function headline(e) {
  const p = e.payload ?? {};
  switch (e.kind) {
    case 'stack': {
      const what = p.habit ? ` of ${p.habit}` : '';
      if (p.failed) return p.blocks > 0
        ? `Did ${p.blocks} block${p.blocks > 1 ? 's' : ''}${what}, then ${p.why === 'quit' ? 'gave up' : 'left the app'}. Hole ${p.hole} took damage.`
        : `${p.why === 'quit' ? 'Gave up' : 'Left the app'} in the first block${what}. Hole ${p.hole} took damage.`;
      if (p.early) return `Stopped after ${p.blocks} of ${p.planned} blocks${what}.`;
      return `Finished a ${p.blocks} block stack${what} · ${formatMinutes(p.blocks * p.focus)}`;
    }
    case 'goal': return p.title ? `Hit a ${p.size} goal: ${p.title}${p.late ? ' (late)' : ''}` : `Hit a ${p.size} goal${p.late ? ' (late)' : ''}`;
    case 'item': return `Found the ${p.name} in a chest`;
    case 'milestone': return `${p.n} ${p.unit} streak${p.habit ? ` on ${p.habit}` : ''}`;
    case 'build': return `Built the ${p.name}`;
    default: return '';
  }
}

function KindArt({ e }) {
  const p = e.payload ?? {};
  if (e.kind === 'item') return <span className="kind-art" style={{ background: RARITY[p.rarity]?.tint }}><DropIcon id={p.id} size={40} /></span>;
  if (e.kind === 'goal') return <span className="kind-art"><ChestArt kind={p.size === 'big' ? 'big' : p.size === 'medium' ? 'chest' : 'crate'} size={40} /></span>;
  if (e.kind === 'stack') return <span className={`kind-art ${p.failed ? 'bad' : 'good'}`}><Icon name={p.failed ? 'x' : 'tomato'} size={22} /></span>;
  if (e.kind === 'milestone') return <span className="kind-art warm"><Icon name="flame" size={22} /></span>;
  return <span className="kind-art"><Icon name="flag" size={22} /></span>;
}

function DayBody({ p }) {
  return (
    <>
      <ul className="feed-lines">
        {(p.lines ?? []).map((l, i) => (
          <li key={i}>
            <span className="dot" style={{ background: CATEGORIES[l.cat]?.tint ?? '#ddd' }} />
            <span className="grow">{l.name}{l.detail ? <span className="muted">: {l.detail}</span> : null}</span>
            <span className={`trust ${l.trust}`}>{TRUST[l.trust]?.label}</span>
          </li>
        ))}
        {p.hidden > 0 && <li className="muted"><Icon name="lock" size={14} /> {p.hidden} private habit{p.hidden === 1 ? '' : 's'}</li>}
      </ul>
      <div className="day-foot">
        <span><b>{p.done}</b>/{Math.max(p.due, p.done)} habits</span>
        {p.focusMin > 0 && <span><b>{formatMinutes(p.focusMin)}</b> focus</span>}
        {(p.blocks?.ok > 0 || p.blocks?.fail > 0) && <span><b>{p.blocks.ok}</b> blocks{p.blocks.fail ? <span className="bad-txt"> · {p.blocks.fail} failed</span> : null}</span>}
        {p.streak > 1 && <span><b>{p.streak}</b> day streak</span>}
      </div>
    </>
  );
}

function dayLabel(day) {
  const today = dayKey();
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return new Date(day + 'T12:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function FeedItem({ e, so, onFriend }) {
  const me = so.user.id;
  const who = so.friends.find((f) => f.id === e.user_id);
  const name = e.user_id === me ? 'You' : who?.name ?? 'Someone';
  const [open, setOpen] = useState(false);
  const counts = REACTIONS.map((r) => ({ r, n: e.reactions.filter((x) => x.emoji === r).length, mine: e.reactions.some((x) => x.emoji === r && x.user_id === me) }));
  const reactors = [...new Set(e.reactions.map((x) => x.user_id))].map((id) => (id === me ? 'You' : so.friends.find((f) => f.id === id)?.name)).filter(Boolean);

  const react = (r) => { sfx.tap(); toggleReaction(e.id, r).catch((x) => fx.toast(x.message)); };

  return (
    <article className={`feed-card kind-${e.kind}`}>
      <div className="feed-head">
        <button className="feed-who" onClick={() => onFriend(e.user_id)} aria-label={`Open ${name}'s course`}>
          <Avatar id={e.user_id} name={who?.name ?? name} />
        </button>
        <div className="grow">
          <strong>{name}</strong>
          <span className="muted small">{e.kind === 'day' ? `${dayLabel(e.payload.day)} · updated ${ago(e.updated_at)}` : ago(e.created_at)}</span>
        </div>
        {e.kind !== 'day' && <KindArt e={e} />}
      </div>
      {e.kind === 'day' ? <DayBody p={e.payload} /> : <p className="feed-headline">{headline(e)}</p>}

      <div className="reactions">
        {counts.map(({ r, n, mine }) => (
          <button key={r} className={`react ${mine ? 'on' : ''} ${n ? 'has' : ''}`} onClick={() => react(r)} aria-pressed={mine} aria-label={`React ${r}`}>
            <span>{r}</span>{n > 0 && <b>{n}</b>}
          </button>
        ))}
        <button className={`react talk ${e.comments.length ? 'has' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          <Icon name="edit" size={14} />{e.comments.length > 0 && <b>{e.comments.length}</b>}
        </button>
      </div>
      {reactors.length > 0 && <p className="muted small reactors">{reactors.join(', ')}</p>}
      {(open || e.comments.length > 0) && <Comments e={e} so={so} open={open} setOpen={setOpen} />}
    </article>
  );
}

function Comments({ e, so, open, setOpen }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const me = so.user.id;
  const shown = open ? e.comments : e.comments.slice(-2);

  async function send(ev) {
    ev.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await addComment(e.id, text); setText(''); sfx.tap(); }
    catch (x) { fx.toast(x.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="comments">
      {!open && e.comments.length > 2 && <button className="link small" onClick={() => setOpen(true)}>All {e.comments.length} comments</button>}
      {shown.map((c) => {
        const n = c.user_id === me ? 'You' : so.friends.find((f) => f.id === c.user_id)?.name ?? 'Someone';
        const canDelete = c.user_id === me || e.user_id === me;
        return (
          <div key={c.id} className="comment">
            <b>{n}</b> <span>{c.body}</span>
            {open && canDelete && <button className="link small del" onClick={() => deleteComment(e.id, c.id).catch((x) => fx.toast(x.message))}>Delete</button>}
          </div>
        );
      })}
      {open && (
        <form className="comment-form" onSubmit={send}>
          <input className="field" placeholder="Say something" value={text} maxLength={500} onChange={(x) => setText(x.target.value)} />
          <button className="btn dark" disabled={busy || !text.trim()}>Send</button>
        </form>
      )}
    </div>
  );
}
