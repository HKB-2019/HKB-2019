# The redesign, agreed with the owner (17 Oct)

The pictures here are the owner's references.

**Built so far (18 Oct):** the new look across the shop and the admin in both
themes (stage A) and the home page (stage B): the wordmark, the hero as in the
landing design (its own picture, cleaned of its words and enlarged; the approved
photo is not used, at the owner's request), the violet craft band, the countdown in panels,
product panels with round arrows, the manifesto with OUR STORY, the film strip
playing the brand film, the Essentials as panels, the promises strip, the attached
JOIN box, the restyled pop-up. `DESIGN.md` is rewritten to this language.
**Still to build:** categories, collections and product details (C), the Shop and
category pages and the SHOP menu (D), the new product page (E).

| File | What it is |
|---|---|
| `landing-redesign.webp` | The new home page design, to follow |
| `hero-photo-approved.webp` | Not used: the owner chose the landing design's own hero instead (18 Oct). The approved hero photo (1672 × 941): enlarge to about 3200 wide, sharpening only the face, hair and print; crop a tall 4:5 version for phones unless the owner sends one |
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

## Three.js

Tried behind the hero on 17 Oct (symbols drifting in depth) and taken off at the
owner's request the same day. Three.js stays installed, unused.

## Decided, unless the owner says otherwise

- **Menu (18 Oct, the owner's choice):** SHOP, COLLECTIONS, ABOUT, JOURNAL. Until a
  journal exists, JOURNAL goes to the film strip; COLLECTIONS to the Essentials.
  Search stays out for now.
- **Collections and the other menu pages**: the owner supplied designs (below). Build
  from those; don't invent other pages.

## Shop, category and product pages (supplied 17 Oct)

| File | Page |
|---|---|
| `shop-all.webp` | Shop: all products |
| `category-tshirts.webp` | T-Shirts |
| `category-headwear.webp` | Headwear |
| `category-bags.webp` | Bags & Accessories |
| `category-outerwear.webp` | Outerwear (Hoodies, Jackets, Layered Pieces) |
| `menu-shop-dropdown.webp` | The SHOP ▾ menu, open |
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

**The SHOP ▾ menu (open):** a wide panel under the menu bar in four columns: SHOP BY
CATEGORY (T-Shirts, Headwear, Bags & Accessories, Outerwear, Accessories, each with a small
photo, a one-line description and →, then "Shop All Products"); FEATURED THIS SEASON (one
large product card); POPULAR PICKS (four small product cards with colour dots and quick add);
and a DROP 01 Urban Rituals panel with EXPLORE THE DROP → and "WEAR IDENTITY. LIVE CULTURE."
COLLECTIONS ▾ is expected to open the same way (its menu design not supplied yet; the
Collections pages themselves are below).

**Reassurance strip:** Fast Delivery (2–5 business days), Easy Returns (7-day return policy),
Secure Payment (100% secure checkout): under the hero in the menu design, and above the
footer on the Outerwear page. The Outerwear page's Drop 01 banner also carries the play
button and People / Places / Patterns / Purpose.

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

## Collections pages (supplied 18 Oct)

| File | Page |
|---|---|
| `collections-all.webp` | All Collections: the index of every collection |
| `collection-essentials.webp` | Essentials — "Everyday Expression." |
| `collection-limited-edition.webp` | Limited Edition — "Rare drops. Distinct stories." |
| `collection-collaborations.webp` | Collaborations — "Stronger Together." |
| `collection-archive.webp` | Archive — "Icons Live On." |

**What they share** (the category pages' layout, with a collection's own words):
1. A hero: breadcrumbs (Home › Collections › Essentials), a violet COLLECTION label, a
   two-line serif title with the second line or last word in violet, a short line, a
   paragraph, one violet button (SHOP ESSENTIALS →), a model photo on the right with
   brush words painted on the wall.
2. A row of panels under it: on All Collections, the collections themselves (All
   Collections, Essentials, Limited Edition, Collaborations, Archive, each with an icon
   and a line); on a collection, its categories (All, T-Shirts, Hoodies, Jackets, Caps,
   Bags, Accessories); the chosen one outlined in violet.
3. On a collection: the filter column (Category with counts, Price range, Colour, Size,
   Availability: In stock / Pre-order, Apply Filters, Reset) and the product grid
   (count, Sort by, heart, colour dots, a round + quick-add, LIMITED EDITION badge).
4. A story band at the foot (Essentials: "Designed For Every Day"; Limited: "More Than A
   Collection"; Collaborations: "MASQ. × Kòlẹ́ — Tradition Meets Tomorrow" with a film;
   Archive: "Stories That Shaped Us" with an archive film), then the promises strip and
   our footer.

**All Collections** has no filters: a grid of large collection tiles (photo, serif name,
product count, one line, round arrow): Essentials, Drop 01 — Urban Rituals, Limited
Edition, Collaborations, Archive, T-Shirts, Hoodies, Jackets, Caps & Headwear, Bags,
Accessories, and a NEW "View New Arrivals" tile.

**Collection specifics:**
- **Limited Edition:** a strip of four promises under the hero (Limited quantities,
  Fast delivery, Authenticity guaranteed, Premium packaging) and a LIMITED EDITION badge.
- **Collaborations:** a row of partner marks (MASQ. × Artifact, × Kòlẹ́, × Lagos to the
  World, × 042) and a Collaboration filter; product names carry the partner ("MASQ. × 042").
- **Archive:** a row of seasons with arrows (2024 Drop 01 Urban Rituals, 2023 Essentials,
  2022 Cultural Codes, 2021 Origins, 2020 Foundations) and a Season filter; names carry
  the year ("Rituals Bomber (2024)").

**What these need:** a Collection on each product (Essentials, Drop 01, Limited
Edition, Collaborations, Archive), a partner name for collaborations, a season/year for
the archive, a Limited flag, and per-collection words, photo and story band editable in
the admin, so each page is filled from the shop's real pieces.

**Ask the owner before building:**
- **Collaborations:** are Artifact, Kòlẹ́, Lagos to the World and 042 real partners? Only
  real ones go on the site; until then the page shows only what the owner adds.
- **Archive seasons 2020–2023:** only seasons that really happened. The archive fills
  from pieces the owner marks as archived.
- **Promises:** "2–5 business days", "7-day return policy", "Authenticity guaranteed",
  "Premium packaging" must match the shop's real terms (today: 1–3 / 3–5 working days,
  14-day returns).
- The **"Trusted by a global community"** faces appear here too: still left out until real.
- The many **pieces and photos** in the pictures appear once added in the admin.

## When it is built

Rewrite `DESIGN.md` to the new language (the owner's design wins over the old rules:
glows and violet light in photos, the colourful wordmark, brighter violet), update the
README, run `npm test` and `npm run test:e2e`, check both themes and 360px, republish
both previews.
