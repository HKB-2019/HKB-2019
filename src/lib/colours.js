/* Pieces sold in colours. A product from the server has `colours` — each with
 * its own `sizes` and, maybe, its own photo — or an empty list, when it is
 * bought by size alone. The first colour is the one in the main photo. */

export const hasColours = (product) => Boolean(product?.colours?.length);

/** The sizes to offer: one colour's, or the product's own when it has no colours. */
export function sizesFor(product, colour) {
  if (!hasColours(product)) return product?.sizes ?? [];
  return product.colours.find(c => c.name === colour)?.sizes ?? [];
}

/** The colour to show first: the first one in stock, else the first. */
export function firstColour(product) {
  if (!hasColours(product)) return '';
  return (product.colours.find(c => !c.soldOut) ?? product.colours[0]).name;
}

/** The photo for a colour: its own, or the product's main one. */
export function photoFor(product, colour) {
  const c = product?.colours?.find(x => x.name === colour);
  return c?.img ? { img: c.img, img2x: c.img2x } : { img: product?.img, img2x: product?.img2x };
}

/** "Black, M" — or just "M" for a piece with no colours. */
export const optionLabel = (colour, size) => (colour ? `${colour}, ${size}` : size);

/** Nothing to choose: one colour at most and one size. Such a piece goes straight in the bag. */
export function onlyChoice(product) {
  if (hasColours(product)) return null;
  return product?.sizes?.length === 1 ? product.sizes[0] : null;
}
