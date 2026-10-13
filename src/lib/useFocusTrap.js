import { useEffect, useRef } from 'react';

/* Keeps Tab inside an open overlay and hands focus back to whatever opened it. */
export function useFocusTrap(active) {
  const ref = useRef(null);
  const lastFocused = useRef(null);

  useEffect(() => {
    if (!active) return;
    lastFocused.current = document.activeElement;
    const root = ref.current;
    const first = root?.querySelector('input, select, button:not([data-close])') || root?.querySelector('[data-close]');
    first?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key !== 'Tab' || !root) return;
      const items = Array.from(root.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, iframe, video, [tabindex]:not([tabindex="-1"])'
      )).filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
      else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      lastFocused.current?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return ref;
}
