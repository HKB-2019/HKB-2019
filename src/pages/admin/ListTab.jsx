import { useEffect, useState } from 'react';
import {
  adminSubscribers, adminRemoveSubscriber, adminDownload, adminStockAlerts, adminClearAlerts, adminRemoveAlert
} from '../../lib/api.js';

/* Everyone who joined the list from the shop's footer. Nothing is emailed
 * from here: download the list into whatever email tool you use, which will
 * handle unsubscribes. Remove someone here when they ask to be forgotten. */

const when = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * People who asked to hear when a sold-out size is back, by piece and size.
 * The shop sends nothing itself yet: copy the addresses into an email, then
 * clear that size so the list stays a list of people still waiting.
 */
function Waiting({ onSummaryChange }) {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [confirming, setConfirming] = useState(null);

  const reload = () => adminStockAlerts().then(setGroups).catch(err => setError(err.message));
  useEffect(() => { reload(); }, []);

  const act = async (fn) => {
    try { await fn(); setConfirming(null); reload(); onSummaryChange?.(); } catch (err) { setError(err.message); }
  };
  const key = (g) => `${g.productId}|${g.colour ?? ''}|${g.size}`;

  const copy = async (g) => {
    const text = g.people.map(p => p.email).join(', ');
    try { await navigator.clipboard.writeText(text); setCopied(key(g)); setTimeout(() => setCopied(null), 1600); }
    catch { setError('Copying was blocked by the browser. Select the addresses and copy them instead.'); }
  };

  return (
    <>
      <div className="admin-section__head admin-section__head--sub">
        <h2 className="admin-h2">Waiting for a size {groups && <span className="admin-count">{groups.reduce((n, g) => n + g.people.length, 0)}</span>}</h2>
        <div className="admin-filters">
          <button className="admin-action" disabled={!groups?.length}
                  onClick={() => adminDownload('/admin/stock-alerts.csv').catch(err => setError(err.message))}>
            DOWNLOAD CSV
          </button>
        </div>
      </div>
      <p className="admin-help">
        From “tell me when it’s back” on sold-out sizes. When a size is back in stock, email these people,
        then clear the size.
      </p>
      {error && <p className="admin-note admin-note--bad" role="alert">{error}</p>}
      {!groups ? <p className="admin-empty">Loading…</p> : groups.length === 0 ? (
        <p className="admin-empty">Nobody is waiting.</p>
      ) : (
        <div className="admin-waiting">
          {groups.map(g => (
            <div className="admin-card admin-waiting__group" key={key(g)}>
              <div className="admin-waiting__head">
                <h3 className="admin-card__title">{g.name} · {g.colour ? `${g.colour} · ` : ''}{g.size}</h3>
                <span className={`admin-status ${g.stock > 0 ? 'admin-status--paid' : 'admin-status--abandoned'}`}>
                  {g.stock > 0 ? `back in stock — ${g.stock}` : 'still sold out'}
                </span>
              </div>
              <p className="admin-waiting__emails">{g.people.map(p => p.email).join(', ')}</p>
              <div className="admin-row-actions">
                <button className="admin-action" onClick={() => copy(g)}>{copied === key(g) ? 'COPIED' : 'COPY EMAILS'}</button>
                {confirming === key(g) ? (
                  <>
                    <button className="admin-action admin-action--danger" onClick={() => act(() => adminClearAlerts(g.productId, g.size, g.colour))}>CLEAR {g.people.length}</button>
                    <button className="admin-link" onClick={() => setConfirming(null)}>keep</button>
                  </>
                ) : <button className="admin-link" onClick={() => setConfirming(key(g))}>told them — clear</button>}
              </div>
              <details className="admin-waiting__people">
                <summary>{g.people.length === 1 ? '1 person' : `${g.people.length} people`}</summary>
                <ul>
                  {g.people.map(p => (
                    <li key={p.id}>
                      <span>{p.email}</span>
                      <button className="admin-link" aria-label={`Remove ${p.email} from this waiting list`}
                              onClick={() => act(() => adminRemoveAlert(p.id))}>remove</button>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function ListTab({ onSummaryChange }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null);

  const reload = () => adminSubscribers().then(setRows).catch(err => setError(err.message));
  useEffect(() => { reload(); }, []);

  const remove = async (id) => {
    try { await adminRemoveSubscriber(id); setConfirming(null); reload(); onSummaryChange?.(); }
    catch (err) { setError(err.message); }
  };

  return (
    <section className="admin-section">
      <div className="admin-section__head">
        <h2 className="admin-h2">The list {rows && <span className="admin-count">{rows.length}</span>}</h2>
        <div className="admin-filters">
          <button className="admin-action" disabled={!rows?.length}
                  onClick={() => adminDownload('/admin/subscribers.csv').catch(err => setError(err.message))}>
            DOWNLOAD CSV
          </button>
        </div>
      </div>
      <p className="admin-help">
        People who joined from the shop. Nothing is sent from here — download the list into your email
        tool. Remove someone when they ask you to.
      </p>
      {error && <p className="admin-note admin-note--bad" role="alert">{error}</p>}

      {!rows ? <p className="admin-empty">Loading…</p> : rows.length === 0 ? (
        <p className="admin-empty">Nobody has joined yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--narrow">
            <thead><tr><th>Email</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td className="admin-when">{when(r.joinedAt)}</td>
                  <td className="admin-row-actions">
                    {confirming === r.id ? (
                      <>
                        <button className="admin-action admin-action--danger" onClick={() => remove(r.id)}>REMOVE</button>
                        <button className="admin-link" onClick={() => setConfirming(null)}>keep</button>
                      </>
                    ) : (
                      <button className="admin-link" onClick={() => setConfirming(r.id)}
                              aria-label={`Remove ${r.email} from the list`}>remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Waiting onSummaryChange={onSummaryChange} />
    </section>
  );
}
