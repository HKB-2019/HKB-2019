# Admin design prompt (for ChatGPT)

For the owner to paste into ChatGPT to design the MASQ. admin. It lists
**everything the admin already does**, so nothing gets lost in the new design,
plus **the new screens** still to build. Send the messages one at a time, in
the same chat, and wait for each picture before sending the next. Upload the
finished boards here (`design/admin/`) and the admin is built from them.

Before message 1, attach two pictures so ChatGPT matches the shop's look:
`design/landing-redesign.webp` and `design/boards/action-feedback.webp`.

---

## Message 1: the brief and the look (send first, with the two pictures)

```
You are designing the admin (back office) for MASQ., a Nigerian streetwear
brand: "Urban Rituals — modern identity wear rooted in culture". The two
pictures attached are the shop's own design. The admin must feel like the same
brand, but calmer: it is a tool used every day by one owner, often on a phone.

LOOK
- Dark theme first: near-black ground #050407, panels one step lighter
  #0f0e14 with a soft 1px border #2a2833, bone-white text #f4f1eb, dim text
  #c2c0bc, faint text #8a8790. Corners 4px on panels and buttons.
- Accent: electric violet #5a2be0 for solid buttons, the chosen tab, chosen
  chips and toggles; light violet #9d85ff for links and labels.
- Status colours: green #3ccf74 (done, paid), amber (needs attention),
  red (problem, refund owed), blue (information).
- Type: Inter for everything (bold, tracked uppercase labels at 12px; numbers
  with even-width figures). EB Garamond serif only for big page titles.
- The colourful brush MASQ. wordmark (from the shop's header) top left, with
  the word ADMIN beside it.
- Also show a light version of one screen: warm paper ground #f6f3ee, white
  panels #fffdf9, near-black text #141217, violet ink #4a22c4.
- Money in naira (₦), dates like "16 Oct, 14:32", Lagos time.

LAYOUT
- Desktop 1440px wide: a left side menu, the page on the right.
- Phone 360px wide: the side menu becomes a bottom bar or a menu button;
  tables become stacked cards; save buttons stay stuck to the bottom.
- Every board: the MASQ. wordmark and a title at the top like the attached
  action-feedback board, numbered sections, desktop and phone side by side,
  a short note under each part saying what it does.

THE SIDE MENU (in this order)
Dashboard, Orders, Returns, Customers, Visitors, Sales, Products,
Collections, Stock, Home page, Journal, List, Settings. At the foot: the
owner's name, "View the shop ↗", Sign out, and a light/dark switch.

Reply "Ready" and wait for my next message. Don't draw anything yet.
```

## Message 2: Dashboard (new)

```
Board 1 — DASHBOARD, the first screen after signing in.
1. Greeting and date ("Good morning · Tue 21 Oct"), a period switch
   (Today / 7 days / 30 days / 12 months).
2. Four figure tiles, each with the change against the period before:
   Revenue, Paid orders, Orders to send, Awaiting payment.
3. "Needs you now" list, each line with a button that goes to the right place:
   checkout closed because delivery prices aren't set; a customer owed a
   refund; return requests waiting; people waiting for a size that's back in
   stock; pieces running low (3 or fewer); the shop is in maintenance.
4. Sales over the period (a simple line chart) and the best sellers (photo,
   name, units, money).
5. Visitors right now, visitors today, conversion rate, top source
   (e.g. Instagram).
6. Latest orders (5 lines: reference, name, items, total, status chip) with
   "See all orders →".
7. Drop status: the next drop time with a countdown, or "No drop scheduled".
8. Quick actions: + New product, Receive a delivery, New discount code,
   Make a gift card, New story.
Also draw the empty version (a new shop with no orders yet), and the
"shop is in maintenance" banner across the top of the admin with
"Open the shop" beside it.
```

## Message 3: Orders and Returns (Returns is new)

