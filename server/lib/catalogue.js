import { query } from '../db.js';

/* How a product row becomes what the storefront and the admin see.
 *
 * One function for both, so the admin's preview of a product is exactly what
 * a customer will be shown — the same photo address, the same sold-out rule. */

/** Above this, the exact count is nobody's business but the owner's. */
const SHOW_COUNT_BELOW = 10;

/** The two addresses of a product's photo: ordinary and double-width. */
export function photoUrls(p) {
  if (p.image_id) {
    return { img: `/api/images/${p.image_id}`, img2x: `/api/images/${p.image_id}/2x` };
  }
  if (p.img) {
    // Built-in photos ship with an @2x twin beside them.
    return { img: p.img, img2x: p.img.replace(/\.(webp|jpe?g|png)$/i, '@2x.$1') };
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
           hidden, position
      FROM products
     ${forAdmin ? '' : 'WHERE hidden = FALSE'}
     ORDER BY position, id
  `);
  const variants = await query('SELECT id, product_id, size, stock FROM variants ORDER BY id');

  return products.map(p => {
    const sizes = variants.filter(v => v.product_id === p.id);
    const { img, img2x } = photoUrls(p);
    const base = {
      id: p.id,
      name: p.name,
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
        hidden: p.hidden,
        hasUpload: Boolean(p.image_id),
        hasBuiltInPhoto: Boolean(p.img),
        sizes: sizes.map(s => ({ variantId: s.id, size: s.size, stock: s.stock }))
      };
    }
    return {
      ...base,
      sizes: sizes.map(s => ({
        size: s.size,
        available: s.stock > 0,
        left: s.stock > 0 && s.stock < SHOW_COUNT_BELOW ? s.stock : null
      }))
    };
  });
}
