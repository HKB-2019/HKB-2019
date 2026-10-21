import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  accountAddresses, accountAddAddress, accountEditAddress, accountDefaultAddress, accountRemoveAddress
} from '../../lib/api.js';
import { useShop } from '../../store/ShopContext.jsx';
import { isPhone } from '../../lib/delivery.js';
import { countriesAbroad } from '../../data/countries.js';
import FieldNote from '../FieldNote.jsx';
import StateMark, { TrashMark } from '../StateMark.jsx';
import Dialog from '../Dialog.jsx';
import { ErrorBanner, detailsOf } from '../Notices.jsx';
import { PhoneField, fullPhone } from './parts.jsx';
import { AccountFrame } from './AccountArea.jsx';
import { EASE_OUT, UI_IN } from '../../lib/motion.js';

/* Saved delivery addresses: kept on the account, checked by checkout's own
 * rules, and offered at checkout with the default filled in. */

const BLANK = { label: '', name: '', phone: '', isDefault: false,
  address: { line1: '', line2: '', city: '', state: '', postcode: '', country: 'Nigeria' } };
const LABELS = ['Home', 'Work'];

const stateName = (s) => (s === 'FCT' ? 'FCT (Abuja)' : s);

/** "12 Admiralty Way, Flat 3B · Lekki, Lagos" — for a card or a picker. */
export function addressLines(a) {
  const { line1, line2, city, state, postcode, country } = a.address;
  return [
    [line1, line2].filter(Boolean).join(', '),
    [city, stateName(state), postcode].filter(Boolean).join(', ') + (country && country !== 'Nigeria' ? ` · ${country}` : '')
  ];
}

const PinPicture = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M10 22l14-6 16 6 14-6v28l-14 6-16-6-14 6z" /><path d="M24 16v28M40 22v28" />
    <path d="M40 10c-4.4 0-8 3.4-8 7.8C32 24 40 32 40 32s8-8 8-14.2C48 13.4 44.4 10 40 10z" stroke="var(--ok)" strokeWidth="2.4" />
    <circle cx="40" cy="18" r="2.6" stroke="var(--ok)" strokeWidth="2.4" />
  </svg>
);

