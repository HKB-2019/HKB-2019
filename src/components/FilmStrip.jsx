import { useShop, useHome } from '../store/ShopContext.jsx';
import { asset } from '../lib/media.js';
import { Play } from './Icons.jsx';

export default function FilmStrip() {
  const { openOverlay, site } = useShop();
  const { images, ready } = useHome();
  const photo = images.film;
  return (
    <section className="film" id="film">
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
      <button className="film__play" aria-haspopup="dialog" onClick={() => openOverlay('film')}>
        <span className="film__disc" aria-hidden="true"><Play /></span>
        <span className="film__label">{site && !site.film ? 'FILM — COMING SOON' : 'PLAY FILM'}</span>
      </button>
    </section>
  );
}
