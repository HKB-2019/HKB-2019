import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { scrollToId } from '../lib/scroll.js';
import { asset } from '../lib/media.js';
import { useHome } from '../store/ShopContext.jsx';
import Lines from './Lines.jsx';
import modelMatte from '../assets/hero/model-matte.webp';

import { EASE_SLOW as ease } from '../lib/motion.js';

export default function Hero() {
  const { home, images, ready } = useHome();
  const go = (e, href) => { e.preventDefault(); scrollToId(href); };
  // The owner's photo once it is known to be there; the design's otherwise.
  const photo = images.hero;

  // The 3D light and symbols behind the model (src/lib/heroField.js): on a
  // large screen that can draw it, once the hero has settled, never for
  // reduced motion or data saving. Only with the design's own photo: the
  // model is redrawn in front through an outline made for that photo.
  const field = useRef(null);
  const [fieldOn, setFieldOn] = useState(false);
  useEffect(() => {
    if (!ready || photo) return;
    const can = window.matchMedia('(min-width: 900px)').matches
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      && !navigator.connection?.saveData
      && (() => { try { return Boolean(document.createElement('canvas').getContext('webgl2')); } catch { return false; } })();
    if (!can) return;
    const t = setTimeout(() => setFieldOn(true), 2400);
    return () => clearTimeout(t);
  }, [ready, photo]);
  useEffect(() => {
    if (!fieldOn || !field.current) return;
    let stop, gone = false;
    import('../lib/heroField.js')
      .then(m => { if (!gone) stop = m.startHeroField(field.current); })
      .catch(() => setFieldOn(false));
    return () => { gone = true; stop?.(); };
  }, [fieldOn]);

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
            src={photo ? photo.img : asset('assets/img/hero-model.webp')}
            srcSet={photo ? `${photo.img} 1x, ${photo.img2x} 2x` : undefined}
            alt={home.heroImageAlt}
            {...(photo ? {} : { width: 2530, height: 2337 })}
            fetchPriority="high"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 2.2, ease }}
          />
        )}
        {fieldOn && (
          <>
            <div className="hero__field" ref={field} />
            <img className="hero__model" src={asset('assets/img/hero-model.webp')} alt=""
                 style={{ '--matte': `url(${modelMatte})` }} />
          </>
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
          <div className="hero__actions" key="a">
            <a href="#drop" className="btn btn--solid" onClick={(e) => go(e, '#drop')}>{home.heroButton}</a>
            <a href="#craft" className="btn btn--ghost" onClick={(e) => go(e, '#craft')}>EXPLORE</a>
          </div>
        ].map((child, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 * i, ease }}
          >{child}</motion.div>
        ))}
      </div>

      <motion.a
        className="hero__cue" href="#craft"
        aria-label="Scroll to the collection"
        onClick={(e) => go(e, '#craft')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, delay: 1.4 }}
      >
        <span>SCROLL</span>
        <i aria-hidden="true" />
      </motion.a>
    </section>
  );
}
