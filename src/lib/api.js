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
