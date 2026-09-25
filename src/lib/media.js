/* Every product shot ships at two widths. Handing the browser both plus a
 * `sizes` hint lets it pick by layout width AND pixel ratio, so the image
 * stays sharp when someone zooms instead of the browser stretching the small
 * one. The hero, film strip and texture band are deliberately NOT split this
 * way — see the resolution note in the README.
 *
 * Takes a product from the API, which carries both addresses — built-in
 * photos and uploaded ones name their double-width copy differently. */

export const srcSet = (p) => (p.img2x ? `${p.img} 1x, ${p.img2x} 2x` : undefined);

export const CARD_SIZES  = '(max-width:900px) 46vw, (max-width:1464px) 21vw, 277px';
export const SLIDE_SIZES = '(max-width:640px) 46vw, (max-width:1100px) 30vw, (max-width:1464px) 21vw, 290px';
