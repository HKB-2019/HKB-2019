import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

/* Smooth scrolling for a mouse wheel or trackpad: the page glides to a stop
 * instead of moving in steps. Phones keep their own scrolling, which already
 * glides, and anyone whose device asks for less motion gets the ordinary
 * scroll. Panels (bag, saved, pages) scroll on their own while it runs. */

let lenis = null;

export function startSmoothScroll() {
  if (lenis) return stopSmoothScroll;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = window.matchMedia('(pointer: fine)').matches;
  if (calm || !mouse) return () => {};
  lenis = new Lenis({ autoRaf: true, lerp: 0.11, allowNestedScroll: true });
  return stopSmoothScroll;
}

export function stopSmoothScroll() {
  lenis?.destroy();
  lenis = null;
}

/** While a panel is open the page behind it stays still. */
export function holdSmoothScroll(held) {
  if (!lenis) return;
  if (held) lenis.stop(); else lenis.start();
}

/** Glide to a place on the page (a number, or an element). */
export function glideTo(target, offset = 0) {
  if (lenis) { lenis.scrollTo(target, { offset }); return; }
  const top = typeof target === 'number'
    ? target
    : target.getBoundingClientRect().top + window.pageYOffset + offset;
  window.scrollTo({ top, behavior: 'smooth' });
}

/** To a place at once, with no glide (coming back to where someone was). */
export function jumpTo(y) {
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo(0, y);
}

/** Back to the top at once, as on arriving at a new page. */
export function jumpToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}
