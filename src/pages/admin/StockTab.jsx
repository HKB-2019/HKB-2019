import { useEffect, useMemo, useState } from 'react';
import { adminStock, adminSaveStockCounts, adminReceiveStock, adminStockHistory, adminDownload } from '../../lib/api.js';

/* STOCK: what there is, line by line — read only, so nothing changes by a
 * stray tap. Two ways to change it, each its own mode with a way back and a
 * save bar that stays on screen:
 *   RECEIVE A DELIVERY — type only how many arrived on each line;
 *   COUNT THE SHELF    — after a stock-take, type what is really there.
 *
 * Pieces sold but not yet sent, and pieces someone is paying for right now,
 * are still on the shelf but no longer for sale. The owner types what is on
 * the shelf; the shop takes those off and shows what is left to sell
 * (server/routes/admin.js). */

const naira = (kobo) => '₦' + (kobo / 100).toLocaleString('en-NG');
const whole = (v) => /^\d{1,6}$/.test(v.trim());
const lineName = (r) => `${r.name}, ${r.colour ? `${r.colour}, ` : ''}${r.size}`;
const when = (iso) => new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
});

function Badge({ state, offSale }) {
  if (offSale) return <span className="admin-status admin-status--abandoned">off sale</span>;
  if (state === 'out') return <span className="admin-status admin-status--failed">sold out</span>;
  if (state === 'low') return <span className="admin-status admin-status--pending">low</span>;
  return null;
}

