import Reveal from './Reveal.jsx';
import Lines from './Lines.jsx';
import { CraftMark } from './Icons.jsx';
import { asset } from '../lib/media.js';
import { useHome } from '../store/ShopContext.jsx';

export default function CraftBand() {
  const { home, images, ready } = useHome();
  const photo = images.band;
  return (
    <section className="craft" id="craft">
      <div className="craft__bg" aria-hidden="true">
        {ready && (
          <img src={photo ? photo.img : asset('assets/img/band-texture.webp')}
               srcSet={photo ? `${photo.img} 1x, ${photo.img2x} 2x` : undefined} alt="" />
        )}
      </div>
      <Reveal className="craft__inner">
        <CraftMark />
        <h2 className="craft__title">{home.craftTitle}</h2>
        <p className="craft__text"><Lines text={home.craftText} /></p>
      </Reveal>
    </section>
  );
}
