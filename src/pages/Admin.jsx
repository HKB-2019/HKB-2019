import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  adminLogin, adminLogout, adminMe, adminStatus, adminSetup, adminOrders,
  adminSummary, adminStock, adminSetStock, adminFulfil
} from '../lib/api.js';

const naira = (kobo) => '₦' + (kobo / 100).toLocaleString('en-NG');
// The API sends ISO 8601 with a timezone, so the browser shows local time.
const when = (iso) => iso ? new Date(iso).toLocaleString('en-GB', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
}) : '—';

const label = (status) => status.replace('_', ' ');

/* ------------------------------------------------------------------ login */

function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await adminLogin(password); onDone(); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="admin-gate">
      <form className="admin-gate__form" onSubmit={submit}>
        <p className="eyebrow">MASQ. Admin</p>
        <h1 className="admin-gate__title">Sign in</h1>
        <label className="field">
          <span>PASSWORD</span>
          <input
            type="password" autoFocus autoComplete="current-password"
            className={error ? 'is-error' : ''}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
          />
        </label>
        <button className="btn btn--solid btn--block" disabled={busy}>
          {busy ? 'CHECKING…' : 'SIGN IN'}
        </button>
        <p className={`form-msg${error ? ' is-show is-error' : ''}`} role="status" aria-live="polite">
          {error ?? ''}
        </p>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------ first run */

const MIN_PASSWORD = 12;

function Setup({ onDone }) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const mismatch = again.length > 0 && again !== password;

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) { setError(`Use at least ${MIN_PASSWORD} characters.`); return; }
    if (password !== again) { setError('The two passwords do not match.'); return; }
    setBusy(true); setError(null);
    try { await adminSetup(code, password); onDone(); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="admin-gate">
      <form className="admin-gate__form" onSubmit={submit}>
        <p className="eyebrow">MASQ. Admin</p>
        <h1 className="admin-gate__title">Choose your password</h1>
        <p className="admin-gate__note">
          This happens once. The setup code is in your host’s log — on Render,
          open your service and choose <strong>Logs</strong>.
        </p>

        <label className="field">
          <span>SETUP CODE</span>
          <input
            id="setup-code" autoFocus autoComplete="off" spellCheck="false"
            value={code} onChange={(e) => { setCode(e.target.value); setError(null); }}
          />
        </label>
        <label className="field">
          <span>NEW PASSWORD · AT LEAST {MIN_PASSWORD} CHARACTERS</span>
          <input
            id="setup-password" type="password" autoComplete="new-password"
            value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }}
          />
        </label>
        <label className="field">
          <span>TYPE IT AGAIN</span>
          <input
            id="setup-again" type="password" autoComplete="new-password"
            className={mismatch ? 'is-error' : ''}
            value={again} onChange={(e) => { setAgain(e.target.value); setError(null); }}
          />
        </label>

        <button className="btn btn--solid btn--block" disabled={busy || !code || !password || !again}>
          {busy ? 'SAVING…' : 'SET PASSWORD'}
        </button>
        <p className={`form-msg${error ? ' is-show is-error' : ''}`} role="status" aria-live="polite">
          {error ?? ''}
        </p>
      </form>
    </div>
  );
}

/* --------------------------------------------------------------- summary */