```
Board 2 — ORDERS and RETURNS.
ORDERS (exists today, keep all of it):
1. Status filter chips: All, Paid, Pending, Refund due, Refunded, Failed,
   Abandoned. Search by reference, name, email or phone. DOWNLOAD CSV.
2. Each order: reference (copy button), date, customer name, phone (tap to
   call), email, delivery address and area, items (photo, name, colour,
   size, quantity), discount code, gift card used, delivery fee, total,
   payment method and status chip.
3. Actions in the row: MARK SENT (asks for courier and tracking number;
   the customer then sees them), edit courier/tracking later, MARK REFUNDED
   (asks first, with a tick box "put the pieces back in stock"),
   resend receipt, open the customer's order page.
4. Order detail drawer with a timeline: placed, paid, receipt emailed,
   sent (courier, tracking), out for delivery, delivered, refunded.
5. A red banner when a customer paid after their order lapsed and the piece
   sold to someone else: "1 customer is owed a refund".
RETURNS (new):
6. List of return requests: reference, customer, items and reason
   (wrong size, damaged, not as pictured, changed mind), photos the customer
   sent, date, days left in the return window, status chip (Requested,
   Approved, Declined, Received, Refunded).
7. A request opened: approve or decline (with a message to the customer),
   mark the parcel received, choose refund to card (done in Paystack) or
   store credit (makes a gift card), put pieces back in stock.
8. Empty states: "No orders yet", "No return requests".
```

## Message 4: Products, Collections and Stock (Collections is new)

```
Board 3 — PRODUCTS, COLLECTIONS and STOCK.
PRODUCTS (exists today, keep all of it, add the new fields marked NEW):
1. A list of product cards (photo, name, price, on sale or not, stock left),
   reorder with up/down, "+ NEW PRODUCT".
2. One product open: name, price, badge (e.g. NEW, LIMITED), switches for
   On sale / In the drop grid / Before VIEW ALL / In the carousel,
   a drop time (hidden and unbuyable until then), up to 7 photos,
   colours (swatch, name, optional photo per colour; rename, remove when its
   counts are 0), sizes with counts per colour, description and
   "details and care" with a WRITE IT FOR ME button (AI writes it),
   a link to see it in the shop.
   NEW fields: Category (T-Shirts, Headwear, Bags, Outerwear, Accessories)
   and sub-category (e.g. Caps, Bucket Hats, Beanies; Backpacks, Crossbody,
   Tote), Collection (Drop 01, Essentials, Limited Edition, Collaborations,
   Archive), SKU, Materials, Size & fit, a NEW flag, Pre-order (can be
   ordered before it is in stock, with a ship date), "Complete the look"
   (pick 2–4 other products), partner name (for collaborations), season and
   year (for the archive).
COLLECTIONS (new):
3. Each collection: name, title and line for its page, the coloured word,
   photo, button words, the story band at the foot (title, text, photo or
   film link), on or off, order of the collections, and which products are in
   it (drag to reorder).
STOCK (exists today, keep all of it):
4. One read-only list of every colour and size: On the shelf, Waiting to be
   sent, Being paid for, Left to sell; sold-out and low lines marked; filter
   by piece or "needs attention"; DOWNLOAD.
5. RECEIVE A DELIVERY mode (type only how many arrived, optional note such
   as supplier or invoice, ADD TO STOCK) and COUNT THE SHELF mode (type what
   is really there, SAVE ALL, all or nothing). Both have "← BACK TO STOCK"
   and a save bar stuck to the bottom; "Leave without saving?" if something
   was typed.
6. Recent changes: the last 100 (before → after, delivery or count, note).
```

## Message 5: Customers, List, Sales, Discounts and Gift cards

