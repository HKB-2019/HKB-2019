import { Link } from 'react-router-dom';
import { useShop, useHome } from '../store/ShopContext.jsx';
import { asset, srcSet } from '../lib/media.js';
import { ArrowShort, BagIcon } from './Icons.jsx';
import { ColourDots } from './Swatches.jsx';
import { CATEGORIES, COLLECTIONS, COLLECTION_PAGES, SHOP_PAGES } from '../data/shop.js';

/* The two wide menus under SHOP ▾ and COLLECTIONS ▾, from the owner's designs
 * (design/menu-shop-dropdown.webp, design/menu-collections-dropdown.webp).
 * Their pictures are the shop's own pieces: the first photo in each category
 * or collection. `onGo` closes the menu once a link is chosen. */

const firstPhoto = (pieces) => pieces.find(p => p.img) ?? null;

function Pic({ piece, fallback, sizes = '96px' }) {
  return piece
    ? <img src={piece.img} srcSet={srcSet(piece)} sizes={sizes} alt="" loading="lazy" />
    : <img src={asset(fallback)} alt="" loading="lazy" />;
}

function Row({ to, pic, name, line, onGo, on }) {
  return (
    <li>
      <Link to={to} className={`mega__row${on ? ' is-on' : ''}`} onClick={onGo}>
        <span className="mega__thumb" aria-hidden="true">{pic}</span>
        <span className="mega__row-text"><strong>{name}</strong><span>{line}</span></span>
        <ArrowShort className="mega__row-go" />
      </Link>
    </li>
  );
}

const AllIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
);

function DropPanel({ onGo, button = 'EXPLORE THE DROP' }) {
  return (
    <div className="mega__drop">
      <img src={asset('assets/img/b-shop-all.webp')} alt="" aria-hidden="true" loading="lazy" />
      <div className="mega__drop-text">
        <p className="mega__label">DROP 01</p>
        <p className="mega__drop-title">Urban Rituals</p>
        <p className="mega__drop-line">A collection rooted in culture, made for now.</p>
        <Link to="/collections/drop-01" className="btn btn--solid mega__btn" onClick={onGo}>{button} <ArrowShort className="btn__arrow" /></Link>
      </div>
      <p className="mega__drop-foot" aria-hidden="true">WEAR IDENTITY. LIVE CULTURE.</p>
    </div>
  );
}

