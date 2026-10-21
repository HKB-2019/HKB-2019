import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ShopLayout from '../components/ShopLayout.jsx';
import Reveal from '../components/Reveal.jsx';
import Perks from '../components/Perks.jsx';
import EmptyArt from '../components/EmptyArt.jsx';
import { ProductCard } from '../components/DropGrid.jsx';
import { ErrorBanner, detailsOf } from '../components/Notices.jsx';
import { JoinForm } from '../components/Newsletter.jsx';
import { ArrowShort, ChevronDown, Close, Play, CaretLeft, CaretRight } from '../components/Icons.jsx';
import { useShop } from '../store/ShopContext.jsx';
import { asset, srcSet } from '../lib/media.js';
import { scrollToId } from '../lib/scroll.js';
import { useFocusTrap } from '../lib/useFocusTrap.js';
import { EASE_OUT, UI_IN, UI_OUT } from '../lib/motion.js';
import {
  SHOP_PAGES, COLLECTION_PAGES, ALL_COLLECTIONS, CATEGORIES, COLLECTIONS,
  groupsOf, categoryOf, collectionOf, SORTS, PER_PAGE
} from '../data/shop.js';

/* The Shop (all products and each category) and the Collections (the index
 * and each collection), from the owner's designs. Every piece on them is the
 * shop's own, placed by what the owner sets on it in the admin (src/data/
 * shop.js has the words). Filters and the page number live in the address,
 * so a filtered page can be shared and Back returns to it. */

/* ------------------------------------------------------------- helpers */

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'ONE SIZE'];
const sizeRank = (s) => { const i = SIZE_ORDER.indexOf(s); return i < 0 ? 50 : i; };
const list = (v) => (v ? v.split(',').filter(Boolean) : []);
const matches = (p, m) => !m || ((!m.category || p.category === m.category) && (!m.type || p.type === m.type));
const roundDown = (n) => Math.floor(n / 1000) * 1000;
const roundUp = (n) => Math.ceil(n / 1000) * 1000;

/** The title's lines: plain words, with the violet part as { accent }. */
function Title({ lines, className, as: Tag = 'h1', small }) {
  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <span key={i} className={`sh-title__line${small && i > 0 ? ' sh-title__line--small' : ''}`}>
          {line.map((part, j) => typeof part === 'string'
            ? <span key={j}>{part}</span>
            : <span key={j} className="is-accent">{part.accent}</span>)}
        </span>
      ))}
    </Tag>
  );
}

/** Pieces as a page shows them, sorted. */
function sortPieces(pieces, sort) {
  const out = [...pieces];
  if (sort === 'newest') out.sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''));
  if (sort === 'price-asc') out.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') out.sort((a, b) => b.price - a.price);
  // Featured: the owner's own order, with what can be bought before what cannot.
  if (sort === 'featured') out.sort((a, b) => Number(a.soldOut) - Number(b.soldOut));
  return out;
}

/* --------------------------------------------------------------- hero */

