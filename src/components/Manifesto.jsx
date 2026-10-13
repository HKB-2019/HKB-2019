import Reveal from './Reveal.jsx';
import { useHome } from '../store/ShopContext.jsx';

export default function Manifesto() {
  const { home } = useHome();
  return (
    <section className="manifesto">
      <Reveal className="manifesto__inner">
        <p className="manifesto__line">{home.manifestoLine1}</p>
        <p className="manifesto__line">{home.manifestoLine2}</p>
        <p className="manifesto__tag">{home.manifestoTag}</p>
      </Reveal>
    </section>
  );
}
