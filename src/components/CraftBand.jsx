import Reveal from './Reveal.jsx';
import Lines from './Lines.jsx';
import { asset } from '../lib/media.js';
import { useHome } from '../store/ShopContext.jsx';
import emblem from '../assets/craft-emblem.webp';

export default function CraftBand() {
  const { home, images, ready } = useHome();
  const photo = images.band;
  return (
    <section className={`craft${photo ? ' craft--own' : ''}`} id="craft">
      <div className="craft__bg" aria-hidden="true">
        {ready && (
          <img src={photo ? photo.img : asset('assets/img/band-design.webp')}
               srcSet={photo
                 ? `${photo.img} 1x, ${photo.img2x} 2x`
                 : `${asset('assets/img/band-design.webp')} 1800w, ${asset('assets/img/band-design@2x.webp')} 3600w`}
               sizes={photo ? undefined : '(max-width: 900px) 400vw, 100vw'} alt="" />
        )}
      </div>
      <Reveal className="craft__inner">
        <img className="craft__emblem" src={emblem} alt="" aria-hidden="true" width="99" height="144" />
        <h2 className="craft__title">{home.craftTitle}</h2>
        <p className="craft__text"><Lines text={home.craftText} /></p>
      </Reveal>
    </section>
  );
}
