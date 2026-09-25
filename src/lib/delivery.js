/* The browser's copy of the delivery rules, so the customer sees the fee for
 * their address before they press pay. The server decides the real fee from
 * the same rules (server/lib/settings.js) and never reads this one's answer. */

export function zoneFor({ country, state }) {
  const c = String(country ?? '').trim().toLowerCase();
  if (c !== 'nigeria' && c !== 'ng') return 'international';
  const s = String(state ?? '').trim().toLowerCase().replace(/\s+state$/, '');
  if (s === 'lagos') return 'lagos';
  if (['abuja', 'fct', 'federal capital territory', 'abuja (fct)', 'fct abuja'].includes(s)) return 'abuja';
  return 'nigeria';
}

export const naira = (kobo) => '₦' + Math.round(kobo / 100).toLocaleString('en-NG');

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim());

export const isPhone = (v) => {
  const s = String(v ?? '').trim();
  const digits = s.replace(/\D/g, '');
  return /^\+?[\d\s()-]+$/.test(s) && digits.length >= 7 && digits.length <= 15;
};
