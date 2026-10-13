/* Prices can be shown in other currencies as a guide. Payment is always in
 * naira — Paystack charges NGN — and the bag says so whenever another
 * currency is selected.
 *
 * The rates are set by the owner in the admin (Settings → Price guide), as
 * "naira for one dollar" and so on. These are the starting values, until
 * the owner saves their own. */

export const GUIDE_CURRENCIES = ['USD', 'GBP', 'EUR'];

/** Naira for one unit of each currency. */
export const DEFAULT_RATES = { USD: 1550, GBP: 1980, EUR: 1690 };

const SYMBOLS = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };

/** The currency menu, with each rate as "multiply naira by this". */
export function currencies(rates = DEFAULT_RATES) {
  const out = { NGN: { symbol: '₦', rate: 1, decimals: 0 } };
  for (const c of GUIDE_CURRENCIES) {
    out[c] = { symbol: SYMBOLS[c], rate: 1 / (rates?.[c] || DEFAULT_RATES[c]), decimals: 2 };
  }
  return out;
}

export const CURRENCIES = currencies();
