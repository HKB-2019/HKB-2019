import { useEffect, useRef, useState } from 'react';
import {
  adminProducts, adminCreateProduct, adminUpdateProduct, adminMoveProduct,
  adminAddSize, adminRemoveSize, adminUploadPhoto, adminRemovePhoto, adminSetStock,
  adminAddGalleryPhoto, adminRemoveGalleryPhoto,
  adminAddColour, adminUpdateColour, adminRemoveColour, adminUploadColourPhoto, adminRemoveColourPhoto,
  adminWriterStatus, adminDraftDescription
} from '../../lib/api.js';
import { preparePhoto } from './photo.js';
import { pageHref, NEW_TAB } from '../../lib/media.js';

/* Everything about a product the owner can change, one card per product.
 * Text fields save with a button (so a half-typed price is never live);
 * switches and sizes save the moment they change. */

const naira = (kobo) => '₦' + (kobo / 100).toLocaleString('en-NG');
const MAX_EXTRA_PHOTOS = 6;     // the server's limit too

/** "28,000" or "₦28000" → 28000. Anything else → NaN. */
const parseNaira = (v) => {
  const s = String(v).replace(/[₦,\s]/g, '');
  return /^\d+$/.test(s) ? Number(s) : NaN;
};

function Note({ state }) {
  if (!state) return null;
  if (state === 'saving') return <span className="admin-note">saving…</span>;
  if (state === 'saved') return <span className="admin-note admin-note--ok">saved</span>;
  return <span className="admin-note admin-note--bad" role="alert">{state}</span>;
}

/** Runs an admin action, showing saving / saved / the server's reason it was refused. */
function useAction(onDone) {
  const [state, setState] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const run = async (fn) => {
    setState('saving');
    try {
      const result = await fn();
      onDone?.(result);
      setState('saved');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState(null), 1600);
      return result;
    } catch (err) {
      setState(err.message);
      return null;
    }
  };
  return [state, run, setState];
}

