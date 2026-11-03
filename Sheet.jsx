import { useEffect, useState } from 'react';
import Icon from './Icons.jsx';

/** Bottom sheet. Closes on backdrop tap or Escape, animates out before unmounting. */
export default function Sheet({ title, onClose, children, tall = false }) {
  const [closing, setClosing] = useState(false);
  const close = () => { setClosing(true); setTimeout(onClose, 180); };

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`sheet-wrap ${closing ? 'closing' : ''}`} onClick={close}>
      <div
        className={`sheet ${tall ? 'tall' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
        </div>
        <div className="sheet-body">{typeof children === 'function' ? children(close) : children}</div>
      </div>
    </div>
  );
}
