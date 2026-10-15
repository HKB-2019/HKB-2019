/* Whether this visitor has been offered the mailing list in the welcome
 * pop-up (src/pages/Storefront.jsx), and whether they joined.
 *
 * On the shop it is remembered in the browser, so a shopper is asked once.
 * The preview is for the owner to look at again and again, so there it
 * lasts only as long as the tab. Never throws: blocked storage simply means
 * not remembered. */

const KEY = 'masq:welcome';
const box = () => (import.meta.env.VITE_DEMO ? window.sessionStorage : window.localStorage);

/** { state: 'shown' | 'joined', at } or null. */
export function welcomeSeen() {
  try { return JSON.parse(box().getItem(KEY)); } catch { return null; }
}

export function markWelcome(state) {
  try { box().setItem(KEY, JSON.stringify({ state, at: Date.now() })); } catch { /* not remembered */ }
}

/** The preview's "see the pop-up again". */
export function forgetWelcome() {
  try { box().removeItem(KEY); } catch { /* nothing to forget */ }
}
