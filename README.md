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
  App.jsx               the routes: home, product pages, order, admin
  pages/Storefront.jsx  the home page
  pages/ProductPage.jsx /product/:id — gallery, sizes, words, more pieces
  pages/OrderStatus.jsx /order — where Paystack returns the customer
  pages/Admin.jsx       /admin — the shell, orders and stock
  pages/admin/          products (with photos), home page, settings, the list
  styles.css            all styling; design tokens at the top under :root
  data/currencies.js    the price-guide currencies and their starting rates
  data/home.js          the home page's words as designed (shared with the server)
  data/catalogue.js     the pieces as designed: seeds the database and the preview
  data/pages.js         the footer pages as first written
  data/maps.js          country and Nigerian-state outlines (Natural Earth)
  lib/analytics.js      counts visits: pages, time spent, shopping steps
  pages/admin/visitors/ the VISITORS tab: charts, maps, tables (loaded on demand)
  demo/                 the preview build's stand-in server and payment page
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
  lib/settings.js       delivery fees, footer pages, links, home page — validated
  lib/catalogue.js      product rows → what the shop and admin show
  lib/analytics.js      visit counting: daily-changing visitor code, device,
                        source, country from time zone, 90-day detail
  lib/report.js         everything the VISITORS tab shows
  lib/                  also auth, Paystack client, photo checks, CSV,
                        rate limits, money helpers
  tools/setup.js        first run: .env, admin password, catalogue
  tools/hash-password.js generates ADMIN_PASSWORD_HASH and SESSION_SECRET
  test/                 API tests: money, admin door, products, delivery
