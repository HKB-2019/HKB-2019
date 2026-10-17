# The redesign, agreed with the owner (17 Oct)

Not built yet; to be built in the next session. The pictures here are the
owner's references.

| File | What it is |
|---|---|
| `landing-redesign.webp` | The new home page design, to follow |
| `hero-photo-approved.webp` | The approved hero photo (1672 × 941): enlarge to about 3200 wide, sharpening only the face, hair and print; crop a tall 4:5 version for phones unless the owner sends one |
| `logo.png` | The MASQ. logo: mask, ring text, wordmark, symbol row |
| `gift-card-design.webp` | The gift card design already built (kept as it is) |

## Take from the new design

- The colourful brush **MASQ.** wordmark (from the logo) in the header and footer.
- A brighter, electric **violet** accent for buttons, labels and links.
- **Hero:** a big bold MASQ. title, serif subtitle, short body text, two buttons
  (SHOP DROP 01 → solid violet, EXPLORE → outline), the approved photo on the right,
  and "WEAR IDENTITY LIVE CULTURE" as live text in a brush style (not baked into the photo).
- **Craft band:** shorter, carved violet relief art on both sides, a small emblem.
- **Product cards:** each in its own panel; name, price below, colour dots, round → button.
- **Manifesto:** left-aligned, "symbols." in violet (not italic), OUR STORY → on the right.
- **Film band:** outlined play button, PLAY BRAND FILM, "People / Places / Patterns / Purpose" on the left.
- **The Essentials:** five panels in a row instead of the carousel.
- Bold, tracked uppercase section titles.

## Keep, as the owner asked

- **The countdown**, restyled in the new design language.
- **The sign-up pop-up**, restyled, with the new email box: an outlined field with the violet JOIN button attached.
- **Our footer** (columns, gift card links), with the new wordmark and colours.
- **Light and dark themes**, both in the new design language, with the switch in the menu.
- **The admin**: same new design language (colours, type, buttons, text style), and everything in it stays as it is.
- Every library and effect we have: Lenis smooth scroll, GSAP headline and scroll effects,
  Framer Motion, View Transitions, photo zoom, reduced motion respected.
- Saved pieces, gift cards, the admin-editable home page, phones at 360px.

## Decided, unless the owner says otherwise

- **Search and Journal**: left out for now; the menu keeps the pages that work.
- **Collections and the other menu pages**: the owner supplied designs (below). Build
  from those; don't invent other pages.

## Shop, category and product pages (supplied 17 Oct)

| File | Page |
|---|---|
| `shop-all.webp` | Shop: all products |
| `category-tshirts.webp` | T-Shirts |
| `category-headwear.webp` | Headwear |
| `category-bags.webp` | Bags & Accessories |
| `product-page.webp` | A product (The Face Tee) |

**Category pages share one layout:**
1. A hero with a label (SHOP, T-SHIRTS…), a two-line serif headline with one violet word
   ("Wear Identity. Live **Culture.**", "More Than A **Cap.**", "Carry Your **Culture.**"),
   a short line, a violet button, the photo on the right, and the brush "WEAR IDENTITY LIVE CULTURE".
2. A row of sub-category panels (All / T-Shirts / Headwear… or All Headwear / Caps / Bucket
   Hats / Beanies), the chosen one outlined in violet, each with a → button.
3. A filter column on the left: Category (with counts), Price range slider, Colour,
   Size, Availability (In stock / Pre-order), Collection, Apply Filters and Reset.
4. A grid of product panels with a count ("24 PRODUCTS"), Sort by, NEW badge, a heart
   (saved), colour dots, a quick-add bag button, and page numbers.
5. A "DROP 01 Urban Rituals" banner with EXPLORE THE COLLECTION →.
6. The footer (ours stays, as agreed).

**Product page:** breadcrumbs; thumbnails on the left, a large photo with arrows and a
full-screen button; category label, name, price, SKU; colour by name ("Color: Royal Violet")
with swatches; size buttons and Size Guide; stock line; quantity with − / +; Add to Cart and
Buy Now; three reassurance lines (delivery, returns, secure payment); a "See it closer" video
panel; tabs (Description, Materials, Size & Fit, Shipping, Returns) with a ticked list;
"Complete the Look" and "You Might Also Like" rows.

**What these need that the shop doesn't have yet:**
- **Categories and sub-categories** on products, chosen in the admin (T-Shirts: Graphic,
  Essential, Limited Edition; Headwear: Caps, Bucket Hats, Beanies; Bags: Backpacks,
  Crossbody, Tote; Accessories; Outerwear), and a **Collection** (Drop 01, Essentials, Limited Edition).
- **Filters** worked by the server or the page: price, colour, size, in stock, pre-order.
- **Pre-order**: a product that can be ordered before it is in stock.
- **SKU**, **materials**, **size & fit** text per product, edited in the admin.
- A **"New"** flag, and **"Complete the look"** picks per product.

**Ask the owner before building:**
- **Reviews and stars** ("4.8 (128 reviews)"): only real ones. Build a reviews feature, or leave the stars out.
- **"Fast delivery 2–5 business days", "7-day return policy"**: must match the shop's real terms.
- The many **new products** in the pictures (bucket hats, beanies, totes, duffle, tees…): they
  appear once the owner adds them in the admin; the pages are built to hold them.
- The **"Trusted by a global community"** faces appear on these pages too: still left out until real.
- **"Trusted by a global community" with four faces**: left out until there are real customers to show.

## When it is built

Rewrite `DESIGN.md` to the new language (the owner's design wins over the old rules:
glows and violet light in photos, the colourful wordmark, brighter violet), update the
README, run `npm test` and `npm run test:e2e`, check both themes and 360px, republish
both previews.
