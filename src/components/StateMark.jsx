import { Check, Close } from './Icons.jsx';

/* The ringed tick (it worked) or cross (it did not) from the owner's design
 * for messages, used on toasts, the "added to bag" panel and the order page.
 * Decoration only: the words beside it say the same. */
export default function StateMark({ tone, size }) {
  if (tone !== 'ok' && tone !== 'bad') return null;
  return (
    <span className={`state-mark state-mark--${tone}${size === 'lg' ? ' state-mark--lg' : ''}`} aria-hidden="true">
      {tone === 'ok' ? <Check /> : <Close />}
    </span>
  );
}