e2e/                    browser tests, with a stand-in Paystack
.github/workflows/      runs every test on every push
.github/dependabot.yml  weekly update alerts, as pull requests the tests run on
public/assets/          images and self-hosted fonts
tools/build-assets.py   regenerates public/assets/img from the design mockup
tools/build-maps.py     regenerates src/data/maps.js from Natural Earth
render.yaml             how Render builds and runs the shop
DEPLOY.md               putting it online for free, step by step
```

Products (with their descriptions and extra photos), prices, the home page's
words and photos, the menu, delivery fees and footer copy are all in the
database and changed in the admin. Display currency rates are set in
the admin too (*Settings → Price guide*). Colour, spacing and type scale are CSS custom
properties under `:root` in `styles.css`.

## Interactions

| Control | Behaviour |
| --- | --- |
| `SHOP DROP 01` / `EXPLORE` / nav | Smooth-scroll to the section; nav underlines whatever is in view. From a product page, the menu goes back to that section. Its names, and which items show, are set in the admin |
| Product photo or name | The photo glides into the product page (in browsers that support it). There: `← BACK` at the top returns to exactly where they were — the same spot on the grid, VIEW ALL still open, or the piece before (the browser's back does the same); someone who arrived from a shared link has nothing in the shop behind them, so BACK opens the shop at the piece's section (the drop, or Essentials) rather than leaving the site. Then photos (swipe on a phone; hover for a close-up with a mouse; tap for full screen, tap again to zoom, drag to look around), colour swatches for a piece sold in colours (the photo, sizes and "only 2 left" follow the colour; the address keeps it, `?colour=Black`, so a shared link opens on it; a colour with no photo of its own says which colour is shown), sizes with "only 2 left", `ADD TO BAG` (asks for a size rather than guessing; on a phone, while it is out of view, a bar at the foot of the screen keeps the button — and the name and price, once those have scrolled away — in reach), save, size guide, description, details and care, delivery and returns, four more pieces |
| Product card | `QUICK ADD` opens the sizes (sold-out sizes struck out) — with the colour swatches above them for a piece sold in colours, and "3 colours" under its price; a one-size piece in one colour adds straight away. On phones the button stays visible — there is no hover |
| Heart on a card | Saves it; the heart in the header opens the saved list, from which it can be bought |
| `VIEW ALL` | Shows the pieces the owner has placed behind it; existing cards glide to their new positions |
| `SHOP ACCESSORIES` | Expands the grid and scrolls to it |
| Bag icon | Quantity (up to 10, or what is left), remove, subtotal → **Delivery** step: name, phone, state, city, address, `HAVE A CODE?` for a discount code, the fee for that address and the total → Paystack |
| Sold-out size | `TELL ME WHEN IT’S BACK` on the product page takes an email — for that colour and size; the owner sees who is waiting for what |
| Countdown | When a piece has a drop time, the home page counts down to it (days, hours, minutes, seconds in panels beside a hooded portrait, from the owner's design; the picture can be changed under *Home page*), and the piece appears by itself at that moment |
| Person icon | Track an order by its reference |
| Currency `NGN` | Shows prices in USD/GBP/EUR as a guide; the bag says payment is in naira |
| `PLAY BRAND FILM`, `OUR STORY →` | Plays the film linked in the admin; with none linked, the brand film made in code (`public/assets/video/brand-film.mp4`, see *Videos*) |
| The Essentials | Panels five across (three, then two, on smaller screens): arrows, drag-to-scroll, arrow keys; a panel's name adds it, or asks for a size; the photo and the round arrow open the piece |
| Promises strip | Delivery, returns and secure payment above the sign-up, in the owner's words (*Home page → Words → Promises*), kept to the Delivery and Returns pages |
| Newsletter `JOIN` | Adds the address to the list the owner sees in the admin |
| Welcome pop-up | A first-time visitor to the home page is offered the mailing list in a pop-up beside the hero photo, a few seconds after landing (the owner sets the words, the wait — at once to a minute — or switches it off, under *Home page → Words*). Once per visitor: noted in the browser when it opens; asked again after 30 days if closed, never once joined (from it or from the form at the foot of the page). Only the visitor closes it — ×, NO THANKS or Escape; a tap on the page around it does nothing, since it arrives unasked and a tap meant for the page would close it unseen. Never over another panel, and never on a product page, where people came to buy. Joining from it lands on the same list as the form below |
| Footer | Three short groups. **Shop**: the drop, the Essentials, about MASQ., saved pieces — from a product page these go back to that part of the home page. **Help**: size guide, delivery, returns, FAQ, track an order, contact. **The small print**: terms of sale, privacy. Pages are as written in the admin and open in a panel that scrolls on a small phone |

Bag, saved list and currency persist in `localStorage`. The bag is checked
against the catalogue on every visit: pieces no longer on sale leave it, new
prices apply, and a quantity above what is left comes down, each with a
note. The delivery address is kept in memory only — not in `localStorage`
on a shared phone. Overlays trap focus, close on `Escape` or a tap outside them,
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

### Counting visits

The shop counts its own visits (`src/lib/analytics.js` in the browser,
`server/lib/analytics.js` on the server) instead of using Google Analytics, so
there is no cookie banner and nothing leaves the shop:

- **No cookies, nothing personal.** A visit is a random id kept for that tab
  only (sessionStorage), ending after 30 idle minutes. A visitor is a code
  made from their internet address and browser with a secret that is replaced
  every day and then overwritten — today's code cannot be linked to
  yesterday's, and the address itself is never stored. "Been here before" is
  a yes/no kept on the device.
- **Left out:** bots, the signed-in owner, admin pages, and browsers sending
  Global Privacy Control.
- **Kept:** detail for 90 days; after that only daily totals
  (`analytics_daily`). Orders keep the source and campaign of the visit that
  placed them, so sales by source last as long as the orders do.
- **Country** comes from the device's time zone (`server/lib/timezones.js`,
  from the tz database) — no lookup of anyone's address. The Nigeria map uses
  the delivery state on paid orders, which is exact.
- The same method as Plausible and Fathom; it counts someone on two devices,
  or on two days, twice.

### The preview pages

`npm run build:preview` builds the shop and admin as one page that runs on
its own, with sample data kept in the visitor's browser and a pretend payment
page in place of Paystack (`src/demo/`). It is the real front end — only
`src/lib/api.js` is swapped for `src/demo/api.js` — so a change to the shop
shows up in the preview the next time it is built. Output goes to
`dist-preview/shop` and `dist-preview/admin` (the same thing, opened at the
admin).

Only the shop build is published, as one link holding both shop and admin
(OPEN THE ADMIN / OPEN THE SHOP on its bar), so they share one set of sample
data. The old admin link shows a notice pointing to it (`tools/admin-moved.html`):
two links meant two separate sets of data, and a setting changed in one never
showed in the other. Sample data is kept per browser, so a phone and a laptop
each have their own.

### Tests

`npm test` runs the API tests (133) against an in-memory Postgres. To run the
same tests against a real server:

```bash
TEST_DATABASE_URL=postgres://user@host/throwaway_db npm test
```

It must be a database you do not mind losing — every test wipes it. Both
ways are worth running before a change to checkout or stock: the in-memory
one queues transactions, so only a real server shows whether two buyers
racing for the last jacket are handled.

`npm run test:e2e` runs the browser tests (36) with Playwright: a robot
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
  delivery. It stays closed until at least one area has a fee. While delivery
  abroad is off (Settings → Outside Nigeria), there is no country to choose:
  the address is in Nigeria, with its states as a list. Once it is on, a
  COUNTRY list appears: Nigeria first, every other country below. Each area's
  switch takes effect the moment it is flipped (one with no fee yet asks for
  it first); a changed fee is kept when SAVE DELIVERY is pressed, and the card
  says "not saved yet" until then.
  Abroad, the form also asks for a **postcode / ZIP** (optional — many
  countries have none; never asked for in Nigeria). It shows on the order in
  the admin and has its own column in the orders spreadsheet, for the courier.
- **Gift cards.** Sold at /gift-card (linked from the footer): ₦10,000,
  ₦25,000, ₦50,000, ₦100,000 or any whole amount from ₦5,000 to ₦500,000,
  in one of five colours (violet, night, teal, clay, rose), with an optional
  name, email and message for the person it is for. A card is its own
  Paystack payment (reference `gift-…`) and works only once Paystack confirms
  the amount; the buyer then sees its code (MASQ-XXXX-XXXX) and a link,
  /gift/MASQ-XXXX-XXXX, to copy or send on WhatsApp. The link opens the same
  card, in the same colour, for the person given it: their name, the message,
  then the card turns over to show the code and what is left (tries count
  against the same limit as codes at checkout). From that page, whoever holds
  a card can **add money to it** (a top-up, ₦5,000 or more, up to ₦500,000 on
  the card), or from "Top up a card" on /gift-card (also in the footer), by
  typing its code: its own Paystack payment (reference `gtop-…`), added once Paystack
  confirms the amount, after which the card lasts twelve months from that day.
  Paid after the card was cancelled, it shows in the admin as money to refund. It lasts twelve months and pays for pieces and
  delivery, after any discount code, in one order or several. What it pays is
  taken off the card when the order is placed and given back if that order is
  not paid (like held stock), or when it is marked refunded; Paystack is asked
  only for the rest, and a card that covers everything pays the order at once.
  A late payment after the card was spent elsewhere becomes "refund due".
  Emails with the code come with Brevo; until then the buyer sends it.
- **Free delivery, announcements, maintenance.** In Settings the owner can
  make delivery free over an amount (after any discount; the server decides,
  the bag shows how close the customer is), put a line across the top of the
  shop (news, good news or a warning; customers can close it), and close the
  shop for maintenance: customers see "We'll be back soon" and checkout and
  gift card payments are refused (503) until it is opened again; the owner,
  signed in, still sees the shop. Each delivery area can also have a number
  of days, which gives a paid order its estimated delivery dates.
- **What the customer is told after paying.** The order page says how it
  was paid ("Visa •••• 4242", "Bank transfer · GTBank", "Gift card", from
  Paystack's answer), the date, the items and the estimated delivery; a
  declined card shows the bank's reason. The first time, a panel says so too
  (Order placed!, Payment failed, Card declined, Payment pending).
- **Customer accounts** (`/account`, server/routes/account.js), once the
  shop can send email (DEPLOY.md, step 7; `MAIL_DRIVER` in server/lib/mail.js).
  Sign up with a name, email and password (8+, a letter and a number, with a
  strength meter), prove the email with a six-digit code (10 minutes, 5 tries,
  a new one after 45 seconds), then sign in (12 hours, or 30 days with
  Remember me). A forgotten password is reset by a link (30 minutes, once),
  which signs every browser out. The account shows the orders placed with its
  email — only once that email is proven, so nobody sees another's orders by
  signing up with their address — and fills in checkout. Profile: name,
  phone, birthday (16 or older), a photo (square, kept small, shown only to
  its owner). Security: change the password (other browsers signed out),
  two-step verification with an authenticator app (TOTP; the secret stored
  encrypted; a code works once), where it is signed in (sign any of them
  out), the last 30 things that happened, and deleting the account (orders
  stay in the shop's records). Ten wrong passwords or codes for one email
  lock it for 15 minutes; answers never say whether an email has an account
  (except sign-up, which must). Two minutes before a sign-in ends, the
  session warning offers to stay signed in.
  Addresses: up to ten, checked by checkout's own rules
  (server/lib/validate.js), one the default; at checkout they are offered
  with the default filled in, and a new one can be saved with a tick.
  Notifications: the mailing list on or off, sign-in alerts (an email when
  a browser not seen before signs in; on unless turned off), and the
  back-in-stock requests made with the account's email. Changing the email
  needs the password and a code sent to the new address; nothing moves until
  the code comes back, the old address is told, and orders, the list and
  back-in-stock requests follow it.
- **The shop's own order emails** (server/lib/receipts.js, server/lib/emails.js),
  once email is set up: the receipt from the owner's email design (desktop,
  phone and plain-text versions) when an order is paid — sent once, claimed in
  the database so the webhook and the order page cannot both send it — with
  Resend on the order page (45 seconds apart, five in all, only ever to the
  order's own email); and "on its way" with the courier and tracking when the
  owner marks it sent.
- **Action feedback** (the owner's board): Undo with its seconds in a ring and
  a "restored" message; Retry with Retrying… / Still having trouble / contact
  us after three misses; offer and tip messages shown once a visit; error
  details with Copy reference and Contact support.
- **The Journal** (`/journal`, src/pages/Journal.jsx, server/routes/journal.js):
  a front page, six topic pages and a story page from the owner's boards, with
  the stories in the database and a JOURNAL tab in the admin to write,
  schedule, hide, feature and give each a cover photo. Ten starter stories are
  put in once (src/data/journal.js); after that the admin is the Journal.
- **Banners from Settings.** The announcement can carry a button: to a page
  of the shop or a secure address, or opening longer details. Maintenance can
  close the shop or only show a notice across the top, now or at a planned
  time (said ahead, with a countdown on the last day; it switches on and off
  by itself).
- **Search** from the magnifier in the header: names, colours, sizes and the
  owner's descriptions of everything on sale.
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

Eight tabs, all usable on a phone — the row of tabs slides sideways, and the
open one is always in view. The admin is a separate file, fetched only when
someone opens it, so a shopper's phone never downloads it.

| Tab | What it does |
| --- | --- |
| **Orders** | Every order with the customer's name, phone (tap to call), address, items, any discount code, and total including delivery. `MARK SENT` asks for the courier and tracking number, which the customer then sees on their order page (and can be corrected later). `refunded?` records a refund made in Paystack, and can put the pieces back in stock. Filters by status. `DOWNLOAD CSV` for packing and dispatch |
| **Customers** | Everyone the shop knows, one line per email: people who bought, and people who have not yet — on the mailing list, waiting for a sold-out size, or a checkout they did not finish. Built from what the shop already holds, so there is nothing to type in. Each line shows where they are, paid orders, money spent (delivery included), last order, and whether they are on the list. Search by name, email, phone, city, tag or note; show only buyers, people not bought yet, the mailing list, bought in the last 90 days, spent over ₦100,000, waiting for a size, unfinished checkouts, or one tag. Open a line for their contact details and address, every order with what was in it, and what they are waiting for — and to keep your own **tags** (up to 10, e.g. VIP, stylist, wholesale) and **notes** (only you see them). **DOWNLOAD** saves it all as a spreadsheet. *They asked to be forgotten…* wipes a person (their right under Nigeria's Data Protection Act): name, phone, address, list sign-up, size requests, tags and notes go; their orders stay in the sales figures without a name. Not while an order of theirs is still being paid for or waiting to be sent. Checkout has a box (unticked) — *Email me about new drops and restocks* — that puts a buyer on the mailing list |
| **Visitors** | Today, 7, 30, 90 days or 12 months, each compared with the period before. Visitors, visits, conversion rate, money in and per visitor, bounce rate, time per visit, returning visitors; visitors over time; the shopping funnel (visited → viewed a piece → added to bag → checkout → payment → paid) with the drop at each step; sources and campaigns with the sales each brought; a tracked-link maker; pieces (views, adds, add rate, sold); pages; devices, systems and browsers (including in-app browsers like Instagram's); a world map of visitors by country; a Nigeria map of buyers by state; visits and orders by day and hour; goals; unfinished checkouts; repeat customers; who is on the site now. Every chart can be shown as a table |
| **Sales** | Money in by week (Monday to Sunday, Lagos time) for the last 12 weeks, average order, discounts given, best-selling pieces and sizes. Paid orders only. Discount codes: per cent or naira off the pieces (never the delivery), optional minimum spend, number of uses and end date; switch off or delete. **Gift cards**: every card bought in the shop or made here (a giveaway, a goodwill gesture, store credit for a return), with where it came from and a filter for each — code, amount, what is left, who it is for, use-by date, and the orders it paid for; copy a code; cancel a card; totals for cards sold, money still to spend on them, and cards working |
| **Products** | One card per product: name, price, badge (save with a button), and switches for on sale, in the drop grid, before `VIEW ALL`, in the carousel (save at once). Reorder with ↑ ↓. **Colours**: none for a piece in one colour; or name each (swatch, name, optional photo of its own). The first named takes over the counts already there and is the colour in the main photo; each after it starts at 0. Rename one, or remove it once its counts are 0 (the last one leaves the piece sold by size, counts kept). Sizes with their counts — per colour; add a size (it comes in every colour); remove one once its counts are 0 and nobody is paying for it. `+ NEW PRODUCT` takes its name, price, sizes and, if it comes in more than one, its colours; it starts off sale — add a photo and counts, then switch it on. Each card also has the product page's description and "details and care" — with **WRITE IT FOR ME** above them when the writing helper is switched on (below) — up to six more photos, and a link to see it on the shop. A **drop time** keeps a piece hidden and unbuyable until then |
| **Home page** | The wide photos (top of the page, craft band, countdown, film strip) — change or put back the original. An optional second photo at the top of the page: the two take turns with a slow fade, every 5, 8, 12 or 20 seconds or never (saved the moment it is chosen; one photo only on a device set to reduce motion, and paused while the tab is hidden). Every line of words on the home page. The menu: rename an item, or switch it off |
| **Stock** | Every colour and size of everything in one list, **read only** — nothing changes by a stray tap. It shows what is **on the shelf**, what is sold but **waiting to be sent**, what someone is **being paid for** right now, and what is **left to sell** (the shelf minus those two). Sold-out and low (3 or fewer) lines are marked; show one piece, or only what needs attention. Two ways to change it, each its own mode with **← BACK TO STOCK** at the top (it asks first if something was typed) and a save bar that stays at the foot of the screen however long the list: **RECEIVE A DELIVERY** — type only how many arrived on each line (with an optional note: the supplier, an invoice number); ADD TO STOCK adds them on top, all lines together. **COUNT THE SHELF** — after a stock-take, type what is really there for any line that is wrong (a piece lost, damaged, given away); SAVE ALL saves every changed line at once — all or nothing: a line counted below what is already sold is named and nothing is saved. **Recent changes** lists the last 100 (before → after, and whether it was a delivery, with its note, or a count); checkout's own changes are recorded by the orders. **DOWNLOAD** saves it as a spreadsheet. On a phone each line is a small card |
| **List** | Everyone who joined the mailing list (the footer, the welcome pop-up, or the box at checkout). Download as CSV into your email tool; remove someone who asks. Below it, everyone waiting for a sold-out size, grouped by piece and size, marked when that size is back — copy their emails, then clear it |
| **Settings** | Delivery fee per area (Lagos, Abuja, rest of Nigeria, abroad); footer pages, including the size guide; Instagram / TikTok / X links; the film link; the price-guide rates (naira for one dollar, pound, euro) |

The money figures (revenue, paid orders, to send, awaiting payment) sit at the top of
**Orders** only. Warnings that need acting on now — checkout closed (no delivery prices yet), a customer owed a refund — show on every tab; *running low* shows on Orders and Stock, and *people waiting for a size that is back* on Orders and List.

**Photos** are prepared in the owner's browser before upload: turned the right
way up, cropped from the centre to the 5:6 frame every product uses, and made
at 700 and 1,400 px wide as WebP (JPEG in Safari, which cannot write WebP). A
phone photo of several MB arrives as a few hundred KB. They are stored in
Postgres rather than on disk, because a free host wipes its disk at every
restart, and served with a year's cache — a new upload is a new address.
The home page's photos keep their own shape (the top one) or are cut to a
wide 3 : 1 strip (the two bands), at sizes to suit a large screen.

**Link previews.** A product link shared on WhatsApp, Instagram or X shows
that product's name, price, description and photo: the server writes them
into the page, because those apps read the page without running it. The
owner's words are escaped on the way in, so they can only ever be text. A
new photo at the top of the home page becomes the home page's preview too.

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

### Write it for me

On each product card, **WRITE IT FOR ME** takes a few notes from the owner
("heavy cotton, boxy fit, print from Gelede masks, wash cold") and has Claude
(Anthropic's model `claude-opus-5-5`) draft the description and "details and
care" in the MASQ. voice. The draft only fills the two boxes: it reaches the
shop when the owner has read it and pressed SAVE, and `undo` puts back what
was there.

- **Honest by instruction.** The brief sent with every draft
  (`server/lib/writer.js`) allows only facts from the notes and the card —
  no invented materials, places of making, care, stock or prices — and bans
  the usual sales words. The product's current words are sent along, so it
  can improve them rather than start over.
- **Off until there is a key.** `ANTHROPIC_API_KEY` in the server's settings
  (DEPLOY.md, step 6). Without it the button does not appear and nothing is
  ever sent. The key stays on the server; the browser never sees it.
- **Bounded cost.** One request per draft, a few US cents each at current
  prices; at most 40 drafts an hour, so a stuck page cannot run up a bill.
  The server logs the tokens each draft used.
- **Answers in JSON** (structured output), checked before it is used; a
  declined request is retried once on Anthropic's recommended stand-in model
  (`fallbacks: "default"`). Failures say what happened — a refused key, the
  service busy, a draft that came back unfinished — and never touch the card.
- The preview stands in with a sample made from the notes and says so; the
  browser tests point the server at a fake Anthropic (`e2e/fake-anthropic.js`)
  and the server tests stand in for its API, so neither costs anything.

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

A session lasts eight hours. Five minutes before it ends the admin asks
whether to stay signed in; STAY SIGNED IN (`POST /api/admin/renew`) gives a
fresh eight hours to a session that is still valid, but only up to a day after
the password was last typed (the session carries that time, signed, and a
renewal keeps it), so a copied cookie cannot be kept alive for ever. At the
end it says "Session expired" rather than letting a save fail. The password
boxes have an eye to show what was typed.

SIGN OUT signs out everywhere at once. The cookie is signed rather than stored,
so clearing it in one browser would leave any other copy (another phone, a
borrowed laptop, a stolen cookie) working until it expired; instead signing out
records the moment, and every session issued before it is refused.

`server/test/admin.test.js` is the proof: every admin route is checked to
refuse a caller with no session, a forged cookie, a tampered payload, an
expired session and one from before the last sign-out, and to refuse setting stock to anything that is not a whole
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

- **Sign in with Google or Apple**, and codes by SMS: each needs an outside
  account (Google, Apple, an SMS provider) first.
- **Saved cards** on the account: Paystack can charge a card again once it
  has been paid with, but a one-tap charge is a money path to build with care.
- **More order emails:** "delivered" and "refund made" (the receipt and "on
  its way" are done).
- **Courier booking.** Delivery is priced and the address collected; the
  parcel is booked with a courier by hand, using the orders spreadsheet.
- **International duties.** Abroad can be switched on with a flat fee; duties
  are not calculated.
- **Automatic emails** for the waiting list and the list: the owner copies
  the addresses out for now. Needs the same domain as our own emails.
- **Live currency rates.** The price-guide rates are typed in the admin.

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

Timing and curves follow Emil Kowalski's rules (`.claude/skills/`), kept in
one place: `src/lib/motion.js` and the matching `--ease-out` / `--ease-in-out`
variables in `src/styles.css`.

- **Everyday UI is quick:** panels, modals and the phone menu arrive in 0.28s
  on a curve that starts fast and settles softly, and leave in 0.18s. Button
  hovers take 0.2s. Only the home page's ceremonial moments (the hero photo,
  the title) keep the slow-starting curve, on purpose.
- **Pressed buttons give a little** (`scale(.97)`), so every tap is answered.
- **Cheap to draw:** the phone menu is revealed with a clip rather than grown,
  size buttons animate only their colours, and the photo zoom on hover is for
  a mouse only (a tap on a phone fires a false hover).
- **Reduce motion is respected everywhere:** `MotionConfig reducedMotion="user"`
  (`src/App.jsx`) keeps Framer Motion's fades and drops its movement; CSS
  transitions, the headline effect, the drifting photos and smooth scrolling
  are off too. A browser test checks the bag no longer slides in.

Framer Motion handles anything that needs to enter, leave, or be interrupted
halfway:

- `AnimatePresence` gives overlays and toasts real exit animations. The
  previous CSS version had to fake these with a class toggle and an
  `animationend` listener.
- `layout` on the product cards is what makes them glide when `VIEW ALL` adds
  four more, and what closes the gap when a bag line is removed.
- The drawer runs on a spring rather than a fixed duration, so opening and
  closing can interrupt each other cleanly.

Four more pieces of motion, each switched off for anyone whose device is set
to reduce motion:

| What | How | Where |
| --- | --- | --- |
| Smooth scrolling with a mouse wheel or trackpad | [Lenis](https://github.com/darkroomengineering/lenis) (about 5 KB). Phones keep their own scrolling. It pauses while a panel is open; panels scroll on their own (`data-lenis-prevent`) | `src/lib/smoothScroll.js` |
| A product photo glides from its card to the product page | The browser's own View Transitions — nothing to download. The router applies page changes at once (`useTransitions={false}`) so the browser can picture the new page | `src/lib/pageMorph.js` |
| Close-up and full-screen photos | Written here, no library. Uses the `@2x` copy; zoom stops at 2×, about as far as those files go before they blur | `src/components/ZoomViewer.jsx`, `Gallery` in `ProductPage.jsx` |
| The MASQ. letters rise in; the big photos drift as the page scrolls | [GSAP](https://gsap.com) with SplitText and ScrollTrigger, in its own file fetched only by the home page after it shows | `src/lib/drift.js` |

The title is hidden only until that file arrives, and shown after 1.5 s
whatever happens, so a slow connection never loses it.

CSS keeps every static style. Where Framer drives a property it also owns the
timing — a CSS `transition` on the same property fights it. Watch for that if
you add animation: anything Framer animates via `transform` will override a
CSS `transform` on the same element entirely, which is why the cart count
passes its own `y` offset.

## Design notes

A 1320px measure with a generous vertical rhythm (`--sec-y`) and portrait 5:6
product frames. Inter for the interface, EB Garamond for the editorial lines.

### Light and dark

Both, with a sun / moon switch in the header (in the menu on a phone, where
the bar is full) and in the admin's bar. Until someone chooses, the site
follows their device, and changes with it; once they choose, it is kept in
their browser (`masq:theme`). `public/theme.js` sets it before the page is
drawn, so it never flashes the wrong one — a file rather than inline script,
because the security policy allows scripts from the site only.

Every colour is a variable at the top of `src/styles.css`; the light theme
redefines them under `:root[data-theme="light"]`. Text colours are at least
4.5:1 on every ground in both. See-through colours are written as channels
(`rgb(var(--ink-rgb) / .2)`), so they follow too. Some parts look the same in
both themes, because they are shot and designed on black: the top of the home
page (the photo, and the menu while it sits over it), the "Craft. Culture.
Identity." band, the film strip, the full-screen photo view and the "Shown in …" label. Inside them the dark palette applies
(`:is(.hero, .craft, …)` at the end of `src/styles.css`). The admin's
charts have their own colours per theme, each checked with the dataviz
validator against that theme's card background.

No blur and no grain anywhere. Frosted panels and noise overlays soften every
edge underneath them, which on a near-black palette reads as haze rather than
atmosphere; overlays use solid fills. Micro-type sits at 11px (never smaller)
with tracking in the .13–.24em range — wider than that destroys word shapes at
these sizes. Sentences — notes, hints, errors, panel text — are 13px or more,
reading text 15–16px kept to about 62 characters a line, and every box you type
in is 16px on a phone so the phone does not zoom in when it is tapped.
Hairlines are `--line` at roughly 1.5:1 against the page, so structure is
actually visible.

Imagery is enlarged with **iterative back-projection** rather than a plain
resample. A resample can only interpolate, so past roughly 2x it turns to
mush; back-projection upscales, simulates the downscale that would have
produced the source, and feeds the residual back in — about +20% mean gradient
magnitude at 5x on these crops. On top of that: a fine unsharp pass for edges,
a wider one for local contrast, and a mild S-curve so form lifts out of the
shadows. The product photos were then rebuilt with Real-ESRGAN (x4plus), run
without PyTorch from a small numpy port of the network, from a quarter-size
copy up to the shipped widths: edges and printed marks come out crisp instead
of soft.

The big photo of the page you land on — the hero, or a product page's first
photo — is named in the page's HTML by the server (`<link rel="preload">`,
matching the `<img>`'s own `srcset`/`sizes` so it is not fetched twice), so it
starts downloading with the page instead of after the script. Places that
fill in once the shop's data arrives keep their room meanwhile, so nothing
below them jumps.

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
  reconstructed by mirroring the head across its axis). It was later rebuilt
  without the sharpening pass, which had turned the source's compression
  blotches into rough skin on the brow: brought back to its source size,
  enlarged with Real-ESRGAN, and toned towards the mockup's own low-key
  lighting (a brightness curve matched to the face and shirt in the mockup)
  so the face sits in shadow as designed;
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

The top of the home page is two campaign photos that take turns: Dayo in the
violet tee (`hero-design.webp`) and Ifeoma in the baby pink (`hero-design-2.webp`),
each with an `@2x` copy at the original 1672 px. Both were made in ChatGPT from
`design/PHOTO-PROMPTS.md` (AI-made models, shown as campaign photos only; each
shirt photographed on its own first so the print stays sharp), framed alike
before the same hand-dyed indigo adire cloth, so the fade changes only the person and the
colour. (Before them, the landing design's own hero, cleaned and enlarged with
Real-ESRGAN, sat there.) The craft band ("Craft. Culture. Identity.") is
the landing design's own band too (`band-design.webp`): the carved violet eyes at both
ends, its words taken out and enlarged four times the same way, with the design's mask
emblem cut out and sharpened (`src/assets/craft-emblem.webp`). The
header and footer wordmark is cut from `design/logo.png` (`src/assets/wordmark-*.webp`;
the light theme's copy has its cream M in ink).

`tools/build-assets.py` regenerates the rest of `public/assets/img/` from
the mockup (`python3 tools/build-assets.py path/to/mockup.webp`, needs Pillow
and numpy). It is a build tool, not part of the site — replace the files with
real product photography when it is available.

## Videos (Remotion)

`video/` holds MASQ. videos made in code with [Remotion](https://www.remotion.dev)
(a development tool: nothing of it reaches shoppers). `video/Film.jsx` is the brand
film: 41.5 seconds at 1920 × 1080, in a 2.39:1 cinema frame with grain, from the
logo, the product photos and the approved hero photo (sharpened copies in
`video/public/img`). Its score is original, made for the film by `video/score.py`
(`python3 video/score.py` writes a WAV; it is kept as `video/public/audio/score.mp3`),
so the owner holds it outright. `npm run video` renders the film to
`out/brand-film.mp4` (in a sandbox without a downloadable Chrome, add
`--browser-executable=<path to Chrome>`). The shop plays a web copy,
`public/assets/video/brand-film.mp4` (1600 wide, about 5 MB), made from that render
with `npx remotion ffmpeg -i out/brand-film.mp4 -vf scale=1600:-2:flags=lanczos
-c:v libx264 -crf 21 -preset slow -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart
public/assets/video/brand-film.mp4`; it is fetched only when someone presses play.
Remotion is free for individuals and small
companies; larger companies need its paid company licence.
