import { motion } from 'framer-motion';
import { scrollToId } from '../lib/scroll.js';
import { asset } from '../lib/media.js';
import { useHome } from '../store/ShopContext.jsx';
import Lines from './Lines.jsx';

const ease = [0.33, 0.02, 0.18, 1];

export default function Hero() {
  const { home, images, ready } = useHome();
  const go = (e, href) => { e.preventDefault(); scrollToId(href); };
  // The owner's photo once it is known to be there; the design's otherwise.
  const photo = images.hero;

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
        <span className="hero__fade" />
      </div>

      <div className="hero__copy" aria-busy={!ready}>
        {ready && [
          <p className="eyebrow" key="e">{home.heroEyebrow}</p>,
          <h1 className="hero__title" key="t">MASQ<span>.</span></h1>,
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
