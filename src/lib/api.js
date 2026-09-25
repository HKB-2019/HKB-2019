/* Talks to the shop API. In dev, Vite proxies /api to the server on :3001. */

const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(BASE + '/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const getProducts = () => request('/products');

/** Send WHAT is being bought. The server decides what it costs. */
export const startCheckout = (email, items) =>
  request('/checkout', {
    method: 'POST',
    body: JSON.stringify({
      email,
      items: items.map(i => ({ productId: i.id, size: i.size, qty: i.qty }))
    })
  });

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
