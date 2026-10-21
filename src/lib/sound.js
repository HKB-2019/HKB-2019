import { asset } from './media.js';

/* The shop's sounds, for good news only: a light tick when something small
 * works (added to the bag, saved, a code applied, signed in); with the
 * confetti when an order is placed, the sound of confetti itself — a soft
 * poof of air from each side and paper rustling down; and for the other big
 * moments (a gift card ready, a password reset) a soft chord with high notes
 * twinkling down. Short files in public/assets/sound, made by
 * tools/make-sounds.py and tools/make-sound-options.py.
 *
 * They play through an ordinary <audio> player, the way a video's sound
 * does, so a phone plays them even with its ring switch on silent. A browser
 * lets a page play sound only once someone has tapped it — an iPhone only a
 * player that was started inside that tap — so the first tap anywhere in the
 * shop starts the player on a moment of silence, and later good news can be
 * heard. Customers can turn the sounds off with the switch in the footer
 * (kept in localStorage `masq:sound`). */

const KEY = 'masq:sound';
// `?v=`: raised when a sound is remade, so browsers fetch the new one.
const FILES = { tick: 'assets/sound/tick.wav?v=2', chime: 'assets/sound/chime.wav?v=2', confetti: 'assets/sound/confetti.wav?v=1', silent: 'assets/sound/silent.wav' };
const listeners = new Set();
let player = null;

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

/* Inside the first tap: start the player on silence (which is what lets it
 * play later), and fetch the two sounds so they start at once. */
const TAPS = ['pointerdown', 'touchend', 'keydown'];
function unlock() {
  if (player || typeof Audio === 'undefined') return stop();
  player = new Audio(asset(FILES.silent));
  player.play()?.catch(() => {});
  [FILES.tick, FILES.chime, FILES.confetti].forEach(f => { const a = new Audio(); a.preload = 'auto'; a.src = asset(f); });
  stop();
}
function stop() { TAPS.forEach(t => window.removeEventListener(t, unlock, true)); }
if (typeof window !== 'undefined') TAPS.forEach(t => window.addEventListener(t, unlock, true));

function play(file) {
  if (typeof Audio === 'undefined' || !soundOn()) return;
  try {
    player ??= new Audio();
    player.src = asset(file);
    player.currentTime = 0;
    player.play()?.catch(() => {});               // not allowed yet: stay silent
  } catch { /* no sound is fine */ }
}

/** A small win: two quick, quiet notes. */
export const tick = () => play(FILES.tick);

/** A big moment: a soft chord with high notes twinkling down. */
export const chime = () => play(FILES.chime);

/** With the confetti: a soft poof from each side and paper rustling down. */
export const confetti = () => play(FILES.confetti);
