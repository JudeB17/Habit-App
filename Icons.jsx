const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const paths = {
  clock: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></>,
  dumbbell: <path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" />,
  phone: <><rect x="5" y="2" width="14" height="20" rx="3" /><path d="M11 18h2" /></>,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  check: <path d="M5 12l5 5L19 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  play: <path d="M7 4l13 8-13 8z" />,
  pause: <path d="M8 4v16M16 4v16" />,
  stop: <rect x="5" y="5" width="14" height="14" rx="2" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  flame: <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 3 4 0-3 0-5 0-7z" />,
  flag: <><path d="M6 21V3" /><path d="M6 4l12 4-12 4" /></>,
  chart: <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0zM12 13v4M8 20h8" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" /></>,
  tomato: <><circle cx="12" cy="13" r="7.5" /><path d="M9 5.5l3 2 3-2M12 7.5V4" /></>,
  wrench: <path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2z" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
};

export default function Icon({ name, size = 20, stroke = 2.4, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={stroke} {...base} style={style} className={className}>
      {paths[name]}
    </svg>
  );
}

/** Cut-paper coin, used on the money chip and the fly-to-wallet animation. */
export function MoneyToken({ size = 22 }) {
  const ink = '#161616';
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size, display: 'block' }} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#FFD23F" stroke={ink} strokeWidth="2" />
      <circle cx="12" cy="12" r="6" fill="none" stroke={ink} strokeWidth="1.4" />
      <path d="M13.6 9.4c-.4-.6-1-.9-1.7-.9-1 0-1.7.5-1.7 1.3 0 1.8 3.6 1 3.6 2.9 0 .8-.8 1.4-1.9 1.4-.8 0-1.5-.3-1.9-.9M12 7.4v1.1M12 14.1v1.1" stroke={ink} strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Cut-paper tokens for the five upkeep materials. */
export function MaterialToken({ kind, size = 22 }) {
  const ink = '#161616';
  const s = { width: size, height: size, display: 'block', flex: '0 0 auto' };
  const st = { stroke: ink, strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' };
  switch (kind) {
    case 'fuel':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <path d="M6 6h9l4 4v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" fill="#EF4F3A" {...st} />
          <path d="M8 3h4v3H8z" fill="#FFD23F" {...st} />
          <path d="M8 11l6 6M14 11l-6 6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'water':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <path d="M12 2.5C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11.5z" fill="#5AA8D6" {...st} />
          <path d="M9.5 14.5a2.6 2.6 0 0 0 2.5 2.5" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'fert':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <path d="M6 5h12l1 15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" fill="#C9E6A0" {...st} />
          <path d="M6 5l2-2h8l2 2" fill="#8CC66A" {...st} />
          <path d="M12 17v-5M12 13c-2.5 0-3.5-1.6-3.5-3 2 0 3.5 1 3.5 3zM12 12.5c0-2 1.2-3.2 3.4-3.2 0 1.8-1.2 3.2-3.4 3.2z" fill="#2F9E44" {...st} strokeWidth="1.3" />
        </svg>
      );
    case 'sand':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <path d="M4 10h16l-2 10H6z" fill="#3B5FD0" {...st} />
          <path d="M4.5 10c1-3 4-4.5 7.5-4.5s6.5 1.5 7.5 4.5z" fill="#F5DDA8" {...st} />
          <path d="M8 3c2 0 2 2 4 2" fill="none" {...st} />
        </svg>
      );
    case 'seed':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <path d="M5 4h14v16H5z" fill="#FFF8EC" {...st} />
          <path d="M5 4l2 2 2-2 2 2 2-2 2 2 2-2 2 2" fill="none" {...st} strokeWidth="1.3" />
          <path d="M12 18v-6M12 13c-3 0-4-2-4-4 2.4 0 4 1.5 4 4zM12 12c0-2.4 1.5-4 4-4 0 2-1.4 4-4 4z" fill="#5BAE64" {...st} strokeWidth="1.3" />
        </svg>
      );
    default:
      return null;
  }
}

/** Treasure chest in three sizes. `open` lifts the lid. */
export function ChestArt({ kind = 'chest', open = false, size = 64 }) {
  const ink = '#161616';
  const st = { stroke: ink, strokeWidth: 2.2, strokeLinejoin: 'round' };
  if (kind === 'crate') {
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className={`chest-art ${open ? 'open' : ''}`}>
        <g className="lid"><rect x="8" y="16" width="48" height="10" fill="#C98A4B" {...st} /></g>
        <rect x="10" y="26" width="44" height="30" fill="#B9773E" {...st} />
        <path d="M10 26l44 30M54 26L10 56" stroke="#8A5528" strokeWidth="3" />
        <rect x="10" y="26" width="44" height="30" fill="none" {...st} />
      </svg>
    );
  }
  const body = kind === 'big' ? '#7A4FB0' : '#B9773E';
  const lid = kind === 'big' ? '#9B6FD0' : '#C98A4B';
  const trim = '#FFD23F';
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className={`chest-art ${open ? 'open' : ''}`}>
      {open && <g className="glow"><circle cx="32" cy="28" r="20" fill="#FFF3B0" opacity="0.9" /></g>}
      <g className="lid">
        <path d="M8 28V20c0-6 10-10 24-10s24 4 24 10v8z" fill={lid} {...st} />
        <path d="M20 12v16M44 12v16" stroke={trim} strokeWidth="4" />
        <path d="M8 28V20c0-6 10-10 24-10s24 4 24 10v8z" fill="none" {...st} />
      </g>
      <rect x="8" y="28" width="48" height="26" rx="2" fill={body} {...st} />
      <path d="M20 28v26M44 28v26" stroke={trim} strokeWidth="4" />
      <rect x="8" y="28" width="48" height="26" rx="2" fill="none" {...st} />
      <rect x="27" y="25" width="10" height="12" rx="2" fill={trim} {...st} strokeWidth="1.8" />
      <circle cx="32" cy="31" r="1.6" fill={ink} />
      {kind === 'big' && <path d="M14 22l2-4 2 4M48 22l2-4 2 4" fill="none" stroke={trim} strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}
