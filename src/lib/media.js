/* Every product shot ships at two widths. Handing the browser both plus a
 * `sizes` hint lets it pick by layout width AND pixel ratio, so the image
 * stays sharp when someone zooms instead of the browser stretching the small
 * one. The hero, film strip and texture band are deliberately NOT split this
 * way — see the resolution note in the README.
 *
 * Takes a product from the API, which carries both addresses — built-in
 * photos and uploaded ones name their double-width copy differently. */

/**
 * A file shipped in public/. The shop is built to be served from the site's
 * root, so this is "/assets/…" and works from any page's address; the preview
 * build is served from a folder and uses relative addresses instead.
 */
export const asset = (path) => import.meta.env.BASE_URL + path.replace(/^\/+/, '');

// By width, not by screen density: the browser then takes the larger copy
// whenever the space on screen needs it — a wide product page on an ordinary
// laptop screen included — rather than only on a sharp (2x) screen. Product
// photos are made 700 and 1400 wide (src/lib/photo.js); the sample
// ones are within a few pixels of that.
export const srcSet = (p) => (p.img2x ? `${p.img} 700w, ${p.img2x} 1400w` : undefined);

export const CARD_SIZES  = '(max-width:900px) 46vw, (max-width:1464px) 21vw, 277px';
export const SLIDE_SIZES = '(max-width:640px) 46vw, (max-width:1100px) 30vw, (max-width:1464px) 21vw, 290px';
export const GALLERY_SIZES = '(max-width:900px) 100vw, 50vw';

/**
 * A link to another page of the shop, for an ordinary <a> (the admin's "see
 * it on the shop" links). The preview keeps its pages after the #.
 */
export const pageHref = (path) => (import.meta.env.VITE_DEMO ? '#' + path : path);
/** Opens in a new tab on the real shop; the preview stays in its one page. */
export const NEW_TAB = import.meta.env.VITE_DEMO ? {} : { target: '_blank', rel: 'noopener' };
