import { useShop } from '../store/ShopContext.jsx';
import { Play } from './Icons.jsx';

export default function FilmStrip() {
  const { openOverlay } = useShop();
  return (
    <section className="film" id="film">
      <img
        className="film__bg"
        src="assets/img/film-still.webp"
        alt="Close detail of hand-beaded MASQ. mask embroidery"
        width="3800" height="548" loading="lazy"
      />
      <button className="film__play" aria-haspopup="dialog" onClick={() => openOverlay('film')}>
        <span className="film__disc" aria-hidden="true"><Play /></span>
        <span className="film__label">PLAY FILM</span>
      </button>
    </section>
  );
}
