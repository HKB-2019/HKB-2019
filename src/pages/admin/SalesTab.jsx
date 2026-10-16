import { useEffect, useState } from 'react';
import {
  adminSales, adminDiscounts, adminCreateDiscount, adminUpdateDiscount, adminDeleteDiscount
} from '../../lib/api.js';
import GiftCardsSection from './GiftCardsSection.jsx';

/* What has sold, and the discount codes. Paid orders only: an order still
 * waiting for payment, or refunded, is not money the shop has. */

const naira = (kobo) => '₦' + Math.round(kobo / 100).toLocaleString('en-NG');
const short = (kobo) => {
  const n = kobo / 100;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}m`;
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}k`;
  return `₦${Math.round(n)}`;
};
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });

function Note({ state }) {
  if (!state) return null;
  if (state === 'saving') return <span className="admin-note">saving…</span>;
  if (state === 'saved') return <span className="admin-note admin-note--ok">saved</span>;
  return <span className="admin-note admin-note--bad" role="alert">{state}</span>;
}

/* ---------------------------------------------------------------- chart */

/**
 * Money in per week, Monday to Sunday, Lagos time. One measure, so one
 * colour and no legend; each bar names its week and amount on hover or
 * focus, and the table under it says the same in words.
 */
function WeeklyChart({ weeks }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...weeks.map(w => w.revenueKobo), 0);
  // A tidy top line for the scale: 1, 2 or 5 times a power of ten.
  const top = (() => {
    if (!max) return 100_000_00;
    const p = 10 ** Math.floor(Math.log10(max));
    return [1, 2, 5, 10].map(m => m * p).find(v => v >= max);
  })();
  const shown = hover ?? weeks.length - 1;

  return (
    <figure className="admin-chart">
      <figcaption className="admin-chart__head">
        <span className="admin-chart__title">Money in, by week</span>
        <span className="admin-chart__readout" aria-live="polite">
          Week of {day(weeks[shown].start)}: <strong>{naira(weeks[shown].revenueKobo)}</strong>
          {' '}· {weeks[shown].orders} {weeks[shown].orders === 1 ? 'order' : 'orders'}
        </span>
      </figcaption>
      <div className="admin-chart__plot">
        <div className="admin-chart__grid" aria-hidden="true">
          {[1, 0.5, 0].map(f => (
            <span key={f} style={{ bottom: `${f * 100}%` }}><em>{short(top * f)}</em></span>
          ))}
        </div>
        <div className="admin-chart__bars" onMouseLeave={() => setHover(null)}>
          {weeks.map((w, i) => (
            <button
              key={w.start} type="button"
              className={`admin-chart__col${i === shown ? ' is-on' : ''}`}
              aria-label={`Week of ${day(w.start)}: ${naira(w.revenueKobo)}, ${w.orders} orders`}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            >
              <span className="admin-chart__bar" style={{ height: `${(w.revenueKobo / top) * 100}%` }} />
            </button>
          ))}
        </div>
      </div>
      <div className="admin-chart__axis" aria-hidden="true">
        {weeks.map((w, i) => <span key={w.start}>{i % 3 === 0 || i === weeks.length - 1 ? day(w.start) : ''}</span>)}
      </div>
    </figure>
  );
}

/* ------------------------------------------------------- discount codes */

