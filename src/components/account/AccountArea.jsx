import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  accountOrders, accountSave, accountPassword, accountSessions, accountEndSession, accountEndOthers,
  accountActivity, account2faSetup, account2faOn, account2faOff, accountDelete, accountUploadPhoto,
  accountRemovePhoto, accountPhotoUrl
} from '../../lib/api.js';
import { useAccount, initialsOf } from '../../store/AccountContext.jsx';
import { useShop } from '../../store/ShopContext.jsx';
import { preparePhoto, AVATAR } from '../../lib/photo.js';
import { useSectionLink } from '../../lib/useSectionLink.js';
import FieldNote from '../FieldNote.jsx';
import PasswordInput from '../PasswordInput.jsx';
import StateMark, { TrashMark } from '../StateMark.jsx';
import Dialog from '../Dialog.jsx';
import { CopyButton } from '../OrderResult.jsx';
import { ErrorBanner, Loader, detailsOf } from '../Notices.jsx';
import { BagIcon, Heart, ArrowShort, Check, Close } from '../Icons.jsx';
import { CodeInput, PasswordStrength, passwordOk, PhoneField, fullPhone } from './parts.jsx';
import { EASE_OUT, UI_IN } from '../../lib/motion.js';

/* The signed-in side of the owner's accounts board: an overview, the
 * customer's orders, their profile, and security (password, two-step
 * verification, where they are signed in, what happened, deleting it all). */

const naira = (kobo) => '₦' + (kobo / 100).toLocaleString('en-NG');
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const STATUS = {
  paid: ['Being prepared', 'ok'], sent: ['On its way', 'ok'], pending: ['Awaiting payment', 'warn'],
  refunded: ['Refunded', 'info'], refund_due: ['Refund due', 'warn']
};

/* ------------------------------------------------------------- the frame */

const NAV = [
  ['/account', 'Overview', true], ['/account/orders', 'Orders'], ['/account/profile', 'Profile'], ['/account/security', 'Security']
];

export function Avatar({ account, version, size = 'md' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [version]);
  return (
    <span className={`avatar avatar--${size}`} aria-hidden="true">
      {account.hasPhoto && !broken
        ? <img src={accountPhotoUrl(version)} alt="" onError={() => setBroken(true)} />
        : initialsOf(account.name, account.email)}
    </span>
  );
}

export function AccountFrame({ title, note, children }) {
  const { account, signOut } = useAccount();
  const { openOverlay, toast } = useShop();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const out = async () => {
    setLeaving(true);
    await signOut();
    setLeaving(false); setAsking(false);
    toast({ key: 'account', tone: 'ok', title: 'Signed out', body: 'You’ve been signed out successfully.' });
    navigate('/');
  };
  return (
    <div className="acct">
      <aside className="acct__side">
        <div className="acct__who">
          <Avatar account={account} version={account.photoVersion} />
          <p><strong>{account.name || 'Your account'}</strong><span>{account.email}</span></p>
        </div>
        <nav className="acct__nav" aria-label="Your account">
          {NAV.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `acct__link${isActive ? ' is-on' : ''}`}>{label}</NavLink>
          ))}
          <button type="button" className="acct__link" onClick={() => openOverlay('saved')}>Saved pieces</button>
          <button type="button" className="acct__link acct__link--out" onClick={() => setAsking(true)}>Sign out</button>
        </nav>
      </aside>
      <motion.section className="acct__main" key={title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: UI_IN, ease: EASE_OUT }}>
        <h1 className="acct__title">{title}</h1>
        {note && <p className="acct__note">{note}</p>}
        {children}
      </motion.section>

      {/* The owner's sign-out confirmation. */}
      <Dialog open={asking} tone="warn" labelledBy="outTitle" onClose={() => setAsking(false)}>
        <StateMark tone="warn" size="lg" />
        <h2 className="state-panel__title" id="outTitle">Sign out?</h2>
        <p className="state-panel__note">Are you sure you want to sign out of your account?</p>
        <button type="button" className="btn btn--contrast btn--block" onClick={out} disabled={leaving}>
          {leaving ? <><span className="spinner" aria-hidden="true" /> SIGNING OUT…</> : 'SIGN OUT'}
        </button>
        <button type="button" className="state-panel__cancel" onClick={() => setAsking(false)}>Cancel</button>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------- overview */

