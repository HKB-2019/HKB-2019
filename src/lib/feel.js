/* Small moments of feedback, played with the Web Animations API so they
 * never fight a CSS transition or a React re-render, and skipped entirely on
 * a device set to reduce motion. Each answers something the customer did. */

const calm = () =>
  typeof window === 'undefined' || !window.matchMedia
  || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const EASE_OUT = 'cubic-bezier(0.2, 0, 0, 1)';

/** A box that needs fixing: a short, damped side-to-side shake. */
export function shake(el) {
  if (!el?.animate || calm()) return;
  el.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' },
     { transform: 'translateX(-2px)' }, { transform: 'translateX(1px)' }, { transform: 'translateX(0)' }],
    { duration: 380, easing: 'ease-out' }
  );
}

/** Every box in `root` marked invalid shakes, and the first one gets focus. */
export function shakeInvalid(root) {
  if (!root) return;
  // After React has marked the boxes, which happens before the next frame.
  requestAnimationFrame(() => {
    const bad = [...root.querySelectorAll('[aria-invalid="true"]')];
    bad.forEach(shake);
    bad[0]?.focus({ preventScroll: false });
  });
}

/** Something switched on (a piece saved): a small settle from slightly smaller. */
export function pop(el) {
  if (!el?.animate || calm()) return;
  el.animate([{ transform: 'scale(0.82)' }, { transform: 'scale(1)' }], { duration: 260, easing: EASE_OUT });
}

/** Words that have just replaced others on a button ("ADDED"): a soft fade up. */
export function textIn(el) {
  if (!el?.animate || calm()) return;
  el.animate(
    [{ opacity: 0, transform: 'translateY(3px)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
    { duration: 220, easing: EASE_OUT }
  );
}

/** An icon that has just replaced another fades and sharpens into place. */
export function iconIn(el) {
  if (!el?.animate || calm()) return;
  el.animate(
    [{ opacity: 0, transform: 'scale(0.25)', filter: 'blur(4px)' }, { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' }],
    { duration: 260, easing: EASE_OUT }
  );
}
