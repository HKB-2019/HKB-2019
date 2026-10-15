import { query } from '../db.js';

/* How a product row becomes what the storefront and the admin see.
 *
 * One function for both, so the admin's preview of a product is exactly what
 * a customer will be shown — the same photo address, the same sold-out rule. */

/**
 * The SQL test for "a customer can see and buy this": not taken off sale,
 * and its drop time, if it has one, has come. `p` is the products alias.
 */
export const onSale = (p = 'p') => `${p}.hidden = FALSE AND (${p}.available_at IS NULL OR ${p}.available_at <= now())`;

/** Above this, the exact count is nobody's business but the owner's. */
const SHOW_COUNT_BELOW = 10;

/** The two addresses of a product's photo: ordinary and double-width. */
export function photoUrls(p) {
  if (p.image_id) {
    return { img: `/api/images/${p.image_id}`, img2x: `/api/images/${p.image_id}/2x` };
  }
  if (p.img) {
    // Built-in photos ship with an @2x twin beside them. Addressed from the
    // site's root, so they load from a product page's address too.
    const img = '/' + p.img.replace(/^\/+/, '');
    return { img, img2x: img.replace(/\.(webp|jpe?g|png)$/i, '@2x.$1') };
  }
  return { img: '', img2x: '' };
}

/**
 * Products with their sizes, in display order.
 *
 *   forAdmin false  on-sale products only; stock shown only when it is low,
 *                   which is all a customer needs ("only 2 left") and all a
 *                   competitor's scraper should get.
 *   forAdmin true   everything, with exact counts.
 */
export async function loadProducts({ forAdmin = false } = {}) {
  const products = await query(`
    SELECT id, name, price_kobo, img, image_id, badge, in_drop, featured, in_essentials,
           hidden, position, description, details, available_at
      FROM products p
     ${forAdmin ? '' : `WHERE ${onSale()}`}
     ORDER BY position, id
  `);
  const variants = await query('SELECT id, product_id, colour, size, stock FROM variants ORDER BY id');
  const extras = await query('SELECT id, product_id, image_id FROM product_photos ORDER BY position, id');
  const colourRows = await query('SELECT id, product_id, name, hex, image_id, img FROM product_colours ORDER BY position, id');

  return products.map(p => {
    const sizes = variants.filter(v => v.product_id === p.id);
    const colours = colourRows.filter(c => c.product_id === p.id);
    // Each size once, in the order first added, whatever the colour.
    const sizeNames = [...new Set(sizes.map(s => s.size))];
    const shopSize = (rows) => sizeNames.map(size => {
      const stock = rows.filter(r => r.size === size).reduce((n, r) => n + Math.max(0, r.stock), 0);
      return { size, available: stock > 0, left: stock > 0 && stock < SHOW_COUNT_BELOW ? stock : null };
    });
    // A colour's own photo: an upload, else one that shipped with the site.
    const colourPhoto = (c) => (c.image_id || c.img ? photoUrls(c) : { img: null, img2x: null });
    const { img, img2x } = photoUrls(p);
    const more = extras.filter(x => x.product_id === p.id);
    // The gallery: the main photo first, then the extra ones in order.
    const photos = [
      ...(img ? [{ img, img2x }] : []),
      ...more.map(x => ({ id: x.id, img: `/api/images/${x.image_id}`, img2x: `/api/images/${x.image_id}/2x` }))
    ];
    const base = {
      id: p.id,
      name: p.name,
      description: p.description,
      details: p.details,
      photos,
      price: p.price_kobo / 100,          // naira, for display only
      priceKobo: p.price_kobo,
      img, img2x,
      badge: p.badge ?? null,
      inDrop: p.in_drop,
      featured: p.featured,
      inEssentials: p.in_essentials,
      soldOut: sizes.length === 0 || sizes.every(s => s.stock <= 0)
    };

    if (forAdmin) {
      return {
        ...base,
        colours: colours.map(c => ({ id: c.id, name: c.name, hex: c.hex, ...colourPhoto(c), hasPhoto: Boolean(c.image_id) })),
        hidden: p.hidden,
        // A drop time still to come; null once it has passed or if there is none.
        availableAt: p.available_at && new Date(p.available_at) > new Date() ? new Date(p.available_at).toISOString() : null,
        hasUpload: Boolean(p.image_id),
        hasBuiltInPhoto: Boolean(p.img),
        sizes: sizes.map(s => ({ variantId: s.id, colour: s.colour || null, size: s.size, stock: s.stock }))
      };
    }
    // Colours, each with its own sizes. A product without colours has an
    // empty list and is bought by size alone. `sizes` is any colour's.
    const shopColours = colours.map(c => {
      const own = shopSize(sizes.filter(s => s.colour === c.name));
      return { name: c.name, hex: c.hex, ...colourPhoto(c), soldOut: own.every(s => !s.available), sizes: own };
    });
    return { ...base, colours: shopColours, sizes: shopSize(sizes) };
  });
}
