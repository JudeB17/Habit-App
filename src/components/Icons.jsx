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
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
};

export default function Icon({ name, size = 20, stroke = 2.4, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={stroke} {...base} style={style} className={className}>
      {paths[name]}
    </svg>
  );
}

/** Little cut-paper token for a resource, used on chips and the fly-to-island animation. */
export function ResourceToken({ resource, size = 22 }) {
  const ink = '#161616';
  const s = { width: size, height: size, display: 'block' };
  switch (resource) {
    case 'timber':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <rect x="2" y="7" width="20" height="10" rx="5" fill="#C98A4B" stroke={ink} strokeWidth="2" />
          <circle cx="7" cy="12" r="3.2" fill="#F1C48A" stroke={ink} strokeWidth="1.6" />
        </svg>
      );
    case 'paper':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <path d="M5 3h10l4 4v14H5z" fill="#FFF" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 11h8M8 15h6" stroke="#3B5FD0" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'stone':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <path d="M3 16l3-8 7-3 7 5 1 7-6 3H7z" fill="#C9C3B6" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
          <path d="M9 10l3 4" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'seeds':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <path d="M12 21v-8" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          <path d="M12 14C6 14 4 9 4 6c5 0 8 3 8 8zM12 12c0-5 3-8 8-8 0 4-3 8-8 8z" fill="#5BAE64" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="#FFD23F" stroke={ink} strokeWidth="2" />
          <circle cx="12" cy="12" r="5" fill="none" stroke={ink} strokeWidth="1.6" />
        </svg>
      );
  }
}
