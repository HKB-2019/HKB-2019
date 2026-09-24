# MASQ. — Urban Rituals

Storefront for a fashion label. React + Vite, with Framer Motion driving the
movement.

```bash
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
npm run preview  # serve the production build
```

## Where things live

```
index.html              Vite entry
src/
  main.jsx              boots React
  App.jsx               the three routes
  pages/Storefront.jsx  the shop itself
  pages/OrderStatus.jsx /order — where Paystack returns the customer
  pages/Admin.jsx       /admin — orders, fulfilment, stock
  styles.css            all styling; design tokens at the top under :root
  data/catalogue.js     products, essentials, currencies, info copy
  store/ShopContext.jsx bag, saved list, currency, overlays, toasts
  lib/                  helpers: storage, smooth scroll, srcset, API client
  components/           one file per section, plus overlays and toasts
server/
  index.js              express app
  schema.sql            tables; money is integer kobo throughout
  db.js  seed.js        sqlite connection, catalogue + stock
  routes/               products, checkout, webhook, orders, admin
  lib/                  money helpers, Paystack REST client, admin auth
  tools/setup.js        first run: .env, admin password, catalogue
  tools/hash-password.js generates ADMIN_PASSWORD_HASH and SESSION_SECRET
  test/shop.test.js     the tests that stop a shop being robbed
  test/admin.test.js    the tests that stop the back room being walked into
public/assets/          images and self-hosted fonts
tools/build-assets.py   regenerates public/assets/img from the design mockup
```

Catalogue, exchange rates and footer copy are plain objects in
`src/data/catalogue.js`. Colour, spacing and type scale are CSS custom
properties under `:root` in `styles.css`.

## Interactions

| Control | Behaviour |
| --- | --- |
| `SHOP DROP 01` / `EXPLORE` / nav | Smooth-scroll to the section; nav underlines whatever is in view |
| Product card hover | Reveals `QUICK ADD`; picking a size adds to the bag |
| Heart on a card | Toggles the saved list (persisted) |
| `VIEW ALL` | Expands the grid from 4 to 8 pieces; existing cards glide to their new positions |
| `SHOP ACCESSORIES` | Expands the grid and scrolls to it |
| Bag icon | Slide-out drawer: quantity +/−, remove, live subtotal, checkout |
| Account icon | Sign in / create account with inline validation |
| Currency `NGN` | Converts every price on the page, including the bag |
| `PLAY FILM` | Film modal with a working play/pause and progress bar |
| Essentials carousel | Arrows, dots, drag-to-scroll, arrow keys; slide titles add to the bag |
| Newsletter `JOIN` | Validates the email, shows a success state |
| Footer links | FAQ / shipping / returns / contact in a modal |

Bag, saved list and currency persist in `localStorage`. Overlays trap focus,
close on `Escape` or a scrim click, and hand focus back to whatever opened
them. Everything reflows down to 390px.

## The shop

```bash
npm install
npm run setup    # asks for an admin password, writes .env, loads the catalogue
npm start        # builds, then serves the whole thing on :3001
```

That is the whole first run. `npm run setup` is safe to run again — it never
overwrites a value already in `.env`.

Then:

| | |
| --- | --- |
| `http://localhost:3001` | the shop |
| `http://localhost:3001/admin` | the back room |
| `http://localhost:3001/order?reference=…` | where Paystack returns a customer |

Checkout needs Paystack test keys in `.env`; nothing else does. Everything
else — the catalogue, the admin, stock — runs without them.

While working on the front end, `npm run dev` gives Vite on :5173 with hot
reload and proxies `/api` to `npm run server` on :3001. `npm start` is the one
that matches production: one process, one port, `dist/` served by the API with
any non-`/api` path falling back to `index.html`, so a refresh on `/admin`
works. `npm test` runs the money tests and the admin tests.

Every script loads `.env` through Node's own `--env-file-if-exists`, so there
is no dotenv dependency and no `require('dotenv')` to forget.

### What works

- **Real checkout.** The bag posts to `POST /api/checkout`, the server prices
  it from its own catalogue, holds the stock, creates a pending order and asks
  Paystack for a payment page.
- **Real stock.** `soldOut` now comes from the `variants` table, not a hand-typed
  flag. Stock is held at checkout, released if payment fails.
- **Real fulfilment.** Paystack's webhook flips the order to `paid`, after the
  amount is confirmed with Paystack directly.
- **An admin view.** `/admin` shows takings, orders with their line items, a
  `MARK SENT` button for paid orders, and an editable stock count per size
  with a running-low line at the top.

### Three rules the code will not bend

**The browser never states a price.** It says what is in the bag; every figure
comes from the database. A request claiming the jacket costs ₦1 is charged
₦98,000, because the number it sent is not read. There is a test for this.

**Money is integer kobo, never naira as a float.** `0.1 + 0.2` is not `0.3` in
binary floating point, and a shop that loses a fraction of a kobo per line
eventually disagrees with its payment provider. Paystack also speaks kobo, so
it is one unit end to end.

**A webhook is not trusted because it arrived.** It is HMAC-SHA512 verified
against the raw body — which is why that route is mounted before the JSON
parser, since re-serialising the body breaks the signature. Then the amount is
confirmed with Paystack. Then it is deduplicated, because Paystack retries.

