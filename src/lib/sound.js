/* The shop's sounds, for good news only: a light tick when something small
 * works (added to the bag, saved, a code applied, signed in) and a fuller
 * chime for the big moments (an order placed, a gift card ready). Made in the
 * browser (Web Audio), so there is no file to load.
 *
 * Browsers let a page make sound only once someone has tapped it, and an
 * iPhone only if the sound is switched on inside that tap — so the first tap
 * anywhere in the shop quietly unlocks it, and later good news can be heard.
 * A phone on silent stays silent. Customers can turn the sounds off with the
 * switch in the footer (kept in localStorage `masq:sound`). */

let ctx = null;
const KEY = 'masq:sound';
const listeners = new Set();

export function soundOn() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

/** Turns the sounds on or off, and tells anything showing the switch. */
export function setSoundOn(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private window: this visit only */ }
  listeners.forEach(fn => fn(on));
}

export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* Inside a tap: make (or wake) the audio and play one silent sample, which is
 * what an iPhone needs to let the page make sound from then on. */
function unlock() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    ctx ??= new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  } catch { /* no sound is fine */ }
  if (ctx?.state === 'running') stopListening();
}
const TAPS = ['pointerdown', 'touchend', 'keydown'];
function stopListening() { TAPS.forEach(t => window.removeEventListener(t, unlock, true)); }
if (typeof window !== 'undefined') TAPS.forEach(t => window.addEventListener(t, unlock, true));

/** Plays [frequency, start offset] notes as soft bells. */
async function play(notes, volume, ring) {
  if (typeof window === 'undefined' || !soundOn()) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    ctx ??= new Ctx();
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') return;          // not unlocked by a tap yet: stay silent
    const start = ctx.currentTime + 0.02;
    const out = ctx.createGain();
    out.gain.value = volume;
    out.connect(ctx.destination);
    notes.forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = start + at;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(1, t + 0.012);     // soft attack, no click
      env.gain.exponentialRampToValueAtTime(0.0001, t + ring); // a bell-like fade
      osc.connect(env).connect(out);
      osc.start(t);
      osc.stop(t + ring + 0.05);
    });
  } catch { /* no sound is fine */ }
}

/** A small win: two quick, quiet notes. */
export const tick = () => play([[1046.5, 0], [1318.5, 0.06]], 0.08, 0.35);

/** A big moment: three rising notes from the major chord. */
export const chime = () => play([[523.25, 0], [659.25, 0.11], [1046.5, 0.22]], 0.16, 0.9);
