import { useEffect, useMemo, useState } from 'react';
import { adminStock, adminSaveStockCounts, adminStockHistory, adminDownload } from '../../lib/api.js';

/* STOCK: count the shelf, type it, save once.
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

  const save = async () => {
    setBusy(true); setNote(null);
    try {
      const res = await adminSaveStockCounts(changes.map(r => ({ variantId: r.variantId, shelf: Number(typed[r.variantId]) })));
      setRows(res.stock);
      setTyped({});
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
        </div>
      </div>
      <p className="admin-help">
        Count what is on the shelf and type it, then SAVE ALL. Pieces already sold but not yet sent, and pieces
        someone is paying for right now, are still on your shelf — the shop takes them off for you and shows what
        is left to sell.
      </p>

      {!rows ? <p className="admin-empty">Loading…</p> : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table admin-stock__table">
              <thead>
                <tr>
                  <th>Piece</th><th>Colour, size</th><th className="num">Price</th>
                  <th>On the shelf</th><th className="num">Waiting to be sent</th><th className="num">Being paid for</th>
                  <th className="num">Left to sell</th><th><span className="sr-only">State</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const t = typed[r.variantId];
                  const changed = t !== undefined && t.trim() !== String(r.shelf);
                  const ok = t === undefined || whole(t);
                  const left = changed && ok ? Number(t) - r.toSend - r.held : r.stock;
                  const short = left < 0;
                  return (
                    <tr key={r.variantId} className={`${changed ? 'is-changed' : ''}${r.offSale ? ' is-off' : ''}`}>
                      <td>{r.name}</td>
                      <td className="mono">{r.colour ? `${r.colour}, ${r.size}` : r.size}</td>
                      <td className="num">{naira(r.priceKobo)}</td>
                      <td>
                        <input className={`admin-stock-input${!ok || short ? ' is-error' : ''}`}
                               inputMode="numeric" aria-label={`${lineName(r)}, on the shelf`}
                               value={t ?? String(r.shelf)}
                               onChange={(e) => { setTyped(x => ({ ...x, [r.variantId]: e.target.value })); setNote(null); }} />
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

          <div className="admin-stock__foot">
            <button type="button" className="admin-action admin-action--primary"
                    disabled={busy || changes.length === 0 || invalid.length > 0} onClick={save}>
              {busy ? 'SAVING…' : changes.length ? `SAVE ALL (${changes.length})` : 'SAVE ALL'}
            </button>
            {changes.length > 0 && !busy && (
              <button type="button" className="admin-link" onClick={() => { setTyped({}); setNote(null); }}>undo changes</button>
            )}
            {invalid.length > 0 && <span className="admin-note admin-note--bad">Type whole numbers only.</span>}
            {note && <span className={`admin-note${note.bad ? ' admin-note--bad' : ' admin-note--ok'}`} role={note.bad ? 'alert' : 'status'}>{note.text}</span>}
          </div>

          <details className="admin-stock__history">
            <summary>Recent changes {history.length ? `(${history.length})` : ''}</summary>
            {history.length === 0 ? <p className="admin-empty">No counts changed yet.</p> : (
              <ol>
                {history.map(h => (
                  <li key={h.id}>
                    <time dateTime={h.at}>{when(h.at)}</time>
                    <span>{h.name}{h.colour ? ` · ${h.colour}` : ''} · {h.size}</span>
                    <span>left to sell {h.before} → <strong>{h.after}</strong>
                      {h.shelf === null ? ' (set directly)' : ` (${h.shelf} counted on the shelf)`}</span>
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
