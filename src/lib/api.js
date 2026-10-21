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
      : 'Could not reach the shop. Check your connection and try again.'), { status: 0, code: 'network', at: Date.now() });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(body.error || friendly(res.status)), { status: res.status, code: body.code, field: body.field, wait: body.wait, at: Date.now() });
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
export const resendReceipt = (reference) => request(`/orders/${encodeURIComponent(reference)}/receipt`, { method: 'POST', body: '{}' });

/* Gift cards: buy one (a payment of its own), see it once paid, check one in the bag. */
export const buyGiftCard   = (card) => request('/gift-cards', { method: 'POST', body: JSON.stringify(card) });
export const getGiftCard   = (reference) => request(`/gift-cards/${encodeURIComponent(reference)}`);
export const checkGiftCard = (code) => request('/gift-cards/check', { method: 'POST', body: JSON.stringify({ code }) });
export const openGiftCard  = (code) => request('/gift-cards/open', { method: 'POST', body: JSON.stringify({ code }) });
export const topUpGiftCard = (topup) => request('/gift-cards/topups', { method: 'POST', body: JSON.stringify(topup) });
export const getTopup      = (reference) => request(`/gift-cards/topups/${encodeURIComponent(reference)}`);

/* ------------------------------------------------------ customer accounts */

const accountRequest = (path, options = {}) => request('/account' + path, { credentials: 'same-origin', ...options });
const send = (method, json) => ({ method, body: JSON.stringify(json ?? {}) });

export const accountMe        = ()     => accountRequest('/me');
export const accountSignUp    = (b)    => accountRequest('/signup', send('POST', b));
export const accountVerify    = (email, code) => accountRequest('/verify', send('POST', { email, code }));
export const accountResend    = (email) => accountRequest('/resend', send('POST', { email }));
export const accountLogin     = (email, password, remember) => accountRequest('/login', send('POST', { email, password, remember }));
export const accountLogin2fa  = (ticket, code) => accountRequest('/login/2fa', send('POST', { ticket, code }));
export const accountLogout    = ()     => accountRequest('/logout', send('POST'));
export const accountRenew     = ()     => accountRequest('/renew', send('POST'));
export const accountForgot    = (email) => accountRequest('/forgot', send('POST', { email }));
export const accountReset     = (email, token, password) => accountRequest('/reset', send('POST', { email, token, password }));
export const accountSave      = (b)    => accountRequest('/me', send('PATCH', b));
export const accountPassword  = (current, password) => accountRequest('/password', send('POST', { current, password }));
export const accountSessions  = ()     => accountRequest('/sessions');
export const accountEndSession = (id)  => accountRequest(`/sessions/${id}`, { method: 'DELETE' });
export const accountEndOthers = ()     => accountRequest('/sessions/sign-out-others', send('POST'));
export const accountActivity  = ()     => accountRequest('/activity');
export const account2faSetup  = ()     => accountRequest('/2fa/setup', send('POST'));
export const account2faOn     = (code) => accountRequest('/2fa/enable', send('POST', { code }));
export const account2faOff    = (password) => accountRequest('/2fa/disable', send('POST', { password }));
export const accountOrders    = ()     => accountRequest('/orders');
export const accountDelete    = (password) => accountRequest('', send('DELETE', { password }));
export const accountEmail     = (email, password) => accountRequest('/email', send('POST', { email, password }));
export const accountEmailResend = ()   => accountRequest('/email/resend', send('POST'));
export const accountEmailConfirm = (code) => accountRequest('/email/confirm', send('POST', { code }));
export const accountEmailCancel = ()   => accountRequest('/email', { method: 'DELETE' });
export const accountAddresses = ()     => accountRequest('/addresses');
export const accountAddAddress = (b)   => accountRequest('/addresses', send('POST', b));
export const accountEditAddress = (id, b) => accountRequest(`/addresses/${id}`, send('PUT', b));
export const accountDefaultAddress = (id) => accountRequest(`/addresses/${id}/default`, send('POST'));
export const accountRemoveAddress = (id) => accountRequest(`/addresses/${id}`, { method: 'DELETE' });
export const accountNotifications = () => accountRequest('/notifications');
export const accountSetNotifications = (b) => accountRequest('/notifications', send('PATCH', b));
export const accountRemoveStockAlert = (id) => accountRequest(`/notifications/stock/${id}`, { method: 'DELETE' });
export const accountRemovePhoto = ()   => accountRequest('/photo', { method: 'DELETE' });
export const accountPhotoUrl  = (v = '') => `${BASE}/api/account/photo${v ? `?v=${v}` : ''}`;

/**
 * Upload a profile photo (a data URL), reporting how much has gone (0–1) as
 * it goes: fetch cannot tell, so this one uses XMLHttpRequest.
 */
export function accountUploadPhoto(image, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${BASE}/api/account/photo`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(Object.assign(new Error(body.error || friendly(xhr.status)), { status: xhr.status, at: Date.now() }));
    };
    xhr.onerror = () => reject(Object.assign(new Error('Could not reach the shop. Check your connection and try again.'), { status: 0, code: 'network', at: Date.now() }));
    xhr.onabort = () => reject(Object.assign(new Error('Upload cancelled.'), { code: 'cancelled' }));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(JSON.stringify({ image }));
  });
}

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

/* The Journal: stories for the shop, and the owner's writing desk. */
export const getJournal       = ()     => request('/journal');
export const getStory         = (slug) => request(`/journal/${encodeURIComponent(slug)}`);
export const adminJournal     = ()     => adminRequest('/admin/journal');
export const adminAddStory    = (b)    => adminRequest('/admin/journal', { method:'POST', body: JSON.stringify(b) });
export const adminSaveStory   = (slug, b) => adminRequest(`/admin/journal/${encodeURIComponent(slug)}`, { method:'PUT', body: JSON.stringify(b) });
export const adminDeleteStory = (slug) => adminRequest(`/admin/journal/${encodeURIComponent(slug)}`, { method:'DELETE' });
export const adminStoryImage  = (slug, image, image2x) =>
  adminRequest(`/admin/journal/${encodeURIComponent(slug)}/image`, { method:'POST', body: JSON.stringify({ image, image2x }) });
export const adminRemoveStoryImage = (slug) => adminRequest(`/admin/journal/${encodeURIComponent(slug)}/image`, { method:'DELETE' });

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
