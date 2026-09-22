import Reveal from './Reveal.jsx';
import { CraftMark } from './Icons.jsx';

export default function CraftBand() {
  return (
    <section className="craft" id="craft">
      <div className="craft__bg" aria-hidden="true">
        <img src="assets/img/band-texture.webp" alt="" />
      </div>
      <Reveal className="craft__inner">
        <CraftMark />
        <h2 className="craft__title">Craft. Culture. Identity.</h2>
        <p className="craft__text">
          Each piece is designed as a modern artifact —<br />
          where heritage meets contemporary expression.
        </p>
      </Reveal>
    </section>
  );
}