function NewCode({ onMade }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: '', kind: 'percent', amount: '', minSpend: '', maxUses: '', endsAt: '' });
  const [state, setState] = useState(null);
  const set = (k) => (e) => setF(v => ({ ...v, [k]: e.target.value }));
  const num = (v) => (String(v).trim() === '' ? null : Number(String(v).replace(/[₦,\s%]/g, '')));

  const submit = async (e) => {
    e.preventDefault();
    setState('saving');
    try {
      const made = await adminCreateDiscount({
        code: f.code, kind: f.kind, amount: num(f.amount),
        minSpendNaira: num(f.minSpend) ?? 0, maxUses: num(f.maxUses),
        endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null
      });
      setF({ code: '', kind: 'percent', amount: '', minSpend: '', maxUses: '', endsAt: '' });
      setState(null); setOpen(false); onMade(made);
    } catch (err) { setState(err.message); }
  };

  if (!open) return <button className="admin-action admin-action--primary" onClick={() => setOpen(true)}>+ NEW CODE</button>;
  return (
    <form className="admin-card admin-code-form" onSubmit={submit}>
      <label className="admin-field">
        <span>Code <em>what customers type</em></span>
        <input value={f.code} maxLength={24} placeholder="LAUNCH10" autoCapitalize="characters" onChange={set('code')} />
      </label>
      <div className="admin-field">
        <span>Takes off</span>
        <div className="admin-segment" role="radiogroup" aria-label="Kind of discount">
          <button type="button" role="radio" aria-checked={f.kind === 'percent'} className={f.kind === 'percent' ? 'is-on' : ''}
                  onClick={() => setF(v => ({ ...v, kind: 'percent' }))}>PER CENT</button>
          <button type="button" role="radio" aria-checked={f.kind === 'fixed'} className={f.kind === 'fixed' ? 'is-on' : ''}
                  onClick={() => setF(v => ({ ...v, kind: 'fixed' }))}>NAIRA</button>
        </div>
      </div>
      <label className="admin-field">
        <span>{f.kind === 'percent' ? 'Per cent off (1–90)' : 'Naira off'}</span>
        <input value={f.amount} inputMode="numeric" placeholder={f.kind === 'percent' ? '10' : '5000'} onChange={set('amount')} />
      </label>
      <label className="admin-field">
        <span>Minimum spend (₦) <em>optional</em></span>
        <input value={f.minSpend} inputMode="numeric" placeholder="0" onChange={set('minSpend')} />
      </label>
      <label className="admin-field">
        <span>Uses allowed <em>optional — blank is no limit</em></span>
        <input value={f.maxUses} inputMode="numeric" placeholder="e.g. 50" onChange={set('maxUses')} />
      </label>
      <label className="admin-field">
        <span>Ends <em>optional</em></span>
        <input type="datetime-local" value={f.endsAt} onChange={set('endsAt')} />
      </label>
      <p className="admin-help admin-code-form__help">
        A code takes money off the pieces, never the delivery, and one code per order. Its value cannot be
        changed once made — make a new code instead.
      </p>
      <div className="admin-new__actions">
        <button className="admin-action admin-action--primary" disabled={!f.code.trim() || !String(f.amount).trim() || state === 'saving'}>CREATE</button>
        <button type="button" className="admin-link" onClick={() => { setOpen(false); setState(null); }}>cancel</button>
        <Note state={state === 'saving' ? 'saving' : state} />
      </div>
    </form>
  );
}

