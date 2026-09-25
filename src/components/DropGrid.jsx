import { useEffect, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useShop } from '../store/ShopContext.jsx';
import { srcSet, CARD_SIZES } from '../lib/media.js';
import { scrollToId } from '../lib/scroll.js';
import { Arrow, Heart } from './Icons.jsx';

const ease = [0.33, 0.02, 0.18, 1];

/** Size buttons for one product: sold-out sizes shown, but struck through and disabled. */
export function SizeButtons({ product, onPicked }) {
  const { addToCart } = useShop();
  return product.sizes.map(s => (
    <button
      key={s.size}
      disabled={!s.available}
      aria-label={s.available ? `Add ${product.name} in ${s.size}` : `${s.size} sold out`}
      title={s.left ? `Only ${s.left} left` : undefined}
      onClick={() => { addToCart(product, s.size); onPicked?.(); }}
    >{s.size}</button>
  ));
}

function ProductCard({ product, picking, onPick, onClosePick }) {
  const { wishlist, toggleWish, format, toast, addToCart } = useShop();
  const saved = wishlist.includes(product.id);
  const only = product.sizes.length === 1 ? product.sizes[0] : null;

  const onQuickAdd = () => {
    if (product.soldOut) { toast('SOLD OUT — JOIN THE LIST FOR RESTOCKS'); return; }
    // One size: nothing to choose, so add it straight away.
    if (only) { addToCart(product, only.size); return; }
    picking ? onClosePick() : onPick(product.id);
  };

  return (
    /* `layout` is what makes the existing cards glide to their new positions
     * when VIEW ALL adds more, instead of snapping. */
    <motion.article
      layout
      className={`card${picking ? ' is-picking' : ''}`}
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.55, ease, layout: { duration: 0.5, ease } }}
    >
      <div className="card__media">
        {product.img && (
          <img src={product.img} srcSet={srcSet(product)} sizes={CARD_SIZES}
               alt={product.name} loading="lazy" />
        )}

        {product.badge && <span className="card__badge">{product.badge}</span>}

        <button
          className={`card__fav${saved ? ' is-on' : ''}`}
          aria-label={saved ? `Remove ${product.name} from saved` : `Save ${product.name}`}
          aria-pressed={saved}
          onClick={() => toggleWish(product.id)}
        ><Heart /></button>

        <button className="card__quick" onClick={onQuickAdd}>
          {product.soldOut ? 'SOLD OUT' : only ? 'ADD TO BAG' : 'QUICK ADD'}
        </button>

        <div className="card__sizes">
          <SizeButtons product={product} onPicked={onClosePick} />
        </div>
      </div>

      <h3 className="card__name">{product.name}</h3>
      <p className={`card__price${product.soldOut ? ' card__sold' : ''}`}>
        {product.soldOut ? 'SOLD OUT' : format(product.price)}
      </p>
    </motion.article>
  );
}

function Placeholder() {
  return (
    <article className="card card--placeholder" aria-hidden="true">
      <div className="card__media" />
      <p className="card__name">&nbsp;</p>
      <p className="card__price">&nbsp;</p>
    </article>
  );
}

export default function DropGrid() {
  const { toast, products, catalogueStatus, loadCatalogue } = useShop();
  const [showAll, setShowAll] = useState(false);
  const [picking, setPicking] = useState(null);

  // "SHOP ACCESSORIES" over in the Essentials section expands this grid.
  useEffect(() => {
    const onExpand = () => setShowAll(true);
    window.addEventListener('masq:expand-drop', onExpand);
    return () => window.removeEventListener('masq:expand-drop', onExpand);
  }, []);

  const inDrop = products.filter(p => p.inDrop);
  const hasMore = inDrop.some(p => !p.featured);
  const list = showAll ? inDrop : inDrop.filter(p => p.featured);

  const onViewAll = () => {
    if (!showAll) toast(`SHOWING ALL ${inDrop.length} PIECES`);
    setShowAll(v => !v);
  };

  return (
    <section className="section drop" id="drop" onClick={(e) => {
      if (!e.target.closest('.card')) setPicking(null);
    }}>
      <div className="section__head">
        <h2 className="section__title">Drop 01 — Urban Rituals</h2>
        <span className="section__rule" aria-hidden="true" />
        {hasMore && (
          <button className="link-arrow" aria-expanded={showAll} onClick={onViewAll}>
            <span>{showAll ? 'SHOW LESS' : 'VIEW ALL'}</span>
            <Arrow />
          </button>
        )}
      </div>

      {catalogueStatus === 'error' ? (
        <div className="shop-error" role="alert">
          <p>The collection could not be loaded.</p>
          <button className="btn btn--ghost" onClick={loadCatalogue}>TRY AGAIN</button>
        </div>
      ) : catalogueStatus !== 'ready' ? (
        <div className="grid" aria-busy="true" aria-label="Loading the collection">
          {Array.from({ length: 4 }, (_, i) => <Placeholder key={i} />)}
        </div>
      ) : list.length === 0 ? (
        <p className="shop-empty">New pieces are on their way. Join the list below to hear first.</p>
      ) : (
        <LayoutGroup>
          <motion.div layout className="grid">
            <AnimatePresence mode="popLayout" initial={false}>
              {list.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  picking={picking === product.id}
                  onPick={setPicking}
                  onClosePick={() => setPicking(null)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      )}
    </section>
  );
}

/* Exposed so "SHOP ACCESSORIES" in the Essentials section can expand this grid
 * and scroll to it. Kept as a tiny event rather than lifting state, so the two
 * sections stay independent. */
export function expandDropGrid() {
  window.dispatchEvent(new CustomEvent('masq:expand-drop'));
  scrollToId('#drop');
}
