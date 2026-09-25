import { useEffect, useState } from 'react';
import { adminSettings, adminSaveSetting } from '../../lib/api.js';

/* The shop's settings, one section each, each saved on its own — a mistake
 * in a social link should not stop the delivery fees saving. */

const ZONES = [
  ['lagos', 'Lagos'],
  ['abuja', 'Abuja (FCT)'],
  ['nigeria', 'Rest of Nigeria'],
  ['international', 'Outside Nigeria']
];

const PAGES = [
  ['FAQ', 'FAQ'],
  ['SHIPPING', 'Shipping'],
  ['RETURNS', 'Returns'],
  ['CONTACT', 'Contact'],
  ['PRIVACY', 'Privacy']
];

function useSave(key, onSaved) {
  const [state, setState] = useState(null);
  const save = async (value) => {
    setState('saving');
    try {
      const clean = await adminSaveSetting(key, value);
      setState('saved');
      setTimeout(() => setState(s => (s === 'saved' ? null : s)), 1800);
      onSaved?.(clean);
    } catch (err) {
      setState(err.message);
    }
  };
  return [state, save];
}

function Note({ state }) {
  if (!state) return null;
  if (state === 'saving') return <span className="admin-note">saving…</span>;
  if (state === 'saved') return <span className="admin-note admin-note--ok">saved</span>;
  return <span className="admin-note admin-note--bad" role="alert">{state}</span>;
}

/* ------------------------------------------------------------ delivery */

