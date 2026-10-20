/* Talks to the shop API. In dev, Vite proxies /api to the server on :3001. */

const BASE = import.meta.env.VITE_API_URL || '';

/* What to say when the server gives no words of its own. */
function friendly(status) {
  if (status === 429) return 'Too many tries in a short time. Please wait a minute, then try again.';
  if (status === 503) return 'The shop is busy or being updated. Please try again in a moment.';
  if (status >= 500) return 'Something went wrong on our end. Please try again in a moment.';
  if (status === 404) return 'We couldn’t find that.';
  return `Something went wrong (${status}). Please try again.`;
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(BASE + '/api' + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch {
    // Offline, or a free host still waking up.
    throw Object.assign(new Error(navigator.onLine === false
      ? 'You’re offline. Check your internet connection and try again.'
      : 'Could not reach the shop. Check your connection and try again.'), { status: 0, code: 'network' });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(body.error || friendly(res.status)), { status: res.status, code: body.code });
  }
  return body;
}

export const getProducts = () => request('/products');
export const getSite     = () => request('/site');

/**
 * Send WHAT is being bought and WHERE it goes. The server decides what it
 * costs — the item prices and the delivery fee both come from its database.
 */
export const startCheckout = ({ email, name, phone, address, newsletter }, items, discountCode, analyticsSession, giftCode) =>
  request('/checkout', {
    method: 'POST',
    body: JSON.stringify({
      email, name, phone, address,
      ...(newsletter ? { newsletter: true } : {}),
      ...(discountCode ? { discountCode } : {}),
      ...(giftCode ? { giftCode } : {}),
      ...(analyticsSession ? { analyticsSession } : {}),
      items: items.map(i => ({ productId: i.id, colour: i.colour ?? '', size: i.size, qty: i.qty }))
    })
  });

/** What a discount code takes off this bag — the server works it out. */
export const checkDiscount = (code, items) =>
  request('/discount', {
    method: 'POST',
    body: JSON.stringify({ code, items: items.map(i => ({ productId: i.id, colour: i.colour ?? '', size: i.size, qty: i.qty })) })
  });

/** "Tell me when it's back" for a sold-out size. */
export const askForRestock = (productId, size, email, colour = '') =>
  request('/stock-alerts', { method: 'POST', body: JSON.stringify({ productId, colour, size, email }) });

export const subscribe = (email) =>
  request('/subscribe', { method: 'POST', body: JSON.stringify({ email }) });

export const getOrder = (reference) => request(`/orders/${encodeURIComponent(reference)}`);

/* Gift cards: buy one (a payment of its own), see it once paid, check one in the bag. */
export const buyGiftCard   = (card) => request('/gift-cards', { method: 'POST', body: JSON.stringify(card) });
export const getGiftCard   = (reference) => request(`/gift-cards/${encodeURIComponent(reference)}`);
export const checkGiftCard = (code) => request('/gift-cards/check', { method: 'POST', body: JSON.stringify({ code }) });
export const openGiftCard  = (code) => request('/gift-cards/open', { method: 'POST', body: JSON.stringify({ code }) });
export const topUpGiftCard = (topup) => request('/gift-cards/topups', { method: 'POST', body: JSON.stringify(topup) });
export const getTopup      = (reference) => request(`/gift-cards/topups/${encodeURIComponent(reference)}`);

/* ---------------------------------------------------------------- admin */

const adminRequest = (path, options = {}) =>
  request(path, { credentials: 'same-origin', ...options });

export const adminLogin    = (password) => adminRequest('/admin/login', { method:'POST', body: JSON.stringify({ password }) });
export const adminLogout   = ()         => adminRequest('/admin/logout', { method:'POST' });
export const adminMe       = ()         => adminRequest('/admin/me');
export const adminRenew    = ()         => adminRequest('/admin/renew', { method:'POST' });
export const adminStatus   = ()         => adminRequest('/admin/status');
export const adminSetup    = (code, password) =>
  adminRequest('/admin/setup', { method:'POST', body: JSON.stringify({ code, password }) });