/* The owner's small inline empty states, as rows with a way on. */
function Row({ icon, title, text, onClick, to }) {
  const inner = <>{icon}<span><strong>{title}</strong><em>{text}</em></span><ArrowShort className="acct-row__go" /></>;
  return to ? <Link className="acct-row" to={to}>{inner}</Link> : <button type="button" className="acct-row" onClick={onClick}>{inner}</button>;
}
const Clock = () => <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const Shield = () => <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /></svg>;

export function Overview() {
  const { account } = useAccount();
  const { cartQty, wishlist, openOverlay } = useShop();
  const [orders, setOrders] = useState(null);
  useEffect(() => { accountOrders().then(setOrders).catch(() => setOrders([])); }, []);
  const latest = orders?.[0];
  return (
    <AccountFrame title={`Hello, ${account.name.split(' ')[0] || 'there'}`} note={`Member since ${day(account.createdAt)}.`}>
      <div className="acct-rows">
        {orders === null ? <Loader title="Loading your orders…" /> : latest ? (
          <Row icon={<Clock />} title={`Latest order · ${STATUS[latest.status]?.[0] ?? latest.status}`}
               text={`${day(latest.createdAt)} · ${latest.itemCount} ${latest.itemCount === 1 ? 'item' : 'items'} · ${naira(latest.totalKobo)}`} to="/account/orders" />
        ) : (
          <Row icon={<Clock />} title="No recent orders." text="Your recent orders will appear here." to="/account/orders" />
        )}
        <Row icon={<BagIcon />} title={cartQty ? `${cartQty} ${cartQty === 1 ? 'piece' : 'pieces'} in your bag` : 'Your bag is empty.'}
             text={cartQty ? 'Pick up where you left off.' : 'Add items to get started.'} onClick={() => openOverlay('cart')} />
        <Row icon={<Heart />} title={wishlist.length ? `${wishlist.length} saved ${wishlist.length === 1 ? 'piece' : 'pieces'}` : 'No items in your wishlist.'}
             text={wishlist.length ? 'Kept for later.' : 'Tap the heart on any product to save it here.'} onClick={() => openOverlay('saved')} />
        <Row icon={<Shield />} title={account.twoFactor ? 'Two-step verification is on' : 'Add an extra layer of security'}
             text={account.twoFactor ? 'Your account asks for a code at sign-in.' : 'Turn on two-step verification.'} to="/account/security" />
      </div>
    </AccountFrame>
  );
}

/* --------------------------------------------------------------- orders */

const BoxPicture = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M8 22l24-12 24 12v22L32 56 8 44z" /><path d="M8 22l24 12 24-12M32 34v22" /><path d="M20 16l24 12v8" stroke="var(--ok)" strokeWidth="3" />
  </svg>
);

export function Orders() {
  const goTo = useSectionLink();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const load = async () => {
    setRetrying(true);
    try { setOrders(await accountOrders()); setError(null); } catch (err) { setError(err); }
    setRetrying(false);
  };
  useEffect(() => { load(); }, []);

  let body;
  if (error && !orders) {
    body = <ErrorBanner layout="panel" picture={error.status === 0 ? 'offline' : 'list'} title="We couldn’t load your orders."
                        text="There was a problem fetching your order history. Please try again." onRetry={load} retrying={retrying} retryLabel="Retry" details={detailsOf(error)} />;
  } else if (!orders) {
    body = (
      <div className="acct-orders" aria-busy="true" aria-label="Loading your orders">
        {[0, 1, 2].map(i => <div key={i} className="acct-order acct-order--ghost"><span /><span /><span /></div>)}
      </div>
    );
  } else if (!orders.length) {
    body = (
      <motion.div className="empty acct-empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: UI_IN, ease: EASE_OUT }}>
        <motion.span className="empty__icon empty__icon--big" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: EASE_OUT }}><BoxPicture /></motion.span>
        <h2 className="empty__title">You haven’t placed any orders yet.</h2>
        <p className="empty__text">When you place an order with this email, it will appear here.</p>
        <button type="button" className="btn btn--contrast" onClick={() => goTo('#drop')}>START SHOPPING <ArrowShort className="btn__arrow" /></button>
      </motion.div>
    );
  } else {
    body = (
      <ul className="acct-orders">
        {orders.map((o, i) => {
          const [label, tone] = STATUS[o.status] ?? [o.status, 'info'];
          return (
            <motion.li key={o.reference} className="acct-order" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                       transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.05, ease: EASE_OUT }}>
              <span className="acct-order__pics">
                {o.items.map((it, n) => it.img ? <img key={n} src={it.img} alt="" /> : <span key={n} />)}
              </span>
              <span className="acct-order__what">
                <strong>{o.items.map(it => it.name).join(', ')}{o.itemCount > o.items.length ? '…' : ''}</strong>
                <em>{day(o.createdAt)} · {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'} · {naira(o.totalKobo)}</em>
              </span>
              <span className={`pill pill--${tone}`}>{label}</span>
              <Link className="acct-order__go" to={`/order?reference=${encodeURIComponent(o.reference)}`}>View order <ArrowShort className="btn__arrow" /></Link>
            </motion.li>
          );
        })}
      </ul>
    );
  }
  return <AccountFrame title="Orders" note="Every order placed with your email.">{body}</AccountFrame>;
}

