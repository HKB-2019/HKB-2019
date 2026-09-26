# MASQ. — Urban Rituals

A shop for a fashion label: the storefront, checkout through Paystack, and
an admin where the owner runs it — products, prices, photos, stock, delivery
fees, orders. React + Vite with Framer Motion at the front; Node, Express and
Postgres behind.

```bash
npm install
npm run setup    # first run: admin password, .env, catalogue
npm start        # the whole shop on http://localhost:3001
npm run test:all # every test: API on the database, then in a real browser
```

To put it online for free, see [DEPLOY.md](DEPLOY.md).

## Where things live

```
index.html              Vite entry
src/
  main.jsx              boots React
  App.jsx               the three routes
  pages/Storefront.jsx  the shop itself
  pages/OrderStatus.jsx /order — where Paystack returns the customer
  pages/Admin.jsx       /admin — the shell, orders and stock
  pages/admin/          products (with photo upload), settings, the list
  styles.css            all styling; design tokens at the top under :root
  data/currencies.js    display currencies and their rough rates
  store/ShopContext.jsx catalogue from the server, bag, saved, overlays
  lib/                  API client, delivery rules, storage, srcset, scroll
  components/           one file per section, plus overlays and toasts
server/
  index.js              express app
  schema.sql            tables; money is integer kobo throughout
  db.js                 Postgres: a hosted server, or PGlite built in
  seed.js               the catalogue as designed, for an empty database
  routes/               products, checkout, webhook, orders, subscribe,
                        admin, admin-products (incl. photo upload)
  lib/orders.js         every change of order status, and the sweeper
  lib/settings.js       delivery fees, footer pages, links — validated
  lib/catalogue.js      product rows → what the shop and admin show
  lib/                  also auth, Paystack client, photo checks, CSV,
                        rate limits, money helpers
  tools/setup.js        first run: .env, admin password, catalogue
  tools/hash-password.js generates ADMIN_PASSWORD_HASH and SESSION_SECRET
  test/                 API tests: money, admin door, products, delivery
e2e/                    browser tests, with a stand-in Paystack
.github/workflows/      runs every test on every push
public/assets/          images and self-hosted fonts
tools/build-assets.py   regenerates public/assets/img from the design mockup
render.yaml             how Render builds and runs the shop
DEPLOY.md               putting it online for free, step by step
```

Products, prices, photos, delivery fees and footer copy are all in the
database and changed in the admin. Display currency rates are in
`src/data/currencies.js`. Colour, spacing and type scale are CSS custom
properties under `:root` in `styles.css`.

## Interactions

| Control | Behaviour |
| --- | --- |
| `SHOP DROP 01` / `EXPLORE` / nav | Smooth-scroll to the section; nav underlines whatever is in view |
| Product card | `QUICK ADD` opens the sizes (sold-out sizes struck out); a one-size piece adds straight away. On phones the button stays visible — there is no hover |
| Heart on a card | Saves it; the heart in the header opens the saved list, from which it can be bought |
| `VIEW ALL` | Shows the pieces the owner has placed behind it; existing cards glide to their new positions |
| `SHOP ACCESSORIES` | Expands the grid and scrolls to it |
| Bag icon | Quantity (up to 10, or what is left), remove, subtotal → **Delivery** step: name, phone, state, city, address, the fee for that address and the total → Paystack |
| Person icon | Track an order by its reference |
| Currency `NGN` | Shows prices in USD/GBP/EUR as a guide; the bag says payment is in naira |
| `PLAY FILM` | Plays the film linked in the admin, or says it is coming |
| Essentials carousel | Arrows, dots, drag-to-scroll, arrow keys; a slide's name adds it, or asks for a size |
| Newsletter `JOIN` | Adds the address to the list the owner sees in the admin |
| Footer links | FAQ / shipping / returns / contact / privacy, as written in the admin |

Bag, saved list and currency persist in `localStorage`. The bag is checked
against the catalogue on every visit: pieces no longer on sale leave it, new
prices apply, and a quantity above what is left comes down, each with a
note. The delivery address is kept in memory only — not in `localStorage`
on a shared phone. Overlays trap focus, close on `Escape` or a scrim click,
and hand focus back to whatever opened them. Everything reflows down to
390px.

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

**Putting it online:** see [DEPLOY.md](DEPLOY.md). Free, about twenty minutes,
all in the browser.

While working on the front end, `npm run dev` gives Vite on :5173 with hot
reload and proxies `/api` to `npm run server` on :3001. `npm start` is the one
that matches production: one process, one port, `dist/` served by the API with
any non-`/api` path falling back to `index.html`, so a refresh on `/admin`
works.

