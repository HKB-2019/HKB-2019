import { Router } from 'express';
import { query } from '../db.js';

export const productsRouter = Router();

/* GET /api/products — the catalogue, with real stock.
 * `soldOut` is computed from the variants table rather than typed by hand. */
productsRouter.get('/products', async (_req, res) => {
  const products = await query(`
    SELECT id, name, price_kobo, img, badge, is_extra FROM products ORDER BY position, id
  `);

  const variants = await query('SELECT product_id, size, stock FROM variants ORDER BY id');

  res.json(products.map(p => {
    const sizes = variants.filter(v => v.product_id === p.id);
    return {
      id: p.id,
      name: p.name,
      price: p.price_kobo / 100,          // naira, for display only
      priceKobo: p.price_kobo,
      img: p.img,
      badge: p.badge ?? undefined,
      extra: Boolean(p.is_extra),
      sizes: sizes.map(s => s.size),
      stock: Object.fromEntries(sizes.map(s => [s.size, s.stock])),
      soldOut: sizes.every(s => s.stock === 0)
    };
  }));
});