/* -------------------------------------------------------------- profile */

/* The owner's upload states: going (a bar and the share gone), done, failed. */
function PhotoUpload() {
  const { account, setAccount } = useAccount();
  const { toast } = useShop();
  const [job, setJob] = useState(null);     // { name, size, share, state: 'going'|'done'|'failed', error, file }
  const input = useRef(null);
  const stop = useRef(null);

  const start = async (file) => {
    if (!file) return;
    const base = { name: file.name, size: file.size, file, share: 0 };
    setJob({ ...base, state: 'going' });
    try {
      const { image } = await preparePhoto(file, AVATAR);
      stop.current = new AbortController();
      await accountUploadPhoto(image, (share) => setJob(j => j && { ...j, share }), stop.current.signal);
      setJob({ ...base, share: 1, state: 'done' });
      setAccount(a => ({ ...a, hasPhoto: true, photoVersion: Date.now() }));
      setTimeout(() => setJob(j => (j?.state === 'done' ? null : j)), 2200);
    } catch (err) {
      if (err.code === 'cancelled') { setJob(null); return; }
      setJob({ ...base, state: 'failed', error: err.message });
    }
  };
  const remove = async () => {
    try { await accountRemovePhoto(); setAccount(a => ({ ...a, hasPhoto: false, photoVersion: Date.now() })); toast({ title: 'Photo removed' }); }
    catch (err) { toast({ tone: 'bad', title: 'We couldn’t remove the photo.', body: err.message }); }
  };
  const kb = (n) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`);

  return (
    <div className="acct-photo">
      <Avatar account={account} version={account.photoVersion} size="lg" />
      <div className="acct-photo__side">
        <div className="acct-photo__buttons">
          <button type="button" className="btn btn--ghost" onClick={() => input.current?.click()} disabled={job?.state === 'going'}>CHANGE PHOTO</button>
          {account.hasPhoto && <button type="button" className="auth__link" onClick={remove}>Remove</button>}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden
               onChange={(e) => { start(e.target.files?.[0]); e.target.value = ''; }} />
        <AnimatePresence mode="wait">
          {job ? (
            <motion.div key={job.state} className={`upload upload--${job.state}`} role={job.state === 'failed' ? 'alert' : 'status'}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: EASE_OUT }}>
              {job.state === 'done' ? <StateMark tone="ok" /> : job.state === 'failed' ? <StateMark tone="bad" /> : <span className="spinner" aria-hidden="true" />}
              <span className="upload__text">
                <strong>{job.state === 'going' ? 'Uploading…' : job.state === 'done' ? 'Photo uploaded' : 'Upload failed'}</strong>
                <em>{job.state === 'failed' ? (job.error || 'Please try again or use a smaller file.') : `${job.name} (${kb(job.size)})`}</em>
                {job.state !== 'failed' && (
                  <span className="upload__bar"><span style={{ transform: `scaleX(${job.state === 'done' ? 1 : job.share})` }} /></span>
                )}
              </span>
              {job.state === 'going' && <b className="upload__share">{Math.round(job.share * 100)}%</b>}
              {job.state === 'failed' && <button type="button" className="btn btn--danger upload__again" onClick={() => start(job.file)}>TRY AGAIN</button>}
              <button type="button" className="upload__x" aria-label={job.state === 'going' ? 'Cancel upload' : 'Close'}
                      onClick={() => { stop.current?.abort(); setJob(null); }}><Close /></button>
            </motion.div>
          ) : (
            <motion.p key="help" className="field__help" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>JPG, PNG or WebP. Cropped square.</motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const sixteenAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 16); return d.toISOString().slice(0, 10); };

export function Profile() {
  const { account, setAccount } = useAccount();
  const { toast } = useShop();
  const [f, setF] = useState(() => ({
    name: account.name, phone: account.phone.replace(/^\+234\s?/, ''), birthDate: account.birthDate ?? '', gender: account.gender
  }));
  const [errors, setErrors] = useState({});
  const [state, setState] = useState(null);   // null | 'saving' | 'saved'
  const set = (k) => (v) => { setF(x => ({ ...x, [k]: v })); setErrors(x => ({ ...x, [k]: null, form: null })); };
  const young = f.birthDate && f.birthDate > sixteenAgo();

  const save = async (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2) { setErrors({ name: 'Please enter your full name.' }); return; }
    if (young) { setErrors({ birthDate: 'You must be 16 or older.' }); return; }
    setState('saving');
    try {
      const me = await accountSave({ name: f.name.trim(), phone: fullPhone(f.phone), birthDate: f.birthDate || null, gender: f.gender });
      setAccount(a => ({ ...a, ...me }));
      setState('saved');
      toast({ key: 'profile', tone: 'ok', title: 'Profile updated', body: 'Your changes have been saved successfully.' });
      setTimeout(() => setState(null), 1800);
    } catch (err) {
      setState(null);
      if (err.field) setErrors({ [err.field]: err.message });
      // A save that did not go: kept on screen until tried again.
      else toast({ key: 'profile', tone: 'bad', title: 'We couldn’t save your changes.', body: err.message, ms: null, action: { label: 'Retry', onClick: () => save(new Event('submit')) } });
    }
  };
  const bad = (k) => (errors[k] ? { 'aria-invalid': true, className: 'is-error' } : {});

  return (
    <AccountFrame title="Profile" note="Manage your personal information.">
      <PhotoUpload />
      <form className="acct-form" onSubmit={save} noValidate>
        <label className="field field--tight" htmlFor="p-name">
          <span>FULL NAME</span>
          <input id="p-name" autoComplete="name" value={f.name} onChange={(e) => set('name')(e.target.value)} {...bad('name')} />
          <FieldNote error={errors.name} />
        </label>
        <label className="field field--tight" htmlFor="p-email">
          <span>EMAIL ADDRESS</span>
          <span className="readonly">
            <input id="p-email" value={account.email} readOnly aria-describedby="p-email-help" />
            <span className="pill pill--ok readonly__pill"><Check /> Verified</span>
          </span>
          <FieldNote id="p-email-help" help="Your sign-in, and where your receipts go. It can’t be changed here." />
        </label>
        <label className="field field--tight" htmlFor="p-phone">
          <span>PHONE NUMBER<em className="field__hint"> · optional</em></span>
          <PhoneField id="p-phone" value={f.phone} onChange={set('phone')} {...bad('phone')} />
          <FieldNote error={errors.phone} />
        </label>
        <div className="acct-form__two">
          <label className="field field--tight" htmlFor="p-dob">
            <span>DATE OF BIRTH<em className="field__hint"> · optional</em></span>
            <input id="p-dob" type="date" max={sixteenAgo()} value={f.birthDate} onChange={(e) => set('birthDate')(e.target.value)}
                   {...(young || errors.birthDate ? { 'aria-invalid': true, className: 'is-warn' } : {})} />
            <FieldNote warn={young ? 'You must be 16 or older.' : null} error={!young ? errors.birthDate : null} />
          </label>
          <label className="field field--tight" htmlFor="p-gender">
            <span>GENDER<em className="field__hint"> · optional</em></span>
            <select id="p-gender" value={f.gender} onChange={(e) => set('gender')(e.target.value)}>
              <option value="">—</option>
              <option value="prefer-not">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non-binary">Non-binary</option>
            </select>
          </label>
        </div>
        <button type="submit" className={`btn btn--block ${state === 'saved' ? 'btn--done' : 'btn--contrast'}`} disabled={state === 'saving'}>
          {state === 'saving' ? <><span className="spinner" aria-hidden="true" /> SAVING CHANGES…</>
            : state === 'saved' ? <><Check /> SAVED</> : 'SAVE CHANGES'}
        </button>
      </form>
    </AccountFrame>
  );
}

/* ------------------------------------------------------------- security */

function SecurityRow({ icon, title, text, action, onClick, busy }) {
  return (
    <div className="sec-row">
      <span className="sec-row__icon" aria-hidden="true">{icon}</span>
      <span className="sec-row__text"><strong>{title}</strong><em>{text}</em></span>
      <button type="button" className="btn btn--ghost sec-row__go" onClick={onClick} disabled={busy}>{action}</button>
    </div>
  );
}
const LockIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
const DeviceIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /></svg>;
const ListIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const BinIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4.5 6.5h15M9.5 6.5V4.8h5v1.7M6.5 6.5l.9 12.2c.1 1 .9 1.8 1.9 1.8h5.4c1 0 1.8-.8 1.9-1.8l.9-12.2" /></svg>;

function ChangePassword({ open, onClose }) {
  const { toast } = useShop();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setCurrent(''); setNext(''); setErrors({}); } }, [open]);
  const save = async (e) => {
    e.preventDefault();
    if (!passwordOk(next)) { setErrors({ password: 'Use at least 8 characters, with a letter and a number.' }); return; }
    setBusy(true);
    try {
      await accountPassword(current, next);
      toast({ key: 'security', tone: 'ok', title: 'Password changed', body: 'Other devices have been signed out.' });
      onClose();
    } catch (err) { setErrors({ [err.field ?? 'form']: err.message }); }
    setBusy(false);
  };
  return (
    <Dialog open={open} tone="info" labelledBy="pwTitle" onClose={onClose}>
      <StateMark tone="info" sign="lock" size="lg" />
      <h2 className="state-panel__title" id="pwTitle">Change your password</h2>
      <form className="acct-form acct-form--dialog" onSubmit={save} noValidate>
        <label className="field field--tight" htmlFor="pw-current"><span>CURRENT PASSWORD</span>
          <PasswordInput id="pw-current" autoComplete="current-password" value={current} autoFocus
                         className={errors.current ? 'is-error' : undefined} onChange={(e) => { setCurrent(e.target.value); setErrors({}); }} />
          <FieldNote error={errors.current} />
        </label>
        <label className="field field--tight" htmlFor="pw-new"><span>NEW PASSWORD</span>
          <PasswordInput id="pw-new" autoComplete="new-password" value={next}
                         className={errors.password ? 'is-error' : next && passwordOk(next) ? 'is-valid' : undefined}
                         onChange={(e) => { setNext(e.target.value); setErrors({}); }} />
          <FieldNote error={errors.password ?? errors.form} />
          <PasswordStrength value={next} />
        </label>
        <button type="submit" className="btn btn--contrast btn--block" disabled={busy}>
          {busy ? <><span className="spinner" aria-hidden="true" /> SAVING…</> : 'SAVE PASSWORD'}
        </button>
      </form>
      <button type="button" className="state-panel__cancel" onClick={onClose}>Cancel</button>
    </Dialog>
  );
}

/* The owner's two-factor screen: choose a way, then scan and confirm. */
function TwoStep({ open, onClose }) {
  const { account, setAccount } = useAccount();
  const { toast } = useShop();
  const [stage, setStage] = useState('choose');      // choose | scan | off
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setStage(account.twoFactor ? 'off' : 'choose'); setSetup(null); setCode(''); setPassword(''); setError(null); } }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps

  const begin = async () => {
    setBusy(true); setError(null);
    try { setSetup(await account2faSetup()); setStage('scan'); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const confirm = async (value = code) => {
    if (value.length !== 6) return;
    setBusy(true); setError(null);
    try {
      const me = await account2faOn(value);
      setAccount(a => ({ ...a, ...me }));
      toast({ key: 'security', tone: 'ok', title: 'Two-step verification is on', body: 'We’ll ask for a code each time you sign in.' });
      onClose();
    } catch (err) { setError(err.message); setCode(''); }
    setBusy(false);
  };
  const turnOff = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const me = await account2faOff(password);
      setAccount(a => ({ ...a, ...me }));
      toast({ key: 'security', title: 'Two-step verification is off' });
      onClose();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  return (
    <Dialog open={open} tone="ok" labelledBy="tfaTitle" onClose={onClose}>
      <StateMark tone="ok" sign="shield" size="lg" />
      <h2 className="state-panel__title" id="tfaTitle">Two-factor authentication</h2>
      {stage === 'choose' && (
        <>
          <p className="state-panel__note">Add an extra layer of security to your account.</p>
          <div className="tfa-choices" role="radiogroup" aria-label="How to get your codes">
            <label className="tfa-choice is-on"><input type="radio" name="tfa" defaultChecked />
              <span><strong>Authenticator app</strong><em>Use Google Authenticator or a similar app.</em></span></label>
            <label className="tfa-choice is-off"><input type="radio" name="tfa" disabled />
              <span><strong>SMS verification</strong><em>Not available yet.</em></span></label>
          </div>
          {error && <FieldNote error={error} />}
          <button type="button" className="btn btn--contrast btn--block" onClick={begin} disabled={busy}>
            {busy ? <><span className="spinner" aria-hidden="true" /> PREPARING…</> : 'CONTINUE'}
          </button>
        </>
      )}
      {stage === 'scan' && setup && (
        <>
          <p className="state-panel__note">Scan this with your authenticator app, then enter the 6-digit code it shows.</p>
          <img className="tfa-qr" src={setup.qr} alt="QR code for your authenticator app" width="180" height="180" />
          <p className="tfa-secret">Can’t scan it? Enter this key: <code>{setup.secret.match(/.{1,4}/g).join(' ')}</code> <CopyButton value={setup.secret} label="Copy the key" /></p>
          <CodeInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={confirm} invalid={Boolean(error)} label="Code from your app" />
          {error && <FieldNote error={error} />}
          <button type="button" className="btn btn--contrast btn--block" onClick={() => confirm()} disabled={busy || code.length !== 6}>
            {busy ? <><span className="spinner" aria-hidden="true" /> CHECKING…</> : 'TURN ON'}
          </button>
        </>
      )}
      {stage === 'off' && (
        <form className="acct-form acct-form--dialog" onSubmit={turnOff} noValidate>
          <p className="state-panel__note">Two-step verification is on. To turn it off, enter your password.</p>
          <label className="field field--tight" htmlFor="tfa-pw"><span>PASSWORD</span>
            <PasswordInput id="tfa-pw" autoComplete="current-password" value={password} autoFocus
                           className={error ? 'is-error' : undefined} onChange={(e) => { setPassword(e.target.value); setError(null); }} />
            <FieldNote error={error} />
          </label>
          <button type="submit" className="btn btn--danger btn--block" disabled={busy || !password}>
            {busy ? <><span className="spinner" aria-hidden="true" /> TURNING OFF…</> : 'TURN OFF'}
          </button>
        </form>
      )}
      <button type="button" className="state-panel__cancel" onClick={onClose}>Cancel</button>
    </Dialog>
  );
}

function Sessions({ open, onClose }) {
  const { toast } = useShop();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const load = () => accountSessions().then(l => { setList(l); setError(null); }).catch(setError);
  useEffect(() => { if (open) { setList(null); load(); } }, [open]);
  const end = async (id) => { await accountEndSession(id).catch(() => {}); toast({ key: 'security', tone: 'ok', title: 'Device signed out' }); load(); };
  const others = async () => { await accountEndOthers().catch(() => {}); toast({ key: 'security', tone: 'ok', title: 'Other devices signed out' }); load(); };
  return (
    <Dialog open={open} tone="info" labelledBy="sessTitle" onClose={onClose}>
      <h2 className="state-panel__title" id="sessTitle">Active sessions</h2>
      <p className="state-panel__note">Where you’re signed in right now.</p>
      {error ? <ErrorBanner title="We couldn’t load your sessions." onRetry={load} retryLabel="Retry" details={detailsOf(error)} />
        : !list ? <Loader title="Loading…" />
        : (
          <ul className="sess-list">
            {list.map(s => (
              <li key={s.id}>
                <span><strong>{s.device}</strong><em>Signed in {when(s.signedInAt)} · last active {when(s.lastSeenAt)}</em></span>
                {s.current ? <span className="pill pill--ok">This device</span>
                  : <button type="button" className="auth__link" onClick={() => end(s.id)}>Sign out</button>}
              </li>
            ))}
          </ul>
        )}
      {list?.length > 1 && <button type="button" className="btn btn--ghost btn--block" onClick={others}>SIGN OUT ALL OTHER DEVICES</button>}
      <button type="button" className="state-panel__cancel" onClick={onClose}>Close</button>
    </Dialog>
  );
}

function Activity({ open, onClose }) {
  const [list, setList] = useState(null);
  useEffect(() => { if (open) { setList(null); accountActivity().then(setList).catch(() => setList([])); } }, [open]);
  return (
    <Dialog open={open} tone="info" labelledBy="actTitle" onClose={onClose}>
      <h2 className="state-panel__title" id="actTitle">Account activity</h2>
      <p className="state-panel__note">The last 30 things that happened on your account.</p>
      {!list ? <Loader title="Loading…" /> : (
        <ol className="sess-list">
          {list.map((e, i) => <li key={i}><span><strong>{e.kind}</strong><em>{when(e.at)}{e.device ? ` · ${e.device}` : ''}</em></span></li>)}
        </ol>
      )}
      <p className="field__help">Something you don’t recognise? Change your password and sign out other devices.</p>
      <button type="button" className="state-panel__cancel" onClick={onClose}>Close</button>
    </Dialog>
  );
}

function DeleteAccount({ open, onClose }) {
  const { setAccount, ended } = useAccount();
  const { toast } = useShop();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setPassword(''); setError(null); } }, [open]);
  const go = async () => {
    setBusy(true); setError(null);
    try {
      await accountDelete(password);
      setAccount(null); ended();
      toast({ title: 'Account deleted', body: 'Your account has been removed from MASQ.' });
      navigate('/');
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <Dialog open={open} tone="bad" labelledBy="delTitle" onClose={onClose}>
      <TrashMark />
      <h2 className="state-panel__title" id="delTitle">Delete your account?</h2>
      <p className="state-panel__note">This can’t be undone. Your account, profile, saved sign-ins and activity will be deleted. Past orders stay in the shop’s records, as the law requires.</p>
      <label className="field field--tight acct-del__pw" htmlFor="del-pw"><span>YOUR PASSWORD</span>
        <PasswordInput id="del-pw" autoComplete="current-password" value={password}
                       className={error ? 'is-error' : undefined} onChange={(e) => { setPassword(e.target.value); setError(null); }} />
        <FieldNote error={error} />
      </label>
      <button type="button" className="btn btn--danger btn--block" onClick={go} disabled={busy || !password}>
        {busy ? <><span className="spinner" aria-hidden="true" /> DELETING…</> : 'DELETE ACCOUNT'}
      </button>
      <button type="button" className="state-panel__cancel" onClick={onClose}>Cancel</button>
    </Dialog>
  );
}

export function Security() {
  const { account } = useAccount();
  const [open, setOpen] = useState(null);
  const close = () => setOpen(null);
  return (
    <AccountFrame title="Security" note="Manage your password, two-step verification and where you’re signed in.">
      <div className="sec-rows">
        <SecurityRow icon={<LockIcon />} title="Password" text={`Last changed ${day(account.passwordChangedAt)}`} action="Edit" onClick={() => setOpen('password')} />
        <SecurityRow icon={<StateMark tone="ok" sign="shield" />} title="Two-factor authentication (2FA)"
                     text={account.twoFactor ? 'On: a code from your app at each sign-in.' : 'Add an extra layer of security to your account.'}
                     action={account.twoFactor ? 'Turn off' : 'Enable'} onClick={() => setOpen('2fa')} />
        <SecurityRow icon={<DeviceIcon />} title="Active sessions" text="Manage devices that are currently signed in to your account." action="Manage" onClick={() => setOpen('sessions')} />
        <SecurityRow icon={<ListIcon />} title="Account activity" text="View your recent account activity." action="View" onClick={() => setOpen('activity')} />
      </div>
      <div className="sec-danger">
        <span className="sec-row__icon" aria-hidden="true"><BinIcon /></span>
        <span className="sec-row__text"><strong>Delete account</strong><em>Remove your account and everything saved with it.</em></span>
        <button type="button" className="btn btn--danger sec-row__go" onClick={() => setOpen('delete')}>DELETE</button>
      </div>
      <ChangePassword open={open === 'password'} onClose={close} />
      <TwoStep open={open === '2fa'} onClose={close} />
      <Sessions open={open === 'sessions'} onClose={close} />
      <Activity open={open === 'activity'} onClose={close} />
      <DeleteAccount open={open === 'delete'} onClose={close} />
    </AccountFrame>
  );
}

