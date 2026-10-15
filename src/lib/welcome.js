/* Whether this visitor has been offered the mailing list in the welcome
 * pop-up (src/pages/Storefront.jsx), and whether they joined.
 *
 * On the shop it is remembered in the browser, so a shopper is asked once.
 * The preview is for the owner to look at again and again, so there it is
 * remembered only until the page is opened or refreshed again — the claude.ai
 * viewer keeps a tab's own storage between visits, which hid it. Never
 * throws: blocked storage simply means not remembered. */

const KEY = 'masq:welcome';
let previewSeen = null;   // the preview's memory: this page load only

/** { state: 'shown' | 'joined', at } or null. */
export function welcomeSeen() {
  if (import.meta.env.VITE_DEMO) return previewSeen;
  try { return JSON.parse(window.localStorage.getItem(KEY)); } catch { return null; }
}

export function markWelcome(state) {
  const seen = { state, at: Date.now() };
  if (import.meta.env.VITE_DEMO) { previewSeen = seen; return; }
  try { window.localStorage.setItem(KEY, JSON.stringify(seen)); } catch { /* not remembered */ }
}

/** The preview's "see the pop-up again". */
export function forgetWelcome() {
  previewSeen = null;
}
