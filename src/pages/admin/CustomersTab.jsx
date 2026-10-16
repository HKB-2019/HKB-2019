import { useEffect, useMemo, useState } from 'react';
import {
  adminCustomers, adminCustomer, adminUpdateCustomer, adminForgetCustomer, adminDownload
} from '../../lib/api.js';

/* CUSTOMERS: everyone the shop knows, one line per email — people who
 * bought, and people who have not yet (on the mailing list, waiting for a
 * sold-out size, or a checkout they did not finish). Open a line for their
 * orders, what they are waiting for, and the owner's own tags and notes.
 * Built from what the shop already holds (server/routes/admin-customers.js). */

const naira = (kobo) => '₦' + Math.round(kobo / 100).toLocaleString('en-NG');
const day = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const DAY = 86_400_000;
const STATUS = { paid: 'paid', pending: 'paying now', abandoned: 'not finished', failed: 'failed', refund_due: 'refund due', refunded: 'refunded' };

const VIEWS = [
  ['', 'Everyone', () => true],
  ['buyers', 'Bought something', p => p.kind === 'buyer'],
  ['prospects', 'Not bought yet', p => p.kind === 'prospect'],
  ['list', 'On the mailing list', p => p.subscribed],
  ['recent', 'Bought in the last 90 days', p => p.lastOrderAt && Date.now() - new Date(p.lastOrderAt) < 90 * DAY],
  ['big', 'Spent over ₦100,000', p => p.spentKobo > 10_000_000],
  ['waiting', 'Waiting for a size', p => p.waiting > 0],
  ['unfinished', 'Did not finish a checkout', p => p.unfinished > 0 && p.kind === 'prospect']
];

const matches = (p, words) => {
  if (!words.length) return true;
  const hay = [p.name, p.email, p.phone, p.city, p.state, p.notes, ...p.tags].filter(Boolean).join(' ').toLowerCase();
  return words.every(w => hay.includes(w));
};

