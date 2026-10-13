import { glideTo } from './smoothScroll.js';

export function scrollToId(hash) {
  const target = document.querySelector(hash);
  if (!target) return;
  glideTo(target, -58);
}