### The admin door

One operator, one password. The password is never stored or committed — only a
scrypt hash of it, in `ADMIN_PASSWORD_HASH`, which `npm run setup` writes for
you (`npm run admin:password` prints the same two values to paste by hand).

Signing in sets a session cookie that is HttpOnly (JavaScript cannot read it),
SameSite (not sent cross-site), `Secure` in production, and signed with
HMAC-SHA256 over `SESSION_SECRET`, so its payload cannot be edited — extending
the expiry by hand breaks the signature. Every comparison, password and
signature alike, is constant-time. Eight wrong passwords from one address locks
that address out for fifteen minutes, and a wrong password never says which
part was wrong.

`server/test/admin.test.js` is the proof: every admin route is checked to
refuse a caller with no session, a forged cookie, a tampered payload and an
expired session, and to refuse setting stock to anything that is not a whole
number.

If this ever runs on more than one instance, move the lockout counter out of
memory and into the database — a per-process counter gives an attacker eight
attempts *per instance*.

### Still to build

Customer accounts and sessions (the account modal is still cosmetic),
transactional email, and shipping/delivery.

### On the database

SQLite via Node's built-in driver — no native build, and its serialised writes
make overselling during a drop harder rather than easier. `schema.sql` is plain
SQL, so moving to Postgres is a change of driver, not of design.

## Animation

Framer Motion handles anything that needs to enter, leave, or be interrupted
halfway:

- `AnimatePresence` gives overlays and toasts real exit animations. The
  previous CSS version had to fake these with a class toggle and an
  `animationend` listener.
- `layout` on the product cards is what makes them glide when `VIEW ALL` adds
  four more, and what closes the gap when a bag line is removed.
- The drawer runs on a spring rather than a fixed duration, so opening and
  closing can interrupt each other cleanly.

CSS keeps every static style. Where Framer drives a property it also owns the
timing — a CSS `transition` on the same property fights it. Watch for that if
you add animation: anything Framer animates via `transform` will override a
CSS `transform` on the same element entirely, which is why the cart count
passes its own `y` offset.

## Design notes

A 1320px measure with a generous vertical rhythm (`--sec-y`) and portrait 5:6
product frames. Inter for the interface, EB Garamond for the editorial lines.

No blur and no grain anywhere. Frosted panels and noise overlays soften every
edge underneath them, which on a near-black palette reads as haze rather than
atmosphere; overlays use solid fills. Micro-type sits at 10–11px with tracking
in the .13–.24em range — wider than that destroys word shapes at these sizes.
Hairlines are `--line` at roughly 1.5:1 against the page, so structure is
actually visible.

Imagery is enlarged with **iterative back-projection** rather than a plain
resample. A resample can only interpolate, so past roughly 2x it turns to
mush; back-projection upscales, simulates the downscale that would have
produced the source, and feeds the residual back in — about +20% mean gradient
magnitude at 5x on these crops. On top of that: a fine unsharp pass for edges,
a wider one for local contrast, and a mild S-curve so form lifts out of the
shadows.

### Resolution and zoom

Product and essentials shots ship at two widths with `srcset` + `sizes`, so
the browser picks by layout width *and* pixel ratio — the large file is
fetched only when a retina screen or browser zoom actually needs it.

The film strip's band height is capped so the strip is never magnified past
what its file can cover. It is a `cover` crop of a 6.9:1 image, so a taller
band both crops in harder and makes the browser stretch the file further — at
440px tall the browser was adding a 1.58x stretch on top of everything else.

The hero, film strip and texture band are **not** split that way. All three
are `object-fit: cover` against a box whose aspect is nothing like the
image's, so each renders far wider than the box it sits in (the film strip
about 2.1x at desktop and 4.3x at phone width). `sizes` only describes width,
so the browser cannot know that, and a "1x" candidate is never the right pick
— each ships as one high-resolution file instead. Re-check this if a section's
height or aspect changes.

## Note on imagery

The photography was cut from the supplied design mockup, so it is limited to
that resolution. Several assets needed repair or reframing:

- the hero had the mockup's own header row baked into it (the model's hair was
  reconstructed by mirroring the head across its axis);
- the stone texture band and the film strip were rebuilt from their text-free
  regions;
- product and essentials shots were extended into 5:6 frames by continuing
  each column's sampled backdrop tone into the margin. Which edge gets that
  margin is decided per image: the script measures how much each edge differs
  from one column to the next, because a studio vignette slides smoothly while
  a subject has local structure. Clean edges score 0.03–0.15 on these crops
  and an edge with a model's head on it scores 1.0–2.9, so an edge above 0.6
  gets no margin at all and the frame grows the other way. Without that, the
  hoodie and jacket shots — both cropped through the model — had their heads
  extruded upward into a vertical smear. The softening pass that hides each
  graft's join is applied only where a graft actually exists: an edge with no
  margin has no join, and blurring it there smears the photograph itself.

`tools/build-assets.py` regenerates everything in `public/assets/img/` from
the mockup (`python3 tools/build-assets.py path/to/mockup.webp`, needs Pillow
and numpy). It is a build tool, not part of the site — replace the files with
real product photography when it is available.
