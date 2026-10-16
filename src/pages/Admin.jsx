import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  adminLogin, adminLogout, adminMe, adminStatus, adminSetup, adminOrders,
  adminSummary, adminFulfil, adminRefunded, adminDownload
} from '../lib/api.js';
import ProductsTab from './admin/ProductsTab.jsx';
import { pageHref } from '../lib/media.js';
import { useTheme } from '../lib/theme.js';
import { Sun, Moon } from '../components/Icons.jsx';
import SettingsTab from './admin/SettingsTab.jsx';
import ListTab from './admin/ListTab.jsx';
import HomeTab from './admin/HomeTab.jsx';
import SalesTab from './admin/SalesTab.jsx';
import StockTab from './admin/StockTab.jsx';
import CustomersTab from './admin/CustomersTab.jsx';

// Charts and maps load only when the tab is opened — never for shoppers.
const VisitorsTab = lazy(() => import('./admin/visitors/VisitorsTab.jsx'));

const TABS = [
  ['orders', 'ORDERS'],
  ['customers', 'CUSTOMERS'],
  ['visitors', 'VISITORS'],
  ['sales', 'SALES'],
  ['products', 'PRODUCTS'],
  ['home', 'HOME PAGE'],
  ['stock', 'STOCK'],
  ['list', 'LIST'],
  ['settings', 'SETTINGS']
];

const ZONE_LABELS = { lagos: 'Lagos', abuja: 'Abuja', nigeria: 'rest of Nigeria', international: 'abroad' };

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

/* The shop at a glance. The four figures belong to ORDERS, the day-to-day
 * page; anything that needs acting on now (checkout closed, a refund owed)
 * shows on every tab; the gentler notes only where they are acted on. */
