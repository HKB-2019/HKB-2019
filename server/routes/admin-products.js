import { Router } from 'express';
import express from 'express';
import { one, query, transaction } from '../db.js';
import { requireAdmin } from '../lib/auth.js';
import { loadProducts } from '../lib/catalogue.js';
import { decodePhoto, MAX_IMAGE_BYTES } from '../lib/images.js';

/* Everything the owner can change about a product: its name, price, badge,
 * where it appears, whether it is on sale, its order, its sizes and its photo.
 *
 * Prices here only affect new orders. An order already placed keeps the price
 * it was charged at, because its line items carry their own copy. */

export const adminProductsRouter = Router();
adminProductsRouter.use('/admin/products', requireAdmin);

const MAX_PRICE_NAIRA = 1_000_000;

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

/* ----------------------------------------------------------- validation */

function cleanName(v) {
  if (typeof v !== 'string') throw fail(400, 'Give the product a name.');
  const name = v.replace(/\s+/g, ' ').trim();
  if (name.length < 2) throw fail(400, 'Give the product a name.');
  if (name.length > 60) throw fail(400, 'Keep the name under 60 characters.');
  return name;
}

/** Whole naira in, kobo out. The admin never deals in kobo. */
function cleanPrice(v) {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw fail(400, 'The price must be a whole number of naira.');
  if (v < 100) throw fail(400, 'The price must be at least ₦100.');
  if (v > MAX_PRICE_NAIRA) throw fail(400, 'The price must be ₦1,000,000 or less.');
  return v * 100;
}

function cleanBadge(v) {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') throw fail(400, 'The badge must be text.');
  const badge = v.replace(/\s+/g, ' ').trim().toUpperCase();
  if (badge.length > 16) throw fail(400, 'Keep the badge under 16 characters.');
  return badge || null;
}

function cleanSize(v) {
  if (typeof v !== 'string') throw fail(400, 'Type a size.');
  const size = v.replace(/\s+/g, ' ').trim().toUpperCase();
  if (!size) throw fail(400, 'Type a size.');
  if (size.length > 12) throw fail(400, 'Keep a size under 12 characters.');
  return size;
}

const bool = (v, label) => {
  if (typeof v !== 'boolean') throw fail(400, `${label} must be on or off.`);
  return v;
};

/** A short, readable, unique id from the name: "The Face Tee" → "the-face-tee". */
async function newId(tx, name) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'product';
  for (let n = 1; n < 1000; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    if (!(await tx.one('SELECT 1 FROM products WHERE id = $1', [id]))) return id;
  }
  throw fail(409, 'Could not find a free id for that name.');
}

async function productOr404(id, tx = { one }) {
  const p = await tx.one('SELECT * FROM products WHERE id = $1', [String(id)]);
  if (!p) throw fail(404, 'That product does not exist.');
  return p;
}

async function current(id) {
  return (await loadProducts({ forAdmin: true })).find(p => p.id === id);
}

/* --------------------------------------------------------------- routes */

adminProductsRouter.get('/admin/products', async (_req, res) => {
  res.json(await loadProducts({ forAdmin: true }));
});

/**
 * Create a product. It starts off sale, with no stock: the owner adds a
 * photo and counts, then puts it on sale — so a half-made product is never
 * visible to customers.
 */
adminProductsRouter.post('/admin/products', async (req, res) => {
  const b = req.body ?? {};
  const name = cleanName(b.name);
  const priceKobo = cleanPrice(b.priceNaira);
  const badge = cleanBadge(b.badge);
  const sizes = Array.isArray(b.sizes) && b.sizes.length ? b.sizes.map(cleanSize) : ['ONE SIZE'];
  if (new Set(sizes).size !== sizes.length) throw fail(400, 'Each size can only be listed once.');
  if (sizes.length > 12) throw fail(400, 'That is more sizes than a product needs.');

  const id = await transaction(async (tx) => {
    const id = await newId(tx, name);
    const { next } = await tx.one('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM products');
    await tx.query(`
      INSERT INTO products (id, name, price_kobo, img, badge, in_drop, featured, in_essentials, hidden, position)
      VALUES ($1, $2, $3, '', $4, TRUE, TRUE, FALSE, TRUE, $5)
    `, [id, name, priceKobo, badge, next]);
    for (const size of sizes) {
      await tx.query('INSERT INTO variants (product_id, size, stock) VALUES ($1, $2, 0)', [id, size]);
    }
    return id;
  });

  res.status(201).json(await current(id));
});