### Tests

`npm test` runs the API tests (96) against an in-memory Postgres. To run the
same tests against a real server:

```bash
TEST_DATABASE_URL=postgres://user@host/throwaway_db npm test
```

It must be a database you do not mind losing — every test wipes it. Both
ways are worth running before a change to checkout or stock: the in-memory
one queues transactions, so only a real server shows whether two buyers
racing for the last jacket are handled.

`npm run test:e2e` runs the browser tests (22) with Playwright: a robot
customer and a robot owner clicking through the built site, on desktop and a
phone-sized screen. They run against a stand-in Paystack (`e2e/fake-paystack.js`)
with a real payment page, so a whole purchase — bag, delivery, pay, webhook,
order page, "mark sent" in the admin — runs without a Paystack account. Any
page error or Content-Security-Policy violation fails the test that caused
it. First time on a new machine: `npx playwright install chromium`.

Both suites run on every push (`.github/workflows/test.yml`), the API tests
against Postgres 16 as well.

Every script loads `.env` through Node's own `--env-file-if-exists`, so there
is no dotenv dependency and no `require('dotenv')` to forget.

### What works

- **Real checkout.** The bag posts to `POST /api/checkout`, the server prices
  it from its own catalogue, holds the stock, creates a pending order and asks
  Paystack for a payment page.
- **Real stock.** `soldOut` now comes from the `variants` table, not a hand-typed
  flag. Stock is held at checkout, released if payment fails or the customer
  walks away.
- **Real fulfilment.** Paystack's webhook flips the order to `paid`, after the
  amount is confirmed with Paystack directly.
- **Real delivery.** Checkout asks for name, phone and address, prices
  delivery by area from the owner's settings, and charges items plus
  delivery. It stays closed until at least one area has a fee.
- **An admin that runs the shop.** Orders with who and where, `MARK SENT`,
  spreadsheet export; products — name, price, badge, placement, on or off
  sale, order, sizes, counts, photo; stock take; the mailing list; delivery
  fees, footer pages, social links and the film. See *The admin* below.

### Orders nobody tells us about

Paystack sends nothing when a customer closes its page. Without something
checking, their items would stay reserved forever — every abandoned checkout
during a drop would quietly take a piece off sale.

`lib/orders.js` runs a **sweeper** a few seconds after every boot and every
five minutes while the server is up. For each order still `pending`:

| Age | Paystack says | Then |
| --- | --- | --- |
| over 5 min | success | marked `paid` — the webhook was missed |
| over 30 min | abandoned or failed | stock returned, order `abandoned` |
| any | ongoing, processing | left alone — the customer may still be paying |
| over 24 h | cannot be reached | stock returned anyway |

The customer's own return page asks Paystack too, but it never releases
stock: a slow bank is not an abandoned basket.

A customer can still find the old Paystack tab an hour later and pay. Their
stock was released, so it is taken back if it is still there. If someone else
bought it in between, the order becomes **`refund_due`** — charged, nothing to
send — and the admin shows a red line until a person refunds them. That is
the one outcome that must never happen silently.

`ABANDON_AFTER_MINUTES` and `CHECK_AFTER_MINUTES` change the thresholds.

### The admin

Five tabs, all usable on a phone:

| Tab | What it does |
| --- | --- |
| **Orders** | Every order with the customer's name, phone (tap to call), address, items and total including delivery. `MARK SENT` on paid orders. Filters by status. `DOWNLOAD CSV` for packing and dispatch |
| **Products** | One card per product: name, price, badge (save with a button), and switches for on sale, in the drop grid, before `VIEW ALL`, in the carousel (save at once). Reorder with ↑ ↓. Sizes with their counts; add a size; remove one once its count is 0 and nobody is paying for it. `+ NEW PRODUCT` starts off sale — add a photo and counts, then switch it on |
| **Stock** | Every size of everything in one list, for counting the shelf |
| **List** | Everyone who joined from the footer. Download as CSV into your email tool; remove someone who asks |
| **Settings** | Delivery fee per area (Lagos, Abuja, rest of Nigeria, abroad); footer pages; Instagram / TikTok / X links; the film link |

Banners at the top say when checkout is closed (no delivery prices yet),
when a customer is owed a refund, and what is running low.

