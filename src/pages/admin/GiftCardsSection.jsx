import { Fragment, useEffect, useState } from 'react';
import { adminGiftCards, adminMakeGiftCard, adminCancelGiftCard } from '../../lib/api.js';
import { DESIGNS, designOf } from '../../components/GiftCard.jsx';

/* Gift cards, in SALES: every card bought in the shop or made here, what is
 * left on it and where it was spent; make one; cancel one. The rules are the
 * server's (server/lib/giftcards.js). */

const naira = (kobo) => '₦' + Math.round(kobo / 100).toLocaleString('en-NG');
const date = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const STATE = { active: ['working', 'paid'], spent: ['spent', 'abandoned'], expired: ['expired', 'abandoned'], cancelled: ['cancelled', 'failed'] };

function MakeCard({ onMade }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ amount: '', recipientName: '', note: '', design: 'violet' });
  const [state, setState] = useState(null);
  const set = (k) => (e) => { setF(v => ({ ...v, [k]: e.target.value })); setState(null); };

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(String(f.amount).replace(/[₦,\s]/g, ''));
    setState('saving');
    try {
      const card = await adminMakeGiftCard({ amountKobo: Math.round(n * 100), recipientName: f.recipientName, note: f.note, design: f.design });
      setF({ amount: '', recipientName: '', note: '', design: 'violet' }); setOpen(false); setState(null); onMade(card);
    } catch (err) { setState(err.message); }
  };

  if (!open) return <button className="admin-action admin-action--primary" onClick={() => setOpen(true)}>+ MAKE A CARD</button>;
  return (
    <form className="admin-card admin-code-form" onSubmit={submit}>
      <label className="admin-field">
        <span>Amount (₦) <em>₦500 to ₦500,000</em></span>
        <input value={f.amount} inputMode="numeric" placeholder="20000" onChange={set('amount')} autoFocus />
      </label>
      <label className="admin-field">
        <span>For <em>optional</em></span>
        <input value={f.recipientName} maxLength={60} placeholder="Name" onChange={set('recipientName')} />
      </label>
      <label className="admin-field">
        <span>Colour</span>
        <select value={f.design} onChange={set('design')}>
          {DESIGNS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <label className="admin-field admin-field--wide">
        <span>Note <em>optional — only you see it</em></span>
        <input value={f.note} maxLength={200} placeholder="Giveaway winner, store credit for a return…" onChange={set('note')} />
      </label>
      <p className="admin-help admin-code-form__help">
        The card works at once and for twelve months, on pieces and delivery. You give the person its code.
      </p>
      <div className="admin-new__actions">
        <button className="admin-action admin-action--primary" disabled={!String(f.amount).trim() || state === 'saving'}>MAKE CARD</button>
        <button type="button" className="admin-link" onClick={() => { setOpen(false); setState(null); }}>cancel</button>
        {state === 'saving' ? <span className="admin-note">saving…</span> : state && <span className="admin-note admin-note--bad" role="alert">{state}</span>}
      </div>
    </form>
  );
}

