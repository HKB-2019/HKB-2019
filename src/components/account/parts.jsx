import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Wordmark from '../Wordmark.jsx';
import { InlineNote } from '../Notices.jsx';
import { asset } from '../../lib/media.js';
import { EASE_OUT } from '../../lib/motion.js';

/* Pieces of the owner's account screens, used by more than one of them. */

/* The split screen of the sign-in board: the form on the left, the hooded
 * photo on the right (hidden on a phone). */
export function AuthShell({ children, title, note }) {
  return (
    <div className="auth">
      <motion.div className="auth__panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE_OUT }}>
        <Link to="/" className="auth__logo"><Wordmark alt="MASQ. — back to the shop" /></Link>
        {title && <h1 className="auth__title">{title}</h1>}
        {note && <p className="auth__note">{note}</p>}
        {children}
      </motion.div>
      <div className="auth__photo" aria-hidden="true">
        <img src={asset('assets/img/countdown.webp')} alt="" />
        <p className="auth__tag"><strong>BOLD<br />BY DESIGN</strong><span>Style. People. Culture.</span></p>
      </div>
    </div>
  );
}

/* Six boxes for a six-digit code: typing moves on, Backspace moves back, a
 * pasted code fills them all, and a phone offers its one-time-code autofill. */
export function CodeInput({ value, onChange, onComplete, invalid, label = 'Verification code', autoFocus = true }) {
  const boxes = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const put = (next) => {
    const clean = next.replace(/\D/g, '').slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
    return clean;
  };
  return (
    <div className={`code-input${invalid ? ' is-error' : ''}`} role="group" aria-label={label}>
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { boxes.current[i] = el; }}
               inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={i === 0 ? 6 : 1}
               aria-label={`Digit ${i + 1}`} aria-invalid={invalid || undefined} autoFocus={autoFocus && i === 0}
               value={d}
               onChange={(e) => {
                 const typed = e.target.value.replace(/\D/g, '');
                 if (typed.length > 1) { const all = put(typed); boxes.current[Math.min(all.length, 5)]?.focus(); return; }
                 const chars = digits.slice(); chars[i] = typed;
                 put(chars.join(''));
                 if (typed && i < 5) boxes.current[i + 1]?.focus();
               }}
               onKeyDown={(e) => {
                 if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
                 if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus();
                 if (e.key === 'ArrowRight' && i < 5) boxes.current[i + 1]?.focus();
               }}
               onPaste={(e) => {
                 const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
                 if (!pasted) return;
                 e.preventDefault();
                 const all = put(pasted);
                 boxes.current[Math.min(all.length, 5)]?.focus();
               }}
               onFocus={(e) => e.target.select()} />
      ))}
    </div>
  );
}

/* How strong a new password is, from the rules the server checks (8+, a
 * letter, a number) and two that make it stronger (a symbol, 12+). */
export const passwordRules = (p) => [
  ['At least 8 characters', p.length >= 8],
  ['Contains a number', /\d/.test(p)],
  ['Contains a letter', /[A-Za-z]/.test(p)],
  ['Contains a special character', /[^A-Za-z0-9]/.test(p)]
];
export const passwordOk = (p) => p.length >= 8 && /\d/.test(p) && /[A-Za-z]/.test(p);

export function PasswordStrength({ value }) {
  if (!value) return null;
  const rules = passwordRules(value);
  const met = rules.filter(([, ok]) => ok).length + (value.length >= 12 ? 1 : 0);
  const level = !passwordOk(value) ? 'weak' : met >= 5 ? 'strong' : 'medium';
  const bars = level === 'weak' ? 1 : level === 'medium' ? 2 : 3;
  return (
    <div className={`strength strength--${level}`}>
      <div className="strength__bars" aria-hidden="true">
        {[0, 1, 2].map(i => <motion.span key={i} initial={false} animate={{ opacity: i < bars ? 1 : 0.25, scaleX: i < bars ? 1 : 0.96 }} transition={{ duration: 0.25 }} />)}
        <b>{level[0].toUpperCase() + level.slice(1)}</b>
      </div>
      <ul className="strength__rules" aria-label="Password rules">
        {rules.map(([label, ok]) => (
          <li key={label} className={ok ? 'is-met' : ''}><span aria-hidden="true" />{label}<span className="sr-only">{ok ? ' (done)' : ' (not yet)'}</span></li>
        ))}
      </ul>
    </div>
  );
}

/* A phone box with the Nigerian flag and +234 before it. A number typed with
 * its own + code (someone abroad) is kept as typed. */
export function PhoneField({ id, value, onChange, ...rest }) {
  return (
    <span className="phone-field">
      <span className="phone-field__code" aria-hidden="true"><span className="phone-field__flag" />+234</span>
      <input id={id} type="tel" inputMode="tel" autoComplete="tel" placeholder="801 234 5678"
             value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </span>
  );
}

/** "+234 801 234 5678" from what was typed in the box above. */
export function fullPhone(typed) {
  const t = String(typed ?? '').trim();
  if (!t || t.startsWith('+')) return t;
  const digits = t.replace(/\D/g, '').replace(/^0/, '');
  return digits ? `+234 ${digits.replace(/^(\d{3})(\d{3})(\d+)$/, '$1 $2 $3')}` : '';
}

/* A word from the preview, which cannot send email: the code it would have sent. */
export function PreviewNote({ code, link }) {
  if (!code && !link) return null;
  return (
    <InlineNote tone="info" className="auth__preview">
      <p><strong>Preview only</strong>
        <span>{code ? <>No email is sent here. Your code is <b>{code}</b>.</> : <>No email is sent here. <Link to={link}>Open the reset link</Link>.</>}</span></p>
    </InlineNote>
  );
}

/* Seconds left before another code may be sent, counting down. */
export function useCountdown(seconds) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}
export const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
