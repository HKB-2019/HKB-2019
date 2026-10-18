import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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

  // The second photo (the owner's, or the built-in one) takes turns with the
  // first: a slow cross-fade every few seconds (Admin → HOME PAGE), paused
  // while the tab is hidden, and never on a device set to reduce motion.
  const second = images.hero2 ?? {
    img: asset('assets/img/hero-design-2.webp'), img2x: asset('assets/img/hero-design-2@2x.webp'), builtIn: true
  };
  const every = home.heroEvery ?? 8;
  const calm = useReducedMotion();
  const turns = Boolean(second) && every > 0 && !calm;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    if (!turns) return;
    const id = setInterval(() => { if (!document.hidden) setShown(n => 1 - n); }, every * 1000);
    return () => clearInterval(id);
  }, [turns, every]);

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
          <div className={`hero__shot${shown === 0 ? ' is-on' : ''}`} aria-hidden={shown !== 0 || undefined}>
            <motion.img
              src={photo ? photo.img : asset('assets/img/hero-design.webp')}
              srcSet={photo
                ? `${photo.img} 1x, ${photo.img2x} 2x`
                : `${asset('assets/img/hero-design.webp')} 1600w, ${asset('assets/img/hero-design@2x.webp')} 1672w`}
              sizes={photo ? undefined : '(max-width: 900px) 250vw, 100vw'}
              alt={home.heroImageAlt}
              {...(photo ? {} : { width: 1672, height: 941 })}
              fetchPriority="high"
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 2.2, ease }}
            />
          </div>
        )}
        {ready && turns && (
          <div className={`hero__shot${shown === 1 ? ' is-on' : ''}`} aria-hidden={shown !== 1 || undefined}>
            <img src={second.img}
                 srcSet={second.builtIn ? `${second.img} 1600w, ${second.img2x} 1672w` : `${second.img} 1x, ${second.img2x} 2x`}
                 sizes={second.builtIn ? '(max-width: 900px) 250vw, 100vw' : undefined}
                 alt={home.heroImageAlt2 ?? home.heroImageAlt} fetchPriority="low" decoding="async" />
          </div>
        )}
        <span className="hero__fade" />
      </div>

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