function Toggle({ label, checked, onChange, disabled, hint }) {
  return (
    <label className={`admin-toggle${disabled ? ' is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled}
             onChange={(e) => onChange(e.target.checked)} />
      <span className="admin-toggle__box" aria-hidden="true" />
      <span>{label}{hint && <em> {hint}</em>}</span>
    </label>
  );
}

/* ------------------------------------------------------------- drop time */

/** An ISO time as the value a datetime-local box wants, in this computer's time. */
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const dropLabel = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * A drop time: the piece stays invisible and unbuyable until then, the home
 * page counts down to it, and at that moment it appears by itself.
 */
function DropTime({ product: p, onChanged }) {
  const [value, setValue] = useState(toLocalInput(p.availableAt));
  const [state, run] = useAction(onChanged);
  useEffect(() => { setValue(toLocalInput(p.availableAt)); }, [p.availableAt]);
  const dirty = value !== toLocalInput(p.availableAt);

  const save = (e) => {
    e.preventDefault();
    if (value && new Date(value) <= new Date()) {
      return run(async () => { throw new Error('Choose a time in the future, or clear it.'); });
    }
    run(() => adminUpdateProduct(p.id, { availableAt: value ? new Date(value).toISOString() : null }));
  };

  return (
    <form className="admin-product__drop" onSubmit={save}>
      <label className="admin-field">
        <span>Drop time <em>optional — hidden from the shop until then</em></span>
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button className="admin-action" disabled={!dirty}>SAVE</button>
      {p.availableAt && (
        <button type="button" className="admin-link" onClick={() => run(() => adminUpdateProduct(p.id, { availableAt: null }))}>clear</button>
      )}
      <Note state={state} />
    </form>
  );
}

/* ------------------------------------------------------- write it for me */

/**
 * The owner's notes in, a drafted description and "details and care" out
 * (server/lib/writer.js). The draft only fills the boxes: it reaches the
 * shop when the owner presses SAVE, after reading it — or not at all.
 */
function Writer({ product: p, current, onDraft }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [state, setState] = useState(null);       // 'writing' | 'done' | error text
  const [sample, setSample] = useState(false);
  const [before, setBefore] = useState(null);     // the words a draft replaced, for undo

  const write = async () => {
    setState('writing');
    try {
      const d = await adminDraftDescription(p.id, notes);
      setBefore(current);
      onDraft({ description: d.description, details: d.details || current.details });
      setSample(Boolean(d.sample));
      setState('done');
      setOpen(false);
    } catch (err) { setState(err.message); }
  };
  const undo = () => { onDraft(before); setBefore(null); setState(null); };

  if (!open) {
    return (
      <div className="admin-writer admin-writer--closed">
        <button type="button" className="admin-link" onClick={() => { setOpen(true); setState(null); }}>
          WRITE IT FOR ME
        </button>
        {state === 'done' && (
          <span className="admin-note admin-note--ok" role="status">
            {sample ? 'Sample draft (in the preview; on your shop Claude writes it from your notes). ' : 'Draft written. '}
            Read it over, change anything, then SAVE.
            {before && <> <button type="button" className="admin-link" onClick={undo}>undo</button></>}
          </span>
        )}
      </div>
    );
  }
  const writing = state === 'writing';
  return (
    <div className="admin-writer">
      <label className="admin-field admin-field--wide admin-field--full">
        <span>Your notes <em>what it is made of, how it fits, the story, how to care for it</em></span>
        <textarea rows={3} maxLength={1500} value={notes} autoFocus disabled={writing}
                  aria-label={`Notes about ${p.name} for the draft`}
                  placeholder="e.g. heavy 240gsm cotton, boxy fit, print from Gelede masks, wash cold inside out"
                  onChange={(e) => setNotes(e.target.value)} />
      </label>
      <p className="admin-help">
        Claude writes a description and the details in the MASQ. voice, using only what is here and on this card.
        It fills the boxes below; nothing goes on the shop until you SAVE.
      </p>
      <div className="admin-writer__actions">
        <button type="button" className="admin-action" disabled={writing || notes.trim().length < 3} onClick={write}>
          {writing ? 'WRITING…' : 'WRITE'}
        </button>
        <button type="button" className="admin-link" disabled={writing} onClick={() => setOpen(false)}>cancel</button>
        {writing && <span className="admin-note" role="status">this takes about 20 seconds</span>}
        {state && !writing && state !== 'done' && <span className="admin-note admin-note--bad" role="alert">{state}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ card */

function ProductCard({ product: p, first, last, writer, onChanged, onReordered }) {
  const [name, setName] = useState(p.name);
  const [price, setPrice] = useState(String(p.price));
  const [badge, setBadge] = useState(p.badge ?? '');
  const [description, setDescription] = useState(p.description ?? '');
  const [details, setDetails] = useState(p.details ?? '');
  const [size, setSize] = useState('');
  const [photoNote, setPhotoNote] = useState(null);

  // A save elsewhere (or a reload) brings new values; take them unless mid-edit.
  useEffect(() => { setName(p.name); setPrice(String(p.price)); setBadge(p.badge ?? ''); }, [p.name, p.price, p.badge]);
  useEffect(() => { setDescription(p.description ?? ''); setDetails(p.details ?? ''); }, [p.description, p.details]);

  const [detailState, runDetail] = useAction(onChanged);
  const [switchState, runSwitch] = useAction(onChanged);
  const [sizeState, runSize] = useAction(onChanged);
  const [photoState, runPhoto, setPhotoState] = useAction(onChanged);

  const priceNaira = parseNaira(price);
  // Compared trimmed, as the server stores them, so a stray space is not a change.
  const tidy = (t) => t.replace(/\r\n?/g, '\n').trim();
  const dirty = name !== p.name || priceNaira !== p.price || badge.trim().toUpperCase() !== (p.badge ?? '')
    || tidy(description) !== (p.description ?? '') || tidy(details) !== (p.details ?? '');
  const fileRef = useRef(null);
  const galleryRef = useRef(null);
  const extras = (p.photos ?? []).filter(x => x.id);

  const saveDetails = (e) => {
    e.preventDefault();
    if (Number.isNaN(priceNaira)) return runDetail(async () => { throw new Error('Type the price in whole naira, e.g. 28000.'); });
    runDetail(() => adminUpdateProduct(p.id, { name, priceNaira, badge: badge.trim() || null, description, details }));
  };

  const flip = (change) => runSwitch(() => adminUpdateProduct(p.id, change));

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';                               // allow choosing the same file again
    if (!file) return;
    setPhotoNote(null);
    setPhotoState('saving');
    let prepared;
    try { prepared = await preparePhoto(file); }
    catch (err) { setPhotoState(err.message); return; }
    if (prepared.small) setPhotoNote(`This photo is only ${prepared.width} px wide after cropping, so it may look soft.`);
    runPhoto(() => adminUploadPhoto(p.id, prepared.image, prepared.image2x));
  };

  const onGalleryPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoNote(null);
    setPhotoState('saving');
    let prepared;
    try { prepared = await preparePhoto(file); }
    catch (err) { setPhotoState(err.message); return; }
    if (prepared.small) setPhotoNote(`This photo is only ${prepared.width} px wide after cropping, so it may look soft.`);
    runPhoto(() => adminAddGalleryPhoto(p.id, prepared.image, prepared.image2x));
  };

  return (
    <article className={`admin-product${p.hidden ? ' is-off' : ''}`} aria-label={p.name}>
      <div className="admin-product__photo">
        {p.img ? <img src={p.img} alt="" /> : <span className="admin-product__nophoto">NO PHOTO</span>}
        <div className="admin-product__photo-actions">
          <button className="admin-action" onClick={() => fileRef.current?.click()}>
            {p.img ? 'CHANGE PHOTO' : 'ADD PHOTO'}
          </button>
          {p.hasUpload && p.hasBuiltInPhoto && (
            <button className="admin-link" onClick={() => runPhoto(() => adminRemovePhoto(p.id))}>use original</button>
          )}
          <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,image/heic"
                 aria-label={`Photo for ${p.name}`} onChange={onPhoto} />
        </div>
        <span className="admin-product__label">More photos <em>for the product page</em></span>
        <div className="admin-gallery">
          {extras.map((x, i) => (
            <div className="admin-gallery__item" key={x.id}>
              <img src={x.img} alt="" />
              <button className="admin-gallery__remove" aria-label={`Remove extra photo ${i + 1} of ${p.name}`}
                      onClick={() => runPhoto(() => adminRemoveGalleryPhoto(p.id, x.id))}>×</button>
            </div>
          ))}
          {extras.length < MAX_EXTRA_PHOTOS && (
            <button className="admin-gallery__add" aria-label={`Add another photo of ${p.name}`}
                    onClick={() => galleryRef.current?.click()}>+</button>
          )}
          <input ref={galleryRef} type="file" hidden accept="image/jpeg,image/png,image/webp,image/heic"
                 aria-label={`Extra photo file for ${p.name}`} onChange={onGalleryPhoto} />
        </div>
        <Note state={photoState} />
        {photoNote && <p className="admin-product__warn">{photoNote}</p>}
      </div>

      <div className="admin-product__body">
        <div className="admin-product__status">
          <span className={`admin-status ${p.hidden ? 'admin-status--abandoned' : 'admin-status--paid'}`}>
            {p.hidden ? 'off sale' : 'on sale'}
          </span>
          {p.availableAt && !p.hidden && <span className="admin-status admin-status--pending">drops {dropLabel(p.availableAt)}</span>}
          {p.soldOut && !p.hidden && <span className="admin-status admin-status--failed">sold out</span>}
          {!p.hidden && !p.availableAt && (
            <a className="admin-link" href={pageHref(`/product/${p.id}`)} {...NEW_TAB}>view on shop ↗</a>
          )}
          <span className="admin-product__order">
            <button className="admin-icon" disabled={first} aria-label={`Move ${p.name} earlier`}
                    onClick={() => onReordered(adminMoveProduct(p.id, 'up'))}>↑</button>
            <button className="admin-icon" disabled={last} aria-label={`Move ${p.name} later`}
                    onClick={() => onReordered(adminMoveProduct(p.id, 'down'))}>↓</button>
          </span>
        </div>

        <form className="admin-product__details" onSubmit={saveDetails}>
          <label className="admin-field admin-field--wide">
            <span>Name</span>
            <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="admin-field">
            <span>Price (₦)</span>
            <input value={price} inputMode="numeric" onChange={(e) => setPrice(e.target.value)}
                   className={Number.isNaN(priceNaira) ? 'is-error' : ''} />
          </label>
          <label className="admin-field">
            <span>Badge <em>optional</em></span>
            <input value={badge} maxLength={16} placeholder="e.g. LIMITED" onChange={(e) => setBadge(e.target.value)} />
          </label>
          {writer && (
            <Writer product={p} current={{ description, details }}
                    onDraft={(d) => { setDescription(d.description); setDetails(d.details); }} />
          )}
          <label className="admin-field admin-field--wide admin-field--full">
            <span>Description <em>shown on the product page</em></span>
            <textarea rows={3} maxLength={2000} value={description}
                      placeholder="What it is, how it fits, the story behind it."
                      onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="admin-field admin-field--wide admin-field--full">
            <span>Details and care <em>optional</em></span>
            <textarea rows={2} maxLength={1000} value={details}
                      placeholder={'e.g. 100% cotton\nWash cold, inside out'}
                      onChange={(e) => setDetails(e.target.value)} />
          </label>
          <div className="admin-product__save">
            <button className="admin-action" disabled={!dirty}>SAVE</button>
            <Note state={detailState} />
          </div>
        </form>

        <div className="admin-product__switches">
          <Toggle label="On sale" checked={!p.hidden} onChange={(v) => flip({ hidden: !v })} />
          <Toggle label="In the drop grid" checked={p.inDrop} onChange={(v) => flip({ inDrop: v })} />
          <Toggle label="Before VIEW ALL" checked={p.featured} disabled={!p.inDrop}
                  onChange={(v) => flip({ featured: v })} />
          <Toggle label="In the Essentials carousel" checked={p.inEssentials}
                  onChange={(v) => flip({ inEssentials: v })} />
          <Note state={switchState} />
        </div>

        <DropTime product={p} onChanged={onChanged} />

        <Colours product={p} onChanged={onChanged} />

        <div className="admin-product__sizes">
          <span className="admin-product__label">Sizes and stock{p.colours?.length ? <em> counted for each colour</em> : null}</span>
          {(p.colours?.length ? p.colours.map(c => c.name) : ['']).map(colour => (
            <div className="admin-sizes__group" key={colour || 'one'}>
              {colour && (
                <span className="admin-sizes__colour">
                  <i style={{ '--swatch': p.colours.find(c => c.name === colour).hex }} aria-hidden="true" />{colour}
                </span>
              )}
              <ul>
                {p.sizes.filter(s => (s.colour ?? '') === colour).map(s => (
                  <SizeStock key={s.variantId} product={p} size={s} onChanged={onChanged}
                             onRemove={() => runSize(() => adminRemoveSize(p.id, s.variantId))} />
                ))}
              </ul>
            </div>
          ))}
          <form className="admin-product__addsize" onSubmit={(e) => {
            e.preventDefault();
            if (!size.trim()) return;
            runSize(async () => { const r = await adminAddSize(p.id, size); setSize(''); return r; });
          }}>
            <input value={size} maxLength={12} placeholder="Add a size, e.g. XXL"
                   aria-label={`New size for ${p.name}`} onChange={(e) => setSize(e.target.value)} />
            <button className="admin-action" disabled={!size.trim()}>ADD</button>
            <Note state={sizeState} />
          </form>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------- colours */

const COLOUR_PRESETS = { black: '#141416', white: '#efece6', indigo: '#3d2f9e', blue: '#2a4b8d', navy: '#1b2340',
  grey: '#7d7b80', gray: '#7d7b80', cream: '#e9e0cc', red: '#9e2b2b', green: '#2f5a3c', brown: '#5b3b26', purple: '#5a2d82' };

/**
 * The colours a piece comes in. None: it is sold by size alone. The first one
 * named takes over the stock already counted, and is the colour in the main
 * photo; each can have a photo of its own.
 */
function Colours({ product: p, onChanged }) {
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#141416');
  const [touchedHex, setTouchedHex] = useState(false);
  const [state, run] = useAction(onChanged);
  const colours = p.colours ?? [];

  // Typing a common colour name picks its swatch, until the owner picks one.
  const onName = (v) => {
    setName(v);
    const preset = COLOUR_PRESETS[v.trim().toLowerCase()];
    if (preset && !touchedHex) setHex(preset);
  };

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    run(async () => {
      const r = await adminAddColour(p.id, name, hex);
      setName(''); setTouchedHex(false);
      return r;
    });
  };

  return (
    <div className="admin-product__colours">
      <span className="admin-product__label">
        Colours <em>{colours.length
          ? 'the first is the one in the main photo'
          : 'only if it comes in more than one — the stock above becomes the first colour you add'}</em>
      </span>
      {colours.length > 0 && (
        <ul className="admin-colours">
          {colours.map((c, i) => <ColourRow key={c.id} product={p} colour={c} first={i === 0} onChanged={onChanged} />)}
        </ul>
      )}
      <form className="admin-product__addsize admin-colours__add" onSubmit={add}>
        <input type="color" value={hex} aria-label={`Swatch for a new colour of ${p.name}`}
               onChange={(e) => { setHex(e.target.value); setTouchedHex(true); }} />
        <input value={name} maxLength={24} placeholder={colours.length ? 'Add a colour, e.g. White' : 'Name its colour, e.g. Black'}
               aria-label={`New colour for ${p.name}`} onChange={(e) => onName(e.target.value)} />
        <button className="admin-action" disabled={!name.trim()}>ADD</button>
        <Note state={state} />
      </form>
    </div>
  );
}

function ColourRow({ product: p, colour: c, first, onChanged }) {
  const [name, setName] = useState(c.name);
  const [state, run, setState] = useAction(onChanged);
  const fileRef = useRef(null);
  useEffect(() => { setName(c.name); }, [c.name]);
  const dirty = name.trim() !== c.name && name.trim() !== '';

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setState('saving');
    let prepared;
    try { prepared = await preparePhoto(file); }
    catch (err) { setState(err.message); return; }
    run(() => adminUploadColourPhoto(p.id, c.id, prepared.image, prepared.image2x));
  };

  return (
    <li className="admin-colour">
      <input type="color" value={c.hex} aria-label={`Swatch for ${c.name}`}
             onChange={(e) => run(() => adminUpdateColour(p.id, c.id, { hex: e.target.value }))} />
      <form className="admin-colour__name" onSubmit={(e) => { e.preventDefault(); if (dirty) run(() => adminUpdateColour(p.id, c.id, { name })); }}>
        <input value={name} maxLength={24} aria-label={`Name of colour ${c.name}`} onChange={(e) => setName(e.target.value)} />
        {dirty && <button className="admin-action">RENAME</button>}
      </form>
      <span className="admin-colour__photo">
        {c.img
          ? <img src={c.img} alt={`${p.name} in ${c.name}`} />
          : <em>{first ? 'main photo' : 'no photo yet'}</em>}
      </span>
      <button className="admin-link" onClick={() => fileRef.current?.click()}>{c.img ? 'change photo' : 'add photo'}</button>
      {c.hasPhoto && <button className="admin-link" onClick={() => run(() => adminRemoveColourPhoto(p.id, c.id))}>remove photo</button>}
      <button className="admin-link" aria-label={`Remove colour ${c.name}`} onClick={() => run(() => adminRemoveColour(p.id, c.id))}>remove</button>
      <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,image/heic"
             aria-label={`Photo of ${p.name} in ${c.name}`} onChange={onPhoto} />
      <Note state={state} />
    </li>
  );
}

function SizeStock({ product, size, onChanged, onRemove }) {
  const [value, setValue] = useState(String(size.stock));
  const [state, run] = useAction(onChanged);
  useEffect(() => { setValue(String(size.stock)); }, [size.stock]);
  const dirty = value !== String(size.stock);

  const save = () => {
    const n = Number(value);
    if (!/^\d+$/.test(value) || n > 100000) return run(async () => { throw new Error('Whole numbers only'); });
    run(async () => { await adminSetStock(size.variantId, n); return null; });
  };

  return (
    <li className="admin-size">
      <span className="admin-size__name">{size.size}</span>
      <input className="admin-stock-input" type="number" min="0" inputMode="numeric"
             aria-label={`${product.name}, ${size.colour ? `${size.colour}, ` : ''}size ${size.size}, in stock`}
             value={value} onChange={(e) => setValue(e.target.value)}
             onKeyDown={(e) => { if (e.key === 'Enter' && dirty) { e.preventDefault(); save(); } }} />
      {dirty && <button className="admin-action" onClick={save}>SAVE</button>}
      {!dirty && size.stock === 0 && (
        <button className="admin-link" aria-label={size.colour ? `Remove size ${size.size} in every colour` : `Remove size ${size.size}`}
                onClick={onRemove}>remove</button>
      )}
      <Note state={state} />
    </li>
  );
}

/* --------------------------------------------------------------- new one */

function NewProduct({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [sizes, setSizes] = useState('');
  const [colours, setColours] = useState([]);       // [{ name, hex }]
  const [state, run] = useAction();

  const submit = (e) => {
    e.preventDefault();
    const priceNaira = parseNaira(price);
    if (Number.isNaN(priceNaira)) return run(async () => { throw new Error('Type the price in whole naira, e.g. 28000.'); });
    const list = sizes.split(',').map(s => s.trim()).filter(Boolean);
    run(async () => {
      const p = await adminCreateProduct({ name, priceNaira, sizes: list, colours });
      setName(''); setPrice(''); setSizes(''); setColours([]); setOpen(false);
      onCreated(p);
      return p;
    });
  };

  if (!open) {
    return <button className="admin-action admin-action--primary" onClick={() => setOpen(true)}>+ NEW PRODUCT</button>;
  }
  return (
    <form className="admin-new" onSubmit={submit}>
      <p className="admin-new__note">
        A new product starts <strong>off sale</strong>. Add a photo and stock counts, then switch it on.
      </p>
      <label className="admin-field admin-field--wide">
        <span>Name</span>
        <input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="admin-field">
        <span>Price (₦)</span>
        <input value={price} inputMode="numeric" placeholder="28000" onChange={(e) => setPrice(e.target.value)} />
      </label>
      <label className="admin-field admin-field--wide">
        <span>Sizes <em>comma separated — leave empty for one size</em></span>
        <input value={sizes} placeholder="S, M, L, XL" onChange={(e) => setSizes(e.target.value)} />
      </label>
      <NewColours colours={colours} onChange={setColours} />
      <div className="admin-new__actions">
        <button className="admin-action admin-action--primary" disabled={!name.trim() || !price.trim()}>CREATE</button>
        <button type="button" className="admin-link" onClick={() => setOpen(false)}>cancel</button>
        <Note state={state} />
      </div>
    </form>
  );
}

/** Colours for a product not made yet: a list kept here, sent with CREATE. */
function NewColours({ colours, onChange }) {
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#141416');
  const [touched, setTouched] = useState(false);
  const tidy = name.trim().replace(/\s+/g, ' ');
  const taken = colours.some(c => c.name.toLowerCase() === tidy.toLowerCase());

  const add = () => {
    if (!tidy || taken || colours.length >= 12) return;
    onChange([...colours, { name: tidy, hex }]);
    setName(''); setTouched(false);
  };

  return (
    <div className="admin-field admin-field--wide admin-new__colours">
      <span>Colours <em>optional — only if it comes in more than one; the first is the one in its main photo</em></span>
      {colours.length > 0 && (
        <ul className="admin-new__chips">
          {colours.map(c => (
            <li key={c.name}>
              <i style={{ '--swatch': c.hex }} aria-hidden="true" />{c.name}
              <button type="button" className="admin-link" aria-label={`Remove ${c.name}`}
                      onClick={() => onChange(colours.filter(x => x !== c))}>×</button>
            </li>
          ))}
        </ul>
      )}
      <div className="admin-product__addsize admin-product__colours">
        <input type="color" value={hex} aria-label="Swatch for the colour to add"
               onChange={(e) => { setHex(e.target.value); setTouched(true); }} />
        <input value={name} maxLength={24} placeholder="e.g. Black" aria-label="Colour to add"
               onChange={(e) => {
                 setName(e.target.value);
                 const preset = COLOUR_PRESETS[e.target.value.trim().toLowerCase()];
                 if (preset && !touched) setHex(preset);
               }}
               onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="admin-action" disabled={!tidy || taken} onClick={add}>ADD COLOUR</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- tab */

export default function ProductsTab({ onSummaryChange }) {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  // "Write it for me" shows only where the server has a key for it.
  const [writer, setWriter] = useState(false);
  useEffect(() => { adminWriterStatus().then(s => setWriter(s.ready)).catch(() => {}); }, []);

  const reload = async () => {
    try { setProducts(await adminProducts()); setError(null); }
    catch (err) { setError(err.message); }
  };
  useEffect(() => { reload(); }, []);

  // Any change can move the running-low line or sold-out flags; refresh all.
  const onChanged = () => { reload(); onSummaryChange?.(); };
  const onReordered = async (promise) => {
    try { setProducts(await promise); } catch (err) { setError(err.message); }
  };

  return (
    <section className="admin-section">
      <div className="admin-section__head">
        <h2 className="admin-h2">Products</h2>
        <div className="admin-filters"><NewProduct onCreated={onChanged} /></div>
      </div>
      <p className="admin-help">
        Prices and names change the shop at once. Orders already placed keep the price they were charged.
        Photos are cropped to the shop's portrait frame from the centre, so keep the piece in the middle.
      </p>

      {error && <p className="admin-note admin-note--bad" role="alert">{error}</p>}
      {!products ? <p className="admin-empty">Loading…</p> : (
        <div className="admin-products">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} first={i === 0} last={i === products.length - 1} writer={writer}
                         onChanged={onChanged} onReordered={onReordered} />
          ))}
        </div>
      )}
    </section>
  );
}
