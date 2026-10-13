import { useEffect, useRef, useState } from 'react';
import {
  adminSettings, adminSaveSetting, adminUploadHomeImage, adminRemoveHomeImage, getSite
} from '../../lib/api.js';
import { asset, pageHref, NEW_TAB } from '../../lib/media.js';
import { NAV } from '../../data/home.js';
import { preparePhoto, HOME } from './photo.js';

/* The home page: its three wide photos, every line of words on it, and the
 * menu. Each photo saves the moment it is chosen; the words save together
 * with one button, so a half-typed headline is never live. */

function Note({ state }) {
  if (!state) return null;
  if (state === 'saving') return <span className="admin-note">saving…</span>;
  if (state === 'saved') return <span className="admin-note admin-note--ok">saved</span>;
  return <span className="admin-note admin-note--bad" role="alert">{state}</span>;
}

/* ---------------------------------------------------------------- photos */

const SLOTS = [
  ['hero', 'Top of the page', 'assets/img/hero-model.webp',
    'The big photo beside MASQ. On a computer it fills a tall frame on the right; on a phone, a wide one above the words — so keep the subject in the middle.'],
  ['band', 'Craft band', 'assets/img/band-texture.webp',
    'The dark strip behind “Craft. Culture. Identity.” It is dimmed under the words, so a texture or a detail works best. Cut to a wide 3 : 1 strip.'],
  ['film', 'Film strip', 'assets/img/film-still.webp',
    'The strip with the PLAY FILM button, and the picture shown before the film starts. Cut to a wide 3 : 1 strip.']
];

