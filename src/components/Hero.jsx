import { useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { scrollToId } from '../lib/scroll.js';
import { asset } from '../lib/media.js';
import { useHome } from '../store/ShopContext.jsx';
import { ArrowShort } from './Icons.jsx';
import Lines from './Lines.jsx';

import { EASE_SLOW as ease } from '../lib/motion.js';

export default function Hero() {
  const { home, images, ready } = useHome();
  const go = (e, href) => { e.preventDefault(); scrollToId(href); };
  // The owner's photo once it is known to be there; the design's otherwise.
  const photo = images.hero;

  // The letters of the title rise into place (src/lib/drift.js). Hidden until
  // that code arrives, so they do not show and then jump; shown anyway if it
  // is slow or fails.
  const title = useRef(null);
  useLayoutEffect(() => {
    const el = title.current;
    if (!ready || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.classList.add('is-waiting');
    const show = () => el.classList.remove('is-waiting');
    const slow = setTimeout(show, 1500);
    let undo, gone = false;
    import('../lib/drift.js')
      .then(m => { if (!gone && el.classList.contains('is-waiting')) { clearTimeout(slow); undo = m.revealTitle(el); } })
      .catch(show);
    return () => { gone = true; clearTimeout(slow); undo?.(); show(); };
  }, [ready]);

  return (
    <section className="hero">
      <div className="hero__media">
        {ready && (
          <motion.img
            src={photo ? photo.img : asset('assets/img/hero-masq.webp')}
            srcSet={photo
              ? `${photo.img} 1x, ${photo.img2x} 2x`
              : `${asset('assets/img/hero-masq.webp')} 1280w, ${asset('assets/img/hero-masq@2x.webp')} 2400w`}
            sizes={photo ? undefined : '(max-width: 900px) 280vw, 100vw'}
            alt={home.heroImageAlt}
            {...(photo ? {} : { width: 2400, height: 1351 })}
            fetchPriority="high"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 2.2, ease }}
          />
        )}
        <span className="hero__fade" />
      </div>

      {/* Painted on the wall beside the model: words, not part of the photo,
          so the owner can change them. Drawn in after the photo settles. */}
      {ready && home.heroBrush && (
        <motion.p
          className="hero__brush" aria-hidden="true"
          initial={{ opacity: 0, clipPath: 'inset(-20% 100% -20% -20%)' }}
          animate={{ opacity: 0.92, clipPath: 'inset(-20% -20% -20% -20%)' }}
          transition={{ duration: 1.4, delay: 1.1, ease }}
        >
          {home.heroBrush}
          <svg viewBox="0 0 200 24"><path d="M4 18 C 60 8, 120 4, 196 6 M 22 22 C 80 14, 130 12, 180 13" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>
        </motion.p>
      )}

      <div className="hero__copy" aria-busy={!ready}>
        {ready && [
          <p className="eyebrow" key="e">{home.heroEyebrow}</p>,
          // Fixed words set as HTML so React leaves the letters alone while
          // the title animation splits them up and puts them back.
          <h1 className="hero__title" key="t" ref={title} dangerouslySetInnerHTML={{ __html: 'MASQ<span>.</span>' }} />,
          <p className="hero__sub" key="s"><Lines text={home.heroSub} /></p>,
          home.heroText && <p className="hero__text" key="x">{home.heroText}</p>,
          <div className="hero__actions" key="a">
            <a href="#drop" className="btn btn--solid" onClick={(e) => go(e, '#drop')}>
              {home.heroButton} <ArrowShort className="btn__arrow" />
            </a>
            <a href="#craft" className="btn btn--ghost" onClick={(e) => go(e, '#craft')}>
              {home.heroButton2} <ArrowShort className="btn__arrow" />
            </a>
          </div>
        ].filter(Boolean).map((child, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 * i, ease }}
          >{child}</motion.div>
        ))}
      </div>
    </section>
  );
}