function Summary({ data }) {
  if (!data) return null;
  const tiles = [
    { label: 'Revenue',            value: naira(data.revenueKobo) },
    { label: 'Paid orders',        value: data.paidOrders },
    { label: 'To send',            value: data.awaitingFulfilment },
    { label: 'Awaiting payment',   value: data.pendingPayment }
  ];
  return (
    <>
      <div className="admin-tiles">
        {tiles.map(t => (
          <div className="admin-tile" key={t.label}>
            <span className="admin-tile__label">{t.label}</span>
            <span className="admin-tile__value">{t.value}</span>
          </div>
        ))}
      </div>
      {data.refundDue > 0 && (
        <p className="admin-alert" role="alert">
          <strong>{data.refundDue === 1 ? '1 customer is' : `${data.refundDue} customers are`} owed a refund.</strong>{' '}
          They paid after their order had lapsed, and the piece had already sold to
          someone else. Refund them from your Paystack dashboard — filter by
          “refund due” below to see who.
        </p>
      )}
      {data.lowStock.length > 0 && (
        <p className="admin-lowstock">
          <strong>Running low:</strong>{' '}
          {data.lowStock.map(s => `${s.name} (${s.size}) — ${s.stock}`).join(' · ')}
        </p>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- orders */

const STATUSES = ['', 'paid', 'pending', 'refund_due', 'failed', 'abandoned'];

function Orders({ orders, onFulfil, filter, setFilter, busyRef }) {
  return (
    <section className="admin-section">
      <div className="admin-section__head">
        <h2 className="admin-h2">Orders</h2>
        <div className="admin-filters">
          {STATUSES.map(s => (
            <button
              key={s || 'all'}
              className={`admin-chip${filter === s ? ' is-on' : ''}`}
              onClick={() => setFilter(s)}
            >{s ? label(s) : 'all'}</button>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="admin-empty">{filter ? `No ${label(filter)} orders.` : 'No orders yet.'}</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reference</th><th>Customer</th><th>Items</th>
                <th className="num">Total</th><th>Status</th><th>Placed</th><th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td className="mono">{o.reference}</td>
                  <td>{o.email}</td>
                  <td className="admin-items">
                    {o.items.map((i, n) => (
                      <span key={n}>{i.qty}× {i.name} <em>{i.size}</em></span>
                    ))}
                  </td>
                  <td className="num">{naira(o.subtotalKobo)}</td>
                  <td>
                    <span className={`admin-status admin-status--${o.status}`}>{label(o.status)}</span>
                    {o.fulfilledAt && <span className="admin-status admin-status--sent">sent</span>}
                  </td>
                  <td className="admin-when">{when(o.createdAt)}</td>
                  <td>
                    {o.status === 'paid' && !o.fulfilledAt && (
                      <button
                        className="admin-action"
                        disabled={busyRef === o.reference}
                        onClick={() => onFulfil(o.reference)}
                      >{busyRef === o.reference ? '…' : 'MARK SENT'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- stock */

function StockRow({ row, onSave }) {
  const [value, setValue] = useState(String(row.stock));
  const [state, setState] = useState(null);       // 'saving' | 'saved' | error text

  useEffect(() => { setValue(String(row.stock)); }, [row.stock]);

  const dirty = value !== String(row.stock);

  const save = async () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) { setState('Whole numbers only'); return; }
    setState('saving');
    try { await onSave(row.variantId, n); setState('saved'); setTimeout(() => setState(null), 1400); }
    catch (err) { setState(err.message); }
  };

  return (
    <tr>
      <td>{row.name}</td>
      <td className="mono">{row.size}</td>
      <td className="num">{naira(row.priceKobo)}</td>
      <td>
        <input
          className="admin-stock-input"
          type="number" min="0" inputMode="numeric"
          value={value}
          onChange={(e) => { setValue(e.target.value); setState(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && dirty) save(); }}
        />
      </td>
      <td>
        {dirty && <button className="admin-action" onClick={save}>SAVE</button>}
        {state === 'saving' && <span className="admin-note">saving…</span>}
        {state === 'saved'  && <span className="admin-note admin-note--ok">saved</span>}
        {state && !['saving','saved'].includes(state) && <span className="admin-note admin-note--bad">{state}</span>}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ page */

export default function Admin() {
  const [signedIn, setSignedIn] = useState(null);   // null = still checking
  const [needsSetup, setNeedsSetup] = useState(false);
  const [summary, setSummary]   = useState(null);
  const [orders, setOrders]     = useState([]);
  const [stock, setStock]       = useState([]);
  const [filter, setFilter]     = useState('');
  const [busyRef, setBusyRef]   = useState(null);
  const [tab, setTab]           = useState('orders');

  useEffect(() => {
    adminMe()
      .then(() => setSignedIn(true))
      .catch(async () => {
        // Not signed in: is there a password to sign in with yet?
        try { setNeedsSetup(!(await adminStatus()).configured); } catch { /* show sign-in */ }
        setSignedIn(false);
      });
  }, []);

  const load = useCallback(async () => {
    const [s, o, st] = await Promise.all([
      adminSummary(), adminOrders(filter), adminStock()
    ]);
    setSummary(s); setOrders(o); setStock(st);
  }, [filter]);

  useEffect(() => { if (signedIn) load().catch(() => setSignedIn(false)); }, [signedIn, load]);

  const onFulfil = async (reference) => {
    setBusyRef(reference);
    try { await adminFulfil(reference); await load(); }
    finally { setBusyRef(null); }
  };

  const onSaveStock = async (variantId, value) => {
    await adminSetStock(variantId, value);
    await load();
  };

  if (signedIn === null) return <div className="admin-gate"><p className="admin-empty">Checking…</p></div>;
  if (!signedIn && needsSetup) return <Setup onDone={() => { setNeedsSetup(false); setSignedIn(true); }} />;
  if (!signedIn) return <Login onDone={() => setSignedIn(true)} />;

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="admin-header__inner">
          <a href="/" className="logo">MASQ<span>.</span></a>
          <span className="admin-badge">ADMIN</span>
          <nav className="admin-tabs">
            {['orders', 'stock'].map(t => (
              <button key={t}
                className={`admin-tab${tab === t ? ' is-on' : ''}`}
                onClick={() => setTab(t)}>{t.toUpperCase()}</button>
            ))}
          </nav>
          <button className="admin-signout"
                  onClick={() => adminLogout().then(() => setSignedIn(false))}>SIGN OUT</button>
        </div>
      </header>

      <main className="admin-main">
        <Summary data={summary} />

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {tab === 'orders' ? (
              <Orders
                orders={orders} onFulfil={onFulfil}
                filter={filter} setFilter={setFilter} busyRef={busyRef}
              />
            ) : (
              <section className="admin-section">
                <div className="admin-section__head"><h2 className="admin-h2">Stock</h2></div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Piece</th><th>Size</th><th className="num">Price</th><th>In stock</th><th></th></tr>
                    </thead>
                    <tbody>
                      {stock.map(row => (
                        <StockRow key={row.variantId} row={row} onSave={onSaveStock} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
