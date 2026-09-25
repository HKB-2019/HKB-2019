/* Prices can be shown in other currencies as a guide. Payment is always in
 * naira — Paystack charges NGN — and the bag says so whenever another
 * currency is selected. These rates are approximate and set by hand. */

export const CURRENCIES = {
  NGN: { symbol:'₦', rate:1,      decimals:0 },
  USD: { symbol:'$', rate:1/1550, decimals:2 },
  GBP: { symbol:'£', rate:1/1980, decimals:2 },
  EUR: { symbol:'€', rate:1/1690, decimals:2 }
};
