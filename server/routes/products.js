import { Router } from 'express';
import { one } from '../db.js';
import { loadProducts } from '../lib/catalogue.js';
import { getSettings, getHomeImages, openZones, NIGERIAN_STATES } from '../lib/settings.js';

export const productsRouter = Router();

/* GET /api/products — the catalogue the storefront shows: on-sale products,
 * their prices, photos and which sizes can be bought. This is the only place
 * the shop page gets any of that from. */
productsRouter.get('/products', async (_req, res) => {
  res.set('Cache-Control', 'no-store');   // a price change must show at once
  res.json(await loadProducts());
});

/* GET /api/site — everything else the public pages need from the admin:
 * the home page's words and photos, footer pages, social links, the film,
 * and where delivery is open. */
productsRouter.get('/site', async (_req, res) => {
  const { pages, social, film, home } = await getSettings(['pages', 'social', 'film', 'home']);
  const ids = await getHomeImages();
  res.set('Cache-Control', 'no-store');
  res.json({
    // A photo the owner has not replaced is null: the page keeps its own.
    home: {
      ...home,
      images: Object.fromEntries(Object.entries(ids).map(([slot, id]) =>
        [slot, id ? { img: `/api/images/${id}`, img2x: `/api/images/${id}/2x` } : null]))
    },
    pages,
    social,
    film: film.kind ? { kind: film.kind, url: film.url, youtubeId: film.youtubeId } : null,
    delivery: await openZones(),
    states: NIGERIAN_STATES
  });
});

/* GET /api/images/:id and /api/images/:id/2x — uploaded product photos.
 *
 * An image id never changes its bytes (a new upload is a new id), so the
 * browser may keep it for a year. nosniff and a no-everything CSP mean that
 * even a file opened on its own can only ever be treated as a picture. */
productsRouter.get(/^\/images\/(\d{1,9})(\/2x)?$/, async (req, res) => {
  const id = Number(req.params[0]);
  const column = req.params[1] ? 'data_2x' : 'data';
  const row = await one(`SELECT mime, ${column} AS bytes FROM images WHERE id = $1`, [id]);
  if (!row) return res.status(404).json({ error: 'No such image.' });

  res.set({
    'Content-Type': row.mime,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox"
  });
  res.send(Buffer.from(row.bytes));
});
