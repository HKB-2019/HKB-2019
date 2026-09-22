import { useCallback, useEffect, useRef, useState } from 'react';
import { ESSENTIALS } from '../data/catalogue.js';
import { useShop } from '../store/ShopContext.jsx';
import { srcSet, SLIDE_SIZES } from '../lib/media.js';
import { expandDropGrid } from './DropGrid.jsx';
import { Arrow, CaretLeft, CaretRight } from './Icons.jsx';

const DRAG_THRESHOLD = 5;

export default function Essentials() {
  const { addToCart, format, toast } = useShop();
  const trackRef = useRef(null);
  const [pages, setPages]   = useState(1);
  const [page, setPage]     = useState(0);
  const [atStart, setStart] = useState(true);
  const [atEnd, setEnd]     = useState(false);

  const perView = useCallback(() => {
    const track = trackRef.current;
    const slide = track?.querySelector('.slide');
    if (!track || !slide) return 1;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return Math.max(1, Math.round((track.clientWidth + gap) / (slide.getBoundingClientRect().width + gap)));
  }, []);

  // Page on whole screenfuls of slides, so the last dot is a real position
  // rather than the sliver left over by dividing the raw scroll width.
  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setPages(Math.max(1, Math.ceil(ESSENTIALS.length / perView())));
  }, [perView]);

  const sync = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max  = track.scrollWidth - track.clientWidth;
    const last = Math.max(1, Math.ceil(ESSENTIALS.length / perView())) - 1;
    setPage(track.scrollLeft >= max - 4 ? last : Math.min(last, Math.round(track.scrollLeft / track.clientWidth)));
    setStart(track.scrollLeft <= 4);
    setEnd(track.scrollLeft >= max - 4);
  }, [perView]);

  useEffect(() => {
    measure(); sync();
    const onResize = () => { measure(); sync(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure, sync]);

  const scrollByPage = (dir) => {
    const track = trackRef.current;
    if (track) track.scrollBy({ left: dir * track.clientWidth, behavior: 'smooth' });
  };

  const goToPage = (i) => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    track.scrollTo({ left: Math.min(i * track.clientWidth, max), behavior: 'smooth' });
  };

  /* Drag to scroll. `is-dragging` disables pointer events on the slides, so it
   * must only engage once the pointer has actually travelled — otherwise a
   * plain click on a slide never reaches its button. */
  const drag = useRef({ pressed: false, dragging: false, startX: 0, startScroll: 0 });

  const onPointerDown = (e) => {
    if (e.pointerType === 'touch') return;   // native touch scrolling is better
    drag.current = {
      pressed: true, dragging: false,
      startX: e.clientX, startScroll: trackRef.current.scrollLeft
    };
  };

  useEffect(() => {
    const onMove = (e) => {
      const d = drag.current;
      if (!d.pressed) return;
      const dx = e.clientX - d.startX;
      if (!d.dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        d.dragging = true;
        trackRef.current?.classList.add('is-dragging');
      }
      trackRef.current.scrollLeft = d.startScroll - dx;
    };
    const onUp = () => {
      const d = drag.current;
      if (!d.pressed) return;
      d.pressed = false;
      if (d.dragging) {
        // swallow the click that ends a drag so it cannot add a product
        trackRef.current?.addEventListener(
          'click', (ev) => { ev.stopPropagation(); ev.preventDefault(); },
          { capture: true, once: true }
        );
        trackRef.current?.classList.remove('is-dragging');
        d.dragging = false;
      }
      sync();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [sync]);

  const onKeyDown = (e) => {
    const track = trackRef.current;
    const slide = track?.querySelector('.slide');
    if (!slide) return;
    const step = slide.getBoundingClientRect().width + 11;
    if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left: step,  behavior: 'smooth' }); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); track.scrollBy({ left: -step, behavior: 'smooth' }); }
  };

  return (
    <section className="section essentials" id="essentials">
      <div className="section__head">
        <h2 className="section__title">The Essentials</h2>
        <span className="section__rule" aria-hidden="true" />
        <button className="link-arrow" onClick={() => {
          expandDropGrid();
          toast('ACCESSORIES ADDED TO THE GRID', 'violet');
        }}>
          <span>SHOP ACCESSORIES</span>
          <Arrow />
        </button>
      </div>

      <div className="carousel">
        <button className="carousel__arrow carousel__arrow--prev" aria-label="Previous essentials"
                disabled={atStart} onClick={() => scrollByPage(-1)}>
          <CaretLeft />
        </button>

        <div
          className="carousel__track"
          ref={trackRef}
          tabIndex={0}
          aria-label="Essentials carousel"
          onScroll={sync}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
        >
          {ESSENTIALS.map(p => (
            <article className="slide" key={p.id}>
              <img src={p.img} srcSet={srcSet(p.img)} sizes={SLIDE_SIZES} alt={p.name} loading="lazy" />
              <div className="slide__meta">
                <button className="slide__name"
                        onClick={() => addToCart(p, 'ONE SIZE')}>{p.name}</button>
                <span className="slide__price">{format(p.price)}</span>
              </div>
            </article>
          ))}
        </div>

        <button className="carousel__arrow carousel__arrow--next" aria-label="Next essentials"
                disabled={atEnd} onClick={() => scrollByPage(1)}>
          <CaretRight />
        </button>
      </div>

      <div className="dots" role="tablist" aria-label="Carousel pages">
        {Array.from({ length: pages }, (_, i) => (
          <button key={i} role="tab"
                  className={i === page ? 'is-active' : ''}
                  aria-selected={i === page}
                  aria-label={`Go to page ${i + 1}`}
                  onClick={() => goToPage(i)} />
        ))}
      </div>
    </section>
  );
}
