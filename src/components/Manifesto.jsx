import Reveal from './Reveal.jsx';
import { useShop, useHome } from '../store/ShopContext.jsx';
import { ArrowShort } from './Icons.jsx';

export default function Manifesto() {
  const { openOverlay } = useShop();
  const { home } = useHome();
  // The last word of the second line is the one in violet ("symbols.").
  const turn = home.manifestoLine2.trim();
  const cut = turn.lastIndexOf(' ');
  return (
    <section className="manifesto">
      <Reveal className="manifesto__inner">
        <p className="manifesto__line">{home.manifestoLine1}</p>
        <p className="manifesto__line">
          {cut > 0 ? <>{turn.slice(0, cut + 1)}<span className="manifesto__word">{turn.slice(cut + 1)}</span></> : turn}
        </p>
        <p className="manifesto__tag">{home.manifestoTag}</p>
        {home.manifestoMore && (
          <button type="button" className="link-arrow manifesto__more" aria-haspopup="dialog"
                  onClick={() => openOverlay('film')}>
            <span>{home.manifestoMore}</span>
            <ArrowShort />
          </button>
        )}
      </Reveal>
    </section>
  );
}
