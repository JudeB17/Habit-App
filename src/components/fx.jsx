// Reward effects drawn straight into a fixed overlay with the Web Animations API.
// Kept outside React so a check-off never waits on a re-render.
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ResourceToken } from './Icons.jsx';
import { sfx } from '../lib/sound.js';
import { CATEGORIES } from '../lib/game.js';

let layer;
function getLayer() {
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'fx-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

function tokenEl(resource) {
  const el = document.createElement('div');
  el.className = 'fx-token';
  const root = createRoot(el);
  flushSync(() => root.render(<ResourceToken resource={resource} size={26} />));
  return { el, root };
}

function center(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export const fx = {
  /** Float "+N resource" from the source and fly tokens to the matching resource chip. */
  reward(fromEl, resource, amount) {
    if (!fromEl || amount <= 0) return;
    const L = getLayer();
    const from = center(fromEl.getBoundingClientRect());
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const label = document.createElement('div');
    label.className = 'fx-plus';
    label.textContent = `+${amount} ${resource}`;
    label.style.left = `${from.x}px`;
    label.style.top = `${from.y}px`;
    L.appendChild(label);
    label.animate(
      [{ transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 },
       { transform: 'translate(-50%, -120%) scale(1.05)', opacity: 1, offset: 0.25 },
       { transform: 'translate(-50%, -220%) scale(1)', opacity: 0 }],
      { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' },
    ).onfinish = () => label.remove();

    const target = document.querySelector(`[data-res-target="${resource}"]`) || document.querySelector('[data-res-target="any"]');
    if (!target || reduce) return;
    const to = center(target.getBoundingClientRect());
    const n = Math.min(4, Math.max(2, Math.round(amount / 6)));

    for (let i = 0; i < n; i++) {
      const { el, root } = tokenEl(resource);
      el.style.left = `${from.x}px`;
      el.style.top = `${from.y}px`;
      L.appendChild(el);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const arc = -60 - i * 14;
      const spread = (i - (n - 1) / 2) * 18;
      el.animate(
        [
          { transform: 'translate(-50%,-50%) scale(.4) rotate(0deg)', opacity: 0 },
          { transform: `translate(calc(-50% + ${spread}px), calc(-50% - 26px)) scale(1.1) rotate(-12deg)`, opacity: 1, offset: 0.2 },
          { transform: `translate(calc(-50% + ${dx * 0.55 + spread / 2}px), calc(-50% + ${dy * 0.55 + arc}px)) scale(1) rotate(10deg)`, offset: 0.6 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.55) rotate(0deg)`, opacity: 0.9 },
        ],
        { duration: 620 + i * 70, delay: 80 + i * 60, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'backwards' },
      ).onfinish = () => {
        el.remove();
        root.unmount();
        if (i === n - 1) {
          sfx.coin();
          target.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.18) rotate(-3deg)' }, { transform: 'scale(1)' }],
            { duration: 280, easing: 'ease-out' },
          );
        }
      };
    }
  },

  toast(text) {
    const L = getLayer();
    const el = document.createElement('div');
    el.className = 'fx-toast';
    el.textContent = text;
    L.appendChild(el);
    el.animate(
      [{ transform: 'translate(-50%, -20px)', opacity: 0 },
       { transform: 'translate(-50%, 0)', opacity: 1, offset: 0.12 },
       { transform: 'translate(-50%, 0)', opacity: 1, offset: 0.85 },
       { transform: 'translate(-50%, -10px)', opacity: 0 }],
      { duration: 2600, easing: 'ease-out' },
    ).onfinish = () => el.remove();
  },
};

/** Feedback for any logging path: sound, card squash, tokens flying to the island. */
export function payout(habit, gained) {
  const btn = document.querySelector(`[data-habit-act="${habit.id}"]`);
  if (gained > 0) {
    sfx.check();
    const card = btn?.closest('.habit');
    if (card) { card.classList.remove('paying'); void card.offsetWidth; card.classList.add('paying'); }
    fx.reward(btn, CATEGORIES[habit.category].resource, gained);
  } else if (gained < 0) {
    sfx.uncheck();
  }
}