export default function CustomersTab({ onChanged }) {
  const [people, setPeople] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('');
  const [open, setOpen] = useState(null);           // email of the opened person

  useEffect(() => { adminCustomers().then(setPeople).catch(err => setError(err.message)); }, []);

  const allTags = useMemo(() => [...new Set((people ?? []).flatMap(p => p.tags))].sort((a, b) => a.localeCompare(b)), [people]);
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const test = view.startsWith('tag:') ? (p) => p.tags.includes(view.slice(4)) : VIEWS.find(([v]) => v === view)?.[2] ?? (() => true);
  const shown = (people ?? []).filter(p => test(p) && matches(p, words));

  const count = (fn) => (people ?? []).filter(fn).length;
  const changed = (p) => setPeople(list => list.map(x => (x.email === p.email ? { ...x, ...p } : x)));
  const forgotten = (email) => { setPeople(list => list.filter(x => x.email !== email)); setOpen(null); onChanged?.(); };
  const download = () => { setError(null); adminDownload('/admin/customers.csv').catch(err => setError(err.message)); };

  return (
    <section className="admin-section admin-crm">
      <div className="admin-section__head">
        <h2 className="admin-h2">Customers</h2>
        <div className="admin-filters">
          <input type="search" className="admin-crm__search" placeholder="Search name, email, phone, city, tag"
                 aria-label="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select aria-label="Show" value={view} onChange={(e) => setView(e.target.value)}>
            {VIEWS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            {allTags.length > 0 && (
              <optgroup label="Tagged">
                {allTags.map(t => <option key={t} value={`tag:${t}`}>{t}</option>)}
              </optgroup>
            )}
          </select>
          <button type="button" className="admin-action" onClick={download} disabled={!people?.length}>DOWNLOAD</button>
        </div>
      </div>
      <p className="admin-help">
        Everyone who has bought, joined the mailing list, asked for a sold-out size or started a checkout — one
        line per email. Open a line to see their orders and to keep your own tags and notes on them.
      </p>
      {error && <p className="admin-note admin-note--bad" role="alert">{error}</p>}

      {!people ? <p className="admin-empty">Loading…</p> : (
        <>
          <div className="admin-tiles admin-crm__tiles">
            {[
              ['People', people.length],
              ['Bought something', count(p => p.kind === 'buyer')],
              ['Not bought yet', count(p => p.kind === 'prospect')],
              ['On the mailing list', count(p => p.subscribed)]
            ].map(([label, n]) => (
              <div className="admin-tile" key={label}>
                <span className="admin-tile__label">{label}</span>
                <span className="admin-tile__value">{n.toLocaleString('en-NG')}</span>
              </div>
            ))}
          </div>

          {people.length === 0 ? (
            <p className="admin-empty">
              No customers yet. People appear here when they order, join the mailing list or ask for a sold-out size.
            </p>
          ) : (
            <>
              {(view || words.length > 0) && (
                <p className="admin-crm__shown" role="status">
                  {shown.length === 1 ? '1 person' : `${shown.length.toLocaleString('en-NG')} people`} shown
                </p>
              )}
              <div className="admin-table-wrap">
                <table className="admin-table admin-crm__table">
                  <thead>
                    <tr>
                      <th>Person</th><th>Where</th><th className="num">Orders</th><th className="num">Spent</th>
                      <th>Last order</th><th>Mailing list</th><th>Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(p => (
                      <Row key={p.email} p={p} open={open === p.email}
                           onToggle={() => setOpen(o => (o === p.email ? null : p.email))}
                           allTags={allTags} onChanged={changed} onForgotten={forgotten} />
                    ))}
                    {shown.length === 0 && (
                      <tr><td colSpan={7} className="admin-empty">Nobody matches.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

/* An empty cell: a dash on a wide screen, left out of a phone's card. */
const none = (v) => (v ? '' : ' is-none');

function Row({ p, open, onToggle, allTags, onChanged, onForgotten }) {
  const id = `crm-${p.email.replace(/[^a-z0-9]/gi, '-')}`;
  return (
    <>
      <tr className={open ? 'is-open' : undefined}>
        <td>
          <button type="button" className="admin-crm__person" aria-expanded={open} aria-controls={id} onClick={onToggle}>
            <strong>{p.name ?? p.email}</strong>
            {p.name && <span>{p.email}</span>}
            <span className="admin-crm__kind">
              <span className={`admin-status admin-status--${p.kind === 'buyer' ? 'paid' : 'abandoned'}`}>
                {p.kind === 'buyer' ? 'bought' : 'not yet'}
              </span>
              {p.waiting > 0 && <span className="admin-status admin-status--pending">waiting · {p.waiting}</span>}
            </span>
          </button>
        </td>
        <td data-label="Where" className={none(p.city || p.state).trim() || undefined}>{[p.city, p.state].filter(Boolean).join(', ') || '—'}</td>
        <td className={`num${none(p.orders)}`} data-label="Orders">{p.orders || '—'}</td>
        <td className={`num${none(p.spentKobo)}`} data-label="Spent">{p.spentKobo ? naira(p.spentKobo) : '—'}</td>
        <td className={`admin-when${none(p.lastOrderAt)}`} data-label="Last order">{day(p.lastOrderAt)}</td>
        <td data-label="Mailing list" className={none(p.subscribed).trim() || undefined}>{p.subscribed ? 'yes' : '—'}</td>
        <td data-label="Tags" className={none(p.tags.length).trim() || undefined}>{p.tags.length ? <span className="admin-crm__tags">{p.tags.map(t => <span key={t}>{t}</span>)}</span> : '—'}</td>
      </tr>
      {open && (
        <tr className="admin-crm__detail" id={id}>
          <td colSpan={7}>
            <Person email={p.email} allTags={allTags} onChanged={onChanged} onForgotten={onForgotten} />
          </td>
        </tr>
      )}
    </>
  );
}

function Person({ email, allTags, onChanged, onForgotten }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [newTag, setNewTag] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    adminCustomer(email).then(d => { setP(d); setNotes(d.notes); }).catch(err => setError(err.message));
  }, [email]);

  const update = async (change, message) => {
    setBusy(true); setError(null); setSaved(null);
    try {
      const out = await adminUpdateCustomer(email, change);
      setP(d => ({ ...d, ...out }));
      onChanged(out);
      setSaved(message);
      return true;
    } catch (err) { setError(err.message); return false; }
    finally { setBusy(false); }
  };

  const addTag = async (t) => {
    const tag = t.replace(/\s+/g, ' ').trim();
    if (!tag || p.tags.includes(tag)) { setNewTag(''); return; }
    if (await update({ tags: [...p.tags, tag] }, `Tagged ${tag}.`)) setNewTag('');
  };
  const removeTag = (t) => update({ tags: p.tags.filter(x => x !== t) }, `${t} removed.`);

  const forget = async () => {
    setBusy(true); setError(null);
    try { await adminForgetCustomer(email); onForgotten(email); }
    catch (err) { setError(err.message); setConfirming(false); setBusy(false); }
  };

  if (!p) return error ? <p className="admin-note admin-note--bad" role="alert">{error}</p> : <p className="admin-empty">Loading…</p>;

  const address = p.address && [
    [p.address.line1, p.address.line2].filter(Boolean).join(', '),
    [p.address.city, [p.address.state, p.address.postcode].filter(Boolean).join(' '), p.address.country].filter(Boolean).join(', ')
  ].filter(Boolean);
  const unused = allTags.filter(t => !p.tags.includes(t)).slice(0, 8);

  return (
    <div className="admin-crm__card">
      <div className="admin-crm__cols">
        <div className="admin-crm__block">
          <h3 className="admin-crm__h">Contact</h3>
          <a href={`mailto:${p.email}`}>{p.email}</a>
          {p.phone && <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}>{p.phone}</a>}
          {address?.map((l, i) => <span key={i} className="admin-crm__faint">{l}</span>)}
          <span className="admin-crm__faint">
            {p.subscribed ? `On the mailing list since ${day(p.subscribedAt)}` : 'Not on the mailing list'}
          </span>
          <span className="admin-crm__faint">First seen {day(p.firstSeenAt)}</span>
        </div>

        <div className="admin-crm__block admin-crm__block--wide">
          <h3 className="admin-crm__h">Orders {p.orderList.length > 0 && <span className="admin-count">{p.orderList.length}</span>}</h3>
          {p.orderList.length === 0 ? <span className="admin-crm__faint">No orders.</span> : (
            <ol className="admin-crm__orders">
              {p.orderList.map(o => (
                <li key={o.reference}>
                  <span className="admin-crm__orderhead">
                    <time dateTime={o.placedAt}>{day(o.placedAt)}</time>
                    <span className={`admin-status admin-status--${o.status}`}>{STATUS[o.status] ?? o.status}</span>
                    {o.sentAt && o.status === 'paid' && <span className="admin-status admin-status--sent">sent</span>}
                    <span className="admin-crm__total">{naira(o.totalKobo)}</span>
                  </span>
                  <span className="admin-crm__faint">
                    {o.items.map(i => `${i.qty}× ${i.name} (${i.colour ? `${i.colour}, ` : ''}${i.size})`).join(' · ')}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {p.waitingFor.length > 0 && (
            <>
              <h3 className="admin-crm__h">Waiting for</h3>
              <ul className="admin-crm__orders">
                {p.waitingFor.map((w, i) => (
                  <li key={i}>
                    <span>{w.name} <span className="admin-crm__faint">· {w.colour ? `${w.colour}, ` : ''}{w.size} · asked {day(w.askedAt)}</span></span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="admin-crm__cols">
        <div className="admin-crm__block">
          <h3 className="admin-crm__h">Tags</h3>
          {p.tags.length > 0 && (
            <ul className="admin-crm__tagedit">
              {p.tags.map(t => (
                <li key={t}>{t}
                  <button type="button" aria-label={`Remove tag ${t}`} disabled={busy} onClick={() => removeTag(t)}>×</button>
                </li>
              ))}
            </ul>
          )}
          <form className="admin-crm__addtag" onSubmit={(e) => { e.preventDefault(); addTag(newTag); }}>
            <input className="admin-crm__input" maxLength={24} placeholder="VIP, stylist, wholesale…" aria-label="New tag"
                   value={newTag} onChange={(e) => setNewTag(e.target.value)} disabled={busy || p.tags.length >= 10} />
            <button type="submit" className="admin-action" disabled={busy || !newTag.trim()}>ADD</button>
          </form>
          {unused.length > 0 && p.tags.length < 10 && (
            <p className="admin-crm__suggest">
              <span className="admin-crm__faint">Used before:</span>
              {unused.map(t => <button type="button" key={t} className="admin-chip" disabled={busy} onClick={() => addTag(t)}>{t}</button>)}
            </p>
          )}
        </div>

        <div className="admin-crm__block admin-crm__block--wide">
          <label className="admin-field">
            <span>Notes <em>only you see these</em></span>
            <textarea rows={3} maxLength={2000} value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(null); }}
                      placeholder="Sizes they like, who they buy for, a conversation to follow up." />
          </label>
          <div className="admin-row-actions">
            <button type="button" className="admin-action admin-action--primary" disabled={busy || notes.trim() === p.notes}
                    onClick={() => update({ notes }, 'Notes saved.')}>SAVE NOTES</button>
          </div>
        </div>
      </div>

      <div className="admin-crm__foot">
        {saved && <span className="admin-note admin-note--ok" role="status">{saved}</span>}
        {error && <span className="admin-note admin-note--bad" role="alert">{error}</span>}
        <span className="admin-crm__forget">
          {confirming ? (
            <>
              <span className="admin-crm__warn">
                Their name, phone, address, list sign-up, size requests, tags and notes are wiped. Their orders stay in
                your sales figures without a name. This cannot be undone.
              </span>
              <button type="button" className="admin-action admin-action--danger" disabled={busy} onClick={forget}>
                {busy ? 'FORGETTING…' : 'FORGET THIS PERSON'}
              </button>
              <button type="button" className="admin-link" disabled={busy} onClick={() => setConfirming(false)}>keep</button>
            </>
          ) : (
            <button type="button" className="admin-link" onClick={() => setConfirming(true)}>they asked to be forgotten…</button>
          )}
        </span>
      </div>
    </div>
  );
}
