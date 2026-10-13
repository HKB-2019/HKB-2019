import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ShopLayout from '../components/ShopLayout.jsx';
import { useShop } from '../store/ShopContext.jsx';
import { srcSet, CARD_SIZES, GALLERY_SIZES } from '../lib/media.js';
import { useSectionLink } from '../lib/useSectionLink.js';
import { Heart } from '../components/Icons.jsx';
import { askForRestock } from '../lib/api.js';
import { track } from '../lib/analytics.js';
import { isEmail } from '../lib/delivery.js';

const ease = [0.33, 0.02, 0.18, 1];
const TITLE = document.title;

/* ------------------------------------------------------------- gallery */

/**
 * The main photo and any extra ones. On a wide screen: one large photo and a
 * row of thumbnails. On a phone: a strip to swipe through, with dots.
 */
function Gallery({ product }) {
  const photos = product.photos?.length ? product.photos : (product.img ? [{ img: product.img, img2x: product.img2x }] : []);
  const [index, setIndex] = useState(0);
  const strip = useRef(null);

  useEffect(() => { setIndex(0); strip.current?.scrollTo({ left: 0 }); }, [product.id]);

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
            <img src={p.img} srcSet={srcSet(p)} sizes={GALLERY_SIZES}
                 alt={i === 0 ? product.name : `${product.name}, photo ${i + 1}`}
                 loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : undefined} />
          </div>
        ))}
      </div>
      {product.badge && <span className="card__badge">{product.badge}</span>}

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
function RestockAsk({ product }) {
  const gone = product.sizes.filter(s => !s.available);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(gone[0]?.size ?? '');
  const [email, setEmail] = useState('');
  const [state, setState] = useState(null);   // null | 'sending' | 'done' | error message

  useEffect(() => { setOpen(false); setState(null); setSize(gone[0]?.size ?? ''); }, [product.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!gone.length) return null;
  if (state === 'done') {
    return <p className="restock restock--done" role="status">WE’LL LET YOU KNOW WHEN {size} IS BACK.</p>;
  }
  if (!open) {
    return (
      <button type="button" className="restock__open" onClick={() => setOpen(true)}>
        {product.soldOut ? 'TELL ME WHEN IT’S BACK' : 'SOLD OUT IN YOUR SIZE? TELL ME WHEN IT’S BACK'}
      </button>
    );
  }

  const send = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) { setState('Enter a valid email address.'); return; }
    setState('sending');
    try { await askForRestock(product.id, size, email.trim()); setState('done'); track('restock_request', { productId: product.id, size }); }
    catch (err) { setState(err.message); }
  };

  return (
    <form className="restock" onSubmit={send} noValidate>
      <p className="restock__lead">Leave your email and we’ll tell you when it’s back.</p>
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
               value={email} onChange={(e) => { setEmail(e.target.value); if (state !== 'sending') setState(null); }} />
        <button className="btn btn--ghost" disabled={state === 'sending'}>{state === 'sending' ? '…' : 'NOTIFY ME'}</button>
      </div>
      {state && state !== 'sending' && <p className="field__error" role="alert">{state}</p>}
    </form>
  );
}

/* ------------------------------------------------------- buying box */

function BuyBox({ product }) {
  const { addToCart, format, wishlist, toggleWish, openOverlay, toast } = useShop();
  const only = product.sizes.length === 1 ? product.sizes[0] : null;
  const [size, setSize] = useState(only?.available ? only.size : null);
  const [asked, setAsked] = useState(false);
  const saved = wishlist.includes(product.id);

  useEffect(() => { setSize(only?.available ? only.size : null); setAsked(false); }, [product.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = product.sizes.find(s => s.size === size);

  const add = () => {
    if (product.soldOut) { toast('SOLD OUT — JOIN THE LIST FOR RESTOCKS'); return; }
    if (!chosen) { setAsked(true); return; }
    addToCart(product, chosen.size);
  };

  return (
    <div className="pdp__info">
      <h1 className="pdp__name">{product.name}</h1>
      <p className={`pdp__price${product.soldOut ? ' card__sold' : ''}`}>
        {product.soldOut ? 'SOLD OUT' : format(product.price)}
      </p>

      {!only && (
        <fieldset className="pdp__sizes">
          <legend>
            <span>SIZE{chosen ? ` — ${chosen.size}` : ''}</span>
            <button type="button" className="pdp__guide" onClick={() => openOverlay({ info: 'SIZE_GUIDE' })}>SIZE GUIDE</button>
          </legend>
          <div className="pdp__size-row">
            {product.sizes.map(s => (
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
      {only?.left ? <p className="pdp__hint">ONLY {only.left} LEFT</p> : null}

      <div className="pdp__actions">
        <button className="btn btn--solid pdp__add" onClick={add} disabled={product.soldOut}>
          {product.soldOut ? 'SOLD OUT' : 'ADD TO BAG'}
        </button>
        <button className={`pdp__save${saved ? ' is-on' : ''}`} aria-pressed={saved}
                aria-label={saved ? `Remove ${product.name} from saved` : `Save ${product.name}`}
                onClick={() => toggleWish(product.id)}><Heart /></button>
      </div>

      <RestockAsk product={product} />

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
          <button type="button" className="pdp__inline" onClick={() => openOverlay({ info: 'SHIPPING' })}>Shipping</button>
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
              <Link to={`/product/${p.id}`} className="card__link" tabIndex={-1} aria-hidden="true">
                {p.img && <img src={p.img} srcSet={srcSet(p)} sizes={CARD_SIZES} alt="" loading="lazy" />}
              </Link>
              {p.badge && <span className="card__badge">{p.badge}</span>}
            </div>
            <h3 className="card__name"><Link to={`/product/${p.id}`}>{p.name}</Link></h3>
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

  useEffect(() => { window.scrollTo(0, 0); }, [id]);
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
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <nav className="pdp__crumbs" aria-label="Breadcrumb">
            <a href="/#drop" onClick={(e) => { e.preventDefault(); goTo('#drop'); }}>SHOP</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{product.name}</span>
          </nav>
          <Gallery product={product} />
          <BuyBox product={product} />
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