export default function StockTab({ onChanged }) {
  const [rows, setRows] = useState(null);
  const [history, setHistory] = useState([]);
  const [typed, setTyped] = useState({});           // variantId → what was typed
  const [piece, setPiece] = useState('');
  const [needsOnly, setNeedsOnly] = useState(false);
  const [note, setNote] = useState(null);           // { text, bad }
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('view');         // 'view' | 'count' | 'receive'
  const [arrived, setArrived] = useState({});       // variantId → how many came (receive mode)
  const [deliveryNote, setDeliveryNote] = useState('');

  const load = async () => {
    const [st, h] = await Promise.all([adminStock(), adminStockHistory()]);
    setRows(st); setHistory(h);
  };
  useEffect(() => { load().catch(err => setNote({ text: err.message, bad: true })); }, []);

  const pieces = useMemo(() => [...new Map((rows ?? []).map(r => [r.productId, r.name])).entries()], [rows]);
  const shown = (rows ?? []).filter(r =>
    (!piece || r.productId === piece) && (!needsOnly || (!r.offSale && r.state !== 'ok')));

  // Lines whose typed shelf count differs from what the shop has.
  const changes = (rows ?? []).filter(r => typed[r.variantId] !== undefined && typed[r.variantId].trim() !== String(r.shelf));
  const invalid = changes.filter(r => !whole(typed[r.variantId]));
  // Delivery lines: anything typed in receive mode that is not empty or 0.
  const deliveries = (rows ?? []).filter(r => (arrived[r.variantId] ?? '').trim() !== '' && arrived[r.variantId].trim() !== '0');
  const badDelivery = deliveries.filter(r => !whole(arrived[r.variantId]));

  const switchTo = (m) => { setMode(m); setTyped({}); setArrived({}); setDeliveryNote(''); setNote(null); };
  // Back to the list; typed numbers would be lost, so ask first.
  const leave = () => {
    const unsaved = mode === 'receive' ? deliveries.length : changes.length;
    if (unsaved && !window.confirm(`Leave without saving? What you typed on ${unsaved === 1 ? '1 line' : `${unsaved} lines`} will be lost.`)) return;
    switchTo('view');
  };

  const receive = async () => {
    setBusy(true); setNote(null);
    try {
      const res = await adminReceiveStock(deliveries.map(r => ({ variantId: r.variantId, qty: Number(arrived[r.variantId]) })), deliveryNote);
      setRows(res.stock);
      setHistory(await adminStockHistory());
      setMode('view'); setArrived({}); setDeliveryNote('');
      setNote({ text: `Delivery added: ${res.received} ${res.received === 1 ? 'piece' : 'pieces'} on ${res.lines} ${res.lines === 1 ? 'line' : 'lines'}.` });
      onChanged?.();
    } catch (err) {
      setNote({ text: err.message, bad: true });
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setNote(null);
    try {
      const res = await adminSaveStockCounts(changes.map(r => ({ variantId: r.variantId, shelf: Number(typed[r.variantId]) })));
      setRows(res.stock);
      setTyped({}); setMode('view');
      setHistory(await adminStockHistory());
      setNote({ text: res.changed === 1 ? '1 line saved.' : `${res.changed} lines saved.` });
      onChanged?.();
    } catch (err) {
      setNote({ text: err.message, bad: true });
    } finally { setBusy(false); }
  };

  const download = () => adminDownload('/admin/stock.csv').catch(err => setNote({ text: err.message, bad: true }));

  return (
    <section className="admin-section admin-stock">
      <div className="admin-section__head">
        <h2 className="admin-h2">Stock</h2>
        <div className="admin-filters">
          <select aria-label="Show one piece" value={piece} onChange={(e) => setPiece(e.target.value)}>
            <option value="">All pieces</option>
            {pieces.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <label className="admin-toggle">
            <input type="checkbox" checked={needsOnly} onChange={(e) => setNeedsOnly(e.target.checked)} />
            <span className="admin-toggle__box" aria-hidden="true" />
            <span>Only low or sold out</span>
          </label>
          <button type="button" className="admin-action" onClick={download}>DOWNLOAD</button>
          {mode === 'view' && (
            <>
              <button type="button" className="admin-action" onClick={() => switchTo('count')}>COUNT THE SHELF</button>
              <button type="button" className="admin-action admin-action--primary" onClick={() => switchTo('receive')}>RECEIVE A DELIVERY</button>
            </>
          )}
        </div>
      </div>
      {mode === 'view' ? (
        <p className="admin-help">
          What you have, line by line. A delivery came in? Press RECEIVE A DELIVERY and type how many arrived.
          Counted the shelf and the numbers are off (a piece lost, damaged or given away)? Press COUNT THE SHELF.
          Pieces sold but not yet sent, and pieces someone is paying for right now, are still on your shelf — the
          shop takes them off and shows what is left to sell.
        </p>
      ) : (
        <div className="admin-stock__mode">
          <button type="button" className="admin-stock__back" onClick={leave}>← BACK TO STOCK</button>
          {mode === 'receive' ? (
            <p role="status"><strong>Receiving a delivery.</strong> Type how many arrived on each line — they are added to what is
              already there. Leave the rest empty, then ADD TO STOCK at the bottom of the screen.</p>
          ) : (
            <p role="status"><strong>Counting the shelf.</strong> Type what is really on the shelf for any line that is wrong,
              then SAVE ALL at the bottom of the screen.</p>
          )}
        </div>
      )}

      {!rows ? <p className="admin-empty">Loading…</p> : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table admin-stock__table">
              <thead>
                <tr>
                  <th>Piece</th><th>Colour, size</th><th className="num">Price</th>
                  <th className={mode === 'view' ? 'num' : undefined}>{mode === 'receive' ? 'Arrived (+)' : 'On the shelf'}</th><th className="num">Waiting to be sent</th><th className="num">Being paid for</th>
                  <th className="num">Left to sell</th><th><span className="sr-only">State</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const t = typed[r.variantId];
                  const a = (arrived[r.variantId] ?? '').trim();
                  const receiving = mode === 'receive';
                  const changed = receiving ? a !== '' && a !== '0' : t !== undefined && t.trim() !== String(r.shelf);
                  const ok = receiving ? a === '' || whole(a) : t === undefined || whole(t);
                  const left = !changed || !ok ? r.stock : receiving ? r.stock + Number(a) : Number(t) - r.toSend - r.held;
                  const short = left < 0;
                  return (
                    <tr key={r.variantId} className={`${changed ? 'is-changed' : ''}${r.offSale ? ' is-off' : ''}`}>
                      <td>{r.name}</td>
                      <td className="mono">{r.colour ? `${r.colour}, ${r.size}` : r.size}</td>
                      <td className="num">{naira(r.priceKobo)}</td>
                      <td className={mode === 'view' ? 'num' : undefined} data-label={mode === 'view' ? 'Shelf' : undefined}>
                        {mode === 'view' ? r.shelf : receiving ? (
                          <span className="admin-stock__arrive">
                            <input className={`admin-stock-input${!ok ? ' is-error' : ''}`}
                                   inputMode="numeric" placeholder="0" aria-label={`${lineName(r)}, how many arrived`}
                                   value={arrived[r.variantId] ?? ''}
                                   onChange={(e) => { setArrived(x => ({ ...x, [r.variantId]: e.target.value })); setNote(null); }} />
                            <small>{changed && ok ? `shelf ${r.shelf} → ${r.shelf + Number(a)}` : `shelf ${r.shelf}`}</small>
                          </span>
                        ) : (
                          <input className={`admin-stock-input${!ok || short ? ' is-error' : ''}`}
                                 inputMode="numeric" aria-label={`${lineName(r)}, on the shelf`}
                                 value={t ?? String(r.shelf)}
                                 onChange={(e) => { setTyped(x => ({ ...x, [r.variantId]: e.target.value })); setNote(null); }} />
                        )}
                      </td>
                      <td className="num" data-label="To send">{r.toSend || '—'}</td>
                      <td className="num" data-label="Paying now">{r.held || '—'}</td>
                      <td className={`num${short ? ' admin-stock__short' : ''}`} data-label="Left">{left}</td>
                      <td>{short ? <span className="admin-status admin-status--failed">fewer than sold</span>
                                 : <Badge state={changed && ok ? (left === 0 ? 'out' : left <= 3 ? 'low' : 'ok') : r.state} offSale={r.offSale} />}</td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr><td colSpan={8} className="admin-empty">Nothing is low or sold out.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {mode === 'view' && note && (
            <p className={`admin-note admin-stock__done${note.bad ? ' admin-note--bad' : ' admin-note--ok'}`} role={note.bad ? 'alert' : 'status'}>{note.text}</p>
          )}
          {/* The save bar stays at the foot of the screen however long the list. */}
          {mode === 'receive' && (
            <div className="admin-stock__foot admin-stock__bar">
              <label className="admin-field admin-stock__note">
                <span>Note</span>
                <input maxLength={120} placeholder="optional — supplier, invoice number" value={deliveryNote}
                       onChange={(e) => setDeliveryNote(e.target.value)} />
              </label>
              <button type="button" className="admin-action admin-action--primary"
                      disabled={busy || deliveries.length === 0 || badDelivery.length > 0} onClick={receive}>
                {busy ? 'ADDING…' : deliveries.length ? `ADD TO STOCK (${deliveries.length})` : 'ADD TO STOCK'}
              </button>
              {!busy && <button type="button" className="admin-link" onClick={leave}>cancel</button>}
              {badDelivery.length > 0 && <span className="admin-note admin-note--bad">Type whole numbers only.</span>}
              {note && <span className={`admin-note${note.bad ? ' admin-note--bad' : ' admin-note--ok'}`} role={note.bad ? 'alert' : 'status'}>{note.text}</span>}
            </div>
          )}
          {mode === 'count' && (
          <div className="admin-stock__foot admin-stock__bar">
            <button type="button" className="admin-action admin-action--primary"
                    disabled={busy || changes.length === 0 || invalid.length > 0} onClick={save}>
              {busy ? 'SAVING…' : changes.length ? `SAVE ALL (${changes.length})` : 'SAVE ALL'}
            </button>
            {changes.length > 0 && !busy && (
              <button type="button" className="admin-link" onClick={() => { setTyped({}); setNote(null); }}>undo changes</button>
            )}
            {!busy && <button type="button" className="admin-link" onClick={leave}>cancel</button>}
            {invalid.length > 0 && <span className="admin-note admin-note--bad">Type whole numbers only.</span>}
            {note && <span className={`admin-note${note.bad ? ' admin-note--bad' : ' admin-note--ok'}`} role={note.bad ? 'alert' : 'status'}>{note.text}</span>}
          </div>
          )}

          <details className="admin-stock__history">
            <summary>Recent changes {history.length ? `(${history.length})` : ''}</summary>
            {history.length === 0 ? <p className="admin-empty">No counts changed yet.</p> : (
              <ol>
                {history.map(h => (
                  <li key={h.id}>
                    <time dateTime={h.at}>{when(h.at)}</time>
                    <span>{h.name}{h.colour ? ` · ${h.colour}` : ''} · {h.size}</span>
                    {h.kind === 'delivery' ? (
                      <span><strong>Delivery +{h.after - h.before}</strong> · left to sell {h.before} → {h.after}
                        {h.note ? ` · ${h.note}` : ''}</span>
                    ) : (
                      <span>left to sell {h.before} → <strong>{h.after}</strong>
                        {h.shelf === null || h.shelf === undefined ? ' (set directly)' : ` (${h.shelf} counted on the shelf)`}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </details>
        </>
      )}
    </section>
  );
}