export function ShopMenu({ onGo, pathname }) {
  const { products, format } = useShop();
  const featured = products.find(p => p.isNew && p.img) ?? products.find(p => p.img);
  const popular = products.filter(p => p.inDrop && p.featured && p.id !== featured?.id).slice(0, 4);
  return (
    <div className="mega__grid mega__grid--shop">
      <div className="mega__col">
        <p className="mega__label">SHOP BY CATEGORY</p>
        <ul className="mega__rows">
          {CATEGORIES.map(c => (
            <Row key={c.key} to={`/shop/${c.key}`} on={pathname === `/shop/${c.key}`} onGo={onGo}
                 pic={<Pic piece={firstPhoto(products.filter(p => p.category === c.key))} fallback={SHOP_PAGES[c.key].img} />}
                 name={c.menuName ?? c.name} line={c.line} />
          ))}
          <Row to="/shop" on={pathname === '/shop'} onGo={onGo} pic={<AllIcon />} name="Shop All Products" line="Explore the full MASQ. collection." />
        </ul>
      </div>
      {featured && (
        <div className="mega__col">
          <p className="mega__label">FEATURED THIS SEASON</p>
          <Link to={`/product/${featured.id}`} className="mega__feature" onClick={onGo}>
            <span className="mega__feature-pic"><Pic piece={featured} sizes="280px" /></span>
            <span className="mega__feature-text">
              <strong>{featured.name}</strong>
              <span>{format(featured.price)}</span>
              <ColourDots product={featured} />
            </span>
            <span className="round-arrow" aria-hidden="true"><ArrowShort /></span>
          </Link>
        </div>
      )}
      {popular.length > 0 && (
        <div className="mega__col">
          <p className="mega__label">POPULAR PICKS</p>
          <ul className="mega__picks">
            {popular.map(p => (
              <li key={p.id}>
                <Link to={`/product/${p.id}`} className="mega__pick" onClick={onGo}>
                  <span className="mega__thumb" aria-hidden="true"><Pic piece={p} /></span>
                  <span className="mega__row-text"><strong>{p.name}</strong><span>{p.soldOut ? 'SOLD OUT' : format(p.price)}</span><ColourDots product={p} /></span>
                  <span className="round-arrow round-arrow--bag" aria-hidden="true"><BagIcon /></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <DropPanel onGo={onGo} />
    </div>
  );
}

export function CollectionsMenu({ onGo, pathname }) {
  const { products } = useShop();
  const { home } = useHome();
  const inIt = (key) => products.filter(p => p.collections?.includes(key));
  const drop = inIt('drop-01');
  const others = COLLECTIONS.filter(c => c.key !== 'drop-01');
  const perks = [1, 2, 3].map(n => [home[`perk${n}Title`], home[`perk${n}Text`]]).filter(([t]) => t);
  return (
    <div className="mega__grid mega__grid--collections">
      <div className="mega__col">
        <p className="mega__label">ALL COLLECTIONS</p>
        <ul className="mega__rows">
          {COLLECTIONS.map(c => (
            <Row key={c.key} to={`/collections/${c.key}`} on={pathname === `/collections/${c.key}`} onGo={onGo}
                 pic={<img src={asset(COLLECTION_PAGES[c.key].img)} alt="" loading="lazy" />}
                 name={c.menu ? <>{c.menu[0]}<br />{c.menu[1]}</> : c.name} line={c.line} />
          ))}
          <Row to="/collections" on={pathname === '/collections'} onGo={onGo} pic={<AllIcon />} name="View All Collections" line="Explore the complete MASQ. archive." />
        </ul>
      </div>
      <div className="mega__col">
        <p className="mega__label">FEATURED COLLECTION</p>
        <div className="mega__featured">
          <DropPanel onGo={onGo} button="EXPLORE COLLECTION" />
          {drop.length > 0 && (
            <ul className="mega__strip">
              {drop.filter(p => p.img).slice(0, 4).map(p => (
                <li key={p.id}><Link to={`/product/${p.id}`} onClick={onGo} aria-label={p.name}><Pic piece={p} /></Link></li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mega__col">
        <p className="mega__label">OTHER COLLECTIONS</p>
        <ul className="mega__tiles">
          {others.map(c => (
            <li key={c.key}>
              <Link to={`/collections/${c.key}`} className="mega__tile" onClick={onGo}>
                <span className="mega__tile-pic" aria-hidden="true"><img src={asset(COLLECTION_PAGES[c.key].img)} alt="" loading="lazy" /></span>
                <span className="mega__tile-text"><strong>{c.name}</strong><span>{c.line}</span></span>
                <ArrowShort className="mega__row-go" />
              </Link>
            </li>
          ))}
        </ul>
        {perks.length > 0 && (
          <ul className="mega__perks">
            {perks.map(([t, x]) => <li key={t}><strong>{t}</strong>{x && <span>{x}</span>}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

/** On a phone: the same places as a short list under each menu item. */
export function MobileShopLinks({ which, onGo }) {
  const items = which === 'shop'
    ? [...CATEGORIES.map(c => [`/shop/${c.key}`, c.menuName ?? c.name]), ['/shop', 'Shop All Products']]
    : [...COLLECTIONS.map(c => [`/collections/${c.key}`, c.name]), ['/collections', 'View All Collections']];
  return (
    <ul className="mobile-nav__sub">
      {items.map(([to, name]) => <li key={to}><Link to={to} onClick={onGo}>{name}</Link></li>)}
    </ul>
  );
}
