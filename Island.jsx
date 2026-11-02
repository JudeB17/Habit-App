// The cut-paper island. Base terrain is always drawn; every building is its own piece that only
// appears once built, so the island visibly changes as you play.
import { useId } from 'react';

const INK = '#161616';

// Footprints for empty-plot markers, in viewBox units.
const PLOTS = {
  trees:      { x: 186, y: 214, w: 56, h: 84 },
  garden:     { x: 428, y: 282, w: 86, h: 44 },
  library:    { x: 228, y: 212, w: 120, h: 104 },
  dock:       { x: 634, y: 330, w: 84, h: 44 },
  blossom:    { x: 508, y: 282, w: 34, h: 42 },
  lighthouse: { x: 540, y: 148, w: 56, h: 166 },
  boat:       { x: 700, y: 336, w: 84, h: 92 },
};

export default function Island({ built = [], idle = 0, fresh, showPlots = false, className = '', label }) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n) => `${n}${raw}`;
  const has = (b) => built.includes(b);
  const pop = (b) => (b === fresh ? 'piece pop' : 'piece');
  const weeds = idle >= 2;
  const faded = idle >= 5;

  return (
    <svg
      className={`island ${className}`}
      viewBox="0 0 800 520"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label ?? `Your island with ${built.length} buildings`}
    >
      <defs>
        <filter id={id('sh')} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="3" dy="4" stdDeviation="0" floodColor={INK} floodOpacity="0.28" />
        </filter>
        <filter id={id('soft')} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="5" stdDeviation="0" floodColor="#1D4E73" floodOpacity="0.35" />
        </filter>
        <filter id={id('grain')} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0.09 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8FCDE6" />
          <stop offset="1" stopColor="#CDEBF2" />
        </linearGradient>
      </defs>

      {/* sky */}
      <rect width="800" height="520" fill={`url(#${id('sky')})`} />
      <g filter={`url(#${id('sh')})`} className="sun">
        <path d="M660 40 L672 74 L706 62 L690 94 L724 106 L690 118 L706 150 L672 138 L660 172 L648 138 L614 150 L630 118 L596 106 L630 94 L614 62 L648 74 Z" fill="#FFE58A" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="660" cy="106" r="38" fill="#FFC83D" stroke={INK} strokeWidth="2.5" />
      </g>
      <path d="M0 270 C80 230 150 236 220 258 C300 220 380 226 440 254 C520 214 620 220 800 262 L800 300 L0 300 Z" fill="#B9DCC4" stroke={INK} strokeWidth="2" strokeLinejoin="round" opacity="0.9" />
      <g filter={`url(#${id('sh')})`} className="clouds">
        <path d="M70 120 C60 100 84 84 104 94 C110 72 146 70 156 92 C176 84 196 100 188 120 Z" fill="#FFF" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M380 76 C372 60 392 48 408 56 C414 38 446 38 452 56 C470 50 486 64 478 80 Z" fill="#FFF" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M500 196 C494 184 508 174 520 180 C526 166 548 166 552 180 C566 176 576 186 570 198 Z" fill="#FFF" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round">
        <path d="M250 110 q8 -8 16 0 q8 -8 16 0" />
        <path d="M296 136 q6 -6 12 0 q6 -6 12 0" />
        <path d="M540 120 q6 -6 12 0 q6 -6 12 0" />
      </g>

      {/* sea */}
      <path d="M0 300 Q50 290 100 300 T200 300 T300 300 T400 300 T500 300 T600 300 T700 300 T800 300 L800 520 L0 520 Z" fill="#6DB6DB" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M0 372 Q40 362 80 372 T160 372 T240 372 T320 372 T400 372 T480 372 T560 372 T640 372 T720 372 T800 372 L800 520 L0 520 Z" fill="#4E9CCB" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M0 446 Q60 434 120 446 T240 446 T360 446 T480 446 T600 446 T720 446 T840 446 L800 520 L0 520 Z" fill="#3A84B7" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <g stroke="#FFF" strokeWidth="3" strokeLinecap="round" opacity="0.85" className="waves">
        <path d="M60 410 h26" /><path d="M220 420 h18" /><path d="M90 480 h30" /><path d="M700 470 h24" /><path d="M610 490 h18" /><path d="M40 340 h20" /><path d="M740 336 h22" />
      </g>

      {/* island ground */}
      <ellipse cx="400" cy="384" rx="300" ry="26" fill="#2C6E9A" opacity="0.45" />
      <g filter={`url(#${id('soft')})`}>
        <path d="M104 360 C124 300 200 280 280 278 C360 262 460 262 540 272 C620 280 684 308 696 360 C600 396 214 400 104 360 Z" fill="#F4C27A" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g fill="none" stroke="#C9924A" strokeWidth="2.5" strokeLinecap="round">
        <path d="M170 360 q20 6 40 2" /><path d="M300 376 q24 6 48 0" /><path d="M470 374 q20 6 40 0" /><path d="M600 362 q18 4 34 -2" />
      </g>
      <path d="M136 336 C166 292 230 272 300 270 C380 254 470 256 540 264 C612 272 652 300 666 336 C580 358 236 360 136 336 Z" fill={weeds ? '#7FA96A' : '#5BAE64'} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M140 326 C170 286 232 266 302 264 C380 248 470 250 540 258 C610 266 650 292 662 326 C580 346 240 348 140 326 Z" fill={weeds ? '#A3C783' : '#7BC67E'} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />

      {/* path */}
      <g opacity={faded ? 0.35 : 1}>
        <path d="M390 312 C420 322 470 318 510 326 C560 336 600 334 640 342" fill="none" stroke={INK} strokeWidth="14" strokeLinecap="round" />
        <path d="M390 312 C420 322 470 318 510 326 C560 336 600 334 640 342" fill="none" stroke="#FBE3B5" strokeWidth="9" strokeLinecap="round" />
      </g>

      {/* empty plots */}
      {showPlots && Object.entries(PLOTS).filter(([b]) => !has(b)).map(([b, p]) => (
        <rect key={b} x={p.x} y={p.y} width={p.w} height={p.h} rx="8" fill="#FFFFFF" fillOpacity="0.25" stroke={INK} strokeWidth="2" strokeDasharray="6 6" opacity="0.55" />
      ))}

      {has('dock') && (
        <g className={pop('dock')} filter={`url(#${id('sh')})`}>
          <rect x="636" y="336" width="78" height="14" rx="2" fill="#B9773E" stroke={INK} strokeWidth="2.5" />
          <path d="M652 336 v14 M668 336 v14 M684 336 v14 M700 336 v14" stroke={INK} strokeWidth="1.5" />
          <rect x="648" y="350" width="6" height="22" fill="#8A5528" stroke={INK} strokeWidth="2" />
          <rect x="700" y="350" width="6" height="22" fill="#8A5528" stroke={INK} strokeWidth="2" />
        </g>
      )}

      {has('boat') && (
        <g className={`${pop('boat')} bob`} filter={`url(#${id('sh')})`}>
          <path d="M700 402 L780 402 L766 424 L714 424 Z" fill="#EF4F3A" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M740 400 V340" stroke={INK} strokeWidth="3" />
          <path d="M744 344 L744 396 L776 396 Z" fill="#FFF" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M736 348 L736 396 L708 396 Z" fill="#FFD23F" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M740 340 l14 5 l-14 5 Z" fill="#3B5FD0" stroke={INK} strokeWidth="2" />
        </g>
      )}

      {has('trees') && (
        <g className={pop('trees')} filter={`url(#${id('sh')})`} stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
          <path d="M196 290 L216 234 L236 290 Z" fill="#2F8F3E" />
          <path d="M200 266 L216 218 L232 266 Z" fill="#3BA64C" />
          <path d="M488 270 L506 222 L524 270 Z" fill="#2F8F3E" />
          <path d="M492 248 L506 206 L520 248 Z" fill="#3BA64C" />
          <path d="M610 296 L626 254 L642 296 Z" fill="#2F8F3E" />
          <rect x="171" y="296" width="8" height="22" fill="#8A5528" />
          <circle cx="175" cy="288" r="20" fill="#3BA64C" />
          <circle cx="166" cy="282" r="8" fill="#5CC46A" stroke="none" />
          <rect x="626" y="306" width="8" height="18" fill="#8A5528" />
          <circle cx="630" cy="300" r="16" fill="#3BA64C" />
        </g>
      )}

      {has('library') && (
        <g className={pop('library')} filter={`url(#${id('sh')})`} stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
          <rect x="240" y="248" width="96" height="62" fill="#FFF8EC" />
          <rect x="234" y="304" width="108" height="10" fill="#E6D3B3" />
          <path d="M230 250 L288 216 L346 250 Z" fill="#3B5FD0" />
          <circle cx="288" cy="236" r="7" fill="#FFD23F" />
          <rect x="250" y="258" width="8" height="46" fill="#FFF" />
          <rect x="270" y="258" width="8" height="46" fill="#FFF" />
          <rect x="298" y="258" width="8" height="46" fill="#FFF" />
          <rect x="318" y="258" width="8" height="46" fill="#FFF" />
          <path d="M280 304 V280 a8 8 0 0 1 16 0 V304 Z" fill="#7A4A22" />
        </g>
      )}

      {has('house') && (
        <g className={pop('house')}>
          <g filter={`url(#${id('sh')})`} stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
            <rect x="388" y="232" width="12" height="22" fill="#B9773E" />
            <rect x="352" y="260" width="66" height="50" fill="#FFF" />
            <path d="M344 264 L385 228 L426 264 Z" fill="#EF4F3A" />
            <rect x="362" y="272" width="16" height="14" fill="#FFD23F" />
            <path d="M370 272 v14 M362 279 h16" strokeWidth="1.5" />
            <rect x="392" y="280" width="16" height="30" fill="#3B5FD0" />
            <circle cx="404" cy="296" r="1.8" fill={INK} stroke="none" />
          </g>
          <path className="smoke" d="M394 226 q-6 -10 2 -16 q-6 -10 4 -16" fill="none" stroke="#FFF" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        </g>
      )}

      {has('garden') && (
        <g className={pop('garden')}>
          <g filter={`url(#${id('sh')})`} stroke={INK} strokeWidth="2" strokeLinejoin="round">
            <rect x="432" y="290" width="70" height="12" rx="6" fill="#8A5528" />
            <rect x="440" y="308" width="70" height="12" rx="6" fill="#8A5528" />
          </g>
          <g fill="#9BE07A" stroke={INK} strokeWidth="1.5">
            <circle cx="444" cy="292" r="5" /><circle cx="460" cy="292" r="5" /><circle cx="476" cy="292" r="5" /><circle cx="492" cy="292" r="5" />
            <circle cx="452" cy="310" r="5" /><circle cx="468" cy="310" r="5" /><circle cx="484" cy="310" r="5" /><circle cx="500" cy="310" r="5" />
          </g>
          <g fill="#EF4F3A"><circle cx="460" cy="290" r="2" /><circle cx="484" cy="308" r="2" /><circle cx="492" cy="290" r="2" /></g>
        </g>
      )}

      {has('lighthouse') && (
        <g className={pop('lighthouse')}>
          <path className="beam" d="M552 184 L478 166 L478 202 Z" fill="#FFF3B0" opacity="0.7" />
          <g filter={`url(#${id('sh')})`} stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
            <path d="M542 312 L552 200 L584 200 L594 312 Z" fill="#FFF" />
            <path d="M550 222 L586 222 L588 246 L548 246 Z" fill="#EF4F3A" />
            <path d="M546 270 L590 270 L592 294 L544 294 Z" fill="#EF4F3A" />
            <rect x="546" y="194" width="44" height="8" fill={INK} />
            <rect x="552" y="174" width="32" height="20" fill="#FFD23F" />
            <path d="M560 174 v20 M568 174 v20 M576 174 v20" strokeWidth="1.5" />
            <path d="M546 176 L568 152 L590 176 Z" fill="#EF4F3A" />
            <rect x="560" y="290" width="16" height="22" fill="#3B5FD0" />
          </g>
        </g>
      )}

      {has('blossom') && (
        <g className={pop('blossom')} filter={`url(#${id('sh')})`} stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
          <rect x="522" y="306" width="7" height="16" fill="#8A5528" />
          <circle cx="525" cy="300" r="13" fill="#F58FB0" />
          <circle cx="520" cy="296" r="4" fill="#FFC7D9" stroke="none" />
        </g>
      )}

      {/* flowers and bushes */}
      <g stroke={INK} strokeWidth="1.5" opacity={weeds ? 0.4 : 1}>
        <circle cx="214" cy="322" r="4" fill="#FFD23F" /><circle cx="226" cy="326" r="4" fill="#F58FB0" />
        <circle cx="350" cy="322" r="4" fill="#FFF" /><circle cx="420" cy="322" r="4" fill="#FFD23F" />
        <circle cx="580" cy="326" r="4" fill="#F58FB0" /><circle cx="150" cy="326" r="4" fill="#FFF" />
      </g>
      <g filter={`url(#${id('sh')})`} stroke={INK} strokeWidth="2" fill="#2F8F3E">
        <path d="M320 326 a10 10 0 0 1 20 0 Z" />
        <path d="M196 330 a9 9 0 0 1 18 0 Z" />
      </g>

      {/* weeds after 2 idle days. Nothing is destroyed; one completed day clears them. */}
      {weeds && (
        <g stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="#B7A23A">
          {[[180, 330], [262, 334], [342, 336], [440, 336], [530, 334], [600, 330], [470, 300], [300, 300]].map(([x, y]) => (
            <path key={`${x}-${y}`} d={`M${x} ${y} l-6 -14 l6 6 l3 -16 l3 16 l6 -6 l-6 14 Z`} />
          ))}
        </g>
      )}

      <rect width="800" height="520" fill="#FFF" filter={`url(#${id('grain')})`} pointerEvents="none" />
    </svg>
  );
}
