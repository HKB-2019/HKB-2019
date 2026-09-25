/* Seeds the catalogue. Prices here are the single source of truth for what a
 * customer is charged — the browser's copy is only ever for display. */
import { transaction, close } from './db.js';

/* Reproduces the storefront as designed: four featured pieces, four more
 * behind VIEW ALL, and the Essentials carousel as its own selection (the pod
 * shell is carousel-only; the tee is grid-only). */
const CATALOGUE = [
  { id:'tee',      name:'THE FACE TEE',         naira:28000, img:'assets/img/prod-tee.webp',      drop:1, featured:1, essential:0, sizes:{ S:12, M:18, L:14, XL:6 } },
  { id:'cap',      name:'THE MARK CAP',         naira:14000, img:'assets/img/prod-cap.webp',      drop:1, featured:1, essential:1, sizes:{ 'ONE SIZE':30 } },
  { id:'backpack', name:'THE CARRIER BACKPACK', naira:65000, img:'assets/img/prod-backpack.webp', drop:1, featured:1, essential:1, sizes:{ 'ONE SIZE':8 } },
  { id:'scarf',    name:'THE PATTERN SCARF',    naira:18000, img:'assets/img/prod-scarf.webp',    drop:1, featured:1, essential:1, sizes:{ 'ONE SIZE':22 } },
  { id:'hoodie',   name:'THE RITUAL HOODIE',    naira:52000, img:'assets/img/ess-hoodie.webp',    drop:1, featured:0, essential:1, sizes:{ S:5, M:9, L:7, XL:3 } },
  { id:'jacket',   name:'THE SYMBOL JACKET',    naira:98000, img:'assets/img/ess-jacket.webp',    drop:1, featured:0, essential:1, sizes:{ M:2, L:3, XL:1 }, badge:'LIMITED' },
  { id:'wallet',   name:'THE ARTIFACT WALLET',  naira:22000, img:'assets/img/ess-wallet.webp',    drop:1, featured:0, essential:1, sizes:{ 'ONE SIZE':16 } },
  { id:'phone',    name:'THE MASK CASE',        naira:12000, img:'assets/img/ess-phone.webp',     drop:1, featured:0, essential:1, sizes:{ 'ONE SIZE':0 } },
  { id:'airpods',  name:'THE POD SHELL',        naira:9000,  img:'assets/img/ess-airpods.webp',   drop:0, featured:0, essential:1, sizes:{ 'ONE SIZE':24 } }
];

export async function seed({ reset = false } = {}) {
  await transaction(async (tx) => {
    if (reset) {
      // RESTART IDENTITY so ids start from 1 again, which keeps tests stable.
      // Settings (the admin password among them) survive a reset on purpose.
      await tx.query(`TRUNCATE order_items, orders, customers, webhook_events, variants, products,
                               images, subscribers
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

      for (const [size, stock] of Object.entries(p.sizes)) {
        await tx.query(`
          INSERT INTO variants (product_id, size, stock) VALUES ($1, $2, $3)
          ON CONFLICT (product_id, size) DO UPDATE SET stock = EXCLUDED.stock
        `, [p.id, size, stock]);
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
