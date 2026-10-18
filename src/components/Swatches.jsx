/**
 * A row of colour swatches to choose from. A colour sold out in every size is
 * struck through, but can still be picked: to see it, and to ask to be told
 * when it is back.
 */
export default function Swatches({ product, value, onChange, large = false }) {
  // One stop on Tab for the whole row; arrow keys move along it, as in any
  // set of radio buttons.
  const onKeyDown = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const names = product.colours.map(c => c.name);
    const next = names[(names.indexOf(value) + step + names.length) % names.length];
    onChange(next);
    e.currentTarget.querySelector(`[data-colour="${CSS.escape(next)}"]`)?.focus();
  };
  return (
    <div className={`swatches${large ? ' swatches--large' : ''}`} role="radiogroup"
         aria-label={`Colour of ${product.name}`} onKeyDown={onKeyDown}>
      {product.colours.map(c => (
        <button
          key={c.name}
          type="button"
          role="radio"
          aria-checked={value === c.name}
          tabIndex={value === c.name ? 0 : -1}
          data-colour={c.name}
          aria-label={c.soldOut ? `${c.name}, sold out` : c.name}
          title={c.soldOut ? `${c.name} — sold out` : c.name}
          className={`swatch${value === c.name ? ' is-on' : ''}${c.soldOut ? ' is-out' : ''}`}
          style={{ '--swatch': c.hex }}
          onClick={(e) => { e.stopPropagation(); onChange(c.name); }}
        />
      ))}
    </div>
  );
}

/** The colours a card comes in, as dots — to look at, not to press. */
export function ColourDots({ product }) {
  if (!product.colours?.length) return null;
  const n = product.colours.length;
  return (
    <p className="card__colours">
      <span className="card__dots" aria-hidden="true">
        {product.colours.map(c => <i key={c.name} style={{ '--swatch': c.hex }} />)}
      </span>
      <span className="sr-only">Comes in {n} colour{n === 1 ? '' : 's'}</span>
    </p>
  );
}