function AddressForm({ open, editing, first, onClose, onSaved }) {
  const { site } = useShop();
  const [f, setF] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const abroadOpen = (site?.delivery ?? []).some(z => z.zone === 'international');
  const inNigeria = f.address.country === 'Nigeria';

  useEffect(() => {
    if (!open) return;
    setErrors({}); setBusy(false);
    setF(editing
      ? { ...editing, phone: editing.phone.replace(/^\+234\s?/, ''), address: { ...BLANK.address, ...editing.address } }
      : BLANK);
  }, [open, editing]);

  const set = (k) => (v) => { setF(x => ({ ...x, [k]: v })); setErrors(x => ({ ...x, [k]: null, form: null })); };
  const setAddr = (k) => (e) => {
    const v = e.target.value;
    setF(x => ({ ...x, address: { ...x.address, [k]: v,
      // Nigeria's states are a list, other countries' are typed.
      ...(k === 'country' && (v === 'Nigeria') !== (x.address.country === 'Nigeria') ? { state: '' } : {}) } }));
    setErrors(x => ({ ...x, [k]: null, form: null }));
  };

  const check = () => {
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Enter the full name for delivery.';
    if (!isPhone(fullPhone(f.phone))) e.phone = 'Enter a phone number the rider can call.';
    if (!f.address.state.trim()) e.state = inNigeria ? 'Choose the state.' : 'Enter the state or region.';
    if (f.address.city.trim().length < 2) e.city = 'Enter the city or area.';
    if (f.address.line1.trim().length < 3) e.line1 = 'Enter the street address.';
    return e;
  };

  const save = async (ev) => {
    ev.preventDefault();
    const e = check();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const body = { label: f.label.trim(), name: f.name.trim(), phone: fullPhone(f.phone), isDefault: f.isDefault,
      address: { ...f.address, postcode: inNigeria ? '' : f.address.postcode } };
    try {
      const list = editing ? await accountEditAddress(editing.id, body) : await accountAddAddress(body);
      onSaved(list, editing ? 'Address updated' : 'Address saved');
    } catch (err) { setErrors({ [err.field ?? 'form']: err.message }); }
    setBusy(false);
  };

  const bad = (k) => (errors[k] ? { 'aria-invalid': true, className: 'is-error' } : {});
  return (
    <Dialog open={open} tone="info" labelledBy="addrTitle" onClose={onClose}>
      <StateMark tone="info" sign="pin" size="lg" />
      <h2 className="state-panel__title" id="addrTitle">{editing ? 'Edit address' : 'Add an address'}</h2>
      <form className="acct-form acct-form--dialog" onSubmit={save} noValidate>
        <div className="field field--tight">
          <span id="a-label-name">LABEL<em className="field__hint"> · optional</em></span>
          <div className="addr-labels" role="group" aria-labelledby="a-label-name">
            {LABELS.map(l => (
              <button key={l} type="button" className={`chip${f.label === l ? ' is-on' : ''}`} aria-pressed={f.label === l}
                      onClick={() => set('label')(f.label === l ? '' : l)}>{l}</button>
            ))}
            <input aria-label="Or name it yourself" placeholder="Or name it…" maxLength={30}
                   value={LABELS.includes(f.label) ? '' : f.label} onChange={(e) => set('label')(e.target.value)} {...bad('label')} />
          </div>
          <FieldNote error={errors.label} />
        </div>
        <label className="field field--tight" htmlFor="a-name"><span>FULL NAME</span>
          <input id="a-name" autoComplete="name" value={f.name} onChange={(e) => set('name')(e.target.value)} {...bad('name')} autoFocus />
          <FieldNote error={errors.name} />
        </label>
        <label className="field field--tight" htmlFor="a-phone"><span>PHONE<em className="field__hint"> · for the rider</em></span>
          <PhoneField id="a-phone" value={f.phone} onChange={set('phone')} {...bad('phone')} />
          <FieldNote error={errors.phone} />
        </label>
        {(abroadOpen || !inNigeria) && (
          <label className="field field--tight" htmlFor="a-country"><span>COUNTRY</span>
            <select id="a-country" autoComplete="country-name" value={f.address.country} onChange={setAddr('country')} {...bad('country')}>
              <option value="Nigeria">Nigeria</option>
              <optgroup label="Outside Nigeria">
                {countriesAbroad().map(c => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            </select>
            <FieldNote error={errors.country} />
          </label>
        )}
        <div className="acct-form__two">
          <label className="field field--tight" htmlFor="a-state"><span>{inNigeria ? 'STATE' : 'STATE OR REGION'}</span>
            {inNigeria ? (
              <select id="a-state" autoComplete="address-level1" value={f.address.state} onChange={setAddr('state')} {...bad('state')}>
                <option value="">Choose…</option>
                {(site?.states ?? []).map(s => <option key={s} value={s}>{stateName(s)}</option>)}
              </select>
            ) : <input id="a-state" autoComplete="address-level1" value={f.address.state} onChange={setAddr('state')} {...bad('state')} />}
            <FieldNote error={errors.state} />
          </label>
          <label className="field field--tight" htmlFor="a-city"><span>CITY OR AREA</span>
            <input id="a-city" autoComplete="address-level2" placeholder={inNigeria ? 'e.g. Lekki' : ''}
                   value={f.address.city} onChange={setAddr('city')} {...bad('city')} />
            <FieldNote error={errors.city} />
          </label>
        </div>
        <label className="field field--tight" htmlFor="a-line1"><span>STREET ADDRESS</span>
          <input id="a-line1" autoComplete="address-line1" value={f.address.line1} onChange={setAddr('line1')} {...bad('line1')} />
          <FieldNote error={errors.line1} />
        </label>
        <label className="field field--tight" htmlFor="a-line2"><span>FLAT, LANDMARK<em className="field__hint"> · optional</em></span>
          <input id="a-line2" autoComplete="address-line2" value={f.address.line2} onChange={setAddr('line2')} />
        </label>
        {!inNigeria && (
          <label className="field field--tight" htmlFor="a-postcode"><span>POSTCODE / ZIP<em className="field__hint"> · if you have one</em></span>
            <input id="a-postcode" autoComplete="postal-code" maxLength={12} value={f.address.postcode} onChange={setAddr('postcode')} {...bad('postcode')} />
            <FieldNote error={errors.postcode} />
          </label>
        )}
        {!first && !editing?.isDefault && (
          <label className="check addr-default">
            <input type="checkbox" checked={f.isDefault} onChange={(e) => set('isDefault')(e.target.checked)} />
            <span>Use as my default address</span>
          </label>
        )}
        {errors.form && <p className="field__error" role="alert">{errors.form}</p>}
        <button type="submit" className="btn btn--contrast btn--block" disabled={busy}>
          {busy ? <><span className="spinner" aria-hidden="true" /> SAVING…</> : editing ? 'SAVE CHANGES' : 'SAVE ADDRESS'}
        </button>
      </form>
      <button type="button" className="state-panel__cancel" onClick={onClose}>Cancel</button>
    </Dialog>
  );
}

export function Addresses() {
  const { toast, failed } = useShop();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [form, setForm] = useState(null);         // null | { editing }
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(null);         // id being changed

  const load = async () => {
    setRetrying(true);
    try { setList(await accountAddresses()); setError(null); } catch (err) { setError(err); }
    setRetrying(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (id, run, done) => {
    setBusy(id);
    try { setList(await run()); if (done) toast({ key: 'address', tone: 'ok', title: done }); }
    catch (err) {
      if (err.status === 404) { toast({ key: 'address', tone: 'bad', title: 'That didn’t work.', body: err.message }); load(); }
      else failed({ key: 'address', title: 'That didn’t work.', body: err.message, done: done ? { title: done } : undefined,
        run: async () => setList(await run()) });
    }
    setBusy(null);
  };
  const remove = async () => {
    const gone = removing;
    await act(gone.id, () => accountRemoveAddress(gone.id), 'Address removed');
    setRemoving(null);
  };

  let body;
  if (error && !list) {
    body = <ErrorBanner layout="panel" picture={error.status === 0 ? 'offline' : 'list'} title="We couldn’t load your addresses."
                        text="Please try again." onRetry={load} retrying={retrying} retryLabel="Retry" details={detailsOf(error)} />;
  } else if (!list) {
    body = (
      <div className="addr-list" aria-busy="true" aria-label="Loading your addresses">
        {[0, 1].map(i => <div key={i} className="addr addr--ghost"><span /><span /><span /></div>)}
      </div>
    );
  } else if (!list.length) {
    body = (
      <motion.div className="empty acct-empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: UI_IN, ease: EASE_OUT }}>
        <motion.span className="empty__icon empty__icon--big" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: EASE_OUT }}><PinPicture /></motion.span>
        <h2 className="empty__title">No saved addresses yet.</h2>
        <p className="empty__text">Save one and checkout fills it in for you.</p>
        <button type="button" className="btn btn--contrast" onClick={() => setForm({ editing: null })}>ADD AN ADDRESS</button>
      </motion.div>
    );
  } else {
    body = (
      <>
        <ul className="addr-list">
          <AnimatePresence initial={false}>
            {list.map((a, i) => {
              const [one, two] = addressLines(a);
              return (
                <motion.li key={a.id} layout="position" className={`addr${a.isDefault ? ' is-default' : ''}`}
                           initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                           transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.04, ease: EASE_OUT }}>
                  <div className="addr__top">
                    <strong>{a.label || 'Address'}</strong>
                    {a.isDefault && <span className="pill pill--ok">Default</span>}
                  </div>
                  <p className="addr__lines"><span>{a.name}</span><span>{one}</span><span>{two}</span><span className="addr__phone">{a.phone}</span></p>
                  <div className="addr__acts">
                    <button type="button" className="auth__link" onClick={() => setForm({ editing: a })}>Edit</button>
                    {!a.isDefault && (
                      <button type="button" className="auth__link" disabled={busy === a.id}
                              onClick={() => act(a.id, () => accountDefaultAddress(a.id), 'Default address changed')}>Make default</button>
                    )}
                    <button type="button" className="auth__link addr__remove" onClick={() => setRemoving(a)}>Remove</button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {list.length < 10
          ? <button type="button" className="btn btn--ghost addr-add" onClick={() => setForm({ editing: null })}>+ ADD AN ADDRESS</button>
          : <p className="field__help">You can keep up to 10 addresses.</p>}
      </>
    );
  }

  return (
    <AccountFrame title="Addresses" note="Saved for checkout. Your default fills in for you.">
      {body}
      <AddressForm open={Boolean(form)} editing={form?.editing ?? null} first={!list?.length} onClose={() => setForm(null)}
                   onSaved={(next, title) => { setList(next); setForm(null); toast({ key: 'address', tone: 'ok', title }); }} />
      <Dialog open={Boolean(removing)} tone="bad" labelledBy="addrRemoveTitle" onClose={() => setRemoving(null)}>
        <TrashMark />
        <h2 className="state-panel__title" id="addrRemoveTitle">Remove this address?</h2>
        {removing && <p className="state-panel__note">{removing.label || 'This address'}: {addressLines(removing)[0]}, {removing.address.city}.</p>}
        <button type="button" className="btn btn--danger btn--block" onClick={remove} disabled={busy === removing?.id}>
          {busy === removing?.id ? <><span className="spinner" aria-hidden="true" /> REMOVING…</> : 'REMOVE'}
        </button>
        <button type="button" className="state-panel__cancel" onClick={() => setRemoving(null)}>Cancel</button>
      </Dialog>
    </AccountFrame>
  );
}