function CardRow({ c, isNew, onChanged }) {
  const [open, setOpen] = useState(isNew);
  const [confirm, setConfirm] = useState(false);
  const [state, setState] = useState(null);
  const [copied, setCopied] = useState(false);
  const [label, tone] = STATE[c.state] ?? STATE.active;

  const cancel = async () => {
    setState('saving');
    try { await adminCancelGiftCard(c.id); setConfirm(false); setState(null); onChanged(); }
    catch (err) { setState(err.message); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(c.code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* select it instead */ }
  };

  return (
    <Fragment>
      <tr className={`${c.state === 'active' ? '' : 'is-off'}${isNew ? ' is-changed' : ''}`}>
        <td>
          <button type="button" className="admin-gift__code mono" aria-expanded={open} onClick={() => setOpen(o => !o)}>{c.code}</button>
          <em className="admin-sub">{c.madeBy === 'shop' ? 'made here' : `bought by ${c.buyerEmail}`}</em>
        </td>
        <td className="num">{naira(c.amountKobo)}</td>
        <td className="num">{naira(c.balanceKobo)}</td>
        <td>{c.recipientName ?? '—'}</td>
        <td className="admin-when">{date(c.expiresAt)}</td>
        <td><span className={`admin-status admin-status--${tone}`}>{label}</span></td>
        <td><div className="admin-row-actions">
          <button className="admin-link" onClick={copy}>{copied ? 'copied' : 'copy code'}</button>
          {c.state === 'active' && (confirm ? (
            <>
              <button className="admin-action admin-action--danger" onClick={cancel}>CANCEL CARD</button>
              <button className="admin-link" onClick={() => setConfirm(false)}>keep</button>
            </>
          ) : <button className="admin-link" onClick={() => setConfirm(true)}>cancel…</button>)}
          {state && state !== 'saving' && <span className="admin-note admin-note--bad" role="alert">{state}</span>}
        </div></td>
      </tr>
      {open && (
        <tr className="admin-gift__detail">
          <td colSpan={7}>
            <div className="admin-gift__more">
              {c.message && <p><span>Message</span>{c.message}</p>}
              {c.recipientEmail && <p><span>Their email</span>{c.recipientEmail}</p>}
              {c.note && <p><span>Note</span>{c.note}</p>}
              <p><span>Colour</span>{designOf(c.design).name}</p>
              <p><span>Live since</span>{date(c.activatedAt)}</p>
              <div>
                <span>History</span>
                {c.uses.length === 0 ? 'Nothing yet.' : (
                  <ol>{c.uses.map((u, i) => (
                    <li key={i}>
                      <time dateTime={u.at}>{date(u.at)}</time>
                      <span className="mono">{u.kind === 'topup' ? 'top-up' : u.orderReference ?? '—'}</span>
                      <span className="num">{u.kind === 'spend' ? `−${naira(-u.amountKobo)}` : u.kind === 'topup' ? `+${naira(u.amountKobo)} added` : `+${naira(u.amountKobo)} back`}</span>
                    </li>
                  ))}</ol>
                )}
              </div>
              {c.topupsToRefund?.length > 0 && (
                <p className="admin-note admin-note--bad">
                  <span>To refund</span>
                  {c.topupsToRefund.map(t => `${naira(t.amountKobo)} from ${t.email}`).join(', ')}: money added after the
                  card was cancelled. Refund it on Paystack.
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export default function GiftCardsSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [made, setMade] = useState(null);

  const load = () => adminGiftCards().then(setData).catch(err => setError(err.message));
  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="admin-section__head admin-section__head--sub">
        <h2 className="admin-h2">Gift cards</h2>
        <div className="admin-filters"><MakeCard onMade={(card) => { setMade(card.id); load(); }} /></div>
      </div>
      <p className="admin-help">
        Bought by customers at /gift-card, or made here: a giveaway, a goodwill gesture, store credit for a return.
        Each lasts twelve months and pays for pieces and delivery, after any discount code. If an order paid with a
        card is refunded, what the card paid goes back on it. Whoever holds a card can add money to it from its page;
        it then lasts twelve months from that day. “Sold for” counts what cards were bought for and every top-up.
      </p>
      {error && <p className="admin-note admin-note--bad" role="alert">{error}</p>}
      {!data ? <p className="admin-empty">Loading…</p> : (
        <>
          <div className="admin-tiles">
            {[
              ['Cards sold', data.totals.soldCount],
              ['Sold for', naira(data.totals.soldKobo)],
              ['Still to spend', naira(data.totals.outstandingKobo)],
              ['Working cards', data.totals.liveCount]
            ].map(([l, v]) => (
              <div className="admin-tile" key={l}><span className="admin-tile__label">{l}</span><span className="admin-tile__value">{v}</span></div>
            ))}
          </div>
          {data.cards.length === 0 ? (
            <p className="admin-empty">No gift cards yet. Customers buy them from “Gift cards” at the foot of every page.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table admin-gift">
                <thead><tr><th>Code</th><th className="num">Amount</th><th className="num">Left</th><th>For</th><th>Use by</th><th>Status</th><th></th></tr></thead>
                <tbody>{data.cards.map(c => <CardRow key={c.id} c={c} isNew={c.id === made} onChanged={load} />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