function PhotoSlot({ slot, title, builtIn, help, current, onChanged }) {
  const fileRef = useRef(null);
  const [state, setState] = useState(null);
  const [warn, setWarn] = useState(null);

  const run = async (fn) => {
    setState('saving');
    try { await fn(); setState('saved'); onChanged(); setTimeout(() => setState(s => (s === 'saved' ? null : s)), 1600); }
    catch (err) { setState(err.message); }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setWarn(null);
    setState('saving');
    let prepared;
    try { prepared = await preparePhoto(file, HOME[slot]); }
    catch (err) { setState(err.message); return; }
    if (prepared.small) setWarn(`This photo is only ${prepared.width} px wide, so it may look soft on large screens.`);
    run(() => adminUploadHomeImage(slot, prepared.image, prepared.image2x));
  };

  return (
    <div className={`admin-home-photo admin-home-photo--${slot}`}>
      <div className="admin-home-photo__frame">
        <img src={current?.img ?? asset(builtIn)} alt="" />
        <span className="admin-home-photo__tag">{current ? 'YOUR PHOTO' : 'ORIGINAL'}</span>
      </div>
      <div className="admin-home-photo__body">
        <h4 className="admin-home-photo__title">{title}</h4>
        <p className="admin-help">{help}</p>
        <div className="admin-product__photo-actions">
          <button type="button" className="admin-action" onClick={() => fileRef.current?.click()}>CHANGE PHOTO</button>
          {current && (
            <button type="button" className="admin-link" onClick={() => run(() => adminRemoveHomeImage(slot))}>use original</button>
          )}
          <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,image/heic"
                 aria-label={`Photo for ${title}`} onChange={onFile} />
          <Note state={state} />
        </div>
        {warn && <p className="admin-product__warn">{warn}</p>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- words */

/* Grouped as they appear down the page. [key, label, max, lines] */
const GROUPS = [
  ['Top of the page', [
    ['heroEyebrow', 'Small line above MASQ.', 40, 1],
    ['heroSub', 'Line under MASQ.', 120, 2],
    ['heroButton', 'Button', 24, 1],
    ['heroImageAlt', 'Describe the photo (read aloud to blind visitors)', 140, 1]
  ]],
  ['Craft band', [
    ['craftTitle', 'Heading', 60, 1],
    ['craftText', 'Text', 240, 3]
  ]],
  ['Products', [
    ['dropTitle', 'Heading over the product grid', 60, 1],
    ['essentialsTitle', 'Heading over the carousel', 40, 1]
  ]],
  ['Manifesto', [
    ['manifestoLine1', 'First line', 60, 1],
    ['manifestoLine2', 'Second line', 60, 1],
    ['manifestoTag', 'Small line under it', 80, 1]
  ]],
  ['Mailing list', [
    ['newsletterTitle', 'Heading', 60, 1],
    ['newsletterNote', 'Text', 200, 2]
  ]]
];

const MENU_HELP = {
  shop: 'goes to the product grid',
  collections: 'goes to the Essentials carousel',
  about: 'goes to the craft band',
  journal: 'goes to the film strip'
};

function Words({ value, onSaved }) {
  const [home, setHome] = useState(value);
  const [state, setState] = useState(null);
  const dirty = JSON.stringify(home) !== JSON.stringify(value);

  const set = (key, v) => setHome(h => ({ ...h, [key]: v }));
  const setNav = (item, change) => setHome(h => ({ ...h, nav: { ...h.nav, [item]: { ...h.nav[item], ...change } } }));

  const save = async (e) => {
    e.preventDefault();
    setState('saving');
    try {
      const clean = await adminSaveSetting('home', home);
      setHome(clean);
      onSaved(clean);
      setState('saved');
      setTimeout(() => setState(s => (s === 'saved' ? null : s)), 1800);
    } catch (err) { setState(err.message); }
  };

  return (
    <form className="admin-card" onSubmit={save}>
      <h3 className="admin-card__title">Words</h3>
      <p className="admin-help">Plain text. Where a box has room for two lines, a line break you type is kept on the page.</p>

      {GROUPS.map(([group, fields]) => (
        <fieldset className="admin-card__part admin-fieldset" key={group}>
          <legend className="admin-product__label">{group}</legend>
          {fields.map(([key, label, max, lines]) => (
            <label className="admin-field admin-field--wide" key={key}>
              <span>{label}</span>
              {lines > 1
                ? <textarea rows={lines} maxLength={max} value={home[key]} onChange={(e) => set(key, e.target.value)} />
                : <input maxLength={max} value={home[key]} onChange={(e) => set(key, e.target.value)} />}
            </label>
          ))}
        </fieldset>
      ))}

      <fieldset className="admin-card__part admin-fieldset">
        <legend className="admin-product__label">Menu</legend>
        <p className="admin-help">Rename an item, or switch it off to take it out of the menu. Each still goes to the same part of the page.</p>
        {NAV.map(item => (
          <div className="admin-menu-row" key={item}>
            <label className="admin-field">
              <span>{MENU_HELP[item]}</span>
              <input maxLength={20} value={home.nav[item].label} aria-label={`Menu item that ${MENU_HELP[item]}`}
                     onChange={(e) => setNav(item, { label: e.target.value })} />
            </label>
            <label className="admin-toggle">
              <input type="checkbox" checked={home.nav[item].show}
                     onChange={(e) => setNav(item, { show: e.target.checked })} />
              <span className="admin-toggle__box" aria-hidden="true" />
              <span>Show</span>
            </label>
          </div>
        ))}
      </fieldset>

      <div className="admin-card__foot">
        <button className="admin-action admin-action--primary" disabled={!dirty}>SAVE WORDS</button>
        {dirty && <button type="button" className="admin-link" onClick={() => setHome(value)}>undo changes</button>}
        <Note state={state} />
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------- tab */

export default function HomeTab() {
  const [home, setHome] = useState(null);
  const [images, setImages] = useState(null);
  const [error, setError] = useState(null);

  const loadImages = async () => {
    try { setImages((await getSite()).home.images); } catch (err) { setError(err.message); }
  };
  useEffect(() => {
    adminSettings().then(s => setHome(s.home)).catch(err => setError(err.message));
    loadImages();
  }, []);

  return (
    <section className="admin-section admin-settings">
      <div className="admin-section__head">
        <h2 className="admin-h2">Home page</h2>
        <a className="admin-link" href={pageHref('/')} {...NEW_TAB}>see the shop ↗</a>
      </div>
      {error && <p className="admin-note admin-note--bad" role="alert">{error}</p>}

      <div className="admin-card">
        <h3 className="admin-card__title">Photos</h3>
        <p className="admin-help">Any phone photo works: it is turned the right way up and shrunk before it uploads. Changes show on the shop at once.</p>
        {!images ? <p className="admin-empty">Loading…</p> : SLOTS.map(([slot, title, builtIn, help]) => (
          <PhotoSlot key={slot} slot={slot} title={title} builtIn={builtIn} help={help}
                     current={images[slot]} onChanged={loadImages} />
        ))}
      </div>

      {home ? <Words value={home} onSaved={setHome} /> : <p className="admin-empty">Loading…</p>}
    </section>
  );
}
