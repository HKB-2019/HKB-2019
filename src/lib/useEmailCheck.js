import { useState } from 'react';
import { isEmail } from './delivery.js';

/* The owner's field states for an email box: nothing until they leave the
 * box with something in it, then "Looks good!" (ok) or "Please enter a valid
 * email address." (bad), kept up to date as they go on typing. Spread `input`
 * on the box and show `note` under it (FieldNote). */
export const EMAIL_OK = 'Looks good!';
export const EMAIL_BAD = 'Please enter a valid email address.';

export function useEmailCheck(value) {
  const [seen, setSeen] = useState(false);
  const filled = String(value ?? '').trim() !== '';
  const state = seen && filled ? (isEmail(value) ? 'ok' : 'bad') : null;
  return {
    state,
    reset: () => setSeen(false),
    input: {
      onBlur: () => { if (filled) setSeen(true); },
      className: state === 'ok' ? 'is-valid' : state === 'bad' ? 'is-error' : undefined,
      'aria-invalid': state === 'bad' || undefined
    }
  };
}
