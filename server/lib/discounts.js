/* Discount codes: what one is worth, whether it can be used, and holding a
 * use while the customer pays.
 *
 * A code takes money off the ITEMS, never the delivery. Its value is worked
 * out here from the order the server has priced — the browser only sends the
 * code it was given. */

const MIN_ITEMS_KOBO = 100_00;   // a code never takes the items below ₦100

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

/** "masq10 " → "MASQ10". Letters, digits, - and _ only. */
export function cleanCode(v) {
  const code = String(v ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw fail(400, 'That code is not valid.');
  return code;
}

/** What a code takes off these items, in kobo — whole naira, never more than allowed. */
export function discountFor(row, subtotalKobo) {
  const raw = row.kind === 'percent'
    ? Math.floor((subtotalKobo * row.amount) / 100 / 100) * 100
    : row.amount;
  return Math.max(0, Math.min(raw, subtotalKobo - MIN_ITEMS_KOBO));
}

/** How the code reads in the bag and the admin: "10% off", "₦5,000 off". */
export function describe(row) {
  return row.kind === 'percent'
    ? `${row.amount}% off`
    : `₦${(row.amount / 100).toLocaleString('en-NG')} off`;
}

const naira = (kobo) => `₦${(kobo / 100).toLocaleString('en-NG')}`;

/**
 * Check a code against an order's items and return { code, discountKobo, label }.
 * With `hold`, one use is taken in the same statement that checks the limit,
 * so two customers cannot both take the last use. Throws a 400 with the
 * reason a customer can act on.
 */
export async function applyCode(tx, rawCode, subtotalKobo, { hold = false } = {}) {
  const code = cleanCode(rawCode);
  const row = await tx.one('SELECT * FROM discount_codes WHERE code = $1', [code]);
  const unknown = fail(400, `${code} is not a code we recognise.`);
  if (!row || !row.active) throw unknown;
  if (row.ends_at && new Date(row.ends_at) <= new Date()) throw fail(400, `${code} has ended.`);
  if (subtotalKobo < row.min_spend_kobo) {
    throw fail(400, `${code} is for orders of ${naira(row.min_spend_kobo)} or more, before delivery.`);
  }
  const discountKobo = discountFor(row, subtotalKobo);
  if (discountKobo <= 0) throw fail(400, `${code} does not take anything off this bag.`);

  if (hold) {
    const held = await tx.one(`
      UPDATE discount_codes SET uses = uses + 1
       WHERE code = $1 AND (max_uses IS NULL OR uses < max_uses)
      RETURNING uses
    `, [code]);
    if (!held) throw fail(400, `${code} has been used up.`);
  } else if (row.max_uses !== null && row.uses >= row.max_uses) {
    throw fail(400, `${code} has been used up.`);
  }

  return { code, discountKobo, label: describe(row) };
}

/** Give back a held use: the order it was held for will not be paid. */
export async function releaseCode(tx, code) {
  if (!code) return;
  await tx.query('UPDATE discount_codes SET uses = GREATEST(uses - 1, 0) WHERE code = $1', [code]);
}

/** Take a use again, without the limit: the customer has already paid. */
export async function retakeCode(tx, code) {
  if (!code) return;
  await tx.query('UPDATE discount_codes SET uses = uses + 1 WHERE code = $1', [code]);
}