export const adminOrders   = (status)   => adminRequest('/admin/orders' + (status ? `?status=${status}` : ''));
export const adminSummary  = ()         => adminRequest('/admin/summary');
export const adminStock    = ()         => adminRequest('/admin/stock');
/** Shelf counts for any number of lines, saved together: [{ variantId, shelf }]. */
export const adminSaveStockCounts = (counts) => adminRequest('/admin/stock', { method:'POST', body: JSON.stringify({ counts }) });
export const adminStockHistory = () => adminRequest('/admin/stock/history');
/** A delivery: how many arrived per line, added on top, with an optional note. */
export const adminReceiveStock = (lines, note) => adminRequest('/admin/stock/receive', { method:'POST', body: JSON.stringify({ lines, note }) });
export const adminSetStock = (variantId, stock) =>
  adminRequest(`/admin/stock/${variantId}`, { method:'POST', body: JSON.stringify({ stock }) });
export const adminFulfil   = (reference, { courier = '', tracking = '' } = {}) =>
  adminRequest(`/admin/orders/${encodeURIComponent(reference)}/fulfil`, { method:'POST', body: JSON.stringify({ courier, tracking }) });
export const adminRefunded = (reference, restock) =>
  adminRequest(`/admin/orders/${encodeURIComponent(reference)}/refunded`, { method:'POST', body: JSON.stringify({ restock }) });

/* --------------------------------------------------------- admin: products */

export const adminProducts      = ()            => adminRequest('/admin/products');
export const adminCreateProduct = (p)           => adminRequest('/admin/products', { method:'POST', body: JSON.stringify(p) });
export const adminUpdateProduct = (id, change)  => adminRequest(`/admin/products/${encodeURIComponent(id)}`, { method:'PATCH', body: JSON.stringify(change) });
export const adminWriterStatus  = ()            => adminRequest('/admin/writer');
export const adminDraftDescription = (id, notes) =>
  adminRequest(`/admin/products/${encodeURIComponent(id)}/draft`, { method:'POST', body: JSON.stringify({ notes }) });
export const adminMoveProduct   = (id, direction) =>
  adminRequest(`/admin/products/${encodeURIComponent(id)}/move`, { method:'POST', body: JSON.stringify({ direction }) });
export const adminAddSize       = (id, size)    =>
  adminRequest(`/admin/products/${encodeURIComponent(id)}/sizes`, { method:'POST', body: JSON.stringify({ size }) });
export const adminRemoveSize    = (id, variantId) =>
  adminRequest(`/admin/products/${encodeURIComponent(id)}/sizes/${variantId}`, { method:'DELETE' });
export const adminUploadPhoto   = (id, image, image2x) =>
  adminRequest(`/admin/products/${encodeURIComponent(id)}/image`, { method:'POST', body: JSON.stringify({ image, image2x }) });
export const adminRemovePhoto   = (id)          =>
  adminRequest(`/admin/products/${encodeURIComponent(id)}/image`, { method:'DELETE' });

export const adminAddGalleryPhoto = (id, image, image2x) =>
  adminRequest(`/admin/products/${encodeURIComponent(id)}/photos`, { method:'POST', body: JSON.stringify({ image, image2x }) });
export const adminRemoveGalleryPhoto = (id, photoId) =>
  adminRequest(`/admin/products/${encodeURIComponent(id)}/photos/${photoId}`, { method:'DELETE' });

const colourPath = (id, colourId) => `/admin/products/${encodeURIComponent(id)}/colours${colourId ? `/${colourId}` : ''}`;
export const adminAddColour      = (id, name, hex)      => adminRequest(colourPath(id), { method:'POST', body: JSON.stringify({ name, hex }) });
export const adminUpdateColour   = (id, colourId, change) => adminRequest(colourPath(id, colourId), { method:'PATCH', body: JSON.stringify(change) });
export const adminRemoveColour   = (id, colourId)       => adminRequest(colourPath(id, colourId), { method:'DELETE' });
export const adminUploadColourPhoto = (id, colourId, image, image2x) =>
  adminRequest(`${colourPath(id, colourId)}/image`, { method:'POST', body: JSON.stringify({ image, image2x }) });