function CodeRow({ c, onChanged }) {
  const [state, setState] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const run = async (fn) => {
    setState('saving');
    try { await fn(); setState(null); setConfirm(false); onChanged(); } catch (err) { setState(err.message); }
  };
  const status = !c.active ? 'off' : c.ended ? 'ended' : c.usedUp ? 'used up' : 'live';
  return (
    <tr className={status === 'live' ? '' : 'is-off'}>
      <td className="mono">{c.code}</td>
      <td>{c.label}{c.minSpendKobo > 0 && <em className="admin-sub">over {naira(c.minSpendKobo)}</em>}</td>
      <td className="num">{c.uses}{c.maxUses ? ` / ${c.maxUses}` : ''}</td>
      <td className="admin-when">{c.endsAt ? new Date(c.endsAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
      <td><span className={`admin-status admin-status--${status === 'live' ? 'paid' : 'abandoned'}`}>{status}</span></td>
      <td><div className="admin-row-actions">
        <button className="admin-link" onClick={() => run(() => adminUpdateDiscount(c.code, { active: !c.active }))}>
          {c.active ? 'switch off' : 'switch on'}
        </button>
        {confirm ? (
          <>
            <button className="admin-action admin-action--danger" onClick={() => run(() => adminDeleteDiscount(c.code))}>DELETE</button>
            <button className="admin-link" onClick={() => setConfirm(false)}>keep</button>
          </>
        ) : <button className="admin-link" onClick={() => setConfirm(true)}>delete</button>}
        <Note state={state} />
      </div></td>
    </tr>
  );
}

/* ------------------------------------------------------------------ tab */

export default function SalesTab() {
  const [sales, setSales] = useState(null);
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    adminSales().then(setSales).catch(err => setError(err.message));
    adminDiscounts().then(setCodes).catch(err => setError(err.message));
  };
  useEffect(load, []);

  return (
    <section className="admin-section admin-settings">
      <div className="admin-section__head"><h2 className="admin-h2">Sales</h2></div>
      <p className="admin-help">Paid orders only, delivery included, after discounts. Refunded orders are left out.</p>
      {error && <p className="admin-note admin-note--bad" role="alert">{error}</p>}

      {!sales ? <p className="admin-empty">Loading…</p> : (
        <>
          <div className="admin-tiles">
            {[
              ['Money in', naira(sales.totals.revenueKobo)],
              ['Paid orders', sales.totals.orders],
              ['Average order', naira(sales.totals.averageKobo)],
              ['Given in discounts', naira(sales.totals.discountKobo)]
            ].map(([label, value]) => (
              <div className="admin-tile" key={label}>
                <span className="admin-tile__label">{label}</span>
                <span className="admin-tile__value">{value}</span>
              </div>
            ))}
          </div>

          <div className="admin-card"><WeeklyChart weeks={sales.weeks} /></div>

          <div className="admin-sales-lists">
            <div className="admin-card">
              <h3 className="admin-card__title">Best sellers</h3>
              {sales.pieces.length === 0 ? <p className="admin-empty">Nothing sold yet.</p> : (
                <table className="admin-mini-table">
                  <thead><tr><th>Piece</th><th className="num">Sold</th><th className="num">Money in</th></tr></thead>
                  <tbody>
                    {sales.pieces.map(p => (
                      <tr key={p.productId + p.name}><td>{p.name}</td><td className="num">{p.qty}</td><td className="num">{naira(p.revenueKobo)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="admin-card">
              <h3 className="admin-card__title">Sizes sold</h3>
              {sales.sizes.length === 0 ? <p className="admin-empty">Nothing sold yet.</p> : (
                <table className="admin-mini-table">
                  <thead><tr><th>Size</th><th className="num">Sold</th></tr></thead>
                  <tbody>{sales.sizes.map(x => <tr key={x.size}><td className="mono">{x.size}</td><td className="num">{x.qty}</td></tr>)}</tbody>
                </table>
              )}
            </div>
            {sales.colours?.length > 0 && (
              <div className="admin-card">
                <h3 className="admin-card__title">Colours sold</h3>
                <table className="admin-mini-table">
                  <thead><tr><th>Piece</th><th>Colour</th><th className="num">Sold</th></tr></thead>
                  <tbody>{sales.colours.map(x => (
                    <tr key={x.name + x.colour}><td>{x.name}</td><td>{x.colour}</td><td className="num">{x.qty}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <div className="admin-section__head admin-section__head--sub">
        <h2 className="admin-h2">Discount codes</h2>
        <div className="admin-filters"><NewCode onMade={load} /></div>
      </div>
      {!codes ? <p className="admin-empty">Loading…</p> : codes.length === 0 ? (
        <p className="admin-empty">No codes yet. A code like LAUNCH10 can give 10% off for the first weekend of a drop.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Code</th><th>Takes off</th><th className="num">Used</th><th>Ends</th><th>Status</th><th></th></tr></thead>
            <tbody>{codes.map(c => <CodeRow key={c.code} c={c} onChanged={load} />)}</tbody>
          </table>
        </div>
      )}
      {sales?.codes.length > 0 && (
        <p className="admin-help">
          On paid orders: {sales.codes.map(c => `${c.code} ${c.orders}× (${naira(c.discountKobo)} off)`).join(' · ')}
        </p>
      )}

      <GiftCardsSection />
    </section>
  );
}
