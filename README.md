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
| Essentials carousel | Arrows, dots, drag-to-scroll, arrow keys; slide titles add to the bag |
| Newsletter `JOIN` | Validates the email, shows success state |
| Footer links | Open FAQ / shipping / returns / contact in a modal |

The bag, saved list and currency persist in `localStorage`. Overlays trap
focus, close on `Escape` or scrim click, and return focus to whatever opened
them. Everything reflows down to 390px, and `prefers-reduced-motion` disables
the animation.

## Note on imagery

The photography was cut from the supplied design mockup, so it is limited to
that resolution. Three assets needed repair because the mockup's own interface
text was baked into them — the hero's header row, the caption in the stone
texture band, and the play button in the film strip. The scripts that produced
`assets/img/` are not part of the site; replace the files with real product
photography when it is available.