/* The photo comes from the owner's board with its brush words painted on. */
function Hero({ label, kicker, title, small, tagline, sub, button, img, crumbs }) {
  return (
    <section className="sh-hero">
      <div className="sh-hero__photo" aria-hidden="true"><img src={asset(img)} alt="" /></div>
      <div className="sh-hero__inner">
        {crumbs && <Crumbs items={crumbs} />}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
          <p className="sh-label">{label}</p>
          {kicker && <p className="sh-hero__kicker">{kicker}</p>}
          <Title lines={title} className="sh-title" small={small} />
          {tagline && <p className="sh-hero__tagline">{tagline}</p>}
          <p className="sh-hero__sub">{sub}</p>
          {button && (
            <button type="button" className="btn btn--solid sh-hero__go" onClick={() => scrollToId('#pieces')}>
              {button} <ArrowShort className="btn__arrow" />
            </button>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function Crumbs({ items }) {
  return (
    <nav className="sh-crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map(([name, to], i) => (
          <li key={name}>
            {to ? <Link to={to}>{name}</Link> : <span aria-current="page">{name}</span>}
            {i < items.length - 1 && <span aria-hidden="true">›</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------ panels */

/** The row under a category hero: each group with a photo of its first piece. */
function PhotoPanels({ groups, chosen, onChoose, pieces, fallback }) {
  return (
    <nav className="sh-panels" aria-label="Kinds of piece">
      {groups.filter(g => g.panel !== false).map(g => {
        const inGroup = g.key === 'all' ? pieces : pieces.filter(p => matches(p, g.match));
        const pic = inGroup.find(p => p.img) ?? null;
        const on = chosen === g.key;
        const body = (
          <>
            <span className="sh-panel__pic" aria-hidden="true">
              {pic ? <img src={pic.img} srcSet={srcSet(pic)} sizes="240px" alt="" loading="lazy" /> : <img src={asset(fallback)} alt="" loading="lazy" />}
            </span>
            <span className="sh-panel__text">
              <strong>{g.name}</strong>
              <span>{g.line}</span>
            </span>
            <span className="round-arrow sh-panel__go" aria-hidden="true"><ArrowShort /></span>
          </>
        );
        return g.to
          ? <Link key={g.key} to={g.to} className={`sh-panel${on ? ' is-on' : ''}`}>{body}</Link>
          : <button key={g.key} type="button" className={`sh-panel${on ? ' is-on' : ''}`} aria-pressed={on}
                    onClick={() => onChoose(g.key)}>{body}</button>;
      })}
    </nav>
  );
}

const CHIP_ICONS = {
  all: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  tshirts: <svg viewBox="0 0 24 24"><path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.6-2 2.6-4 2.6S8.5 4.6 8 3z" /></svg>,
  headwear: <svg viewBox="0 0 24 24"><path d="M3 16c0-5 4-9 9-9s8 3.5 8.6 8M2 17h20c-3 2-8 2-12 1" /></svg>,
  bags: <svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="13" rx="2" /><path d="M9 8V6a3 3 0 0 1 6 0v2M9 13h6" /></svg>,
  outerwear: <svg viewBox="0 0 24 24"><path d="M9 3h6l5 4v14h-5v-7l-3 2-3-2v7H4V7z M12 5v11" /></svg>,
  accessories: <svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="6" /><path d="M12 8V3M9 3h6" /></svg>,
  drop: <svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></svg>,
  tee: <svg viewBox="0 0 24 24"><path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.6-2 2.6-4 2.6S8.5 4.6 8 3z" /></svg>,
  diamond: <svg viewBox="0 0 24 24"><path d="M3 9l4-5h10l4 5-9 11z M3 9h18M9 4l3 16 3-16" /></svg>,
  rings: <svg viewBox="0 0 24 24"><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></svg>,
  box: <svg viewBox="0 0 24 24"><path d="M12 3l8 4v10l-8 4-8-4V7z M4 7l8 4 8-4M12 11v10" /></svg>
};

/** The row under a collection hero: icons and names, one chosen. */
function ChipRow({ items, chosen, onChoose, label }) {
  return (
    <nav className="sh-chips" aria-label={label}>
      {items.map(it => {
        const on = chosen === it.key;
        const inner = <><span className="sh-chip__icon" aria-hidden="true">{CHIP_ICONS[it.icon]}</span><span><strong>{it.name}</strong>{it.line && <em>{it.line}</em>}</span></>;
        return it.to
          ? <Link key={it.key} to={it.to} className={`sh-chip${on ? ' is-on' : ''}`} aria-current={on ? 'page' : undefined}>{inner}</Link>
          : <button key={it.key} type="button" className={`sh-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => onChoose(it.key)}>{inner}</button>;
      })}
    </nav>
  );
}

/* ------------------------------------------------------------ filters */

/* What each filter offers, worked out from the pieces on the page. */
function filterChoices(pieces, groups) {
  const prices = pieces.map(p => p.price);
  const colours = new Map();
  for (const p of pieces) for (const c of p.colours ?? []) {
    const k = c.name.toLowerCase();
    if (!colours.has(k)) colours.set(k, { key: k, name: c.name, hex: c.hex });
  }
  const sizes = [...new Set(pieces.flatMap(p => (p.sizes ?? []).map(s => s.size)))].sort((a, b) => sizeRank(a) - sizeRank(b));
  const count = (fn) => pieces.filter(fn).length;
  return {
    groups: groups.filter(g => g.key !== 'all').map(g => ({ ...g, n: count(p => matches(p, g.match)) })).filter(g => g.n > 0),
    min: prices.length ? roundDown(Math.min(...prices)) : 0,
    max: prices.length ? roundUp(Math.max(...prices)) : 0,
    colours: [...colours.values()],
    sizes,
    stock: count(p => !p.soldOut),
    pre: count(p => p.preorder),
    collections: COLLECTIONS.map(c => ({ ...c, n: count(p => p.collections?.includes(c.key)) })).filter(c => c.n > 0),
    partners: [...new Set(pieces.map(p => p.partner).filter(Boolean))].map(name => ({ name, n: count(p => p.partner === name) })),
    seasons: [...new Set(pieces.map(p => p.season).filter(Boolean))].sort().reverse().map(name => ({ name, n: count(p => p.season === name) }))
  };
}

const EMPTY = { g: [], min: null, max: null, colour: [], size: [], stock: false, pre: false, col: [], partner: [], season: [] };

/** The applied filters, read from the address. */
function readFilters(params) {
  const num = (k) => (params.get(k) && /^\d+$/.test(params.get(k)) ? Number(params.get(k)) : null);
  return {
    g: list(params.get('type')), min: num('min'), max: num('max'),
    colour: list(params.get('colour')), size: list(params.get('size')),
    stock: params.get('stock') === '1', pre: params.get('pre') === '1',
    col: list(params.get('col')), partner: list(params.get('partner')), season: list(params.get('season'))
  };
}

function writeFilters(params, f) {
  const next = new URLSearchParams(params);
  const put = (k, v) => (v === null || v === '' || v === false || (Array.isArray(v) && !v.length) ? next.delete(k) : next.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v)));
  put('type', f.g); put('min', f.min); put('max', f.max); put('colour', f.colour); put('size', f.size);
  put('stock', f.stock); put('pre', f.pre); put('col', f.col); put('partner', f.partner); put('season', f.season);
  next.delete('page');
  return next;
}

function applyFilters(pieces, f, groups) {
  const chosen = groups.filter(g => f.g.includes(g.key));
  return pieces.filter(p =>
    (!chosen.length || chosen.some(g => matches(p, g.match)))
    && (f.min === null || p.price >= f.min) && (f.max === null || p.price <= f.max)
    && (!f.colour.length || (p.colours ?? []).some(c => f.colour.includes(c.name.toLowerCase())))
    && (!f.size.length || (p.sizes ?? []).some(s => f.size.includes(s.size)))
    && (!(f.stock || f.pre) || (f.stock && !p.soldOut) || (f.pre && p.preorder))
    && (!f.col.length || f.col.some(k => p.collections?.includes(k)))
    && (!f.partner.length || f.partner.includes(p.partner))
    && (!f.season.length || f.season.includes(p.season)));
}

const filterCount = (f) => f.g.length + (f.min !== null || f.max !== null ? 1 : 0) + f.colour.length + f.size.length
  + (f.stock ? 1 : 0) + (f.pre ? 1 : 0) + f.col.length + f.partner.length + f.season.length;

function Section({ title, children, open: startOpen = true }) {
  const [open, setOpen] = useState(startOpen);
  const id = `f-${title.replace(/\W+/g, '').toLowerCase()}`;
  return (
    <div className={`sh-filter${open ? ' is-open' : ''}`}>
      <button type="button" className="sh-filter__head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        {title} <ChevronDown />
      </button>
      <div className="sh-filter__body" id={id} hidden={!open}>{children}</div>
    </div>
  );
}

function Tick({ checked, onChange, children, n }) {
  return (
    <label className="sh-tick">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="sh-tick__box" aria-hidden="true" />
      <span>{children}{n !== undefined && <em> ({n})</em>}</span>
    </label>
  );
}

/** Two thumbs on one track: the lowest and highest price. */
function PriceRange({ min, max, value, onChange, format }) {
  const lo = value.min ?? min;
  const hi = value.max ?? max;
  const step = max - min > 20000 ? 1000 : 500;
  const pct = (v) => (max === min ? 0 : ((v - min) / (max - min)) * 100);
  const set = (nextLo, nextHi) => onChange({ min: nextLo <= min ? null : nextLo, max: nextHi >= max ? null : nextHi });
  return (
    <div className="sh-price">
      <div className="sh-price__track" style={{ '--lo': `${pct(lo)}%`, '--hi': `${pct(hi)}%` }}>
        <input type="range" min={min} max={max} step={step} value={lo} aria-label="Lowest price" aria-valuetext={format(lo)}
               onChange={(e) => set(Math.min(Number(e.target.value), hi - step), hi)} />
        <input type="range" min={min} max={max} step={step} value={hi} aria-label="Highest price" aria-valuetext={format(hi)}
               onChange={(e) => set(lo, Math.max(Number(e.target.value), lo + step))} />
      </div>
      <p className="sh-price__ends"><span>{format(lo)}</span><span>{format(hi)}</span></p>
    </div>
  );
}

/**
 * The filter column. Choices wait in a draft until APPLY FILTERS, as the
 * design has it; RESET clears everything at once.
 */
function Filters({ kinds, choices, applied, onApply, onReset, allName, groupsTitle = 'Category' }) {
  const { format } = useShop();
  const [draft, setDraft] = useState(applied);
  const key = JSON.stringify(applied);
  useEffect(() => { setDraft(applied); }, [key]);    // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const flip = (k, item, on) => set(k, on ? [...draft[k], item] : draft[k].filter(x => x !== item));
  const pending = JSON.stringify(draft) !== key;

  return (
    <form className="sh-filters" onSubmit={(e) => { e.preventDefault(); onApply(draft); }} aria-label="Filters">
      <div className="sh-filters__head">
        <h2>FILTERS</h2>
        <button type="button" className="sh-link" onClick={onReset}>Reset</button>
      </div>
      {kinds.includes('partner') && choices.partners.length > 0 && (
        <Section title="Collaboration">
          <Tick checked={!draft.partner.length} onChange={() => set('partner', [])} n={choices.partners.reduce((n, x) => n + x.n, 0)}>All Collaborations</Tick>
          {choices.partners.map(x => <Tick key={x.name} checked={draft.partner.includes(x.name)} onChange={(on) => flip('partner', x.name, on)} n={x.n}>MASQ. × {x.name}</Tick>)}
        </Section>
      )}
      {kinds.includes('season') && choices.seasons.length > 0 && (
        <Section title="Season">
          <Tick checked={!draft.season.length} onChange={() => set('season', [])} n={choices.seasons.reduce((n, x) => n + x.n, 0)}>All Seasons</Tick>
          {choices.seasons.map(x => <Tick key={x.name} checked={draft.season.includes(x.name)} onChange={(on) => flip('season', x.name, on)} n={x.n}>{x.name}</Tick>)}
        </Section>
      )}
      {kinds.includes('category') && choices.groups.length > 0 && (
        <Section title={groupsTitle}>
          <Tick checked={!draft.g.length} onChange={() => set('g', [])} n={choices.groups.length ? undefined : 0}>{allName}</Tick>
          {choices.groups.map(g => <Tick key={g.key} checked={draft.g.includes(g.key)} onChange={(on) => flip('g', g.key, on)} n={g.n}>{g.name}</Tick>)}
        </Section>
      )}
      {kinds.includes('price') && choices.max > choices.min && (
        <Section title="Price Range">
          <PriceRange min={choices.min} max={choices.max} value={draft} format={format}
                      onChange={({ min, max }) => setDraft(d => ({ ...d, min, max }))} />
        </Section>
      )}
      {kinds.includes('colour') && choices.colours.length > 0 && (
        <Section title="Colour">
          <div className="sh-colours" role="group" aria-label="Colours">
            {choices.colours.map(c => {
              const on = draft.colour.includes(c.key);
              return <button key={c.key} type="button" className={`swatch${on ? ' is-on' : ''}`} style={{ '--swatch': c.hex }}
                             aria-pressed={on} aria-label={c.name} title={c.name} onClick={() => flip('colour', c.key, !on)} />;
            })}
          </div>
        </Section>
      )}
      {kinds.includes('size') && choices.sizes.length > 0 && (
        <Section title="Size">
          <div className="sh-sizes" role="group" aria-label="Sizes">
            {choices.sizes.map(s => {
              const on = draft.size.includes(s);
              return <button key={s} type="button" className={`sh-size${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => flip('size', s, !on)}>{s}</button>;
            })}
          </div>
        </Section>
      )}
      {kinds.includes('collection') && choices.collections.length > 0 && (
        <Section title="Collection">
          {choices.collections.map(c => <Tick key={c.key} checked={draft.col.includes(c.key)} onChange={(on) => flip('col', c.key, on)} n={c.n}>{c.name}</Tick>)}
        </Section>
      )}
      {kinds.includes('availability') && (choices.stock > 0 || choices.pre > 0) && (
        <Section title="Availability">
          <Tick checked={draft.stock} onChange={(on) => set('stock', on)} n={choices.stock}>In Stock</Tick>
          {choices.pre > 0 && <Tick checked={draft.pre} onChange={(on) => set('pre', on)} n={choices.pre}>Pre-Order</Tick>}
        </Section>
      )}
      <button className={`btn btn--solid sh-filters__apply${pending ? ' is-pending' : ''}`}>Apply Filters</button>
    </form>
  );
}

/** On a phone the filter column opens as a sheet from the side. */
function FilterSheet({ open, onClose, children }) {
  const ref = useFocusTrap(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sh-sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: UI_OUT } }}
                    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div ref={ref} className="sh-sheet__panel" role="dialog" aria-modal="true" aria-label="Filters"
                      initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%', transition: { duration: UI_OUT, ease: EASE_OUT } }}
                      transition={{ duration: UI_IN, ease: EASE_OUT }}>
            <button type="button" className="sh-sheet__close" aria-label="Close filters" onClick={onClose}><Close /></button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* --------------------------------------------------------------- grid */

function Pager({ page, pages, onPage }) {
  if (pages < 2) return null;
  // First, last, and the two either side of this one; gaps as "…".
  const show = [...new Set([1, page - 1, page, page + 1, pages].filter(n => n >= 1 && n <= pages))].sort((a, b) => a - b);
  return (
    <nav className="sh-pager" aria-label="Pages">
      <button type="button" className="round-arrow sh-pager__step" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><CaretLeft /></button>
      {show.map((n, i) => (
        <span key={n} className="sh-pager__item">
          {i > 0 && n - show[i - 1] > 1 && <span className="sh-pager__gap" aria-hidden="true">…</span>}
          <button type="button" className={`sh-pager__n${n === page ? ' is-on' : ''}`} aria-current={n === page ? 'page' : undefined}
                  aria-label={`Page ${n}`} onClick={() => onPage(n)}>{n}</button>
        </span>
      ))}
      <button type="button" className="round-arrow sh-pager__step" disabled={page === pages} onClick={() => onPage(page + 1)} aria-label="Next page"><CaretRight /></button>
    </nav>
  );
}

function Placeholders() {
  return (
    <div className="grid sh-grid" aria-busy="true" aria-label="Loading the pieces">
      {Array.from({ length: 8 }, (_, i) => (
        <article key={i} className="card card--placeholder" aria-hidden="true"><div className="card__media" /><div className="card__meta"><div className="card__text"><p className="card__name">&nbsp;</p><p className="card__price">&nbsp;</p></div></div></article>
      ))}
    </div>
  );
}

/**
 * The pieces with their filters, sort and pages: the heart of every Shop and
 * Collections page. `pieces` are the page's own; `groups` the panels'.
 */
function Listing({ pieces, groups, kinds, allName, gridTitle, badge, empty, groupsTitle }) {
  const { catalogueStatus, catalogueError, loadCatalogue } = useShop();
  const [params, setParams] = useSearchParams();
  const [sheet, setSheet] = useState(false);
  const [picking, setPicking] = useState(null);
  const applied = readFilters(params);
  const sort = SORTS.some(([k]) => k === params.get('sort')) ? params.get('sort') : (params.get('sort') ? 'featured' : null);
  const choices = useMemo(() => filterChoices(pieces, groups), [pieces, groups]);
  const shown = useMemo(() => sortPieces(applyFilters(pieces, applied, groups), sort ?? 'featured'),
    [pieces, groups, params]);                                           // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(params.get('page')) || 1));
  const onPage = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const n = filterCount(applied);

  const go = (next, top = true) => {
    setParams(next, { preventScrollReset: true });
    if (top) requestAnimationFrame(() => scrollToId('#pieces'));
  };
  const apply = (f) => { setSheet(false); go(writeFilters(params, f)); };
  const reset = () => { setSheet(false); go(writeFilters(params, EMPTY)); };
  const setSort = (v) => { const next = new URLSearchParams(params); v === 'featured' ? next.delete('sort') : next.set('sort', v); next.delete('page'); go(next, false); };
  const setPage = (p) => { const next = new URLSearchParams(params); p === 1 ? next.delete('page') : next.set('page', String(p)); go(next); };

  const filters = kinds.length > 0 && (
    <Filters kinds={kinds} choices={choices} applied={applied} onApply={apply} onReset={reset} allName={allName} groupsTitle={groupsTitle} />
  );

  return (
    <section className={`sh-listing${kinds.length ? '' : ' sh-listing--wide'}`} id="pieces" aria-label="The pieces">
      {filters && <aside className="sh-listing__side">{filters}</aside>}
      <div className="sh-listing__main">
        <div className="sh-bar">
          {gridTitle ? <h2 className="sh-bar__title">{gridTitle} <span>{shown.length} {shown.length === 1 ? 'PRODUCT' : 'PRODUCTS'}</span></h2>
            : <p className="sh-bar__count" aria-live="polite">{shown.length} {shown.length === 1 ? 'PRODUCT' : 'PRODUCTS'}</p>}
          {filters && (
            <button type="button" className="sh-bar__filters" onClick={() => setSheet(true)} aria-haspopup="dialog">
              FILTERS{n > 0 && <span className="sh-bar__n">{n}</span>}
            </button>
          )}
          <label className="sh-sort">
            <span>Sort by</span>
            <select value={sort ?? 'featured'} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map(([k, name]) => <option key={k} value={k}>{name}</option>)}
            </select>
          </label>
        </div>

        {catalogueStatus === 'error' ? (
          <ErrorBanner title="We couldn’t load the pieces." text="Please check your connection and try again."
                       onRetry={loadCatalogue} retryLabel="Retry" details={detailsOf(catalogueError)} />
        ) : catalogueStatus !== 'ready' ? <Placeholders /> : pieces.length === 0 && empty ? (
          <div className="empty sh-empty">
            <span className="empty__icon empty__icon--art" aria-hidden="true"><EmptyArt name="box" /></span>
            <h3 className="empty__title">{empty.title}</h3>
            <p className="empty__text">{empty.text}</p>
            <JoinForm id="shop-empty-email" />
          </div>
        ) : shown.length === 0 ? (
          <div className="empty sh-empty">
            <span className="empty__icon empty__icon--art" aria-hidden="true"><EmptyArt name={n ? 'search' : 'box'} /></span>
            <h3 className="empty__title">{n ? 'No products match these filters.' : 'No items in this category.'}</h3>
            <p className="empty__text">{n ? 'Try fewer filters, or clear them to see everything.' : 'We couldn’t find any items here right now. Check back later or explore our other collections.'}</p>
            {n ? <button type="button" className="btn btn--ghost" onClick={reset}>CLEAR FILTERS</button>
              : <Link to="/shop" className="btn btn--ghost">VIEW ALL PRODUCTS <ArrowShort className="btn__arrow" /></Link>}
          </div>
        ) : (
          <div className="grid sh-grid" onClick={(e) => { if (!e.target.closest('.card')) setPicking(null); }}>
            {onPage.map(p => (
              <ProductCard key={p.id} product={p} bagButton picking={picking === p.id} onPick={setPicking} onClosePick={() => setPicking(null)}
                           badge={badge && p.collections?.includes('limited') ? badge : p.isNew ? 'NEW' : p.preorder ? 'PRE-ORDER' : undefined} />
            ))}
          </div>
        )}
        <Pager page={page} pages={pages} onPage={setPage} />
      </div>
      {filters && <FilterSheet open={sheet} onClose={() => setSheet(false)}>{filters}</FilterSheet>}
    </section>
  );
}

/* --------------------------------------------------------------- bands */

/** The DROP 01 band at the foot of the Shop pages. */
function DropBand({ band }) {
  const to = band.to;
  return (
    <Reveal as="section" className="sh-band" aria-label={band.title}>
      <img className="sh-band__img" src={asset(band.img ?? 'assets/img/b-shop-all.webp')} alt="" aria-hidden="true" loading="lazy" />
      <div className="sh-band__inner">
        <div>
          <p className="sh-label">{band.kicker}</p>
          <h2 className="sh-band__title">{band.title}</h2>
          <p className="sh-band__line">{band.line}</p>
          {to.startsWith('#')
            ? <button type="button" className="btn btn--solid" onClick={() => scrollToId(to)}>{band.button} <ArrowShort className="btn__arrow" /></button>
            : <Link to={to} className="btn btn--solid">{band.button} <ArrowShort className="btn__arrow" /></Link>}
        </div>
        {band.words && <Words />}
      </div>
    </Reveal>
  );
}

const Words = () => (
  <ul className="sh-words" aria-hidden="true"><li>PEOPLE</li><li>PLACES</li><li>PATTERNS</li><li>PURPOSE</li></ul>
);

/** A collection's story band: words and a button beside a photo, and a film when there is one. */
function StoryBand({ story }) {
  const { site, openOverlay } = useShop();
  const film = story.film && site?.film;
  return (
    <Reveal as="section" className={`sh-story${film ? ' sh-story--film' : ''}`} aria-label="The story">
      <div className="sh-story__text">
        {story.kicker && <p className="sh-label">{story.kicker}</p>}
        <Title as="h2" className={`sh-story__title${story.caps ? ' is-caps' : ''}`} lines={story.title.map(l => [l])} />
        <p className="sh-story__line">{story.text}</p>
        <Link to={story.to} className="btn btn--ghost sh-story__go">{story.button} <ArrowShort className="btn__arrow" /></Link>
      </div>
      <div className="sh-story__pic" aria-hidden="true"><img src={asset(story.img)} alt="" loading="lazy" style={story.pos ? { objectPosition: story.pos } : undefined} /></div>
      {film && (
        <button type="button" className="sh-story__film" aria-haspopup="dialog" onClick={() => openOverlay('film')}>
          <img src={asset(story.filmImg ?? 'assets/img/film-still.webp')} alt="" aria-hidden="true" loading="lazy" />
          <span className="film__disc" aria-hidden="true"><Play /></span>
          <span className="sh-story__film-label"><strong>{story.film}</strong><em>Watch the film</em></span>
        </button>
      )}
      {story.words && <Words />}
    </Reveal>
  );
}

/* --------------------------------------------------------------- pages */

function usePageTitle(title) {
  useEffect(() => {
    const was = document.title;
    document.title = `${title} — MASQ.`;
    return () => { document.title = was; };
  }, [title]);
}

/** /shop and /shop/:category */
export function ShopPage() {
  const { category = 'all' } = useParams();
  const { products } = useShop();
  const page = SHOP_PAGES[category];
  const [params, setParams] = useSearchParams();
  usePageTitle(page ? (category === 'all' ? 'Shop' : page.crumb) : 'Shop');
  const pieces = useMemo(() => (page?.includes ? products.filter(p => page.includes.includes(p.category)) : products), [products, page]);
  if (!page) return <Navigate to="/shop" replace />;
  const groups = groupsOf(page);
  const chosenG = list(params.get('type'));
  const chosen = chosenG.length === 1 ? chosenG[0] : chosenG.length ? null : 'all';
  const choose = (key) => {
    const next = writeFilters(params, { ...readFilters(params), g: key === 'all' ? [] : [key] });
    setParams(next, { preventScrollReset: true });
  };
  // On All Products the panels are the categories, and open their own pages.
  const panelGroups = category === 'all' ? groups.map(g => (g.key === 'all' ? g : { ...g, to: `/shop/${g.key}` })).slice(0, 5) : groups;

  return (
    <ShopLayout footerJoin={false}>
      <Hero label={page.label} title={page.title} sub={page.sub} button={page.button} img={page.img}
            crumbs={category === 'all' ? null : [['Home', '/'], ['Shop', '/shop'], [page.crumb]]} />
      <PhotoPanels groups={panelGroups} chosen={chosen} onChoose={choose} pieces={pieces} fallback={page.img} />
      <Listing pieces={pieces} groups={groups} kinds={page.filters} allName={category === 'all' ? 'All Products' : page.allName} />
      <DropBand band={page.band} />
    </ShopLayout>
  );
}

/** The collections' own rows of categories: All, then each with pieces in it. */
function categoryGroups(pieces) {
  return [
    { key: 'all', name: 'All', icon: 'all' },
    ...CATEGORIES.filter(c => pieces.some(p => p.category === c.key))
      .map(c => ({ key: c.key, name: c.key === 'bags' ? 'Bags' : c.name, icon: c.key, match: { category: c.key } }))
  ];
}

/** /collections/:slug */
export function CollectionPage() {
  const { slug } = useParams();
  const { products } = useShop();
  const c = collectionOf(slug);
  const page = COLLECTION_PAGES[slug];
  const [params, setParams] = useSearchParams();
  usePageTitle(c ? c.name : 'Collections');
  const pieces = useMemo(() => products.filter(p => p.collections?.includes(slug)), [products, slug]);
  // A collection's seasons and partners come from its own pieces.
  const seasons = useMemo(() => [...new Set(pieces.map(p => p.season).filter(Boolean))].sort().reverse(), [pieces]);
  const partners = useMemo(() => [...new Set(pieces.map(p => p.partner).filter(Boolean))], [pieces]);
  if (!c || !page) return <Navigate to="/collections" replace />;
  const groups = categoryGroups(pieces);
  const chosenG = list(params.get('type'));
  const chosen = chosenG.length === 1 ? chosenG[0] : chosenG.length ? null : 'all';
  const choose = (key) => setParams(writeFilters(params, { ...readFilters(params), g: key === 'all' ? [] : [key] }), { preventScrollReset: true });
  const chooseSeason = (s) => setParams(writeFilters(params, { ...readFilters(params), season: s ? [s] : [] }), { preventScrollReset: true });
  const season = list(params.get('season'));

  return (
    <ShopLayout footerJoin={false}>
      <Hero label="COLLECTION" kicker={page.kicker} title={page.title} small={page.smallSecond} tagline={page.tagline}
            sub={page.sub} button={page.button} img={page.img}
            crumbs={[['Home', '/'], ['Collections', '/collections'], [c.name]]} />
      {page.promises && <Perks />}
      {page.partners && partners.length > 0 && (
        <ul className="sh-partners" aria-label="Our partners">
          {partners.map(name => <li key={name}><span className="sh-partners__us">MASQ.</span><span aria-hidden="true">×</span><span>{name}</span></li>)}
        </ul>
      )}
      {page.seasons && seasons.length > 0 && (
        <nav className="sh-seasons" aria-label="Seasons">
          {seasons.map(s => {
            const on = season.length === 1 && season[0] === s;
            const pic = pieces.find(p => p.season === s && p.img);
            const [year, ...rest] = s.split(/\s+—\s+|\s+-\s+/);
            return (
              <button key={s} type="button" className={`sh-season${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => chooseSeason(on ? null : s)}>
                {pic && <img src={pic.img} alt="" aria-hidden="true" loading="lazy" />}
                <span><strong>{year}</strong>{rest.length > 0 && <em>{rest.join(' — ')}</em>}</span>
              </button>
            );
          })}
        </nav>
      )}
      {pieces.length > 0 && groups.length > 2 && (
        <ChipRow items={groups} chosen={chosen} onChoose={choose} label="Kinds of piece" />
      )}
      <Listing pieces={pieces} groups={groups} kinds={page.filters} allName={`All ${c.key === 'drop-01' ? 'pieces' : c.name}`}
               gridTitle={page.gridTitle} badge={page.badge} empty={page.empty}
               groupsTitle={slug === 'collaborations' ? 'Product Type' : 'Category'} />
      {page.story && <StoryBand story={page.story} />}
      {page.band && <DropBand band={page.band} />}
      {slug !== 'limited' && slug !== 'drop-01' && <Perks />}
    </ShopLayout>
  );
}

/** /collections */
export function CollectionsPage() {
  const { products, catalogueStatus } = useShop();
  usePageTitle('Collections');
  const tiles = [
    ...COLLECTIONS.map(c => ({ key: c.key, name: c.name, text: c.tile, to: `/collections/${c.key}`,
      pieces: products.filter(p => p.collections?.includes(c.key)), img: COLLECTION_PAGES[c.key].img })),
    ...CATEGORIES.map(c => ({ key: c.key, name: c.key === 'bags' ? 'Bags' : c.name, text: c.line, to: `/shop/${c.key}`,
      pieces: products.filter(p => p.category === c.key), img: SHOP_PAGES[c.key].img })),
    { key: 'new', name: 'View New Arrivals', text: 'Fresh drops. Latest pieces from across all collections.', to: '/shop?sort=newest',
      pieces: products.filter(p => p.isNew), img: 'assets/img/h-collaborations.webp', isNew: true }
  ];
  const total = products.filter(p => p.collections?.length).length;
  const chips = [
    { key: 'all', name: 'All Collections', line: 'View everything', icon: 'all', to: '/collections' },
    ...COLLECTIONS.filter(c => c.key !== 'drop-01').map(c => ({ key: c.key, name: c.name, line: c.chip, icon: c.icon, to: `/collections/${c.key}` }))
  ];
  return (
    <ShopLayout footerJoin={false}>
      <Hero label="COLLECTIONS" title={ALL_COLLECTIONS.title} tagline={ALL_COLLECTIONS.tagline} sub={ALL_COLLECTIONS.sub}
            button={ALL_COLLECTIONS.button} img={ALL_COLLECTIONS.img} crumbs={[['Home', '/'], ['Collections', '/collections'], ['All Collections']]} />
      <ChipRow items={chips} chosen="all" label="Collections" />
      <section className="sh-tiles-wrap" id="pieces" aria-labelledby="all-collections">
        <h2 className="sh-bar__title" id="all-collections">All Collections {catalogueStatus === 'ready' && <span>{total} PRODUCTS</span>}</h2>
        <div className="sh-tiles">
          {tiles.map((t, i) => {
            return (
              <Reveal key={t.key} delay={(i % 3) * 0.05}>
                <Link to={t.to} className="sh-tile">
                  <img src={asset(t.img)} alt="" loading="lazy" />
                  {t.isNew && <span className="card__badge card__badge--new">NEW</span>}
                  <span className="sh-tile__text">
                    <strong>{t.name}</strong>
                    <em>{t.pieces.length ? `${t.pieces.length} ${t.pieces.length === 1 ? 'PRODUCT' : 'PRODUCTS'}` : 'COMING SOON'}</em>
                    <span>{t.text}</span>
                  </span>
                  <span className="round-arrow sh-tile__go" aria-hidden="true"><ArrowShort /></span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>
      <Perks />
    </ShopLayout>
  );
}
