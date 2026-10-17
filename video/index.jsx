import { registerRoot, Composition } from 'remotion';
import { Film, FILM_FRAMES, FPS } from './Film.jsx';

/* MASQ. videos, made in code with Remotion. Not part of the shop: nothing here
 * is sent to shoppers. Render with `npm run video` (see README). */

function Root() {
  return (
    <Composition id="BrandFilm" component={Film} durationInFrames={FILM_FRAMES} fps={FPS} width={1920} height={1080} />
  );
}

registerRoot(Root);
