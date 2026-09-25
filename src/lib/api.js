/* Talks to the shop API. In dev, Vite proxies /api to the server on :3001. */

const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(BASE + '/api' + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch {
    // Offline, or a free host still waking up.
    throw Object.assign(new Error('Could not reach the shop. Check your connection and try again.'), { status: 0 });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { status: res.status, code: body.code });
  }
  return body;
}

export const getProducts = () => request('/products');
export const getSite     = () => request('/site');

/**
 * Send WHAT is being bought and WHERE it goes. The server decides what it
 * costs — the item prices and the delivery fee both come from its database.
 */
export const startCheckout = ({ email, name, phone, address }, items) =>
  request('/checkout', {
    method: 'POST',
    body: JSON.stringify({
      email, name, phone, address,
      items: items.map(i => ({ productId: i.id, size: i.size, qty: i.qty }))
    })
  });

export const subscribe = (email) =>
  request('/subscribe', { method: 'POST', body: JSON.stringify({ email }) });

export const getOrder = (reference) => request(`/orders/${encodeURIComponent(reference)}`);

/* ---------------------------------------------------------------- admin */

const adminRequest = (path, options = {}) =>
  request(path, { credentials: 'same-origin', ...options });

export const adminLogin    = (password) => adminRequest('/admin/login', { method:'POST', body: JSON.stringify({ password }) });
export const adminLogout   = ()         => adminRequest('/admin/logout', { method:'POST' });
export const adminMe       = ()         => adminRequest('/admin/me');
export const adminStatus   = ()         => adminRequest('/admin/status');
export const adminSetup    = (code, password) =>
  adminRequest('/admin/setup', { method:'POST', body: JSON.stringify({ code, password }) });
export const adminOrders   = (status)   => adminRequest('/admin/orders' + (status ? `?status=${status}` : ''));
export const adminSummary  = ()         => adminRequest('/admin/summary');
export const adminStock    = ()         => adminRequest('/admin/stock');
export const adminSetStock = (variantId, stock) =>
  adminRequest(`/admin/stock/${variantId}`, { method:'POST', body: JSON.stringify({ stock }) });
export const adminFulfil   = (reference) =>
  adminRequest(`/admin/orders/${encodeURIComponent(reference)}/fulfil`, { method:'POST' });

/* --------------------------------------------------------- admin: products */

export const adminProducts      = ()            => adminRequest('/admin/products');
export const adminCreateProduct = (p)           => adminRequest('/admin/products', { method:'POST', body: JSON.stringify(p) });
export const adminUpdateProduct = (id, change)  => adminRequest(`/admin/products/${encodeURIComponent(id)}`, { method:'PATCH', body: JSON.stringify(change) });
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

/* ------------------------------------------------ admin: settings and list */

export const adminSettings      = ()            => adminRequest('/admin/settings');
export const adminSaveSetting   = (key, value)  => adminRequest(`/admin/settings/${key}`, { method:'PUT', body: JSON.stringify(value) });
export const adminSubscribers   = ()            => adminRequest('/admin/subscribers');
export const adminRemoveSubscriber = (id)       => adminRequest(`/admin/subscribers/${id}`, { method:'DELETE' });

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