```
Board 4 — CUSTOMERS, LIST and SALES (all exist today; keep everything).
CUSTOMERS:
1. One line per email: name, where they are, paid orders, money spent, last
   order, on the mailing list or not. Search; filters: buyers, not bought
   yet, mailing list, bought in the last 90 days, spent over ₦100,000,
   waiting for a size, unfinished checkouts, a tag. DOWNLOAD.
2. A customer open: contact details and address, every order and what was in
   it, what sizes they are waiting for, the owner's own tags (up to 10, e.g.
   VIP, stylist, wholesale) and private notes, and "They asked to be
   forgotten…" (wipes their details, keeps the sales figures).
LIST:
3. The mailing list (where each person signed up, date, remove, download)
   and "Waiting for a size", grouped by piece and size, marked when the size
   is back, with COPY EMAILS and clear.
SALES:
4. Money in by week for the last 12 weeks, average order, discounts given,
   best sellers, sizes sold, colours sold.
5. Discount codes: per cent or naira off (never the delivery), minimum
   spend, number of uses, end date, switch off, delete.
6. Gift cards: cards bought in the shop and cards made here (giveaway,
   goodwill, store credit for a return); code, amount, left to spend, who
   for, use-by date, orders it paid for; copy, cancel, MAKE CARD; totals.
```

## Message 6: Visitors

```
Board 5 — VISITORS (exists today; keep everything).
1. Period: Today, 7, 30, 90 days, 12 months, compared with the period before.
2. Figures: visitors, visits, conversion rate, money in, money per visitor,
   bounce rate, time per visit, returning visitors.
3. Visitors over time; the shopping funnel (visited → viewed a piece →
   added to bag → checkout → payment → paid) with the drop at each step.
4. Sources and campaigns with the sales each brought, and a tracked-link
   maker (pick Instagram/TikTok/WhatsApp, name the campaign, COPY).
5. Pieces (views, adds, add rate, sold); pages; devices, systems and browsers
   (including Instagram's in-app browser).
6. A world map of visitors by country and a Nigeria map of buyers by state.
7. Visits and orders by day and hour (a heat grid); goals; unfinished
   checkouts; repeat customers; who is on the site now.
8. Every chart can switch to a table. On a phone the tables scroll sideways
   with the first column fixed.
```

## Message 7: Home page, Journal and Settings (maintenance view is new)

```
Board 6 — HOME PAGE, JOURNAL and SETTINGS (exist today; keep everything).
HOME PAGE:
1. The wide photos (top of the page, a second top photo that takes turns
   every 5/8/12/20 seconds or never, craft band, countdown, film strip),
   each with CHANGE PHOTO and "put back the original"; every line of words
   on the home page; the menu (rename or switch off an item); the welcome
   pop-up words.
JOURNAL:
2. Stories list with LIVE / HIDDEN / SCHEDULED chips, NEW STORY; a story
   open: topic, title, summary, the story text, pull quote, author, publish
   date (schedule), featured and editor's pick switches, cover photo,
   DELETE STORY (asks first).
SETTINGS:
3. Delivery fee per area (Lagos, Abuja, rest of Nigeria, abroad) and
   delivery days; free delivery over an amount; announcement bar (words,
   button to a page, or details); maintenance (close the shop now or at a
   planned time, or only a notice bar; countdown on the last day); footer
   pages (Shipping, Returns, Contact, Privacy, Terms, size guide);
   Instagram / TikTok / X links; the brand film link; price-guide rates
   (naira for one dollar, pound, euro).
4. NEW: the maintenance view — what the admin looks like while the shop is
   closed: a banner on every page ("The shop is closed for maintenance until
   Thu 23 Oct, 09:00"), a preview of what customers see, and OPEN THE SHOP.
```

## Message 8: Sign-in, warnings and states

```
Board 7 — SIGN-IN AND STATES (exist today; restyle).
1. First-time setup (one-time code from the server log, then set a password)
   and sign-in with a show-password eye.
2. "Your session ends in 2:00" warning with a countdown that turns amber in
   the last minute and red in the last 10 seconds, and "Stay signed in";
   "Session expired" with Sign in again.
3. "Leave without saving?" box; saved / couldn't save messages with Retry;
   loading skeletons for a table and a card; an error box with
   "View details" (reference, time, Copy) and Contact support.
4. Empty states for every page (no orders, no customers, no stories,
   no discount codes, no gift cards, nobody on the list).
```
