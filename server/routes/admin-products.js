import { Router } from 'express';
import express from 'express';
import { one, query, transaction } from '../db.js';
import { requireAdmin } from '../lib/auth.js';
import { loadProducts } from '../lib/catalogue.js';
import { decodePhoto, MAX_IMAGE_BYTES } from '../lib/images.js';
import { cleanText, HOME_SLOTS, setHomeImage } from '../lib/settings.js';

/* Everything the owner can change about a product: its name, price, badge,
 * where it appears, whether it is on sale, its order, its colours, its sizes
 * and its photos.
 *
 * Prices here only affect new orders. An order already placed keeps the price
 * it was charged at, because its line items carry their own copy. */

export const adminProductsRouter = Router();
adminProductsRouter.use('/admin/products', requireAdmin);

const MAX_PRICE_NAIRA = 1_000_000;
/** Photos beyond the main one, per product. Enough for front, back, detail, worn. */
export const MAX_EXTRA_PHOTOS = 6;

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

/** Colours per product. More than this is a different product. */
export const MAX_COLOURS = 12;

function cleanColourName(v) {
  if (typeof v !== 'string') throw fail(400, 'Name the colour.');
  const name = v.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (!name) throw fail(400, 'Name the colour.');
  if (name.length > 24) throw fail(400, 'Keep a colour name under 24 characters.');
  // Title case, so "black" and "Black" are one colour and read the same everywhere.
  return name.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
}

function cleanHex(v) {
  const hex = String(v ?? '').trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(hex)) throw fail(400, 'Pick the colour of its swatch.');
  return hex;
}

/** Is an unfinished payment holding any of these sizes? Then they cannot go yet. */
async function heldByPayment(tx, variantIds) {
  if (!variantIds.length) return false;
  return Boolean(await tx.one(`
    SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.variant_id = ANY($1::int[]) AND o.status = 'pending' LIMIT 1
  `, [variantIds]));
}

/** The colours of a product, by name, or [''] when it has none. */
async function colourNames(tx, productId) {
  const rows = await tx.query('SELECT name FROM product_colours WHERE product_id = $1 ORDER BY position, id', [productId]);
  return rows.length ? rows.map(r => r.name) : [''];
}

async function colourOr404(tx, productId, colourId) {
  const id = Number(colourId);
  if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) throw fail(400, 'Bad colour.');
  const c = await tx.one('SELECT * FROM product_colours WHERE id = $1 AND product_id = $2 FOR UPDATE', [id, productId]);
  if (!c) throw fail(404, 'That colour does not exist.');
  return c;
}

// Shown on the product page as plain text; line breaks kept, blank allowed.
const cleanDescription = (v) => cleanText(v, { label: 'Description', max: 2000, allowEmpty: true });
const cleanDetails = (v) => cleanText(v, { label: 'Details and care', max: 1000, allowEmpty: true });

/** When a drop goes on sale: an ISO time, or null for "as soon as it is on sale". */
function cleanAvailableAt(v) {
  if (v === null || v === '') return null;
  const d = new Date(v);
  if (typeof v !== 'string' || Number.isNaN(d.getTime())) throw fail(400, 'That drop time is not a date.');
  if (d.getTime() > Date.now() + 366 * 86_400_000) throw fail(400, 'Choose a drop time within a year.');
  return d.toISOString();
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
  const description = 'description' in b ? cleanDescription(b.description) : '';
  const details = 'details' in b ? cleanDetails(b.details) : '';
  const sizes = Array.isArray(b.sizes) && b.sizes.length ? b.sizes.map(cleanSize) : ['ONE SIZE'];
  if (new Set(sizes).size !== sizes.length) throw fail(400, 'Each size can only be listed once.');
  if (sizes.length > 12) throw fail(400, 'That is more sizes than a product needs.');

  const id = await transaction(async (tx) => {
    const id = await newId(tx, name);
    const { next } = await tx.one('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM products');
    await tx.query(`
      INSERT INTO products (id, name, price_kobo, img, badge, in_drop, featured, in_essentials, hidden, position,
                            description, details)
      VALUES ($1, $2, $3, '', $4, TRUE, TRUE, FALSE, TRUE, $5, $6, $7)
    `, [id, name, priceKobo, badge, next, description, details]);
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
  if ('description' in b)  set('description', cleanDescription(b.description));
  if ('details' in b)      set('details', cleanDetails(b.details));
  if ('availableAt' in b)  set('available_at', cleanAvailableAt(b.availableAt));
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
    const { n } = await tx.one('SELECT COUNT(DISTINCT size) AS n FROM variants WHERE product_id = $1', [p.id]);
    if (n >= 12) throw fail(400, 'That is more sizes than a product needs.');
    if (await tx.one('SELECT 1 FROM variants WHERE product_id = $1 AND size = $2', [p.id, size])) {
      throw fail(409, `${size} is already a size of this product.`);
    }
    // In every colour, each counted on its own, starting at 0.
    for (const colour of await colourNames(tx, p.id)) {
      await tx.query('INSERT INTO variants (product_id, colour, size, stock) VALUES ($1, $2, $3, 0)', [p.id, colour, size]);
    }
  });
  res.status(201).json(await current(req.params.id));
});

