import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ShopLayout from '../components/ShopLayout.jsx';
import { useShop } from '../store/ShopContext.jsx';
import { srcSet, CARD_SIZES, GALLERY_SIZES } from '../lib/media.js';
import { useSectionLink } from '../lib/useSectionLink.js';
import { Heart, Check } from '../components/Icons.jsx';
import SwapIcon from '../components/SwapIcon.jsx';
import { pop, textIn } from '../lib/feel.js';
import { askForRestock } from '../lib/api.js';
import { track } from '../lib/analytics.js';
import { isEmail } from '../lib/delivery.js';
import { useEmailCheck, EMAIL_OK, EMAIL_BAD } from '../lib/useEmailCheck.js';
import FieldNote from '../components/FieldNote.jsx';
import { jumpToTop, glideTo } from '../lib/smoothScroll.js';
import { useGlideToProduct, arrivedByPhoto, FROM_SHOP } from '../lib/pageMorph.js';
import { hasColours, sizesFor, firstColour, onlyChoice, optionLabel } from '../lib/colours.js';
import Swatches from '../components/Swatches.jsx';

import { EASE_OUT } from '../lib/motion.js';
const TITLE = document.title;

/* ------------------------------------------------------------- gallery */

/**
 * The main photo and any extra ones. On a wide screen: one large photo and a
 * row of thumbnails. On a phone: a strip to swipe through, with dots.
 */
function Gallery({ product, colour }) {
  // A colour with a photo of its own shows it first, in place of the main one.
  const own = product.colours?.find(c => c.name === colour && c.img);
  const base = product.photos?.length ? product.photos : (product.img ? [{ img: product.img, img2x: product.img2x }] : []);
  const photos = own ? [{ img: own.img, img2x: own.img2x }, ...base.slice(1)] : base;
  // Picked a colour nobody has photographed yet: say which colour is shown.
  const pictured = hasColours(product) && !own && colour !== product.colours[0].name ? product.colours[0].name : null;
  const { openOverlay } = useShop();
  const [index, setIndex] = useState(0);
  const [lens, setLens] = useState(null);   // where the mouse is over the photo, in %, and whether it is there
  const lensReady = useRef(false);           // the sharp copy is fetched on the first hover only
  const strip = useRef(null);
  const enlarge = (i) => openOverlay({ zoom: { photos, index: i, name: product.name } });

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
      {product.badge && <span className="card__badge">{product.badge}</span>}
      {pictured && <p className="pdp__pictured">Shown in {pictured}</p>}

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
      <FieldNote error={state && state !== 'sending' ? state : check.state === 'bad' ? EMAIL_BAD : null}
                 ok={!state && check.state === 'ok' ? EMAIL_OK : null} reserve />
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

  const add = () => {
    if (product.soldOut || colourOut) { showSoldOut(product, colour); return; }
    if (!chosen) { setAsked(true); return; }
    const got = addToCart(product, chosen.size, colour, { quiet: true });
    if (!got) return;   // the bag has said why (sold out, the most per order)
    // A panel offers the bag or more shopping; the button says so for a
    // moment too, and its name for screen readers stays.
    openOverlay({ added: got });
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
      <h1 className="pdp__name">{product.name}</h1>
      <p className={`pdp__price${product.soldOut ? ' card__sold' : ''}`} ref={price}>
        {product.soldOut ? 'SOLD OUT' : format(product.price)}
      </p>

      {hasColours(product) && (
        <fieldset className="pdp__colours">
          <legend>COLOUR — {colour.toUpperCase()}{colourOut ? ' (SOLD OUT)' : ''}</legend>
          <Swatches product={product} value={colour} onChange={pickColour} large />
        </fieldset>
      )}

      {!only && !single && (
        <fieldset className="pdp__sizes">
          <legend>
            <span>SIZE{chosen ? ` — ${chosen.size}` : ''}</span>
            <button type="button" className="pdp__guide" onClick={() => openOverlay({ info: 'SIZE_GUIDE' })}>SIZE GUIDE</button>
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
            {asked ? 'CHOOSE A SIZE FIRST'
              : chosen?.left ? `ONLY ${chosen.left} LEFT IN ${chosen.size}`
              : ' '}
          </p>
        </fieldset>
      )}
      {single?.left ? <p className="pdp__hint">ONLY {single.left} LEFT</p> : null}

      <div className="pdp__actions" ref={actions}>
        <button className="btn btn--solid pdp__add" onClick={add} disabled={product.soldOut || colourOut}
                aria-label={product.soldOut || colourOut ? 'SOLD OUT' : 'ADD TO BAG'}>
          <SwapIcon swap={added} play={textIn}>
            {product.soldOut || colourOut ? 'SOLD OUT' : added ? addedLabel : 'ADD TO BAG'}
          </SwapIcon>
        </button>
        <button className={`pdp__save${saved ? ' is-on' : ''}`} aria-pressed={saved}
                aria-label={saved ? `Remove ${product.name} from saved` : `Save ${product.name}`}
                onClick={(e) => { if (!saved) pop(e.currentTarget.firstChild); toggleWish(product.id); }}><Heart /></button>
      </div>

      <RestockAsk product={product} colour={colour} />

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

      {product.description && <p className="pdp__text">{product.description}</p>}

      {product.details && (
        <details className="pdp__more" open>
          <summary>DETAILS &amp; CARE</summary>
          <p className="pdp__text pdp__text--sm">{product.details}</p>
        </details>
      )}

      <details className="pdp__more">
        <summary>DELIVERY &amp; RETURNS</summary>
        <p className="pdp__text pdp__text--sm">
          The delivery fee for your address is shown in the bag, before you pay.{' '}
          <button type="button" className="pdp__inline" onClick={() => openOverlay({ info: 'SHIPPING' })}>Delivery</button>
          {' · '}
          <button type="button" className="pdp__inline" onClick={() => openOverlay({ info: 'RETURNS' })}>Returns</button>
        </p>
      </details>
    </div>
  );
}

