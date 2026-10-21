import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ShopLayout from '../components/ShopLayout.jsx';
import { useShop } from '../store/ShopContext.jsx';
import { asset, srcSet, GALLERY_SIZES } from '../lib/media.js';
import { useSectionLink } from '../lib/useSectionLink.js';
import { Heart, Check, CaretLeft, CaretRight, ArrowShort, BagIcon, Play } from '../components/Icons.jsx';
import SwapIcon from '../components/SwapIcon.jsx';
import { pop, textIn } from '../lib/feel.js';
import { askForRestock } from '../lib/api.js';
import { track } from '../lib/analytics.js';
import { isEmail } from '../lib/delivery.js';
import { useEmailCheck, EMAIL_BAD } from '../lib/useEmailCheck.js';
import { EmailNote } from '../components/FieldNote.jsx';
import { ErrorBanner, detailsOf } from '../components/Notices.jsx';
import { jumpToTop, glideTo } from '../lib/smoothScroll.js';
import { arrivedByPhoto } from '../lib/pageMorph.js';
import { hasColours, sizesFor, firstColour, onlyChoice, optionLabel } from '../lib/colours.js';
import Swatches from '../components/Swatches.jsx';
import { ProductCard } from '../components/DropGrid.jsx';
import { useHome } from '../store/ShopContext.jsx';
import { categoryOf } from '../data/shop.js';
import { titleCase } from '../lib/names.js';

import { EASE_OUT } from '../lib/motion.js';
const TITLE = document.title;

/* ------------------------------------------------------------- gallery */

/**
 * The main photo and any extra ones. On a wide screen: one large photo and a
 * row of thumbnails. On a phone: a strip to swipe through, with the
 * thumbnails in a row underneath.
 */
