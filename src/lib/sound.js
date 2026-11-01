// Tiny synthesised sounds, no audio files. iOS has no vibration API, so sound carries the feedback.
import { getState } from './store.js';

let ctx;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq, to, dur = 0.12, type = 'triangle', gain = 0.18, delay = 0 }) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

// Short burst of filtered noise: sounds like a paper snip.
function snip(delay = 0) {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * 0.05);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 2200;
  const g = a.createGain();
  g.gain.value = 0.25;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + delay);
}

const on = () => getState().settings.sound;

export const sfx = {
  check() { if (!on()) return; snip(); tone({ freq: 660, to: 990, dur: 0.1 }); tone({ freq: 990, to: 1320, dur: 0.14, delay: 0.07, gain: 0.12 }); },
  uncheck() { if (!on()) return; tone({ freq: 520, to: 340, dur: 0.12, gain: 0.1 }); },
  coin() { if (!on()) return; tone({ freq: 1320, dur: 0.08, type: 'sine', gain: 0.12 }); tone({ freq: 1760, dur: 0.12, type: 'sine', gain: 0.1, delay: 0.06 }); },
  build() { if (!on()) return; snip(); snip(0.08); [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.16, delay: 0.05 + i * 0.07, gain: 0.12 })); },
  tap() { if (!on()) return; tone({ freq: 440, dur: 0.05, gain: 0.06 }); },
  fail() { if (!on()) return; tone({ freq: 440, to: 220, dur: 0.35, type: 'sawtooth', gain: 0.08 }); tone({ freq: 330, to: 150, dur: 0.45, type: 'triangle', gain: 0.12, delay: 0.15 }); },
  drop() { if (!on()) return; snip(); [659, 880, 1175, 1568, 2093].forEach((f, i) => tone({ freq: f, dur: 0.2, delay: i * 0.08, type: 'sine', gain: 0.1 })); },
  done() { if (!on()) return; [784, 988, 1175, 1568].forEach((f, i) => tone({ freq: f, dur: 0.22, delay: i * 0.1, type: 'sine', gain: 0.12 })); },
};