function Summary({ data, goTo, tab }) {
  if (!data) return null;
  const tiles = [
    { label: 'Revenue',            value: naira(data.revenueKobo) },
    { label: 'Paid orders',        value: data.paidOrders },
    { label: 'To send',            value: data.awaitingFulfilment },
    { label: 'Awaiting payment',   value: data.pendingPayment }
  ];
  return (
    <>
      {tab === 'orders' && (
        <div className="admin-tiles">
          {tiles.map(t => (
            <div className="admin-tile" key={t.label}>
              <span className="admin-tile__label">{t.label}</span>
              <span className="admin-tile__value">{t.value}</span>
            </div>
          ))}
        </div>
      )}
      {data.checkoutOpen === false && (
        <p className="admin-alert" role="alert">
          <strong>Checkout is closed.</strong> Customers can browse and fill their bags, but cannot pay
          until you set delivery prices.{' '}
          <button className="admin-link admin-link--strong" onClick={() => goTo('settings')}>Set delivery prices →</button>
        </p>
      )}
      {data.refundDue > 0 && (
        <p className="admin-alert" role="alert">
          <strong>{data.refundDue === 1 ? '1 customer is' : `${data.refundDue} customers are`} owed a refund.</strong>{' '}
          They paid after their order had lapsed, and the piece had already sold to
          someone else. Refund them from your Paystack dashboard — filter by
          “refund due” below to see who.
        </p>
      )}
      {data.alertsReady > 0 && ['orders', 'list'].includes(tab) && (
        <p className="admin-alert admin-alert--info">
          <strong>{data.alertsReady === 1 ? '1 person is' : `${data.alertsReady} people are`} waiting for a size that is back in stock.</strong>{' '}
          <button className="admin-link admin-link--strong" onClick={() => goTo('list')}>See who →</button>
        </p>
      )}
      {data.lowStock.length > 0 && ['orders', 'stock'].includes(tab) && (
        <p className="admin-lowstock">
          <strong>Running low:</strong>{' '}
          {data.lowStock.map(s => `${s.name} (${s.colour ? `${s.colour}, ` : ''}${s.size}) — ${s.stock}`).join(' · ')}
        </p>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- orders */

const STATUSES = ['', 'paid', 'pending', 'refund_due', 'refunded', 'failed', 'abandoned'];

/**
 * What can be done with one order: send it (with the courier and tracking
 * number, which the customer sees), correct those later, or record a refund
 * made in Paystack. Each asks before it acts, in the row itself.
 */
function OrderActions({ order: o, onChanged }) {
  const [mode, setMode] = useState(null);           // null | 'send' | 'refund'
  const [courier, setCourier] = useState(o.courier ?? '');
  const [tracking, setTracking] = useState(o.tracking ?? '');
  const [restock, setRestock] = useState(!o.fulfilledAt && o.status === 'paid');
  const [state, setState] = useState(null);

  const run = async (fn) => {
    setState('saving');
    try { await fn(); setMode(null); setState(null); await onChanged(); }
    catch (err) { setState(err.message); }
  };

  if (mode === 'send') {
    return (
      <form className="admin-row-form" onSubmit={(e) => { e.preventDefault(); run(() => adminFulfil(o.reference, { courier, tracking })); }}>
        <input aria-label="Courier" placeholder="Courier, e.g. GIG" maxLength={40} value={courier} onChange={(e) => setCourier(e.target.value)} />
        <input aria-label="Tracking number" placeholder="Tracking no. (optional)" maxLength={60} value={tracking} onChange={(e) => setTracking(e.target.value)} />
        <div className="admin-row-form__actions">
          <button className="admin-action admin-action--primary" disabled={state === 'saving'}>
            {o.fulfilledAt ? 'SAVE' : 'MARK SENT'}
          </button>
          <button type="button" className="admin-link" onClick={() => { setMode(null); setState(null); }}>cancel</button>
        </div>
        {state && state !== 'saving' && <span className="admin-note admin-note--bad" role="alert">{state}</span>}
      </form>
    );
  }

  if (mode === 'refund') {
    return (
      <div className="admin-row-form">
        <p className="admin-row-form__note">Refund the customer in your Paystack dashboard first. This only records it here.</p>
        {o.status === 'paid' && (
          <label className="admin-check">
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
            Put the pieces back in stock
          </label>
        )}
        <div className="admin-row-form__actions">
          <button className="admin-action admin-action--danger" disabled={state === 'saving'}
                  onClick={() => run(() => adminRefunded(o.reference, o.status === 'paid' && restock))}>MARK REFUNDED</button>
          <button className="admin-link" onClick={() => { setMode(null); setState(null); }}>cancel</button>
        </div>
        {state && state !== 'saving' && <span className="admin-note admin-note--bad" role="alert">{state}</span>}
      </div>
    );
  }

  return (
    <div className="admin-row-actions admin-row-actions--stack">
      {o.status === 'paid' && !o.fulfilledAt && (
        <button className="admin-action" onClick={() => setMode('send')}>MARK SENT</button>
      )}
      {o.status === 'paid' && o.fulfilledAt && (
        <button className="admin-link" onClick={() => setMode('send')}>{o.tracking ? 'edit tracking' : 'add tracking'}</button>
      )}
      {['paid', 'refund_due'].includes(o.status) && (
        <button className="admin-link" onClick={() => setMode('refund')}>refunded?</button>
      )}
    </div>
  );
}

function Orders({ orders, onChanged, filter, setFilter }) {
  const [exportError, setExportError] = useState(null);
  const exportCsv = () => {
    setExportError(null);
    adminDownload('/admin/orders.csv' + (filter ? `?status=${filter}` : '')).catch(err => setExportError(err.message));
  };
  return (
    <section className="admin-section">
      <div className="admin-section__head">
        <h2 className="admin-h2">Orders</h2>
        <button className="admin-action" onClick={exportCsv} disabled={!orders.length}>DOWNLOAD CSV</button>
        {exportError && <span className="admin-note admin-note--bad">{exportError}</span>}
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
                <th>Reference</th><th>Deliver to</th><th>Items</th>
                <th className="num">Total</th><th>Status</th><th>Placed</th><th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td className="mono">{o.reference}</td>
                  <td className="admin-who">
                    {o.name && <strong>{o.name}</strong>}
                    {o.phone && <a href={`tel:${o.phone.replace(/[^\d+]/g, '')}`}>{o.phone}</a>}
                    <span>{o.email}</span>
                    {o.address && (
                      <span className="admin-who__addr">
                        {[o.address.line1, o.address.line2].filter(Boolean).join(', ')}<br />
                        {[o.address.city, [o.address.state, o.address.postcode].filter(Boolean).join(' '), o.address.country !== 'Nigeria' ? o.address.country : null].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="admin-items">
                    {o.items.map((i, n) => (
                      <span key={n}>{i.qty}× {i.name} <em>{i.colour ? `${i.colour}, ${i.size}` : i.size}</em></span>
                    ))}
                  </td>
                  <td className="num">
                    {naira(o.totalKobo ?? o.subtotalKobo)}
                    {o.discountKobo > 0 && (
                      <em className="admin-sub admin-sub--discount">{o.discountCode} −{naira(o.discountKobo)}</em>
                    )}
                    {o.shippingKobo > 0 && (
                      <em className="admin-sub">incl. {naira(o.shippingKobo)} delivery{o.zone ? ` · ${ZONE_LABELS[o.zone] ?? o.zone}` : ''}</em>
                    )}
                  </td>
                  <td>
                    <span className={`admin-status admin-status--${o.status}`}>{label(o.status)}</span>
                    {o.fulfilledAt && o.status === 'paid' && <span className="admin-status admin-status--sent">sent</span>}
                    {o.fulfilledAt && (o.courier || o.tracking) && (
                      <em className="admin-sub">{[o.courier, o.tracking].filter(Boolean).join(' · ')}</em>
                    )}
                  </td>
                  <td className="admin-when">{when(o.createdAt)}</td>
                  <td><OrderActions order={o} onChanged={onChanged} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ page */

export default function Admin() {
  const { theme, toggle } = useTheme();
  const [signedIn, setSignedIn] = useState(null);   // null = still checking
  const [needsSetup, setNeedsSetup] = useState(false);
  const [summary, setSummary]   = useState(null);
  const [orders, setOrders]     = useState([]);
  const [filter, setFilter]     = useState('');
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
    const [s, o] = await Promise.all([adminSummary(), adminOrders(filter)]);
    setSummary(s); setOrders(o);
  }, [filter]);

  useEffect(() => { if (signedIn) load().catch(() => setSignedIn(false)); }, [signedIn, load]);

  // On a phone the tab row scrolls sideways: bring the open tab into view,
  // sideways only, so the page itself never jumps.
  useEffect(() => {
    const row = document.querySelector('.admin-tabs__inner');
    const on = row?.querySelector('.admin-tab.is-on');
    if (!row || !on) return;
    const left = on.offsetLeft - row.offsetLeft, right = left + on.offsetWidth;
    if (left < row.scrollLeft + 16) row.scrollLeft = Math.max(0, left - 24);
    else if (right > row.scrollLeft + row.clientWidth - 48) row.scrollLeft = right - row.clientWidth + 56;
  }, [tab, signedIn]);

  // Summary tiles and banners follow what the other tabs change.
  const refreshSummary = useCallback(() => { adminSummary().then(setSummary).catch(() => {}); }, []);

  // Tabs switch without a reload; the address keeps the tab, so a refresh or
  // a bookmark lands where the owner was.
  // Follows the address too — typing #settings, or Back after a tab change.
  useEffect(() => {
    const follow = () => {
      const fromHash = window.location.hash.slice(1);
      if (TABS.some(([t]) => t === fromHash)) setTab(fromHash);
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);
  const goTo = (t) => {
    setTab(t);
    if (window.location.hash !== `#${t}`) history.pushState(null, '', `#${t}`);
    if (t === 'orders' || t === 'stock') load().catch(() => {});
  };

  if (signedIn === null) return <div className="admin-gate"><p className="admin-empty">Checking…</p></div>;
  if (!signedIn && needsSetup) return <Setup onDone={() => { setNeedsSetup(false); setSignedIn(true); }} />;
  if (!signedIn) return <Login onDone={() => setSignedIn(true)} />;

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="admin-header__inner">
          <a href={pageHref('/')} className="logo" aria-label="MASQ. — back to the shop">MASQ<span>.</span></a>
          <span className="admin-badge">ADMIN</span>
          <button className="icon-btn admin-theme" onClick={toggle}
                  aria-label={theme === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme'}>
            {theme === 'light' ? <Moon /> : <Sun />}
          </button>
          <button className="admin-signout"
                  onClick={() => adminLogout().then(() => setSignedIn(false))}>SIGN OUT</button>
        </div>
        <nav className="admin-tabs" aria-label="Admin sections">
          <div className="admin-tabs__inner">
            {TABS.map(([t, label]) => (
              <button key={t} aria-current={tab === t ? 'page' : undefined}
                className={`admin-tab${tab === t ? ' is-on' : ''}`}
                onClick={() => goTo(t)}>{label}</button>
            ))}
          </div>
        </nav>
      </header>

      <main className="admin-main">
        <h1 className="sr-only">MASQ. admin — {TABS.find(([t]) => t === tab)?.[1]}</h1>
        <Summary data={summary} goTo={goTo} tab={tab} />

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {tab === 'orders' && (
              <Orders
                orders={orders} onChanged={load}
                filter={filter} setFilter={setFilter}
              />
            )}
            {tab === 'products' && <ProductsTab onSummaryChange={refreshSummary} />}
            {tab === 'stock' && <StockTab onChanged={refreshSummary} />}
            {tab === 'customers' && <CustomersTab onChanged={refreshSummary} />}
            {tab === 'home' && <HomeTab />}
            {tab === 'sales' && <SalesTab />}
            {tab === 'visitors' && (
              <Suspense fallback={<p className="admin-empty">Loading…</p>}><VisitorsTab /></Suspense>
            )}
            {tab === 'list' && <ListTab onSummaryChange={refreshSummary} />}
            {tab === 'settings' && <SettingsTab onSummaryChange={refreshSummary} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
