# MASQ. — Urban Rituals

Front-end build of the MASQ. storefront: a dark, editorial landing page for a
fashion label, with the shop interactions wired up.

No build step, no dependencies. Open `index.html`, or serve the folder:

```bash
npx http-server . -p 8080
```

## Layout

```
index.html
assets/
  css/styles.css     all styling, design tokens at the top of the file
  js/main.js         every interaction; product data lives at the top
  fonts/             Inter + EB Garamond (latin subsets, self-hosted)
  img/               product, hero, texture and film imagery
tools/
  build-assets.py    regenerates assets/img/ from the design mockup
```

Product catalogue, essentials carousel contents, exchange rates and the footer
copy are plain arrays/objects at the top of `assets/js/main.js` — edit those
rather than the markup. Colour, spacing and type scale are CSS custom
properties under `:root`.

## Interactions

| Control | Behaviour |
| --- | --- |
| `SHOP DROP 01` / `EXPLORE` / nav | Smooth-scroll to the matching section; nav underlines the section in view |
| Product card hover | Reveals `QUICK ADD`; picking a size adds to the bag |
| Heart on a card | Toggles the saved list (persisted) |
| `VIEW ALL` | Expands the grid from 4 to 8 pieces, toggles back to `SHOW LESS` |
| `SHOP ACCESSORIES` | Expands the grid and scrolls to it |
| Bag icon | Slide-out drawer: quantity +/−, remove, live subtotal, checkout |
| Account icon | Sign in / create account modal with inline validation |
| Currency `NGN` | Converts every price on the page, including the bag |
| `PLAY FILM` | Opens the film modal; the player has a working play/pause and progress bar |
| Essentials carousel | Arrows, dots, drag-to-scroll, arrow keys; slide titles add to the bag. Pages by whole screenfuls of slides |
| Newsletter `JOIN` | Validates the email, shows success state |
| Footer links | Open FAQ / shipping / returns / contact in a modal |

The bag, saved list and currency persist in `localStorage`. Overlays trap
focus, close on `Escape` or scrim click, and return focus to whatever opened
them. Everything reflows down to 390px, and `prefers-reduced-motion` disables
the animation.

## Design notes

The layout runs on a 1320px measure with a generous vertical rhythm
(`--sec-y`) and portrait 5:6 product frames. Type is Inter for the interface
and EB Garamond for the editorial lines.

The page deliberately carries **no blur and no grain**. Frosted panels and a
noise overlay both soften every edge underneath them, which on a near-black
palette reads as haze rather than atmosphere; overlays use solid fills
instead. Micro-type sits at 10–11px with tracking in the .13–.24em range —
wider tracking than that destroys word shapes at these sizes. Hairlines are
`--line` at roughly 1.5:1 against the page so structure is actually visible.

Imagery is sharpened for acutance rather than resolution (the sources are
small): a two-step LANCZOS upscale, a fine unsharp pass for edges plus a wider
one for local contrast, and a mild S-curve so form lifts out of the shadows.
See `--ink-dim` / `--ink-faint` for the secondary ink levels.

## Note on imagery

The photography was cut from the supplied design mockup, so it is limited to
that resolution. Several assets needed repair or reframing:

- the hero had the mockup's own header row baked into it (the model's hair was
  reconstructed by mirroring the head across its axis);
- the stone texture band and the film strip were rebuilt from their text-free
  regions;
- product and essentials shots were extended into 5:6 frames by continuing
  each column's sampled backdrop tone into the margin, so the pieces sit in
  more air without duplicating any content. Columns where the product meets
  the crop edge are pulled back towards the row median, or they extend as
  bright streaks once the contrast pass runs.

`tools/build-assets.py` regenerates everything in `assets/img/` from the
mockup (`python3 tools/build-assets.py path/to/mockup.webp`, needs Pillow). It
is a build tool, not part of the site — replace the files with real product
photography when it is available.
