import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ShopLayout from '../components/ShopLayout.jsx';
import Reveal from '../components/Reveal.jsx';
import { JoinForm } from '../components/Newsletter.jsx';
import { ArrowShort } from '../components/Icons.jsx';
import { useShop } from '../store/ShopContext.jsx';
import { asset } from '../lib/media.js';
import { scrollToId } from '../lib/scroll.js';
import { EASE_OUT } from '../lib/motion.js';

/* About MASQ., from the owner's About board: the story, the purpose, the
 * inspiration, craft / culture / community, the vision, the values, and the
 * community sign-up. The words are the board's; the photos are the shop's own
 * until the owner sends the ones drawn on the board. */

const P = {
  hero: 'assets/img/countdown.webp',
  purpose: 'assets/img/ess-hoodie.webp',
  inspiration: 'assets/img/ess-jacket.webp',
  craft: 'assets/img/film-still.webp',
  culture: 'assets/img/prod-backpack.webp',
  community: 'assets/img/hero-design.webp',
  vision: 'assets/img/prod-tee-black.webp'
};

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
const I = {
  eye: <svg viewBox="0 0 32 32" {...line}><path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16z" /><circle cx="16" cy="16" r="4.5" /><circle cx="16" cy="16" r="1.4" fill="currentColor" /></svg>,
  globe: <svg viewBox="0 0 32 32" {...line}><circle cx="16" cy="16" r="12" /><path d="M4 16h24M16 4c3.5 3.3 5 7.3 5 12s-1.5 8.7-5 12c-3.5-3.3-5-7.3-5-12s1.5-8.7 5-12z" /></svg>,
  diamond: <svg viewBox="0 0 32 32" {...line}><path d="M16 3l13 13-13 13L3 16z" /><path d="M16 9l7 7-7 7-7-7z" /></svg>,
  people: <svg viewBox="0 0 32 32" {...line}><circle cx="11" cy="11" r="4" /><circle cx="22" cy="12" r="3.2" /><path d="M3.5 26c.8-4.6 3.8-7 7.5-7s6.7 2.4 7.5 7M18.5 20.5c1-.9 2.2-1.4 3.5-1.4 3 0 5.2 2 5.8 5.9" /></svg>,
  star: <svg viewBox="0 0 32 32" {...line}><path d="M16 4l3.6 7.6 8.2 1-6 5.7 1.5 8.2L16 22.6l-7.3 3.9 1.5-8.2-6-5.7 8.2-1z" /></svg>,
  leaf: <svg viewBox="0 0 32 32" {...line}><path d="M6 26c0-11 7-18 21-20-1 14-8 21-19 21" /><path d="M6 26l10-10" /></svg>
};

const PILLARS = [
  [I.eye, 'PEOPLE', 'For a generation that sees beyond borders.'],
  [I.globe, 'PLACES', 'Inspired by our roots. Designed for the world.'],
  [I.diamond, 'PURPOSE', 'More than fashion — a positive cultural impact.']
];
const TILES = [
  ['craft', 'CRAFT', 'Quality materials, thoughtful details and modern craftsmanship in every piece.'],
  ['culture', 'CULTURE', 'African heritage reinterpreted for a new generation.'],
  ['community', 'COMMUNITY', 'A global community that wears culture proudly and supports creative expression.']
];
const VISION = [
  [I.globe, 'GLOBAL RECOGNITION', 'African creativity on the world stage.'],
  [I.people, 'TALENT EMPOWERMENT', 'Opportunities for designers, creatives and communities.'],
  [I.star, 'CULTURAL IMPACT', 'Fashion that celebrates and preserves our heritage.'],
  [I.leaf, 'SUSTAINABLE GROWTH', 'Building a brand that creates long-term value.']
];
const VALUES = [
  [I.star, 'Authenticity', 'We stay true to our roots and our story.'],
  [I.people, 'Creativity', 'We push boundaries through design and ideas.'],
  [I.leaf, 'Community', 'We grow with our people and culture.'],
  [I.diamond, 'Quality', 'We create pieces that last, with meaning.']
];

