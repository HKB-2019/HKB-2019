import { useEffect, useState } from 'react';
import { adminSubscribers, adminRemoveSubscriber, adminDownload } from '../../lib/api.js';

/* Everyone who joined the list from the shop's footer. Nothing is emailed
 * from here: download the list into whatever email tool you use, which will
 * handle unsubscribes. Remove someone here when they ask to be forgotten. */

const when = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

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
    </section>
  );
}
