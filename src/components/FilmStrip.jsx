import { useShop, useHome } from '../store/ShopContext.jsx';
import { asset } from '../lib/media.js';
import { Play } from './Icons.jsx';

export default function FilmStrip() {
  const { openOverlay } = useShop();
  const { home, images, ready } = useHome();
  const photo = images.film;
  const words = (home.filmWords ?? '').split('\n').map(w => w.trim()).filter(Boolean);
  return (
    <section className="film" id="film">
      {/* The frame drifts as the page scrolls (src/lib/drift.js); the photo
          in it zooms a little on hover. Two elements, so neither undoes the other. */}
      <div className="film__media" aria-hidden="true">
        {ready && (
          <img
            className="film__bg"
            src={photo ? photo.img : asset('assets/img/film-still.webp')}
            srcSet={photo ? `${photo.img} 1x, ${photo.img2x} 2x` : undefined}
            alt=""
            {...(photo ? {} : { width: 3800, height: 548 })}
            loading="lazy"
          />
        )}
      </div>
      {words.length > 0 && (
        <ul className="film__words" aria-hidden="true">
          {words.map(w => <li key={w}>{w}</li>)}
        </ul>
      )}
      <button className="film__play" aria-haspopup="dialog" onClick={() => openOverlay('film')}>
        <span className="film__disc" aria-hidden="true"><Play /></span>
        <span className="film__label">PLAY BRAND FILM</span>
      </button>
    </section>
  );
}
