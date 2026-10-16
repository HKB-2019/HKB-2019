/* Seeds the catalogue. Prices here are the single source of truth for what a
 * customer is charged — the browser's copy is only ever for display. */
import { transaction, close } from './db.js';
import { CATALOGUE } from '../src/data/catalogue.js';

export async function seed({ reset = false } = {}) {
  await transaction(async (tx) => {
    if (reset) {
      // RESTART IDENTITY so ids start from 1 again, which keeps tests stable.
      // Settings (the admin password among them) survive a reset on purpose —
      // except the home page's photos, which live in the images being emptied.
      await tx.query("DELETE FROM settings WHERE key = 'home_images'");
      await tx.query(`TRUNCATE order_items, orders, customers, webhook_events, variants,
                               product_colours, product_photos, products, images, subscribers,
                               discount_codes, stock_alerts, stock_log, events, analytics_daily,
                               gift_card_uses, gift_cards
                      RESTART IDENTITY CASCADE`);
    }

    for (const [position, p] of CATALOGUE.entries()) {
      await tx.query(`
        INSERT INTO products (id, name, price_kobo, img, badge, in_drop, featured, in_essentials, hidden, position)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, price_kobo = EXCLUDED.price_kobo, img = EXCLUDED.img,
          badge = EXCLUDED.badge, in_drop = EXCLUDED.in_drop, featured = EXCLUDED.featured,
          in_essentials = EXCLUDED.in_essentials, hidden = FALSE, position = EXCLUDED.position
      `, [p.id, p.name, Math.round(p.naira * 100), p.img, p.badge ?? null,
          Boolean(p.drop), Boolean(p.featured), Boolean(p.essential), position]);

      const colours = p.colours ?? [{ name: '', sizes: p.sizes }];
      for (const [i, c] of colours.entries()) {
        if (c.name) {
          await tx.query(`
            INSERT INTO product_colours (product_id, name, hex, position, img) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (product_id, name) DO UPDATE SET hex = EXCLUDED.hex, position = EXCLUDED.position, img = EXCLUDED.img
          `, [p.id, c.name, c.hex, i, c.img ?? '']);
        }
        for (const [size, stock] of Object.entries(c.sizes)) {
          await tx.query(`
            INSERT INTO variants (product_id, colour, size, stock) VALUES ($1, $2, $3, $4)
            ON CONFLICT (product_id, colour, size) DO UPDATE SET stock = EXCLUDED.stock
          `, [p.id, c.name, size, stock]);
        }
      }
    }
  });
  return CATALOGUE.length;
}

if (process.argv[1] && process.argv[1].endsWith('server/seed.js')) {
  // Seeding overwrites every stock count with the numbers above, and --reset
  // deletes every order. Neither belongs anywhere near a live shop.
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed in production: it would overwrite live stock counts.');
    process.exit(1);
  }
  const n = await seed({ reset: process.argv.includes('--reset') });
  console.log(`seeded ${n} products`);
  await close();
}
