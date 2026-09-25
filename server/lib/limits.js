/* A small per-address rate limit, for routes a script could hammer:
 * checkout (every call holds stock for half an hour) and the mailing list.
 *
 * In memory, which is the right scope for one server. Like the admin lockout,
 * it would need to move to the database if the shop ever ran as several. */

export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();

  // Forget old entries now and then, so the map cannot grow without bound.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now - v.first > windowMs) hits.delete(k);
  }, windowMs);
  sweep.unref();

  const limiter = (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || now - entry.first > windowMs) {
      entry = { first: now, count: 0 };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.first + windowMs - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
  limiter.reset = () => hits.clear();
  return limiter;
}
