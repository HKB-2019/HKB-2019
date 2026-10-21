import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  accountLogin, accountLogin2fa, accountSignUp, accountVerify, accountResend, accountForgot, accountReset
} from '../../lib/api.js';
import { useAccount } from '../../store/AccountContext.jsx';
import { useShop } from '../../store/ShopContext.jsx';
import { useEmailCheck } from '../../lib/useEmailCheck.js';
import { isEmail } from '../../lib/delivery.js';
import { shake } from '../../lib/feel.js';
import { EmailNote } from '../FieldNote.jsx';
import FieldNote from '../FieldNote.jsx';
import PasswordInput from '../PasswordInput.jsx';
import StateMark from '../StateMark.jsx';
import Dialog from '../Dialog.jsx';
import { ErrorBanner, InlineNote } from '../Notices.jsx';
import { ArrowShort } from '../Icons.jsx';
import { AuthShell, CodeInput, PasswordStrength, passwordOk } from './parts.jsx';
import { EASE_OUT } from '../../lib/motion.js';

/* The owner's sign-in board: sign in, create an account, prove the email
 * with a six-digit code, forgot / set a new password, and the second step
 * for an authenticator app. Google and Apple sign-in are not here: they need
 * the shop's own Google and Apple developer accounts first (DEPLOY.md). */

const Busy = ({ on, idle, busy }) => (on ? <><span className="spinner" aria-hidden="true" /> {busy}</> : <>{idle} <ArrowShort className="btn__arrow" /></>);

/* A word from the preview, which cannot send email: the code it would have sent. */
function PreviewNote({ code, link }) {
  if (!code && !link) return null;
  return (
    <InlineNote tone="info" className="auth__preview">
      <p><strong>Preview only</strong>
        <span>{code ? <>No email is sent here. Your code is <b>{code}</b>.</> : <>No email is sent here. <Link to={link}>Open the reset link</Link>.</>}</span></p>
    </InlineNote>
  );
}

/* ------------------------------------------------------------- sign in */