adminProductsRouter.patch('/admin/products/:id', async (req, res) => {
  const b = req.body ?? {};
  const sets = [];
  const params = [];
  const set = (column, value) => { params.push(value); sets.push(`${column} = $${params.length}`); };

  if ('name' in b)         set('name', cleanName(b.name));
  if ('priceNaira' in b)   set('price_kobo', cleanPrice(b.priceNaira));
  if ('badge' in b)        set('badge', cleanBadge(b.badge));
  if ('inDrop' in b)       set('in_drop', bool(b.inDrop, 'Drop grid'));
  if ('featured' in b)     set('featured', bool(b.featured, 'Front of the grid'));
  if ('inEssentials' in b) set('in_essentials', bool(b.inEssentials, 'Essentials'));
  if ('hidden' in b)       set('hidden', bool(b.hidden, 'On sale'));
  if (!sets.length) throw fail(400, 'Nothing to change.');

  await transaction(async (tx) => {
    const p = await tx.one('SELECT * FROM products WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!p) throw fail(404, 'That product does not exist.');

    // Putting something on sale that a customer could not actually buy, or
    // could not see, helps nobody.
    if (b.hidden === false) {
      if (!p.image_id && !p.img) throw fail(409, 'Add a photo before putting this on sale.');
      const { n } = await tx.one('SELECT COUNT(*) AS n FROM variants WHERE product_id = $1', [p.id]);
      if (!n) throw fail(409, 'Add at least one size before putting this on sale.');
    }

    params.push(p.id);
    await tx.query(`UPDATE products SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  });

  res.json(await current(req.params.id));
});

/** Move one place earlier or later in the shop's order. */
adminProductsRouter.post('/admin/products/:id/move', async (req, res) => {
  const dir = req.body?.direction;
  if (dir !== 'up' && dir !== 'down') throw fail(400, 'Move up or down.');

  await transaction(async (tx) => {
    const rows = await tx.query('SELECT id FROM products ORDER BY position, id FOR UPDATE');
    const i = rows.findIndex(r => r.id === req.params.id);
    if (i === -1) throw fail(404, 'That product does not exist.');
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= rows.length) return;               // already at the end
    [rows[i], rows[j]] = [rows[j], rows[i]];
    // Renumber the lot, so positions are always 0..n with no ties to break.
    for (const [position, r] of rows.entries()) {
      await tx.query('UPDATE products SET position = $1 WHERE id = $2', [position, r.id]);
    }
  });

  res.json(await loadProducts({ forAdmin: true }));
});

adminProductsRouter.post('/admin/products/:id/sizes', async (req, res) => {
  const size = cleanSize(req.body?.size);
  await transaction(async (tx) => {
    const p = await productOr404(req.params.id, tx);
    const { n } = await tx.one('SELECT COUNT(*) AS n FROM variants WHERE product_id = $1', [p.id]);
    if (n >= 12) throw fail(400, 'That is more sizes than a product needs.');
    const added = await tx.one(`
      INSERT INTO variants (product_id, size, stock) VALUES ($1, $2, 0)
      ON CONFLICT (product_id, size) DO NOTHING
      RETURNING id
    `, [p.id, size]);
    if (!added) throw fail(409, `${size} is already a size of this product.`);
  });
  res.status(201).json(await current(req.params.id));
});

/**
 * Remove a size. Only once its count is zero — so a slip cannot delete stock
 * the owner has counted — and only if no unfinished order is holding it.
 */
adminProductsRouter.delete('/admin/products/:id/sizes/:variantId', async (req, res) => {
  const variantId = Number(req.params.variantId);
  if (!Number.isInteger(variantId) || variantId < 1 || variantId > 2_147_483_647) {
    throw fail(400, 'Bad size.');
  }

  await transaction(async (tx) => {
    const p = await productOr404(req.params.id, tx);
    const v = await tx.one('SELECT id, size, stock FROM variants WHERE id = $1 AND product_id = $2 FOR UPDATE',
      [variantId, p.id]);
    if (!v) throw fail(404, 'That size does not exist.');
    if (v.stock > 0) throw fail(409, `Set the ${v.size} count to 0 first.`);

    const held = await tx.one(`
      SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE oi.variant_id = $1 AND o.status = 'pending' LIMIT 1
    `, [v.id]);
    if (held) throw fail(409, `Someone is paying for a ${v.size} right now. Try again in half an hour.`);

    const { n } = await tx.one('SELECT COUNT(*) AS n FROM variants WHERE product_id = $1', [p.id]);
    if (n <= 1 && !p.hidden) throw fail(409, 'A product on sale needs at least one size. Take it off sale first.');

    await tx.query('DELETE FROM variants WHERE id = $1', [v.id]);
  });

  res.json(await current(req.params.id));
});

/** Go back to the photo that shipped with the site, if there is one. */
adminProductsRouter.delete('/admin/products/:id/image', async (req, res) => {
  await transaction(async (tx) => {
    const p = await productOr404(req.params.id, tx);
    if (!p.image_id) return;
    if (!p.img && !p.hidden) throw fail(409, 'This product has no other photo. Upload a new one instead, or take it off sale first.');
    await tx.query('UPDATE products SET image_id = NULL WHERE id = $1', [p.id]);
    await tx.query('DELETE FROM images WHERE id = $1', [p.image_id]);
  });
  res.json(await current(req.params.id));
});

/* ---------------------------------------------------------- photo upload */

/*
 * Mounted BEFORE the shop's ordinary 100 KB body limit, with its own larger
 * one — and with the sign-in check ahead of the body parser, so nobody who is
 * not signed in can make the server read megabytes on their behalf.
 */
export const adminUploadRouter = Router();

adminUploadRouter.post(
  '/admin/products/:id/image',
  requireAdmin,
  express.json({ limit: Math.ceil(MAX_IMAGE_BYTES * 2 * 1.4) }),   // two photos, base64
  async (req, res) => {
    const small = decodePhoto(req.body?.image, 'standard');
    const large = decodePhoto(req.body?.image2x, 'sharp-screen');
    if (small.mime !== large.mime) throw fail(400, 'The two sizes of the photo do not match.');

    await transaction(async (tx) => {
      const p = await tx.one('SELECT id, image_id FROM products WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!p) throw fail(404, 'That product does not exist.');
      const { id } = await tx.one(
        'INSERT INTO images (mime, data, data_2x) VALUES ($1, $2, $3) RETURNING id',
        [small.mime, small.bytes, large.bytes]);
      await tx.query('UPDATE products SET image_id = $1 WHERE id = $2', [id, p.id]);
      // The old upload is no longer shown anywhere; keep the database small.
      if (p.image_id) await tx.query('DELETE FROM images WHERE id = $1', [p.image_id]);
    });

    res.json(await current(req.params.id));
  }
);