/**
 * Remove a size, in every colour. Only once its counts are zero — so a slip
 * cannot delete stock the owner has counted — and only if no unfinished order
 * is holding it. Any one of the size's stock rows names it.
 */
adminProductsRouter.delete('/admin/products/:id/sizes/:variantId', async (req, res) => {
  const variantId = Number(req.params.variantId);
  if (!Number.isInteger(variantId) || variantId < 1 || variantId > 2_147_483_647) {
    throw fail(400, 'Bad size.');
  }

  await transaction(async (tx) => {
    const p = await productOr404(req.params.id, tx);
    const v = await tx.one('SELECT id, size FROM variants WHERE id = $1 AND product_id = $2', [variantId, p.id]);
    if (!v) throw fail(404, 'That size does not exist.');
    const rows = await tx.query('SELECT id, colour, stock FROM variants WHERE product_id = $1 AND size = $2 FOR UPDATE',
      [p.id, v.size]);
    const counted = rows.find(r => r.stock > 0);
    if (counted) {
      throw fail(409, `Set the ${counted.colour ? `${counted.colour} ` : ''}${v.size} count to 0 first.`);
    }

    if (await heldByPayment(tx, rows.map(r => r.id))) {
      throw fail(409, `Someone is paying for a ${v.size} right now. Try again in half an hour.`);
    }

    const { n } = await tx.one('SELECT COUNT(DISTINCT size) AS n FROM variants WHERE product_id = $1', [p.id]);
    if (n <= 1 && !p.hidden) throw fail(409, 'A product on sale needs at least one size. Take it off sale first.');

    await tx.query('DELETE FROM variants WHERE product_id = $1 AND size = $2', [p.id, v.size]);
  });

  res.json(await current(req.params.id));
});

/* -------------------------------------------------------------- colours */

/**
 * Add a colour. The first one takes over the stock already counted, so naming
 * the colour of a product already on sale loses nothing. Each colour after it
 * gets every size, counted from 0.
 */
