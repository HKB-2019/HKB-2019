/* Checks shared by every route that takes them, so they cannot drift apart. */

/** An email address worth sending to: something@somewhere.tld, at most 254 characters. */
export const isEmail = (v) => typeof v === 'string' && v.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Lower-cased and trimmed, the form an email is stored and compared in. */
export const normEmail = (v) => String(v ?? '').trim().toLowerCase();