export function SignIn() {
  const { signedIn, endedBy } = useAccount();
  const { toast } = useShop();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next') : '/account';
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ticket, setTicket] = useState(null);     // the authenticator step
  const [code, setCode] = useState('');
  const check = useEmailCheck(email);
  const form = useRef(null);

  const done = (me) => {
    signedIn(me);
    toast({ key: 'account', tone: 'ok', title: `Welcome back${me.name ? `, ${me.name.split(' ')[0]}` : ''}`, body: 'You’re signed in.' });
    navigate(next, { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!isEmail(email) || !password) { setError({ message: 'Enter your email and password.' }); shake(form.current?.querySelector('input')); return; }
    setBusy(true); setError(null);
    try {
      const r = await accountLogin(email.trim(), password, remember);
      if (r.twoFactor) { setTicket(r.ticket); setBusy(false); return; }
      done(r);
    } catch (err) {
      setBusy(false);
      if (err.code === 'unverified') { navigate(`/account/verify?email=${encodeURIComponent(email.trim())}`, { state: { sent: true, previewCode: err.previewCode } }); return; }
      setError(err);
      shake(form.current?.querySelector('.password input'));
    }
  };

  const second = async (value = code) => {
    if (value.length !== 6) return;
    setBusy(true); setError(null);
    try { done(await accountLogin2fa(ticket, value)); }
    catch (err) {
      setBusy(false); setCode('');
      if (err.code === 'ticket') { setTicket(null); setPassword(''); }
      setError(err);
    }
  };

  if (ticket) {
    return (
      <AuthShell title="Two-step verification" note="Enter the 6-digit code from your authenticator app.">
        <StateMark tone="ok" sign="shield" size="lg" />
        <CodeInput value={code} onChange={setCode} onComplete={second} invalid={Boolean(error)} label="Authenticator code" />
        {error && <FieldNote error={error.message} />}
        <button type="button" className="btn btn--contrast btn--block auth__go" disabled={busy || code.length !== 6} onClick={() => second()}>
          <Busy on={busy} idle="VERIFY" busy="VERIFYING…" />
        </button>
        <button type="button" className="auth__link" onClick={() => { setTicket(null); setCode(''); setError(null); }}>Use a different account</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back" note="Sign in to your account.">
      {import.meta.env.VITE_DEMO && (
        <InlineNote tone="info" className="auth__preview">
          <p><strong>Preview</strong><span>Sign in as ada@example.com with masq-preview-1 to see an account with orders, or create one.</span></p>
        </InlineNote>
      )}
      {endedBy === 'expired' && (
        <ErrorBanner title="Your session has expired." text="Please sign in again to continue." />
      )}
      <form className="auth__form" onSubmit={submit} noValidate ref={form}>
        <label className="field field--tight" htmlFor="si-email">
          <span>EMAIL ADDRESS</span>
          <input id="si-email" type="email" autoComplete="email" inputMode="email" placeholder="you@email.com" autoFocus
                 value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} {...check.input} />
          <EmailNote check={check} onUse={setEmail} reserve={false} />
        </label>
        <label className="field field--tight" htmlFor="si-password">
          <span>PASSWORD</span>
          <PasswordInput id="si-password" autoComplete="current-password" value={password}
                         className={error ? 'is-error' : undefined}
                         onChange={(e) => { setPassword(e.target.value); setError(null); }} />
        </label>
        <div className="auth__row">
          <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Remember me</span></label>
          <Link to={`/account/forgot${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="auth__link">Forgot password?</Link>
        </div>
        <AnimatePresence>{error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE_OUT }}>
            <InlineNote tone="bad"><p>{error.message}</p></InlineNote>
          </motion.div>
        )}</AnimatePresence>
        <button type="submit" className="btn btn--contrast btn--block auth__go" disabled={busy}>
          <Busy on={busy} idle="SIGN IN" busy="SIGNING IN…" />
        </button>
      </form>
      <p className="auth__switch">Don’t have an account? <Link to="/account/sign-up">Create an account</Link></p>
    </AuthShell>
  );
}

/* --------------------------------------------------------------- terms */

/* The owner's "modal with scroll": the Terms of Sale, read and agreed to. */
function TermsDialog({ open, onClose, onAgree }) {
  const { site } = useShop();
  const [agree, setAgree] = useState(false);
  return (
    <Dialog open={open} tone="info" labelledBy="termsTitle" onClose={onClose}>
      <h2 className="state-panel__title" id="termsTitle">Terms of Sale</h2>
      <div className="terms__scroll" tabIndex={0} data-lenis-prevent>
        <p className="terms__text">{site?.pages?.TERMS ?? 'Loading…'}</p>
      </div>
      <label className="check terms__agree"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>I have read and agree to the Terms of Sale</span></label>
      <button type="button" className="btn btn--contrast btn--block" disabled={!agree} onClick={() => { onAgree(); onClose(); }}>CONTINUE</button>
    </Dialog>
  );
}

/* ------------------------------------------------------------- sign up */

export function SignUp() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [name, setName] = useState(state?.name ?? '');
  const [email, setEmail] = useState(state?.email ?? '');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [news, setNews] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const check = useEmailCheck(email);
  const form = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (name.trim().length < 2) err.name = 'Please enter your full name.';
    if (!isEmail(email)) err.email = email.trim() ? 'Please enter a valid email address.' : 'Enter your email address.';
    if (!passwordOk(password)) err.password = 'Use at least 8 characters, with a letter and a number.';
    if (!terms) err.terms = 'You must accept the Terms of Sale to continue.';
    setErrors(err);
    if (Object.keys(err).length) { shake(form.current?.querySelector('[aria-invalid="true"]')); return; }
    setBusy(true);
    try {
      const r = await accountSignUp({ name: name.trim(), email: email.trim(), password, terms: true, newsletter: news });
      navigate(`/account/verify?email=${encodeURIComponent(r.email)}`, { state: { sent: true, name: name.trim(), previewCode: r.previewCode } });
    } catch (e2) {
      setBusy(false);
      setErrors({ [e2.field ?? 'form']: e2.message, exists: e2.code === 'exists' });
    }
  };
  const bad = (k) => (errors[k] ? { 'aria-invalid': true, className: 'is-error' } : {});

  return (
    <AuthShell title="Create your account" note="Track your orders and check out faster.">
      <form className="auth__form" onSubmit={submit} noValidate ref={form}>
        <label className="field field--tight" htmlFor="su-name">
          <span>FULL NAME</span>
          <input id="su-name" autoComplete="name" value={name} placeholder="As you’d like it on your orders"
                 onChange={(e) => { setName(e.target.value); setErrors(x => ({ ...x, name: null })); }} {...bad('name')} />
          <FieldNote error={errors.name} />
        </label>
        <label className="field field--tight" htmlFor="su-email">
          <span>EMAIL ADDRESS</span>
          <input id="su-email" type="email" autoComplete="email" inputMode="email" value={email}
                 onChange={(e) => { setEmail(e.target.value); setErrors(x => ({ ...x, email: null, exists: false })); }}
                 {...check.input} {...bad('email')} />
          <EmailNote check={check} error={errors.email} onUse={setEmail} reserve={false} />
          {errors.exists && <Link className="auth__link" to={`/account/sign-in?email=${encodeURIComponent(email)}`}>Sign in instead</Link>}
        </label>
        <label className="field field--tight" htmlFor="su-password">
          <span>PASSWORD</span>
          <PasswordInput id="su-password" autoComplete="new-password" value={password}
                         onChange={(e) => { setPassword(e.target.value); setErrors(x => ({ ...x, password: null })); }}
                         className={errors.password ? 'is-error' : password && passwordOk(password) ? 'is-valid' : undefined} />
          {errors.password ? <FieldNote error={errors.password} /> : !password && <FieldNote help="At least 8 characters, with a letter and a number." />}
          <PasswordStrength value={password} />
        </label>
        <label className={`check${errors.terms ? ' is-error' : ''}`}>
          <input type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); setErrors(x => ({ ...x, terms: null })); }}
                 aria-invalid={Boolean(errors.terms) || undefined} />
          <span>I agree to the <button type="button" className="auth__link" onClick={() => setReading(true)}>Terms of Sale</button></span>
        </label>
        <FieldNote error={errors.terms} />
        <label className="check"><input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} />
          <span>Email me about new drops and restocks. Leave any time.</span></label>
        {errors.form && <InlineNote tone="bad"><p>{errors.form}</p></InlineNote>}
        <button type="submit" className="btn btn--contrast btn--block auth__go" disabled={busy}>
          <Busy on={busy} idle="CREATE ACCOUNT" busy="CREATING YOUR ACCOUNT…" />
        </button>
      </form>
      <p className="auth__switch">Already have an account? <Link to="/account/sign-in">Sign in</Link></p>
      <TermsDialog open={reading} onClose={() => setReading(false)} onAgree={() => { setTerms(true); setErrors(x => ({ ...x, terms: null })); }} />
    </AuthShell>
  );
}

/* --------------------------------------------------- prove the email */

function useCountdown(seconds) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function Verify() {
  const { signedIn } = useAccount();
  const { toast } = useShop();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { state } = useLocation();
  const email = params.get('email') ?? '';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(state?.previewCode ?? null);
  const [wait, setWait] = useCountdown(state?.sent ? 45 : 0);

  const verify = async (value = code) => {
    if (value.length !== 6) return;
    setBusy(true); setError(null);
    try {
      const me = await accountVerify(email, value);
      signedIn(me);
      toast({ key: 'account', tone: 'ok', title: 'Email verified', body: 'Your account is ready.' });
      navigate('/account', { replace: true });
    } catch (err) { setBusy(false); setError(err); setCode(''); }
  };
  const resend = async () => {
    setError(null);
    try { const r = await accountResend(email); setWait(r.wait ?? 45); if (r.previewCode) setPreview(r.previewCode); toast({ key: 'code', tone: 'ok', title: 'Code sent', body: `A new code is on its way to ${email}.` }); }
    catch (err) { if (err.wait) setWait(err.wait); else setError(err); }
  };

  return (
    <AuthShell>
      <div className="auth__centre">
        <StateMark tone="ok" sign="mail" size="lg" />
        <h1 className="auth__title">Check your email</h1>
        <p className="auth__note">We’ve sent a 6-digit verification code to <strong>{email || 'your email'}</strong>. Enter the code below to continue.</p>
      </div>
      <PreviewNote code={preview} />
      <CodeInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={verify} invalid={Boolean(error)} />
      {error && <FieldNote error={error.message} />}
      <p className="auth__resend">
        Didn’t receive the code?{' '}
        {wait > 0 ? <span>Resend code ({mmss(wait)})</span> : <button type="button" className="auth__link" onClick={resend}>Resend code</button>}
      </p>
      <button type="button" className="btn btn--contrast btn--block auth__go" disabled={busy || code.length !== 6} onClick={() => verify()}>
        <Busy on={busy} idle="VERIFY CODE" busy="VERIFYING…" />
      </button>
      <Link className="auth__link auth__under" to="/account/sign-up" state={{ email, name: state?.name }}>Change email address</Link>
    </AuthShell>
  );
}

/* ------------------------------------------------------ forgot password */

export function Forgot() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const check = useEmailCheck(email);

  const submit = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) { setError('Please enter a valid email address.'); return; }
    setBusy(true); setError(null);
    try { const r = await accountForgot(email.trim()); setSent({ email: email.trim(), link: r.previewLink }); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };

  if (sent) {
    return (
      <AuthShell>
        <div className="auth__centre">
          <StateMark tone="ok" size="lg" burst />
          <h1 className="auth__title">Check your email</h1>
          <p className="auth__note">If there’s an account for <strong>{sent.email}</strong>, we’ve sent it a link to reset the password. The link expires in 30 minutes.</p>
        </div>
        <PreviewNote link={sent.link} />
        <Link className="btn btn--ghost btn--block" to="/account/sign-in">BACK TO SIGN IN</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      <div className="auth__centre">
        <StateMark tone="ok" sign="mail" size="lg" />
        <h1 className="auth__title">Reset your password</h1>
        <p className="auth__note">Enter your email address and we’ll send you a reset link.</p>
      </div>
      <form className="auth__form" onSubmit={submit} noValidate>
        <label className="field field--tight" htmlFor="fp-email">
          <span>EMAIL ADDRESS</span>
          <input id="fp-email" type="email" autoComplete="email" inputMode="email" autoFocus value={email}
                 onChange={(e) => { setEmail(e.target.value); setError(null); }} {...check.input} />
          <EmailNote check={check} error={error} onUse={setEmail} reserve={false} />
        </label>
        <button type="submit" className="btn btn--contrast btn--block auth__go" disabled={busy}>
          <Busy on={busy} idle="SEND RESET LINK" busy="SENDING…" />
        </button>
      </form>
      <Link className="auth__link auth__under" to="/account/sign-in">Back to sign in</Link>
    </AuthShell>
  );
}

/* ------------------------------------------------------- new password */

export function Reset() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!passwordOk(password)) { setError({ message: 'Use at least 8 characters, with a letter and a number.' }); return; }
    setBusy(true); setError(null);
    try { await accountReset(email, token, password); setDone(true); }
    catch (err) { setError(err); }
    setBusy(false);
  };

  if (done) {
    return (
      <AuthShell>
        <div className="auth__centre">
          <StateMark tone="ok" size="lg" burst />
          <h1 className="auth__title">Password reset successful</h1>
          <p className="auth__note">You can now sign in with your new password.</p>
        </div>
        <Link className="btn btn--contrast btn--block" to={`/account/sign-in?email=${encodeURIComponent(email)}`}>SIGN IN <ArrowShort className="btn__arrow" /></Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      <div className="auth__centre">
        <StateMark tone="ok" sign="lock" size="lg" />
        <h1 className="auth__title">Create a new password</h1>
        <p className="auth__note">Enter a new password for <strong>{email}</strong>.</p>
      </div>
      {error?.code === 'expired' ? (
        <ErrorBanner title="This link has expired." text="Reset links work for 30 minutes, once. Ask for a new one."
                     action={<Link className="btn btn--danger" to={`/account/forgot?email=${encodeURIComponent(email)}`}>Send a new link</Link>} />
      ) : (
        <form className="auth__form" onSubmit={submit} noValidate>
          <label className="field field--tight" htmlFor="rp-password">
            <span>NEW PASSWORD</span>
            <PasswordInput id="rp-password" autoComplete="new-password" autoFocus value={password}
                           className={error ? 'is-error' : password && passwordOk(password) ? 'is-valid' : undefined}
                           onChange={(e) => { setPassword(e.target.value); setError(null); }} />
            {error && <FieldNote error={error.message} />}
            <PasswordStrength value={password} />
          </label>
          <button type="submit" className="btn btn--contrast btn--block auth__go" disabled={busy}>
            <Busy on={busy} idle="RESET PASSWORD" busy="SAVING…" />
          </button>
        </form>
      )}
    </AuthShell>
  );
}