function Gallery({ product, colour }) {
  // A colour with a photo of its own shows it first, in place of the main one.
  const own = product.colours?.find(c => c.name === colour && c.img);
  const base = product.photos?.length ? product.photos : (product.img ? [{ img: product.img, img2x: product.img2x }] : []);
  const photos = own ? [{ img: own.img, img2x: own.img2x }, ...base.slice(1)] : base;
  // Picked a colour nobody has photographed yet: say which colour is shown.
  const pictured = hasColours(product) && !own && colour !== product.colours[0].name ? product.colours[0].name : null;
  const { openOverlay, toast } = useShop();
  const [index, setIndex] = useState(0);
  const [lens, setLens] = useState(null);   // where the mouse is over the photo, in %, and whether it is there
  const lensReady = useRef(false);           // the sharp copy is fetched on the first hover only
  const strip = useRef(null);
  const enlarge = (i) => openOverlay({ zoom: { photos, index: i, name: product.name } });
  // A hint, once a visit: the photos open up close.
  useEffect(() => {
    if (!product) return;
    const t = setTimeout(() => toast({ tone: 'tip', title: 'Tip: tap a photo to see it up close.', once: 'tip-zoom' }), 2500);
    return () => clearTimeout(t);
  }, [Boolean(product)]);   // eslint-disable-line react-hooks/exhaustive-deps

  // With a mouse, the photo under the pointer shows close up, from the
  // sharper copy. Touch screens tap through to the full-screen view instead.
  const onLens = (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    lensReady.current = true;
    setLens({ x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100, on: true });
  };

  useEffect(() => { setIndex(0); strip.current?.scrollTo({ left: 0 }); }, [product.id, own?.img]);

  const show = (i) => {
    setIndex(i);
    const el = strip.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  // Swiping on a phone moves the strip; keep the dots in step with it.
  const onScroll = () => {
    const el = strip.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  if (!photos.length) return <div className="pdp__gallery"><div className="pdp__frame" /></div>;

  return (
    <div className="pdp__gallery">
      <div className="pdp__strip" ref={strip} onScroll={onScroll}
           role="group" aria-roledescription="gallery" aria-label={`Photos of ${product.name}`}>
        {photos.map((p, i) => (
          <div className="pdp__frame" key={p.img} aria-hidden={i !== index}>
            <button type="button" className="pdp__enlarge" tabIndex={i === index ? 0 : -1}
                    aria-label={`Enlarge photo ${i + 1} of ${product.name}`}
                    onClick={() => enlarge(i)}
                    onPointerMove={i === index ? onLens : undefined}
                    onPointerLeave={() => setLens(l => l && { ...l, on: false })}>
              <img src={p.img} srcSet={srcSet(p)} sizes={GALLERY_SIZES}
                   style={i === 0 ? { viewTransitionName: 'pdp-photo' } : undefined}
                   alt={i === 0 ? product.name : `${product.name}, photo ${i + 1}`}
                   loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : undefined} />
              {i === index && lensReady.current && (
                <img className={`pdp__lens${lens?.on ? ' is-on' : ''}`} src={p.img2x || p.img} alt="" aria-hidden="true"
                     style={lens ? { transformOrigin: `${lens.x}% ${lens.y}%` } : undefined} />
              )}
            </button>
          </div>
        ))}
      </div>
      {(product.isNew || product.badge) && <span className={`card__badge${product.isNew ? ' card__badge--new' : ''}`}>{product.isNew ? 'NEW' : product.badge}</span>}
      {pictured && <p className="pdp__pictured">Shown in {pictured}</p>}
      {photos.length > 1 && (
        <>
          <button type="button" className="pdp__arrow pdp__arrow--prev" aria-label="Previous photo"
                  onClick={() => show((index - 1 + photos.length) % photos.length)}><CaretLeft /></button>
          <button type="button" className="pdp__arrow pdp__arrow--next" aria-label="Next photo"
                  onClick={() => show((index + 1) % photos.length)}><CaretRight /></button>
        </>
      )}
      <button type="button" className="pdp__full" aria-label="See the photo full screen" onClick={() => enlarge(index)}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5" /></svg>
      </button>

      {photos.length > 1 && (
        <>
          <div className="pdp__thumbs">
            {photos.map((p, i) => (
              <button key={p.img} className={i === index ? 'is-active' : ''} aria-current={i === index}
                      aria-label={`Show photo ${i + 1} of ${photos.length}`} onClick={() => show(i)}>
                <img src={p.img} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          <div className="dots pdp__dots" aria-hidden="true">
            {photos.map((p, i) => <button key={p.img} tabIndex={-1} className={i === index ? 'is-active' : ''} onClick={() => show(i)} />)}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------- back-in-stock form */

/**
 * For the sizes that have sold out: leave an email and the owner can tell
 * you when it is back. Nothing is sent automatically yet — the owner sees the
 * list in the admin — so the words promise no more than that.
 */
function RestockAsk({ product, colour = '' }) {
  const gone = sizesFor(product, colour).filter(s => !s.available);
  const colourOut = hasColours(product) && gone.length === sizesFor(product, colour).length;
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(gone[0]?.size ?? '');
  const [email, setEmail] = useState('');
  const [state, setState] = useState(null);   // null | 'sending' | 'done' | error message
  const check = useEmailCheck(email);

  useEffect(() => { setOpen(false); setState(null); setSize(gone[0]?.size ?? ''); }, [product.id, colour]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Sent here by the "Out of stock" panel's NOTIFY ME: the form is open,
  // on the size they wanted, and the page glides to it.
  const { state: arrived, key: visit } = useLocation();
  useEffect(() => {
    if (!arrived?.notify || !gone.length) return;
    setOpen(true);
    if (gone.some(s => s.size === arrived.size)) setSize(arrived.size);
    const t = setTimeout(() => {
      const el = document.getElementById('restock-email');
      if (el) { glideTo(el, -180); el.focus({ preventScroll: true }); }
    }, 80);
    return () => clearTimeout(t);
  }, [visit]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!gone.length) return null;
  if (state === 'done') {
    return <p className="restock restock--done" role="status">You’re on the list. We’ll let you know when {optionLabel(colour, size)} is back.</p>;
  }
  if (!open) {
    return (
      <button type="button" className="restock__open" onClick={() => setOpen(true)}>
        {product.soldOut || colourOut ? 'TELL ME WHEN IT’S BACK' : 'SOLD OUT IN YOUR SIZE? TELL ME WHEN IT’S BACK'}
      </button>
    );
  }

  const send = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) { setState(EMAIL_BAD); return; }
    setState('sending');
    try { await askForRestock(product.id, size, email.trim(), colour); setState('done'); track('restock_request', { productId: product.id, size }); }
    catch (err) { setState(err.message); }
  };

  return (
    <form className="restock" onSubmit={send} noValidate>
      <p className="restock__lead">Leave your email and we’ll tell you when {colour ? `${colour} is` : 'it’s'} back.</p>
      <div className="restock__row">
        {gone.length > 1 && (
          <>
            <label className="sr-only" htmlFor="restock-size">Size</label>
            <select id="restock-size" value={size} onChange={(e) => setSize(e.target.value)}>
              {gone.map(s => <option key={s.size} value={s.size}>{s.size}</option>)}
            </select>
          </>
        )}
        <label className="sr-only" htmlFor="restock-email">Email</label>
        <input id="restock-email" type="email" autoComplete="email" placeholder="Your email"
               value={email} onChange={(e) => { setEmail(e.target.value); if (state !== 'sending') setState(null); }}
               {...check.input}
               {...(state && state !== 'sending' ? { className: 'is-error', 'aria-invalid': true } : {})} />
        <button className="btn btn--ghost" disabled={state === 'sending'}>{state === 'sending' ? '…' : 'NOTIFY ME'}</button>
      </div>
      <EmailNote check={check} error={state && state !== 'sending' ? state : null} onUse={setEmail} />
    </form>
  );
}

/* ------------------------------------------------------- buying box */

function BuyBox({ product, colour, onColour }) {
  const { addToCart, format, wishlist, toggleWish, openOverlay, showSoldOut } = useShop();
  const sizes = sizesFor(product, colour);
  // One size and no colours: nothing to choose. One size in colours: the size
  // needs no choosing, the colour does.
  const single = sizes.length === 1 ? sizes[0] : null;
  const only = onlyChoice(product);
  const [size, setSize] = useState(single?.available ? single.size : null);
  const [asked, setAsked] = useState(false);
  const saved = wishlist.includes(product.id);
  const colourOut = hasColours(product) && sizes.every(s => !s.available);

  useEffect(() => { setSize(single?.available ? single.size : null); setAsked(false); }, [product.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  // A new colour keeps the size chosen if that colour has it, else asks again.
  const pickColour = (name) => {
    onColour(name);
    const next = sizesFor(product, name);
    const keep = next.find(s => s.size === size && s.available);
    const one = next.length === 1 && next[0].available ? next[0].size : null;
    setSize(keep ? size : one);
    setAsked(false);
  };

  const chosen = sizes.find(s => s.size === size && s.available);

  // How many to add: up to what is left in this size, and the most per order.
  const [qty, setQty] = useState(1);
  const maxQty = Math.min(10, chosen?.left ?? single?.left ?? 10);
  useEffect(() => { setQty(1); }, [product.id, colour, size]);
  const add = (buyNow = false) => {
    if (product.soldOut || colourOut) { showSoldOut(product, colour); return; }
    if (!chosen) { setAsked(true); return; }
    const got = addToCart(product, chosen.size, colour, { quiet: true, qty });
    if (!got) return;   // the bag has said why (sold out, the most per order)
    // Buy now: straight on to the delivery details.
    if (buyNow) { openOverlay('checkout'); return; }
    // A panel offers the bag or more shopping; the button says so for a
    // moment too, and its name for screen readers stays.
    // Few left in this size (the shop says how many only when it is low): the
    // owner's amber "Low stock" panel instead, which still says it is in the bag.
    openOverlay({ added: { ...got, left: chosen.left ?? null } });
    setAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 1600);
  };
  const [added, setAdded] = useState(false);
  const addedTimer = useRef(null);
  useEffect(() => () => clearTimeout(addedTimer.current), []);
  useEffect(() => { clearTimeout(addedTimer.current); setAdded(false); }, [product.id]);
  const addedLabel = <span className="btn__added"><Check />ADDED</span>;

  // On a phone the buying box sits below the photo. While it is out of view a
  // bar at the foot of the screen keeps the name, price and button in reach.
  // Its name and price only when those are out of view too.
  const actions = useRef(null);
  const price = useRef(null);
  const [away, setAway] = useState(false);
  const [priceAway, setPriceAway] = useState(false);
  useEffect(() => {
    if (!actions.current || !('IntersectionObserver' in window)) return;
    const watch = new IntersectionObserver(entries => {
      for (const e of entries) (e.target === actions.current ? setAway : setPriceAway)(!e.isIntersecting);
    });
    watch.observe(actions.current);
    watch.observe(price.current);
    return () => watch.disconnect();
  }, []);
  // A size still to choose: take them to the sizes rather than guess.
  const barAdd = () => {
    if (!chosen && !product.soldOut && !colourOut) {
      setAsked(true);
      glideTo(document.querySelector('.pdp__colours, .pdp__sizes') ?? actions.current, -90);
      return;
    }
    add();
  };

  return (
    <div className="pdp__info">
      <p className="pdp__kicker">
        {categoryOf(product.category) && <span className="pdp__cat">{categoryOf(product.category).name}</span>}
        {product.sku && <span className="pdp__sku">SKU: {product.sku}</span>}
      </p>
      <h1 className="pdp__name">{titleCase(product.name)}</h1>
      <p className={`pdp__price${product.soldOut ? ' card__sold' : ''}`} ref={price}>
        {product.soldOut ? 'SOLD OUT' : format(product.price)}
      </p>
      {product.rating > 0 && <Stars rating={product.rating} reviews={product.reviews} />}
      {product.description && <p className="pdp__lede">{product.description.split(/\n\s*\n/)[0]}</p>}

      {hasColours(product) && (
        <fieldset className="pdp__colours">
          <legend>Colour: <strong>{colour}</strong>{colourOut ? ' (sold out)' : ''}</legend>
          <Swatches product={product} value={colour} onChange={pickColour} large />
        </fieldset>
      )}

      {!only && !single && (
        <fieldset className="pdp__sizes">
          <legend>
            <span>Size:{chosen ? <strong> {chosen.size}</strong> : null}</span>
            <button type="button" className="pdp__guide" onClick={() => openOverlay({ info: 'SIZE_GUIDE' })}>
              <svg viewBox="0 0 20 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="1" y="1" width="18" height="10" rx="1" /><path d="M5 1v4M9 1v3M13 1v4M17 1v3" /></svg>
              Size Guide
            </button>
          </legend>
          <div className="pdp__size-row">
            {sizes.map(s => (
              <button key={s.size} type="button" aria-pressed={size === s.size}
                      disabled={!s.available}
                      className={size === s.size ? 'is-on' : ''}
                      aria-label={s.available ? s.size : `${s.size}, sold out`}
                      onClick={() => { setSize(s.size); setAsked(false); }}>{s.size}</button>
            ))}
          </div>
          <p className={`pdp__hint${asked ? ' is-error' : ''}`} role={asked ? 'alert' : undefined}>
            {asked ? 'CHOOSE A SIZE FIRST' : ' '}
          </p>
        </fieldset>
      )}
      <Stock product={product} chosen={chosen ?? single} out={product.soldOut || colourOut} />

      <div className="pdp__actions" ref={actions}>
        {!(product.soldOut || colourOut) && (
          <div className="pdp__qty" role="group" aria-label="Quantity">
            <button type="button" aria-label="One fewer" disabled={qty <= 1} onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
            <output aria-live="polite">{qty}</output>
            <button type="button" aria-label="One more" disabled={qty >= maxQty} onClick={() => setQty(q => Math.min(maxQty, q + 1))}>+</button>
          </div>
        )}
        <button className="btn btn--solid pdp__add" onClick={() => add()} disabled={product.soldOut || colourOut}
                aria-label={product.soldOut || colourOut ? 'SOLD OUT' : 'ADD TO BAG'}>
          <SwapIcon swap={added} play={textIn}>
            {product.soldOut || colourOut ? 'SOLD OUT' : added ? addedLabel : <span className="pdp__add-label"><BagIcon />ADD TO BAG</span>}
          </SwapIcon>
        </button>
        <button className={`pdp__save${saved ? ' is-on' : ''}`} aria-pressed={saved}
                aria-label={saved ? `Remove ${product.name} from saved` : `Save ${product.name}`}
                onClick={(e) => { if (!saved) pop(e.currentTarget.firstChild); toggleWish(product.id); }}><Heart /></button>
      </div>
      {!(product.soldOut || colourOut) && (
        <button type="button" className="btn btn--ghost pdp__buy" onClick={() => add(true)}>
          BUY NOW <ArrowShort className="btn__arrow" />
        </button>
      )}

      <RestockAsk product={product} colour={colour} />
      <Promises />

      {/* A shortcut for the eye and thumb only: the same name, price and
          button are in the box above, where a screen reader finds them. Put
          on the page itself: the box moves as it fades in, which would carry
          a bar fixed inside it along. */}
      {createPortal(<div className={`pdp__bar${away ? ' is-on' : ''}${priceAway ? '' : ' pdp__bar--button'}`} aria-hidden="true">
        <p className="pdp__bar-text">
          <span className="pdp__bar-name">{product.name}</span>
          <span>{product.soldOut ? 'SOLD OUT' : format(product.price)}</span>
        </p>
        <button type="button" tabIndex={-1} className="btn btn--solid pdp__bar-add" onClick={barAdd}
                disabled={product.soldOut || colourOut}>
          <SwapIcon swap={added} play={textIn}>
            {product.soldOut || colourOut ? 'SOLD OUT' : added ? addedLabel : chosen || sizes.length < 2 ? 'ADD TO BAG' : 'CHOOSE SIZE'}
          </SwapIcon>
        </button>
      </div>, document.body)}

    </div>
  );
}

/* ------------------------------------------- stock line and promises */

/** In stock, low, sold out or pre-order, in one line under the sizes. */
function Stock({ product, chosen, out }) {
  if (out) return <p className="pdp__stock pdp__stock--out"><i aria-hidden="true" />Sold out</p>;
  if (product.preorder) {
    return <p className="pdp__stock pdp__stock--pre"><i aria-hidden="true" />Pre-order<span>{product.shipsNote || 'Sent as soon as it arrives'}</span></p>;
  }
  if (chosen?.left) return <p className="pdp__stock pdp__stock--low"><i aria-hidden="true" />Only {chosen.left} left{chosen.size !== 'ONE SIZE' ? ` in ${chosen.size}` : ''}<span>Ready to ship</span></p>;
  return <p className="pdp__stock"><i aria-hidden="true" />In stock<span>Ready to ship</span></p>;
}

const PROMISE_ICONS = [
  <path key="v" d="M2 6h11v8H2zM13 9h4l3 3v2h-7zM5 16a1.5 1.5 0 1 0 0 .1M16 16a1.5 1.5 0 1 0 0 .1" />,
  <path key="b" d="M11 2l7 3.5v9L11 18l-7-3.5v-9zM4 5.5l7 3.5 7-3.5M11 9v9" />,
  <path key="s" d="M11 2l7 2.6v5c0 4.2-2.9 7.3-7 8.9-4.1-1.6-7-4.7-7-8.9v-5zM8 10l2.2 2.2L14.5 8" />
];

/** The three promises, in the owner's own words (Home page → Words). */
function Promises() {
  const { home } = useHome();
  const perks = [1, 2, 3].map(n => [home[`perk${n}Title`], home[`perk${n}Text`]]).filter(([t]) => t);
  if (!perks.length) return null;
  return (
    <ul className="pdp__promises">
      {perks.map(([t, x], i) => (
        <li key={t}>
          <svg viewBox="0 0 22 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">{PROMISE_ICONS[i]}</svg>
          <span><strong>{t}</strong>{x && <em>{x}</em>}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------- tabs */

/** Lines as a ticked list, or paragraphs split at blank lines. */
function Text({ text, ticks = false }) {
  if (ticks) {
    const lines = text.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    return <ul className="pdp-tabs__ticks">{lines.map(l => <li key={l}>{l}</li>)}</ul>;
  }
  return text.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>);
}

/**
 * Description, Materials, Size & Fit, Shipping and Returns, as tabs. A tab
 * shows only when there is something in it: the owner writes the first three
 * on each product in the admin; the last two are the shop's own pages.
 */
function Tabs({ product }) {
  const { site, openOverlay } = useShop();
  const pages = site?.pages ?? {};
  const tabs = [
    (product.description || product.details) && ['description', 'Description', <>
      {product.description && <Text text={product.description} />}
      {product.details && <Text text={product.details} ticks />}
    </>],
    product.materials && ['materials', 'Materials', <Text text={product.materials} ticks />],
    (product.fit || (product.sizes?.length ?? 0) > 1) && ['fit', 'Size & Fit', <>
      {product.fit && <Text text={product.fit} />}
      <p><button type="button" className="pdp__inline" onClick={() => openOverlay({ info: 'SIZE_GUIDE' })}>See the size guide</button></p>
    </>],
    pages.SHIPPING && ['shipping', 'Shipping', <><Text text={pages.SHIPPING} /><p>The delivery fee for your address is shown in the bag, before you pay.</p></>],
    pages.RETURNS && ['returns', 'Returns', <Text text={pages.RETURNS} />]
  ].filter(Boolean);
  const [open, setOpen] = useState(null);
  useEffect(() => { setOpen(null); }, [product.id]);
  if (!tabs.length) return null;
  const current = tabs.find(t => t[0] === open) ?? tabs[0];
  // Arrow keys move along the tabs, as in any tab list.
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    const i = tabs.findIndex(t => t[0] === current[0]);
    const next = tabs[(i + step + tabs.length) % tabs.length][0];
    setOpen(next);
    document.getElementById(`tab-${next}`)?.focus();
  };
  return (
    <div className="pdp-tabs">
      <div className="pdp-tabs__list" role="tablist" aria-label="About this piece" onKeyDown={onKey}>
        {tabs.map(([key, name]) => (
          <button key={key} id={`tab-${key}`} type="button" role="tab" aria-selected={key === current[0]} aria-controls={`panel-${key}`}
                  tabIndex={key === current[0] ? 0 : -1} className={key === current[0] ? 'is-on' : ''} onClick={() => setOpen(key)}>{name}</button>
        ))}
      </div>
      <div className="pdp-tabs__panel" role="tabpanel" id={`panel-${current[0]}`} aria-labelledby={`tab-${current[0]}`}>{current[2]}</div>
    </div>
  );
}

/** Five stars filled to the rating, with the number of reviews beside them. */
function Stars({ rating, reviews }) {
  const pct = Math.max(0, Math.min(5, rating)) / 5 * 100;
  return (
    <p className="pdp__stars">
      <span className="pdp__stars-row" style={{ '--fill': `${pct}%` }} aria-hidden="true">★★★★★</span>
      <span>{rating.toFixed(1)}{reviews ? ` (${reviews} reviews)` : ''}</span>
      <span className="sr-only">Rated {rating.toFixed(1)} out of 5</span>
    </p>
  );
}

/**
 * "See it closer". With a close-up film still for the piece it plays the
 * film, as the design has it; otherwise its photo opens the close-up view.
 */
function Closer({ product }) {
  const { openOverlay } = useShop();
  const photos = product.photos?.length ? product.photos : (product.img ? [{ img: product.img, img2x: product.img2x }] : []);
  if (!photos.length && !product.closer) return null;
  const i = photos.length > 1 ? 1 : 0;
  const film = Boolean(product.closer);
  return (
    <button type="button" className={`pdp-closer${film ? ' pdp-closer--film' : ''}`} aria-haspopup="dialog"
            onClick={() => openOverlay(film ? 'film' : { zoom: { photos, index: i, name: product.name } })}>
      <img src={film ? asset(product.closer) : (photos[i].img2x || photos[i].img)} alt="" aria-hidden="true" loading="lazy" />
      {film && <span className="film__disc pdp-closer__disc" aria-hidden="true"><Play /></span>}
      <span className="pdp-closer__text">
        <strong>SEE IT<br />CLOSER</strong>
        <span>A closer look at the details, texture and craftsmanship behind {titleCase(product.name)}.</span>
        <em>{film ? 'PLAY VIDEO' : 'ZOOM IN'} <ArrowShort /></em>
      </span>
    </button>
  );
}

/* ------------------------------------------ complete the look, more */

function Row({ id, title, link, pieces }) {
  const [picking, setPicking] = useState(null);
  if (!pieces.length) return null;
  return (
    <section className="section pdp__more-like" aria-labelledby={id}>
      <div className="pdp-row__head">
        <h2 className="pdp-row__title" id={id}>{title}</h2>
        {link && <Link to={link[0]} className="sh-link pdp-row__link">{link[1]} <ArrowShort /></Link>}
      </div>
      <div className="grid" onClick={(e) => { if (!e.target.closest('.card')) setPicking(null); }}>
        {pieces.map(p => (
          <ProductCard key={p.id} product={p} bagButton="plus" picking={picking === p.id} onPick={setPicking} onClosePick={() => setPicking(null)}
                       badge={p.isNew ? 'NEW' : undefined} />
        ))}
      </div>
    </section>
  );
}

function MoreLike({ product }) {
  const { products } = useShop();
  const others = products.filter(p => p.id !== product.id);
  // Complete the look: the owner's own picks; else pieces of other kinds from
  // the same collections; else of other kinds at all.
  const picked = (product.look ?? []).map(id => others.find(p => p.id === id)).filter(Boolean);
  const shares = (p) => p.collections?.some(c => product.collections?.includes(c));
  const look = (picked.length ? picked : [
    ...others.filter(p => p.category !== product.category && shares(p) && !p.soldOut),
    ...others.filter(p => p.category !== product.category && !shares(p) && !p.soldOut)
  ]).slice(0, 4);
  // You might also like: the same category first, then the rest of the drop.
  const like = [
    ...others.filter(p => p.category && p.category === product.category && !look.includes(p)),
    ...others.filter(p => p.category !== product.category && p.inDrop && !look.includes(p))
  ].slice(0, 4);
  const cat = categoryOf(product.category);
  return (
    <>
      <Row id="theLook" title="Complete the Look" link={['/collections/drop-01', 'Shop the Full Drop']} pieces={look} />
      <Row id="moreLike" title="You Might Also Like" link={cat ? [`/shop/${cat.key}`, `View All ${cat.name}`] : ['/shop', 'View All']} pieces={like} />
    </>
  );
}

/* ---------------------------------------------------------------- page */

export default function ProductPage() {
  const { id } = useParams();
  const { productById, catalogueStatus, catalogueError, loadCatalogue } = useShop();
  const goTo = useSectionLink();
  const product = productById(id);
  const navigate = useNavigate();
  const { state } = useLocation();

  // Where on the home page this piece lives: the drop grid, else the carousel.
  const section = product && !product.inDrop && product.inEssentials ? '#essentials' : '#drop';
  // BACK returns to exactly where they were — the same spot on the grid, or
  // the piece before this one. Someone who arrived from a shared link has
  // nowhere in the shop behind them, so it opens the shop at this piece's
  // section instead of sending them out of the site.
  const back = (e) => {
    e.preventDefault();
    if (state?.fromShop) navigate(-1);
    else goTo(section);
  };

  // The colour being looked at: the one a link names (?colour=Black), else
  // the first in stock. Kept in the address, so a shared link opens on it.
  const [params, setParams] = useSearchParams();
  const asked = params.get('colour');
  const colour = product && hasColours(product)
    ? (product.colours.find(c => c.name.toLowerCase() === asked?.toLowerCase())?.name ?? firstColour(product))
    : '';
  const setColour = (name) => {
    const next = new URLSearchParams(params);
    next.set('colour', name);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  // Before the browser draws the new page (and before a gliding photo's
  // "after" picture is taken), so it opens at the top.
  useLayoutEffect(() => { jumpToTop(); }, [id]);
  // Counted once per piece per page visit, when it has actually loaded.
  const viewed = product?.id;
  useEffect(() => {
    if (viewed) track('view_item', { productId: viewed, valueKobo: product.priceKobo });
  }, [viewed]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (product) document.title = `${product.name} — MASQ.`;
    return () => { document.title = TITLE; };
  }, [product]);

  let body;
  if (product) {
    body = (
      <>
        <motion.div className="pdp" key={product.id}
                    initial={arrivedByPhoto() ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
          <div className="pdp__crumbs">
            <a href={`/${section}`} className="pdp__back" onClick={back}>
              <span aria-hidden="true">←</span> BACK
            </a>
            <nav aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <span aria-hidden="true">›</span>
              <Link to="/shop">Shop</Link>
              {categoryOf(product.category) && (
                <>
                  <span aria-hidden="true">›</span>
                  <Link to={`/shop/${product.category}`}>{categoryOf(product.category).name}</Link>
                </>
              )}
              <span aria-hidden="true">›</span>
              <span aria-current="page">{product.name}</span>
            </nav>
          </div>
          <Gallery product={product} colour={colour} />
          <BuyBox product={product} colour={colour} onColour={setColour} />
        </motion.div>
        <section className="pdp-more" aria-label="About this piece">
          <Closer product={product} />
          <Tabs product={product} />
        </section>
        <MoreLike product={product} />
      </>
    );
  } else if (catalogueStatus === 'error') {
    body = (
      <div className="pdp-empty">
        <ErrorBanner layout="panel" picture={catalogueError?.status === 0 ? 'offline' : 'server'}
                     title="We couldn’t load this page." text="Please try again, or contact us if the problem persists."
                     onRetry={loadCatalogue} retryLabel="Retry" details={detailsOf(catalogueError)} />
      </div>
    );
  } else if (catalogueStatus === 'ready') {
    body = (
      <div className="pdp-empty">
        <p className="eyebrow">NOT FOUND</p>
        <h1 className="pdp-empty__title">This piece is no longer available.</h1>
        <a className="btn btn--ghost" href="/#drop" onClick={(e) => { e.preventDefault(); goTo('#drop'); }}>SEE THE COLLECTION</a>
      </div>
    );
  } else {
    body = <div className="pdp pdp--loading" aria-busy="true" aria-label="Loading"><div className="pdp__gallery"><div className="pdp__frame" /></div></div>;
  }

  return <ShopLayout>{body}</ShopLayout>;
}
