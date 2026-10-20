import { useState } from 'react';

/* A password box with an eye to show what was typed, for checking a long
 * password on a phone. Shown text goes back to dots when the form is sent. */

const Eye = ({ open }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
    {!open && <path d="M4 20 20 4" />}
  </svg>
);

export default function PasswordInput({ className = '', ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="password">
      <input {...props} type={shown ? 'text' : 'password'} className={className}
             autoCapitalize="off" autoCorrect="off" spellCheck="false"
             onKeyDown={(e) => { if (e.key === 'Enter') setShown(false); props.onKeyDown?.(e); }} />
      <button type="button" className="password__eye" aria-pressed={shown}
              aria-label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown(v => !v)}>
        <Eye open={!shown} />
      </button>
    </span>
  );
}
