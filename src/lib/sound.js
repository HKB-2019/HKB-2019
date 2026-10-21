import { asset } from './media.js';

/* The shop's sounds, for good news only: a light tick when something small
 * works (added to the bag, saved, a code applied, signed in) and, for the
 * big moments (an order placed, a gift card ready), a soft chord with high
 * notes twinkling down like the confetti that falls with it. Two short files
 * in public/assets/sound, made by tools/make-sounds.py.
 *
 * They play through an ordinary <audio> player, the way a video's sound
 * does, so a phone plays them even with its ring switch on silent. A browser
 * lets a page play sound only once someone has tapped it — an iPhone only a
 * player that was started inside that tap — so the first tap anywhere in the
 * shop starts the player on a moment of silence, and later good news can be
 * heard. Customers can turn the sounds off with the switch in the footer
 * (kept in localStorage `masq:sound`). */

const KEY = 'masq:sound';
const FILES = { tick: 'assets/sound/tick.wav', chime: 'assets/sound/chime.wav', silent: 'assets/sound/silent.wav' };
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
  [FILES.tick, FILES.chime].forEach(f => { const a = new Audio(); a.preload = 'auto'; a.src = asset(f); });
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

/** A big moment: three rising notes from the major chord. */
export const chime = () => play(FILES.chime);
