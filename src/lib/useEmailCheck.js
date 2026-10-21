import { useState } from 'react';
import { isEmail } from './delivery.js';

/* The owner's field states for an email box: nothing until they leave the
 * box with something in it, then "Looks good!" (ok), "Please enter a valid
 * email address." (bad), or, for a real-looking address with a likely slip
 * in it (gmial.com), an amber "Did you mean …?" (warn) — kept up to date as
 * they go on typing. Spread `input` on the box and show the note under it
 * (FieldNote). */
export const EMAIL_OK = 'Looks good!';
export const EMAIL_BAD = 'Please enter a valid email address.';

// Slips seen on the addresses people mean most often.
const SLIPS = {
  'gmail.com': ['gmial.com', 'gamil.com', 'gmai.com', 'gmal.com', 'gmaill.com', 'gnail.com', 'gmail.co', 'gmail.con', 'gmail.cm', 'gmail.om', 'gmaik.com'],
  'yahoo.com': ['yaho.com', 'yahooo.com', 'yhoo.com', 'yaoo.com', 'yahoo.con', 'yahoo.cm', 'yahho.com'],
  'hotmail.com': ['hotmial.com', 'hotmal.com', 'hotmai.com', 'hotmail.con', 'hotmil.com', 'hotmali.com'],
  'outlook.com': ['outlok.com', 'outllok.com', 'outlook.con', 'outloo.com'],
  'icloud.com': ['iclod.com', 'icloud.con', 'icoud.com', 'iclud.com']
};
const FIX = Object.fromEntries(Object.entries(SLIPS).flatMap(([right, wrongs]) => wrongs.map(w => [w, right])));

/** The address they probably meant, or null. */
export function suggestEmail(value) {
  const v = String(value ?? '').trim();
  const at = v.lastIndexOf('@');
  if (at < 1 || !isEmail(v)) return null;
  const domain = v.slice(at + 1).toLowerCase();
  const fixed = FIX[domain] ?? (domain.endsWith('.con') ? domain.slice(0, -4) + '.com' : null);
  return fixed && fixed !== domain ? `${v.slice(0, at)}@${fixed}` : null;
}

export function useEmailCheck(value) {
  const [seen, setSeen] = useState(false);
  const filled = String(value ?? '').trim() !== '';
  const suggestion = suggestEmail(value);
  const state = seen && filled ? (!isEmail(value) ? 'bad' : suggestion ? 'warn' : 'ok') : null;
  return {
    state,
    suggestion: state === 'warn' ? suggestion : null,
    reset: () => setSeen(false),
    touch: () => { if (filled) setSeen(true); },
    input: {
      onBlur: () => { if (filled) setSeen(true); },
      className: state === 'ok' ? 'is-valid' : state === 'bad' ? 'is-error' : state === 'warn' ? 'is-warn' : undefined,
      'aria-invalid': state === 'bad' || undefined
    }
  };
}
