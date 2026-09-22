import { motion } from 'framer-motion';
import { scrollToId } from '../lib/scroll.js';

const ease = [0.33, 0.02, 0.18, 1];

export default function Hero() {
  const go = (e, href) => { e.preventDefault(); scrollToId(href); };

  return (
    <section className="hero">
      <div className="hero__media">
        <motion.img
          src="assets/img/hero-model.webp"
          alt="Model wearing the MASQ. Face Tee in ultraviolet"
          width="2530" height="2337" fetchPriority="high"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2.2, ease }}
        />
        <span className="hero__fade" />
      </div>

      <div className="hero__copy">
        {[
          <p className="eyebrow" key="e">URBAN RITUALS</p>,
          <h1 className="hero__title" key="t">MASQ<span>.</span></h1>,
          <p className="hero__sub" key="s">Modern identity wear<br />rooted in culture.</p>,
          <div className="hero__actions" key="a">
            <a href="#drop" className="btn btn--solid" onClick={(e) => go(e, '#drop')}>SHOP DROP 01</a>
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
