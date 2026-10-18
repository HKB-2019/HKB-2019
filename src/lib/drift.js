import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { onSmoothScroll } from './smoothScroll.js';

/* The home page's two GSAP effects. This file is fetched only by the home
 * page, after it is showing, and never on a device set to reduce motion.
 *
 *  - The MASQ. title: its letters rise into place one after another.
 *  - The big photos (top of the page, craft band, film strip) move a little
 *    slower than the page as it scrolls, which gives them depth.
 */

gsap.registerPlugin(ScrollTrigger, SplitText);

export function revealTitle(el) {
  const split = SplitText.create(el, { type: 'chars', mask: 'chars' });
  el.classList.remove('is-waiting');
  const tween = gsap.from(split.chars, {
    yPercent: 110, duration: 1.15, ease: 'expo.out', stagger: 0.075, delay: 0.1,
    // Back to plain text once it has landed: the masks would clip the Q's tail.
    onComplete: () => split.revert()
  });
  return () => { tween.kill(); split.revert(); };
}

export function startDrift(root) {
  document.documentElement.classList.add('has-drift');
  const ctx = gsap.context(() => {
    const hero = root.querySelector('.hero');
    if (hero) {
      gsap.to('.hero__media', {
        yPercent: 14, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
      });
    }
    for (const [band, layer] of [['.craft', '.craft__bg'], ['.film', '.film__media']]) {
      const el = root.querySelector(band);
      if (!el) continue;
      gsap.fromTo(el.querySelector(layer), { yPercent: -5 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    }
  }, root);

  // With the glide on (a mouse or trackpad), take its position every frame
  // it moves, as GSAP advises for Lenis: the photos then never lag it.
  const off = onSmoothScroll(ScrollTrigger.update);

  // Pieces load in above the bands after the page opens; measure again when
  // the page changes height so each band drifts while it is actually on screen.
  let timer;
  const resized = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => ScrollTrigger.refresh(), 200);
  });
  resized.observe(document.body);

  return () => {
    off();
    clearTimeout(timer);
    resized.disconnect();
    ctx.revert();
    document.documentElement.classList.remove('has-drift');
  };
}