function Delivery({ value, onSaved }) {
  const [rows, setRows] = useState(() => Object.fromEntries(ZONES.map(([z]) => [z, {
    enabled: value[z].enabled,
    fee: value[z].feeKobo === null ? '' : String(value[z].feeKobo / 100)
  }])));
  const [state, save] = useSave('delivery', onSaved);
  const [rowsError, setRowsError] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    const out = {};
    for (const [z, label] of ZONES) {
      const raw = rows[z].fee.replace(/[₦,\s]/g, '');
      if (rows[z].enabled && !/^\d+$/.test(raw)) {
        // Said here, without a round trip, and the box that needs fixing is focused.
        setRowsError(`${label}: type the fee in whole naira, e.g. 2500.`);
        document.getElementById(`fee-${z}`)?.focus();
        return;
      }
      out[z] = { enabled: rows[z].enabled, feeKobo: /^\d+$/.test(raw) ? Number(raw) * 100 : null };
    }
    setRowsError(null);
    save(out);
  };
  const anyOn = ZONES.some(([z]) => rows[z].enabled);

  return (
    <form className="admin-card" onSubmit={submit}>
      <h3 className="admin-card__title">Delivery</h3>
      <p className="admin-help">
        Switch on the places you deliver to and set a fee for each. The fee is added to the order
        before the customer pays. <strong>Checkout stays closed until at least one is switched on.</strong>
      </p>
      <table className="admin-mini-table">
        <thead><tr><th>Area</th><th>Deliver here</th><th>Fee (₦)</th></tr></thead>
        <tbody>
          {ZONES.map(([z, label]) => (
            <tr key={z}>
              <td>{label}</td>
              <td>
                <label className="admin-toggle">
                  <input type="checkbox" checked={rows[z].enabled} aria-label={`Deliver to ${label}`}
                         onChange={(e) => setRows(r => ({ ...r, [z]: { ...r[z], enabled: e.target.checked } }))} />
                  <span className="admin-toggle__box" aria-hidden="true" />
                </label>
              </td>
              <td>
                <input id={`fee-${z}`} className="admin-stock-input admin-fee-input" inputMode="numeric"
                       aria-label={`Delivery fee for ${label}`} placeholder={rows[z].enabled ? '0' : '—'}
                       value={rows[z].fee}
                       onChange={(e) => setRows(r => ({ ...r, [z]: { ...r[z], fee: e.target.value } }))} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!anyOn && <p className="admin-alert admin-alert--inline">Checkout is closed: no area is switched on.</p>}
      <div className="admin-card__foot">
        <button className="admin-action admin-action--primary">SAVE DELIVERY</button>
        <Note state={rowsError ?? state} />
      </div>
    </form>
  );
}

/* --------------------------------------------------------------- pages */

function Pages({ value, onSaved }) {
  const [pages, setPages] = useState(value);
  const [state, save] = useSave('pages', onSaved);
  const placeholder = /000 0000/.test(pages.CONTACT);

  return (
    <form className="admin-card" onSubmit={(e) => { e.preventDefault(); save(pages); }}>
      <h3 className="admin-card__title">Footer pages</h3>
      <p className="admin-help">Plain text. Line breaks are kept.</p>
      {placeholder && (
        <p className="admin-alert admin-alert--inline">
          The Contact page still has the sample phone number and address from the design. Replace them
          with your real details before launch.
        </p>
      )}
      {PAGES.map(([key, label]) => (
        <label className="admin-field admin-field--wide" key={key}>
          <span>{label}</span>
          <textarea rows={key === 'PRIVACY' ? 7 : 3} maxLength={4000} value={pages[key]}
                    onChange={(e) => setPages(p => ({ ...p, [key]: e.target.value }))} />
        </label>
      ))}
      <p className="admin-help">
        The Privacy text describes what the shop actually collects and why. Read it, and change it
        if your practice differs — it is a starting point, not legal advice.
      </p>
      <div className="admin-card__foot">
        <button className="admin-action admin-action--primary">SAVE PAGES</button>
        <Note state={state} />
      </div>
    </form>
  );
}

/* --------------------------------------------------------------- links */

function Links({ social, film, onSaved }) {
  const [links, setLinks] = useState(social);
  const [filmUrl, setFilmUrl] = useState(film.url);
  const [socialState, saveSocial] = useSave('social', onSaved);
  const [filmState, saveFilm] = useSave('film', onSaved);

  return (
    <div className="admin-card">
      <h3 className="admin-card__title">Links</h3>
      <form onSubmit={(e) => { e.preventDefault(); saveSocial(links); }}>
        <p className="admin-help">Footer icons appear only for the links you fill in. Each must start with https://</p>
        {[['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['x', 'X']].map(([key, label]) => (
          <label className="admin-field admin-field--wide" key={key}>
            <span>{label}</span>
            <input type="url" inputMode="url" placeholder={`https://…`} value={links[key]}
                   onChange={(e) => setLinks(l => ({ ...l, [key]: e.target.value }))} />
          </label>
        ))}
        <div className="admin-card__foot">
          <button className="admin-action admin-action--primary">SAVE LINKS</button>
          <Note state={socialState} />
        </div>
      </form>

      <form className="admin-card__part" onSubmit={(e) => { e.preventDefault(); saveFilm({ url: filmUrl }); }}>
        <label className="admin-field admin-field--wide">
          <span>Film <em>a YouTube link, or a link to an .mp4 file</em></span>
          <input type="url" inputMode="url" placeholder="https://youtu.be/…" value={filmUrl}
                 onChange={(e) => setFilmUrl(e.target.value)} />
        </label>
        <p className="admin-help">Empty: the site says the film is coming soon.</p>
        <div className="admin-card__foot">
          <button className="admin-action admin-action--primary">SAVE FILM</button>
          <Note state={filmState} />
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ tab */

export default function SettingsTab({ onSummaryChange }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminSettings().then(setSettings).catch(err => setError(err.message));
  }, []);

  if (error) return <p className="admin-note admin-note--bad" role="alert">{error}</p>;
  if (!settings) return <p className="admin-empty">Loading…</p>;

  return (
    <section className="admin-section admin-settings">
      <div className="admin-section__head"><h2 className="admin-h2">Settings</h2></div>
      <Delivery value={settings.delivery} onSaved={onSummaryChange} />
      <Pages value={settings.pages} />
      <Links social={settings.social} film={settings.film} />
    </section>
  );
}
