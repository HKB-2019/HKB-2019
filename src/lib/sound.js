/* The shop's sounds, for good news only: a light tick when something small
 * works (added to the bag, saved, a code applied, signed in) and a fuller
 * chime for the big moments (an order placed, a gift card ready). Made in the
 * browser (Web Audio), so there is no file to load. They play only where the
 * browser allows sound — after the customer has tapped something in the
 * shop — and are otherwise skipped in silence. A customer who has turned
 * sounds off (localStorage `masq:sound` = "off") never hears them. */

let ctx = null;

function soundOff() {
  try { return localStorage.getItem('masq:sound') === 'off'; } catch { return false; }
}

/** Plays [frequency, start offset] notes as soft bells. */
async function play(notes, volume, ring) {
  if (typeof window === 'undefined' || soundOff()) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    ctx ??= new Ctx();
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') return;          // the browser wants a tap first: stay silent
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
