/* Seeds the catalogue. Prices here are the single source of truth for what a
 * customer is charged — the browser's copy is only ever for display. */
import { db, transaction } from './db.js';

const CATALOGUE = [
  { id:'tee',      name:'THE FACE TEE',         naira:28000, img:'assets/img/prod-tee.webp',      extra:0, sizes:{ S:12, M:18, L:14, XL:6 } },
  { id:'cap',      name:'THE MARK CAP',         naira:14000, img:'assets/img/prod-cap.webp',      extra:0, sizes:{ 'ONE SIZE':30 } },
  { id:'backpack', name:'THE CARRIER BACKPACK', naira:65000, img:'assets/img/prod-backpack.webp', extra:0, sizes:{ 'ONE SIZE':8 } },
  { id:'scarf',    name:'THE PATTERN SCARF',    naira:18000, img:'assets/img/prod-scarf.webp',    extra:0, sizes:{ 'ONE SIZE':22 } },
  { id:'hoodie',   name:'THE RITUAL HOODIE',    naira:52000, img:'assets/img/ess-hoodie.webp',    extra:1, sizes:{ S:5, M:9, L:7, XL:3 } },
  { id:'jacket',   name:'THE SYMBOL JACKET',    naira:98000, img:'assets/img/ess-jacket.webp',    extra:1, sizes:{ M:2, L:3, XL:1 }, badge:'LIMITED' },
  { id:'wallet',   name:'THE ARTIFACT WALLET',  naira:22000, img:'assets/img/ess-wallet.webp',    extra:1, sizes:{ 'ONE SIZE':16 } },
  { id:'phone',    name:'THE MASK CASE',        naira:12000, img:'assets/img/ess-phone.webp',     extra:1, sizes:{ 'ONE SIZE':0 } },
  { id:'airpods',  name:'THE POD SHELL',        naira:9000,  img:'assets/img/ess-airpods.webp',   extra:1, sizes:{ 'ONE SIZE':24 } }
];

export function seed({ reset = false } = {}) {
  transaction(() => {
    if (reset) {
      db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM variants; DELETE FROM products;');
    }
    const product = db.prepare(`
      INSERT INTO products (id, name, price_kobo, img, badge, is_extra)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, price_kobo = excluded.price_kobo,
        img = excluded.img, badge = excluded.badge, is_extra = excluded.is_extra
    `);
    const variant = db.prepare(`
      INSERT INTO variants (product_id, size, stock) VALUES (?, ?, ?)
      ON CONFLICT(product_id, size) DO UPDATE SET stock = excluded.stock
    `);

    for (const p of CATALOGUE) {
      product.run(p.id, p.name, Math.round(p.naira * 100), p.img, p.badge ?? null, p.extra);
      for (const [size, stock] of Object.entries(p.sizes)) variant.run(p.id, size, stock);
    }
  });
  return CATALOGUE.length;
}

if (process.argv[1] && process.argv[1].endsWith('server/seed.js')) {
  const n = seed({ reset: process.argv.includes('--reset') });
  console.log(`seeded ${n} products`);
}
