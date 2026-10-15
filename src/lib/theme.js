import { useCallback, useEffect, useState } from 'react';

/* Light or dark. Until someone chooses, the site follows their device (and
 * changes with it); once they choose, their choice is kept in this browser.
 * public/theme.js sets it before the first paint; this keeps it in step. */

const KEY = 'masq:theme';
const BAR = { dark: '#050407', light: '#f6f3ee' };   // the phone's address bar
const deviceTheme = () => (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

function saved() {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; }
  catch { return null; }
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme]);
}

export function useTheme() {
  const [theme, setTheme] = useState(() => saved() ?? deviceTheme());

  useEffect(() => { applyTheme(theme); }, [theme]);

  // Following the device: change when it does (an evening switch to dark).
  useEffect(() => {
    if (saved()) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const follow = () => { if (!saved()) setTheme(mq.matches ? 'light' : 'dark'); };
    mq.addEventListener('change', follow);
    return () => mq.removeEventListener('change', follow);
  }, []);

  const toggle = useCallback(() => {
    setTheme(t => {
      const next = t === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(KEY, next); } catch { /* this visit only */ }
      return next;
    });
  }, []);

  return { theme, toggle };
}