adminProductsRouter.post('/admin/products/:id/colours', async (req, res) => {
  const name = cleanColourName(req.body?.name);
  const hex = cleanHex(req.body?.hex);
  await transaction(async (tx) => {
    const p = await productOr404(req.params.id, tx);
    await tx.one('SELECT id FROM products WHERE id = $1 FOR UPDATE', [p.id]);
    const existing = await tx.query('SELECT name FROM product_colours WHERE product_id = $1', [p.id]);
    if (existing.length >= MAX_COLOURS) throw fail(400, `A product can have ${MAX_COLOURS} colours.`);
    if (existing.some(c => c.name === name)) throw fail(409, `${name} is already a colour of this product.`);

    const { next } = await tx.one(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM product_colours WHERE product_id = $1', [p.id]);
    await tx.query('INSERT INTO product_colours (product_id, name, hex, position) VALUES ($1, $2, $3, $4)',
      [p.id, name, hex, next]);

    if (!existing.length) {
      await tx.query("UPDATE variants SET colour = $1 WHERE product_id = $2 AND colour = ''", [name, p.id]);
      await tx.query("UPDATE stock_alerts SET colour = $1 WHERE product_id = $2 AND colour = ''", [name, p.id]);
    } else {
      const sizes = await tx.query(`
        SELECT size FROM variants WHERE product_id = $1 GROUP BY size ORDER BY MIN(id)`, [p.id]);
      for (const { size } of sizes) {
        await tx.query('INSERT INTO variants (product_id, colour, size, stock) VALUES ($1, $2, $3, 0)', [p.id, name, size]);
      }
    }
  });
  res.status(201).json(await current(req.params.id));
});

/** Rename a colour or change its swatch. Past orders keep the name they were sold under. */
adminProductsRouter.patch('/admin/products/:id/colours/:colourId', async (req, res) => {
  const b = req.body ?? {};
  if (!('name' in b) && !('hex' in b)) throw fail(400, 'Nothing to change.');
  await transaction(async (tx) => {
    const p = await productOr404(req.params.id, tx);
    const c = await colourOr404(tx, p.id, req.params.colourId);
    if ('hex' in b) await tx.query('UPDATE product_colours SET hex = $1 WHERE id = $2', [cleanHex(b.hex), c.id]);
    if ('name' in b) {
      const name = cleanColourName(b.name);
      if (name === c.name) return;
      if (await tx.one('SELECT 1 FROM product_colours WHERE product_id = $1 AND name = $2', [p.id, name])) {
        throw fail(409, `${name} is already a colour of this product.`);
      }
      await tx.query('UPDATE product_colours SET name = $1 WHERE id = $2', [name, c.id]);
      await tx.query('UPDATE variants SET colour = $1 WHERE product_id = $2 AND colour = $3', [name, p.id, c.name]);
      await tx.query('UPDATE stock_alerts SET colour = $1 WHERE product_id = $2 AND colour = $3', [name, p.id, c.name]);
    }
  });
  res.json(await current(req.params.id));
});

/**
 * Remove a colour. Like a size: only once its counts are zero and nobody is
 * paying for it. Removing the last colour leaves the product sold by size
 * alone, keeping that colour's counts.
 */
adminProductsRouter.delete('/admin/products/:id/colours/:colourId', async (req, res) => {
  await transaction(async (tx) => {
    const p = await productOr404(req.params.id, tx);
    const c = await colourOr404(tx, p.id, req.params.colourId);
    const { n } = await tx.one('SELECT COUNT(*) AS n FROM product_colours WHERE product_id = $1', [p.id]);
    const rows = await tx.query('SELECT id, size, stock FROM variants WHERE product_id = $1 AND colour = $2 FOR UPDATE',
      [p.id, c.name]);

    if (n > 1) {
      const counted = rows.find(r => r.stock > 0);
      if (counted) throw fail(409, `Set the ${c.name} counts to 0 first (${counted.size} has ${counted.stock}).`);
      if (await heldByPayment(tx, rows.map(r => r.id))) {
        throw fail(409, `Someone is paying for a ${c.name} one right now. Try again in half an hour.`);
      }
      await tx.query('DELETE FROM variants WHERE product_id = $1 AND colour = $2', [p.id, c.name]);
      await tx.query('DELETE FROM stock_alerts WHERE product_id = $1 AND colour = $2', [p.id, c.name]);
    } else {
      await tx.query("UPDATE variants SET colour = '' WHERE product_id = $1 AND colour = $2", [p.id, c.name]);
      await tx.query("UPDATE stock_alerts SET colour = '' WHERE product_id = $1 AND colour = $2", [p.id, c.name]);
    }
    await tx.query('DELETE FROM product_colours WHERE id = $1', [c.id]);
    if (c.image_id) await tx.query('DELETE FROM images WHERE id = $1', [c.image_id]);
  });
  res.json(await current(req.params.id));
});

/** Take a colour's own photo away; the product's main photo shows for it again. */
adminProductsRouter.delete('/admin/products/:id/colours/:colourId/image', async (req, res) => {
  await transaction(async (tx) => {
    const p = await productOr404(req.params.id, tx);
    const c = await colourOr404(tx, p.id, req.params.colourId);
    if (!c.image_id) return;
    await tx.query('UPDATE product_colours SET image_id = NULL WHERE id = $1', [c.id]);
    await tx.query('DELETE FROM images WHERE id = $1', [c.image_id]);
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

/** Remove one of the extra gallery photos. */
adminProductsRouter.delete('/admin/products/:id/photos/:photoId', async (req, res) => {
  const photoId = Number(req.params.photoId);
  if (!Number.isInteger(photoId) || photoId < 1 || photoId > 2_147_483_647) throw fail(400, 'Bad photo.');
  await transaction(async (tx) => {
    const p = await productOr404(req.params.id, tx);
    const row = await tx.one('DELETE FROM product_photos WHERE id = $1 AND product_id = $2 RETURNING image_id',
      [photoId, p.id]);
    if (!row) throw fail(404, 'That photo is already gone.');
    await tx.query('DELETE FROM images WHERE id = $1', [row.image_id]);
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

/** The ordinary and the double-width copy of one photo, checked. */
function bothSizes(body) {
  const small = decodePhoto(body?.image, 'standard');
  const large = decodePhoto(body?.image2x, 'sharp-screen');
  if (small.mime !== large.mime) throw fail(400, 'The two sizes of the photo do not match.');
  return { small, large };
}

const uploadBody = express.json({ limit: Math.ceil(MAX_IMAGE_BYTES * 2 * 1.4) });   // two photos, base64

adminUploadRouter.post(
  '/admin/products/:id/image',
  requireAdmin,
  uploadBody,
  async (req, res) => {
    const { small, large } = bothSizes(req.body);
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

/** Add a photo to the product page's gallery, after the main one. */
adminUploadRouter.post('/admin/products/:id/photos', requireAdmin, uploadBody, async (req, res) => {
  const { small, large } = bothSizes(req.body);
  await transaction(async (tx) => {
    const p = await tx.one('SELECT id FROM products WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!p) throw fail(404, 'That product does not exist.');
    const { n } = await tx.one('SELECT COUNT(*) AS n FROM product_photos WHERE product_id = $1', [p.id]);
    if (n >= MAX_EXTRA_PHOTOS) throw fail(409, `A product can have ${MAX_EXTRA_PHOTOS} extra photos. Remove one first.`);
    const { id } = await tx.one(
      'INSERT INTO images (mime, data, data_2x) VALUES ($1, $2, $3) RETURNING id',
      [small.mime, small.bytes, large.bytes]);
    const { next } = await tx.one(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM product_photos WHERE product_id = $1', [p.id]);
    await tx.query('INSERT INTO product_photos (product_id, image_id, position) VALUES ($1, $2, $3)',
      [p.id, id, next]);
  });
  res.status(201).json(await current(req.params.id));
});

/** A colour's own photo: shown first on the product page when it is picked. */
adminUploadRouter.post('/admin/products/:id/colours/:colourId/image', requireAdmin, uploadBody, async (req, res) => {
  const { small, large } = bothSizes(req.body);
  await transaction(async (tx) => {
    const p = await productOr404(req.params.id, tx);
    const c = await colourOr404(tx, p.id, req.params.colourId);
    const { id } = await tx.one(
      'INSERT INTO images (mime, data, data_2x) VALUES ($1, $2, $3) RETURNING id',
      [small.mime, small.bytes, large.bytes]);
    await tx.query('UPDATE product_colours SET image_id = $1 WHERE id = $2', [id, c.id]);
    if (c.image_id) await tx.query('DELETE FROM images WHERE id = $1', [c.image_id]);
  });
  res.json(await current(req.params.id));
});

/* ------------------------------------------------------- home page photos */

function slotOr404(slot) {
  if (!HOME_SLOTS.includes(slot)) throw fail(404, 'There is no photo there.');
  return slot;
}

/** Replace one of the three wide home-page photos. The one it replaces is deleted. */
adminUploadRouter.post('/admin/home/image/:slot', requireAdmin, uploadBody, async (req, res) => {
  const slot = slotOr404(req.params.slot);
  const { small, large } = bothSizes(req.body);
  await transaction(async (tx) => {
    const { id } = await tx.one(
      'INSERT INTO images (mime, data, data_2x) VALUES ($1, $2, $3) RETURNING id',
      [small.mime, small.bytes, large.bytes]);
    const previous = await setHomeImage(tx, slot, id);
    if (previous) await tx.query('DELETE FROM images WHERE id = $1', [previous]);
  });
  res.json({ ok: true });
});

/** Go back to the photo the site shipped with. */
adminProductsRouter.delete('/admin/home/image/:slot', requireAdmin, async (req, res) => {
  const slot = slotOr404(req.params.slot);
  await transaction(async (tx) => {
    const previous = await setHomeImage(tx, slot, null);
    if (previous) await tx.query('DELETE FROM images WHERE id = $1', [previous]);
  });
  res.json({ ok: true });
});
