-- MASQ. shop schema
--
-- Money is stored in KOBO as integers, never naira as floats. 0.1 + 0.2 is not
-- 0.3 in binary floating point, and a shop that rounds a fraction of a kobo per
-- line eventually disagrees with its payment provider about what it charged.
-- Paystack's API also takes and returns kobo, so this keeps one unit end to end.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  price_kobo  INTEGER NOT NULL CHECK (price_kobo > 0),
  img         TEXT    NOT NULL,
  badge       TEXT,
  is_extra    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One row per sellable thing. A size is not a property of a product, it is a
-- separate thing with its own stock count — "THE FACE TEE" is never in stock,
-- "THE FACE TEE, size M" is.
CREATE TABLE IF NOT EXISTS variants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  TEXT    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size        TEXT    NOT NULL,
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  UNIQUE (product_id, size)
);

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL UNIQUE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- status: pending -> paid | failed | abandoned
-- Stock is held at `pending` and only released back on failure, so two people
-- cannot both buy the last jacket while one of them is still on Paystack's page.
CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reference      TEXT    NOT NULL UNIQUE,
  customer_id    INTEGER REFERENCES customers(id),
  email          TEXT    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','paid','failed','abandoned')),
  subtotal_kobo  INTEGER NOT NULL CHECK (subtotal_kobo > 0),
  currency       TEXT    NOT NULL DEFAULT 'NGN',
  paystack_id    TEXT,
  paid_at        TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Line items keep their own copy of name and price. A product's price may
-- change next week; what this customer was charged must not.
CREATE TABLE IF NOT EXISTS order_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      TEXT    NOT NULL,
  variant_id      INTEGER NOT NULL,
  name            TEXT    NOT NULL,
  size            TEXT    NOT NULL,
  unit_price_kobo INTEGER NOT NULL CHECK (unit_price_kobo > 0),
  qty             INTEGER NOT NULL CHECK (qty > 0)
);

-- Every webhook Paystack sends, recorded before it is acted on. Paystack
-- retries, so the same event arrives more than once; this table is what makes
-- handling it idempotent.
CREATE TABLE IF NOT EXISTS webhook_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     TEXT    NOT NULL UNIQUE,
  event_type   TEXT    NOT NULL,
  reference    TEXT,
  payload      TEXT    NOT NULL,
  processed_at TEXT,
  received_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_reference  ON orders(reference);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_items_order       ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_variants_product  ON variants(product_id);