/* ---------------------------------------------------- you may also like */

function MoreLike({ product }) {
  const { products, format } = useShop();
  const glide = useGlideToProduct();
  // Others from the drop first, in the shop's own order; then the rest.
  const others = products.filter(p => p.id !== product.id);
  const picks = [...others.filter(p => p.inDrop && !p.soldOut), ...others.filter(p => !p.inDrop || p.soldOut)].slice(0, 4);
  if (!picks.length) return null;

  return (
    <section className="section pdp__more-like" aria-labelledby="moreLike">
      <div className="section__head">
        <h2 className="section__title" id="moreLike">You may also like</h2>
        <span className="section__rule" aria-hidden="true" />
      </div>
      <div className="grid">
        {picks.map(p => (
          <article className="card" key={p.id}>
            <div className="card__media">
              <Link to={`/product/${p.id}`} state={FROM_SHOP} onClick={(e) => glide(e, `/product/${p.id}`)} className="card__link" tabIndex={-1} aria-hidden="true">
                {p.img && <img src={p.img} srcSet={srcSet(p)} sizes={CARD_SIZES} alt="" loading="lazy" />}
              </Link>
              {p.badge && <span className="card__badge">{p.badge}</span>}
            </div>
            <h3 className="card__name"><Link to={`/product/${p.id}`} state={FROM_SHOP} onClick={(e) => glide(e, `/product/${p.id}`)}>{p.name}</Link></h3>
            <p className={`card__price${p.soldOut ? ' card__sold' : ''}`}>{p.soldOut ? 'SOLD OUT' : format(p.price)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- page */

export default function ProductPage() {
  const { id } = useParams();
  const { productById, catalogueStatus, loadCatalogue } = useShop();
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
              <a href={`/${section}`} onClick={(e) => { e.preventDefault(); goTo(section); }}>SHOP</a>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{product.name}</span>
            </nav>
          </div>
          <Gallery product={product} colour={colour} />
          <BuyBox product={product} colour={colour} onColour={setColour} />
        </motion.div>
        <MoreLike product={product} />
      </>
    );
  } else if (catalogueStatus === 'error') {
    body = (
      <div className="pdp-empty" role="alert">
        <p>This piece could not be loaded.</p>
        <button className="btn btn--ghost" onClick={loadCatalogue}>TRY AGAIN</button>
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
