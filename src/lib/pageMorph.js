import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';

/* Tapping a piece: its photo glides from the card to its place on the
 * product page while the rest of the page changes around it. This is the
 * browser's own page transition (View Transitions); a browser without it,
 * or a device set to reduce motion, simply opens the page as before. */

let arriving = false;

/** True while the product page is being opened by a gliding photo. */
export const arrivedByPhoto = () => arriving;

/* Carried by every link inside the shop that opens a product page, so the
 * page's BACK knows there is somewhere in the shop to go back to (rather
 * than out to Instagram, for someone who arrived from a shared link). */
export const FROM_SHOP = { fromShop: true };

const canGlide = () =>
  typeof document.startViewTransition === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** onClick for a link to a product: `onClick={(e) => glide(e, to)}`. */
export function useGlideToProduct() {
  const navigate = useNavigate();
  return useCallback((e, to) => {
    // A new tab, a modified click or a browser without transitions: leave the link alone.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!canGlide()) return;
    const photo = e.currentTarget.closest('.card, .slide')?.querySelector('img');
    if (!photo) return;
    e.preventDefault();

    // Only one thing on the page may carry the name: the photo that was tapped,
    // not the product page's own photo when going from one piece to another.
    document.querySelectorAll('.pdp__frame img').forEach(img => { img.style.viewTransitionName = 'none'; });
    photo.style.viewTransitionName = 'pdp-photo';
    arriving = true;

    const glide = document.startViewTransition(() => flushSync(() => navigate(to, { state: FROM_SHOP })));
    glide.finished.finally(() => {
      arriving = false;
      photo.style.viewTransitionName = '';
    });
  }, [navigate]);
}