export const adminRemoveColourPhoto = (id, colourId)    => adminRequest(`${colourPath(id, colourId)}/image`, { method:'DELETE' });

/* --------------------------------------------- admin: sales and waiting */

export const adminSales          = ()             => adminRequest('/admin/sales');
export const adminDiscounts      = ()             => adminRequest('/admin/discounts');
export const adminCreateDiscount = (d)            => adminRequest('/admin/discounts', { method:'POST', body: JSON.stringify(d) });
export const adminUpdateDiscount = (code, change) => adminRequest(`/admin/discounts/${encodeURIComponent(code)}`, { method:'PATCH', body: JSON.stringify(change) });
export const adminDeleteDiscount = (code)         => adminRequest(`/admin/discounts/${encodeURIComponent(code)}`, { method:'DELETE' });
export const adminStockAlerts    = ()             => adminRequest('/admin/stock-alerts');
export const adminClearAlerts    = (productId, size, colour = '') =>
  adminRequest('/admin/stock-alerts/clear', { method:'POST', body: JSON.stringify({ productId, colour: colour ?? '', size }) });
export const adminRemoveAlert    = (id)           => adminRequest(`/admin/stock-alerts/${id}`, { method:'DELETE' });

export const adminAnalytics = (range) => adminRequest(`/admin/analytics?range=${encodeURIComponent(range)}`);

/* ------------------------------------------------------- admin: home page */

export const adminUploadHomeImage = (slot, image, image2x) =>
  adminRequest(`/admin/home/image/${slot}`, { method:'POST', body: JSON.stringify({ image, image2x }) });
export const adminRemoveHomeImage = (slot) => adminRequest(`/admin/home/image/${slot}`, { method:'DELETE' });

/* ------------------------------------------------ admin: settings and list */

export const adminSettings      = ()            => adminRequest('/admin/settings');
export const adminSaveSetting   = (key, value)  => adminRequest(`/admin/settings/${key}`, { method:'PUT', body: JSON.stringify(value) });
export const adminSubscribers   = ()            => adminRequest('/admin/subscribers');
export const adminRemoveSubscriber = (id)       => adminRequest(`/admin/subscribers/${id}`, { method:'DELETE' });

// Gift cards: every card, make one, cancel one.
export const adminGiftCards       = ()     => adminRequest('/admin/gift-cards');
export const adminMakeGiftCard    = (card) => adminRequest('/admin/gift-cards', { method:'POST', body: JSON.stringify(card) });
export const adminCancelGiftCard  = (id)   => adminRequest(`/admin/gift-cards/${id}/cancel`, { method:'POST' });

// Customers: everyone the shop knows, by email (CSV: adminDownload('/admin/customers.csv')).
const customerPath = (email) => `/admin/customers/${encodeURIComponent(email)}`;
export const adminCustomers       = ()              => adminRequest('/admin/customers');
export const adminCustomer        = (email)         => adminRequest(customerPath(email));
export const adminUpdateCustomer  = (email, change) => adminRequest(customerPath(email), { method:'PATCH', body: JSON.stringify(change) });
export const adminForgetCustomer  = (email)         => adminRequest(customerPath(email), { method:'DELETE' });

/** Download a spreadsheet the admin is allowed to see, as a file. */
export async function adminDownload(path) {
  const res = await fetch(BASE + '/api' + path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Download failed.');
  const name = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'export.csv';
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------- visits */

/**
 * Report one thing that happened (src/lib/analytics.js decides what). Sent so
 * that it survives the page closing, and never in the customer's way: a
 * failure here is silently dropped.
 */
export function sendEvent(payload) {
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon?.(BASE + '/api/e', new Blob([body], { type: 'application/json' }))) return;
  } catch { /* fall through */ }
  fetch(BASE + '/api/e', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } })
    .catch(() => {});
}