**Photos** are prepared in the owner's browser before upload: turned the right
way up, cropped from the centre to the 5:6 frame every product uses, and made
at 700 and 1,400 px wide as WebP (JPEG in Safari, which cannot write WebP). A
phone photo of several MB arrives as a few hundred KB. They are stored in
Postgres rather than on disk, because a free host wipes its disk at every
restart, and served with a year's cache — a new upload is a new address.

The server does not trust the browser about any of this: the file type is
read from the file's first bytes (JPEG, PNG and WebP only — SVG can carry
script), each size is capped, and the sign-in check runs before a large body
is even read.

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
scrypt hash of it. It lives in one of two places:

- `ADMIN_PASSWORD_HASH`, which `npm run setup` writes to `.env` for you
  (`npm run admin:password` prints it to paste by hand); or
- the database, chosen in the browser at `/admin` the first time. With no
  password set, the server prints a one-time **setup code** to its log at
  boot, and `/admin` asks for it. The log is only readable by whoever runs the
  server, so finding `/admin` first is not enough to claim it. The code is
  72 random bits, compared in constant time, subject to the same lockout as
  passwords, and spent once used. Two browsers claiming at the same moment
  cannot both win: the password is stored by a single `INSERT … ON CONFLICT
  DO NOTHING`.

This second way exists so a shop can be set up entirely from a phone. The
environment variable, if set, always wins.

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

Behind a host's load balancer, `TRUST_PROXY=1` makes the lockout count each
visitor's real address rather than the balancer's. It trusts exactly that many
proxies and never `true`, which would believe any `X-Forwarded-For` a client
sent and let an attacker invent a new address for every guess.

If this ever runs on more than one instance, move the lockout counter out of
memory and into the database — a per-process counter gives an attacker eight
attempts *per instance*.

### What else the scan fixed

A pass over the whole codebase before this round found, and fixed:

- Order references came from `Math.random` and contained `_`, which Paystack
  does not allow in a reference — the first real checkout would have failed.
  They are now 96 random bits from `crypto`, in hex.
- The public order page returned the customer's full email. It now shows
  `a•••a@example.com` and the town, never the phone or street.
- Broken JSON got a 500, unknown `/api` paths got the home page, missing
  files got the home page. Now 400, a JSON 404, and a 404.
- Security headers on everything, a strict CSP on pages (scripts only from
  the shop itself; no framing), `/admin` not indexed, `robots.txt`.
- Checkout and the mailing list are rate limited — every checkout holds
  stock for half an hour, so a script could otherwise empty the shelves.
- Spreadsheet exports neutralise cells a spreadsheet would run as formulas —
  a customer's "name" could otherwise run on the owner's computer.
- Link previews on WhatsApp, Instagram and X now show a picture.

### Still to build

- **Customer accounts.** The person icon tracks an order by reference;
  there is no sign-in for customers yet.
- **Our own emails.** Paystack emails the customer a receipt and the owner a
  payment notice, so nobody is left without word — but the shop does not yet
  send its own confirmation or "your order has shipped".
- **Courier booking.** Delivery is priced and the address collected; the
  parcel is booked with a courier by hand, using the orders spreadsheet.
- **International duties.** Abroad can be switched on with a flat fee; duties
  are not calculated.
- **Currency rates** for the price guide are set by hand in
  `src/data/currencies.js`.

### On the database

Postgres, from one of two places. With `DATABASE_URL` set, a real server
through `pg` — that is production. Without it, **PGlite**: the whole of
Postgres compiled to WebAssembly, running inside the app and keeping its files
in `server/data/`. Nothing to install, and the same SQL either way.

PGlite is for your own machine only. With `NODE_ENV=production` the server
refuses to start without `DATABASE_URL`: on a host, PGlite's files would sit
on a disk that is wiped at every restart, and it needs about 580 MB of memory
where Render's free plan gives 512. With `pg` the whole shop runs in about
65 MB.

It was SQLite until the shop needed free hosting. Free hosts wipe the app's
disk on every restart, and the orders would have gone with it; the database
has to live somewhere that outlasts the app.

The move changed how stock is held. SQLite serialises every write, so reading
a count and then subtracting was safe there. Postgres runs checkouts truly in
parallel, and the same two steps sold **ten jackets out of two** in a test
against a real server. Stock is now held by one statement —
`UPDATE … SET stock = stock - $1 WHERE id = $2 AND stock >= $1` — which a
second buyer waits on, re-checks, and loses cleanly.

COUNT and SUM come back from Postgres as 64-bit integers, which both drivers
return as strings. `db.js` parses them to numbers; the admin summary would
otherwise report revenue as `"4200000"`.

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
