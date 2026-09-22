/* Money is integer kobo everywhere on the server. It only becomes a decimal
 * when it is shown to a person, and it is never parsed back from one. */

export const nairaToKobo = (naira) => Math.round(naira * 100);

export function formatNaira(kobo) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/** Reject anything that is not a whole, positive, sane number of kobo. */
export function assertKobo(value, label = 'amount') {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer number of kobo, got ${value}`);
  }
  if (value > 1_000_000_00) {          // ₦1,000,000 — a guard, not a business rule
    throw new Error(`${label} of ${value} kobo is implausibly large; refusing`);
  }
  return value;
}
