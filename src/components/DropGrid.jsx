import { useEffect, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { PRODUCTS } from '../data/catalogue.js';
import { useShop } from '../store/ShopContext.jsx';
import { srcSet, CARD_SIZES } from '../lib/media.js';
import { scrollToId } from '../lib/scroll.js';
import { Arrow, Heart } from './Icons.jsx';

const ease = [0.33, 0.02, 0.18, 1];

function ProductCard({ product, picking, onPick, onClosePick }) {
  const { addToCart, wishlist, toggleWish, format, toast } = useShop();
  const saved = wishlist.includes(product.id);

  const onQuickAdd = () => {
    if (product.soldOut) { toast('SOLD OUT — JOIN THE LIST FOR RESTOCKS'); return; }
    picking ? onClosePick() : onPick(product.id);
  };

  return (
    /* `layout` is what makes the existing cards glide to their new positions
     * when VIEW ALL adds four more, instead of snapping. */
    <motion.article
      layout
      className={`card${picking ? ' is-picking' : ''}`}
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.55, ease, layout: { duration: 0.5, ease } }}
    >
      <div className="card__media">
        <img src={product.img} srcSet={srcSet(product.img)} sizes={CARD_SIZES}
             alt={product.name} loading="lazy" />

        {product.badge && <span className="card__badge">{product.badge}</span>}

        <button
          className={`card__fav${saved ? ' is-on' : ''}`}
          aria-label={`Save ${product.name}`}
          aria-pressed={saved}
          onClick={() => toggleWish(product.id)}
        ><Heart /></button>

        <button className="card__quick" onClick={onQuickAdd}>
          {product.soldOut ? 'SOLD OUT' : 'QUICK ADD'}
        </button>

        <div className="card__sizes">
          {product.soldOut
            ? <button disabled>SOLD OUT</button>
            : product.sizes.map(size => (
                <button key={size} onClick={() => { addToCart(product, size); onClosePick(); }}>
                  {size}
                </button>
              ))}
        </div>
      </div>

      <h3 className="card__name">{product.name}</h3>
      <p className={`card__price${product.soldOut ? ' card__sold' : ''}`}>{format(product.price)}</p>
    </motion.article>
  );
}

export default function DropGrid() {
  const { toast } = useShop();
  const [showAll, setShowAll] = useState(false);
  const [picking, setPicking] = useState(null);

  // "SHOP ACCESSORIES" over in the Essentials section expands this grid.
  useEffect(() => {
    const onExpand = () => setShowAll(true);
    window.addEventListener('masq:expand-drop', onExpand);
    return () => window.removeEventListener('masq:expand-drop', onExpand);
  }, []);

  const list = showAll ? PRODUCTS : PRODUCTS.filter(p => !p.extra);

  const onViewAll = () => {
    setShowAll(v => {
      if (!v) toast(`SHOWING ALL ${PRODUCTS.length} PIECES`);
      return !v;
    });
  };

  return (
    <section className="section drop" id="drop" onClick={(e) => {
      if (!e.target.closest('.card')) setPicking(null);
    }}>
      <div className="section__head">
        <h2 className="section__title">Drop 01 — Urban Rituals</h2>
        <span className="section__rule" aria-hidden="true" />
        <button className="link-arrow" aria-expanded={showAll} onClick={onViewAll}>
          <span>{showAll ? 'SHOW LESS' : 'VIEW ALL'}</span>
          <Arrow />
        </button>
      </div>

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
