/* The one sound in the shop: a short, soft chime when an order is placed.
 * Made in the browser (Web Audio), so there is no file to load. It plays
 * only where the browser allows sound without a fresh tap — usually it does
 * after the customer has used the shop — and is otherwise skipped in silence.
 * A customer who has turned sounds off (localStorage `masq:sound` = "off")
 * never hears it. */

let ctx = null;

function soundOff() {
  try { return localStorage.getItem('masq:sound') === 'off'; } catch { return false; }
}

/** Three rising notes from the logo's major chord, quiet and quickly gone. */
export async function chime() {
  if (typeof window === 'undefined' || soundOff()) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    ctx ??= new Ctx();
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') return;          // the browser wants a tap first: stay silent
    const start = ctx.currentTime + 0.02;
    const out = ctx.createGain();
    out.gain.value = 0.16;
    out.connect(ctx.destination);
    [[523.25, 0], [659.25, 0.11], [1046.5, 0.22]].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = start + at;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(1, t + 0.012);     // soft attack, no click
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);  // a bell-like fade
      osc.connect(env).connect(out);
      osc.start(t);
      osc.stop(t + 0.95);
    });
  } catch { /* no sound is fine */ }
}