export default function About() {
  const { toast } = useShop();
  useEffect(() => {
    const was = document.title;
    document.title = 'About — MASQ.';
    return () => { document.title = was; };
  }, []);

  return (
    <ShopLayout footerJoin={false}>
      {/* Our story */}
      <section className="jr-hero ab-hero">
        <div className="jr-hero__photo" aria-hidden="true"><img src={asset(P.hero)} alt="" /></div>
        <div className="jr-hero__inner">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
            <p className="jr-eyebrow">OUR STORY</p>
            <h1 className="ab-hero__title"><span className="ab-hero__bold">More Than<br />Clothes.</span><span className="ab-hero__serif">A Culture<br />in Motion.</span></h1>
            <p className="jr-hero__sub">MASQ. is a contemporary fashion and lifestyle brand inspired by African heritage, designed for a global generation. We create modern pieces that carry meaning — where identity, culture and self-expression meet.</p>
            <div className="jr-hero__buttons">
              <button type="button" className="btn btn--contrast ab-hero__go" onClick={() => scrollToId('#purpose')}>OUR STORY <ArrowShort className="btn__arrow" /></button>
            </div>
          </motion.div>
        </div>
        <p className="jr-scribble" aria-hidden="true"><span>WEAR</span><span>IDENTITY</span><span>LIVE</span><span>CULTURE</span><i /></p>
      </section>

      {/* Our purpose */}
      <section className="ab-split" id="purpose" aria-labelledby="ab-purpose">
        <div className="ab-split__photo"><img src={asset(P.purpose)} alt="" loading="lazy" /></div>
        <Reveal className="ab-split__text">
          <p className="jr-eyebrow">OUR PURPOSE</p>
          <h2 className="ab-title" id="ab-purpose">Identity.<br />Expression.<br />Belonging.</h2>
          <p className="ab-copy">We believe in the power of culture to connect people, inspire creativity and shape a better future. MASQ. exists to celebrate African identity through design, craft and community — creating pieces that feel modern, authentic and globally relevant.</p>
          <ul className="ab-pillars">
            {PILLARS.map(([icon, name, text]) => (
              <li key={name}><span className="ab-icon" aria-hidden="true">{icon}</span><strong>{name}</strong><span>{text}</span></li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* Our inspiration */}
      <section className="ab-split ab-split--flip" aria-labelledby="ab-inspiration">
        <Reveal className="ab-split__text">
          <p className="jr-eyebrow">OUR INSPIRATION</p>
          <h2 className="ab-title" id="ab-inspiration">Rooted<br />in Heritage.<br />Designed for<br />Today.</h2>
          <p className="ab-copy">From traditional African symbols, art and stories, we draw inspiration to create contemporary pieces for everyday life. MASQ. reimagines these elements through a modern lens — blending heritage with current culture, street style and global fashion.</p>
          <Link to="/collections" className="btn btn--ghost ab-go">EXPLORE COLLECTIONS <ArrowShort className="btn__arrow" /></Link>
        </Reveal>
        <div className="ab-split__photo"><img src={asset(P.inspiration)} alt="" loading="lazy" /></div>
      </section>

      {/* Craft, culture, community */}
      <section className="ab-tiles" aria-label="What we stand on">
        {TILES.map(([key, name, text], i) => (
          <Reveal key={key} className="ab-tile" delay={i * 0.08}>
            <img src={asset(P[key])} alt="" loading="lazy" />
            <div><h3>{name}</h3><p>{text}</p></div>
          </Reveal>
        ))}
      </section>

      {/* Our vision */}
      <section className="ab-vision" aria-labelledby="ab-vision">
        <img className="ab-vision__photo" src={asset(P.vision)} alt="" aria-hidden="true" loading="lazy" />
        <div className="ab-vision__inner">
          <Reveal className="ab-vision__text">
            <p className="jr-eyebrow">OUR VISION</p>
            <h2 className="ab-title" id="ab-vision">A Global<br />Cultural Brand<br />From Africa.</h2>
            <p className="ab-copy">To build a globally recognised brand that showcases African creativity, empowers local talent and inspires a new wave of cultural expression through fashion and lifestyle.</p>
          </Reveal>
          <ul className="ab-goals">
            {VISION.map(([icon, name, text]) => (
              <li key={name}><span className="ab-icon" aria-hidden="true">{icon}</span><span><strong>{name}</strong><em>{text}</em></span></li>
            ))}
          </ul>
        </div>
      </section>

      {/* Our values */}
      <section className="ab-values" aria-labelledby="ab-values">
        <p className="jr-eyebrow">OUR VALUES</p>
        <h2 className="ab-title" id="ab-values">What Drives Us</h2>
        <ul>
          {VALUES.map(([icon, name, text], i) => (
            <Reveal as="li" key={name} delay={i * 0.06}>
              <span className="ab-icon" aria-hidden="true">{icon}</span><strong>{name}</strong><span>{text}</span>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Join */}
      <section className="ab-join" aria-labelledby="ab-join">
        <div>
          <p className="jr-eyebrow">BE PART OF THE STORY</p>
          <h2 className="ab-join__title" id="ab-join">Join the MASQ. Community</h2>
          <p className="ab-join__note">Get early access to new drops, stories and exclusive offers.</p>
        </div>
        <JoinForm id="about-email" onJoined={() => toast({ tone: 'ok', title: 'You’re on the list', body: 'Welcome to the world of MASQ.' })} />
      </section>
    </ShopLayout>
  );
}
