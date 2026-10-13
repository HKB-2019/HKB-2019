import { sendEvent } from './api.js';

/* Counting visits, the shop's side. See server/lib/analytics.js for the rules.
 *
 * Nothing here identifies anyone. The visit id lives in sessionStorage — this
 * tab only, forgotten when it closes or after 30 idle minutes. "Been here
 * before" is a yes/no kept on the device. No cookies. The owner's own visits
 * are left out by the server, and a browser that asks not to be tracked
 * (Global Privacy Control) is not counted at all. */

const IDLE_MS = 30 * 60_000;
const KEY = 'masq:visit';

const off = () => typeof window === 'undefined'
  || navigator.globalPrivacyControl === true
  || window.location.pathname.startsWith('/admin')
  || window.location.hash.startsWith('#/admin');

const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');

function readVisit() {
  try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
}
function writeVisit(v) {
  try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* counted for this page only */ }
}

let memory = null;   // when sessionStorage is blocked

/** This visit, starting a new one after 30 idle minutes. */
function visit() {
  const now = Date.now();
  let v = readVisit() ?? memory;
  if (!v || now - v.last > IDLE_MS) {
    const url = new URL(window.location.href);
    let ref = '';
    try {
      const r = document.referrer && new URL(document.referrer);
      if (r && r.hostname !== window.location.hostname) ref = r.hostname;
    } catch { /* no referrer */ }
    let returning = false;
    try { returning = localStorage.getItem('masq:seen') === '1'; localStorage.setItem('masq:seen', '1'); } catch { /* unknown */ }
    v = {
      id: hex(12), ref, returning,
      us: url.searchParams.get('utm_source') ?? '', um: url.searchParams.get('utm_medium') ?? '',
      uc: url.searchParams.get('utm_campaign') ?? ''
    };
  }
  v.last = now;
  memory = v;
  writeVisit(v);
  return v;
}

/** A page's address without its query: "/product/tee", "/". */
const currentPath = () => window.location.hash.startsWith('#/')
  ? window.location.hash.slice(1).split('?')[0]
  : window.location.pathname;

/* Time actually spent looking: only while the tab is visible. */
let page = { path: null, visibleSince: 0, engaged: 0 };

function flush() {
  if (!page.path) return;
  if (page.visibleSince) { page.engaged += Date.now() - page.visibleSince; page.visibleSince = document.hidden ? 0 : Date.now(); }
  if (page.engaged >= 1000 && !off()) {
    sendEvent({ n: 'leave', s: visit().id, p: page.path, ms: Math.min(page.engaged, IDLE_MS) });
  }
  page.engaged = 0;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
    else page.visibleSince = Date.now();
  });
  window.addEventListener('pagehide', flush);
}

/** A page was shown. Called by the router on every change of address. */
export function trackPageview() {
  if (off()) return;
  const path = currentPath();
  if (path === page.path) return;
  flush();
  page = { path, visibleSince: document.hidden ? 0 : Date.now(), engaged: 0 };
  const v = visit();
  sendEvent({
    n: 'pageview', s: v.id, p: path, r: v.ref, us: v.us, um: v.um, uc: v.uc,
    w: window.screen?.width ?? window.innerWidth,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ret: v.returning
  });
}

/**
 * Something worth counting: a piece viewed, a bag add, a sign-up.
 *   props: { productId, size, valueKobo }
 */
export function track(name, { productId, size, valueKobo } = {}) {
  if (off()) return;
  sendEvent({
    n: name, s: visit().id, p: currentPath(),
    ...(productId ? { pid: productId } : {}), ...(size ? { sz: size } : {}),
    ...(Number.isInteger(valueKobo) ? { v: valueKobo } : {})
  });
}

/** This visit's id, sent with a checkout so the order knows where it came from. */
export const visitId = () => (off() ? undefined : visit().id);
