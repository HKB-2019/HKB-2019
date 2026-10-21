# MASQ. — what's left, what's on your side, and every screen

**Shop preview (with the admin inside):** https://claude.ai/artifact/C7GwTxuGrFtSpHnCw5n6yF

Kept up to date with the project. Plain steps; the detailed how-to for
setting things up is in `DEPLOY.md`.

> **Don't forget:** pick the pictures from the film boards so we can write the
> **Seedance 2.5** prompt for the brand film on **Google Flow** (item 15).

---

## 1. Your to-do list

### To put the shop online (needed for real customers)

1. **Database: Neon** (free). Make the account and copy its connection string (DEPLOY.md, step 1).
2. **Hosting: Render** (free to start). Connect the GitHub repository and paste the Neon string (step 2).
3. **Your admin password.** Use the one-time code from Render's log to set it (step 3).
4. **Paystack.**
   - Finish Paystack's business checks so you can take real money (they ask for business details, ID and the bank account for payouts).
   - Test first: paste the **test** secret key into Render and set the webhook address (step 5). Buy something with a test card.
   - Then switch to the **live** key and the live webhook address.
5. **Before your first sale, in the admin** (step 4):
   - delivery prices;
   - contact details;
   - Privacy, Terms of sale and size guide pages;
   - social links;
   - price-guide rates;
   - check every product's price, photos, sizes and counts.
6. **Your web address.**
   - Buy the domain. The brand boards say **masq.world**, but the shop's contact page says studio@masq.ng, so decide which.
   - Point it at Render (Render → Settings → Custom domains).
   - Then add `PUBLIC_URL` (e.g. `https://masq.world`) in Render, so links in emails use it.
7. **Email: Brevo** (free, 300 a day). Set up the account, verify your sender address (best on your own domain), then add `BREVO_API_KEY` and `MAIL_FROM` in Render (step 7). This one step switches on:
   - customer accounts;
   - receipt emails;
   - "on its way" emails;
   - sign-in alerts;
   - all the account codes and links.
8. **When the shop earns:** move Render to the paid plan (about $7 a month) so the shop never falls asleep.

### Optional extras (the shop works without them)

9. **"Write it for me"** in the admin. A button on each product in admin → Products that writes the product's description for you. It needs an Anthropic key in Render (DEPLOY.md, step 6) and costs a few cents per description. Skip it and you type descriptions yourself.

### Pictures and words only you can give

10. **Product photos** for every piece and every colour, plus real descriptions. The shop uses sample photos today.
11. **Home page photos: nothing to do.** The home page already uses the photos you chose (Dayo and Ifeoma at the top, Ifeoma in the patterned hood for the countdown, the carved violet eyes in the craft band). Change them in admin → Home page only if you want to.
12. **The Journal.**
    - Read the 10 starter stories I wrote (admin → Journal). Check the facts and the voice; change or hide anything.
    - Give each story a real cover photo; they use the shop's photos for now.
    - People & Creatives needs real people. Lifestyle & Community needs real events. I won't invent either.
    - Photos for the top of each Journal page. Today they reuse the shop's pictures.
    - **About page photos** (the hooded man at the top, the hoodie, the jacket, the three craft / culture / community tiles, the vision background). It uses the shop's pictures for now.
13. **The receipt email's top picture: done.** It uses the bag from your email design. Send a sharper one later if you like.
14. **The 3D empty-state pictures: done.** The bag, heart, magnifier and box are cut from your empty-states board and show on the empty bag, saved, search and orders screens. Send sharper ones later if you like.
15. **The brand film: select the pictures.** Go through the film boards (`design/film/README.md`): Film 01 "Worn, Not Spoken", the Ori One reel, and the two posters. Pick the pictures that go in, and we'll write a **Seedance 2.5** prompt for video generation on **Google Flow**. When the film is made, put its link in admin → Settings, and it plays on the home page.
16. **Brand decisions** (`design/brand/README.md`). The brand boards differ from the shop on:
    - fonts: Rift Bold needs a paid licence; Clash Grotesk is free;
    - the exact purple;
    - the four collections (Ori, Egungun, Code, Neo Masq);
    - the contact email (hello@masq.world or studio@masq.ng);
    - the founding year.

    Tell me which way each goes.
17. **Kling credits for the banner photos.** You chose to have the Journal and About banner photos cleaned up with Kling (the words printed on them removed, made sharp). Your Kling account has 0 credits today, so top it up first; I'll tell you the cost before using any.
18. **Admin designs from ChatGPT.** Paste the eight messages in `design/ADMIN-PROMPT.md` into ChatGPT, one at a time, and send me the boards. The prompt lists everything the admin already does, so nothing is lost, plus the new screens (dashboard, returns, collections, maintenance view).
19. **Ori One (the shoe).** If it's going on sale, I need photos, sizes, price and stock. Or say "coming soon" and I'll add a waiting list.

### Accounts needed for features not built yet (only when you want them)

20. **Sign in with Google:** a Google Cloud project and an OAuth client ID.
21. **Sign in with Apple:** an Apple Developer account ($99 a year).
22. **Codes by text message:** an SMS company (e.g. Termii) and an approved sender name.
23. **Address search while typing** (optional), from your inline-feedback board, section 14. At checkout and in saved addresses, the customer types a few letters ("Allen Av") and picks the full address from a list, so fewer addresses are mistyped for the courier. It needs a Google Places key with billing on; Google charges per search after a free monthly allowance. The shop works without it: customers type the address themselves.
24. **Saved cards:** just your go-ahead. Paystack supports it, but it's a money path to build carefully.
25. **Courier booking from the admin** (optional): an account with a courier that has an API (e.g. GIG, Sendbox).
26. **Live currency rates** (optional): an exchange-rate service key. Today you type the rates in.

### Business and legal

27. Have a lawyer read the **Terms of sale**, **Privacy** and **Returns** pages. Nigeria's data protection law (NDPA 2023) applies to customer data.
28. Keep Paystack's compliance documents up to date.

---

## 2. Still to build, and the designs I need from you

**Built from your boards since the last list:**
- Action feedback (Undo, Retry, Dismiss, View details, Receipt sent).
- The receipt email, plus an "on its way" email.
- The whole Journal: home, six topics, story page and an admin tab.
- The About page.
- Saved addresses, notification settings and change email.

**Waiting on you (see section 1):**
- Google, Apple and SMS sign-in.
- Saved cards.
- Address search.

**Pages left to build.** Everything still to make, shop and admin. "Design in hand" means your design is in `design/` (sent 17 and 18 Oct; details in `design/REDESIGN.md`); "Design needed" means I need a design from you first.

*Shop pages (design in hand):*
- **Shop: all products**, with the filter column, sort, page numbers and the SHOP ▾ menu.
- **Category pages:** T-Shirts, Headwear, Bags & Accessories, Accessories and Outerwear.
- **Outerwear.** I kept the first Outerwear design and marked the new one as replacing it. Compared with the first one, the new version:
  - has photos in the sub-category panels;
  - uses a round bag button for quick add;
  - adds page numbers;
  - drops the play button and the promises strip.
- **Collection pages:** All Collections, Drop 01 Urban Rituals, Essentials, Limited Edition, Collaborations and Archive, with the COLLECTIONS ▾ menu.
- **The redesigned product page.**
- **Empty states for these pages:** "No products match these filters", "No items in this category" and "No saved searches".

*Admin screens (design needed: you make them with the prompt in `design/ADMIN-PROMPT.md`, item 18):*
- **A dashboard home:** the first screen after signing in, with the day's sales, orders to send, low stock and visitors at a glance. Today the admin opens on Orders, with the money strip on top.
- **A returns and refunds screen:** see return requests, approve or decline them, and mark the refund made. Today there is only MARK REFUNDED on an order.
- **A "your shop is in maintenance" view:** what you see in the admin while the shop is closed. Today it's a switch in Settings and a note on the shop.
- **What the shop pages above need in the admin:** categories and sub-categories, collections, SKU, materials, size & fit, a NEW flag, pre-order, "Complete the look" picks, a partner name for collaborations and a season for the archive, plus each collection's words, photo and story band. I'll build these with the shop pages, in the admin's current style, unless you send a design.

*Customer orders and returns (design needed):*
- **Order statuses "Out for delivery" and "Delivered"** on the order page. Today it stops at "On its way".
- **Returns:** request a return, choose items and a reason, then "return requested", "approved" or "declined".
- **Reviews** on the product page and a "write a review" form, only if you want real reviews.

*Emails (design needed, or I follow the receipt email's design):*
- **Delivered.**
- **Refund made.**
- **Back in stock**, for the waiting list.
- **Gift card received**, for the person given the card.

*Site-wide (design needed):*
- **A 404 "page not found" page.** Today an unknown address shows the home page.
- **A cookie notice.** Not legally required while the shop sets no tracking cookies, but useful if you add ads later.

**Things to confirm for those pages:**
1. Outerwear title: "Layer Your Identity" or "MASQ. Your Identity"? I'll use "Layer Your Identity" unless you say otherwise.
2. Drop 01 button: the design reads "SHOP THE COLLECTIAR", which looks like a typo. I'll write "SHOP THE COLLECTION".
3. New products: the bottle, sunglasses, lanyard, socks, card wallet and the Harrington, windbreaker, varsity, anorak and padded vest jackets will show once you add them in the admin. The pages are built to hold them.

**Questions still open from last time:**
- **Collaboration partners:** are Artifact, Kòlẹ́, Lagos to the World and 042 real partners? Only real ones go on the site.
- **Archive seasons:** did the 2020–2023 seasons (Foundations, Origins, Cultural Codes, Essentials) really happen? Only real ones are shown.
- **Delivery and returns wording:** the designs say "2–5 business days" and "7-day return policy"; the shop today says 1–3 / 3–5 working days and 14-day returns. Which is right? Also "Authenticity guaranteed" and "Premium packaging" on Limited Edition.
- **Customer faces** ("Trusted by a global community"): left out until there are real customers who agree to be shown.
- **Reviews and stars:** build real reviews, or leave the stars out?

---

## 3. Every screen that's built

Everything below works in the preview link with sample data. The **Needs**
column says what has to be set up before real customers see it on the live
shop.

### Shop

| Screen | Needs |
|---|---|
| Home: two top photos taking turns, craft band, the drop with quick add, drop countdown, manifesto, film strip, the Essentials, sign-up | Countdown only when a piece has a future drop time; film needs its link |
| Welcome pop-up with sign-up | — |
| Announcement bar (with button or details) | You switch it on in Settings |
| Maintenance: notice bar, planned countdown, "closed" page | You switch it on in Settings |
| Product page: photos, zoom, colours, sizes, size guide, low stock, sold out, "Tell me when it's back" | — |
| Bag, remove confirmation, added-to-bag panel (and low-stock version), out-of-stock message | — |
| Saved pieces | — |
| Search, with no-results state | — |
| Track an order | — |
| Footer pages: FAQ, Shipping, Returns, Contact, Privacy, Size guide, Terms | — |
| Checkout: steps, delivery details, saved addresses, discount code, gift card, "processing" screen | Paystack keys to pay for real |
| Paystack's own payment page | Paystack keys |
| Order page: paid, being prepared, on its way with tracking, pending, failed, declined (with the bank's reason), cancelled, refunded, paid-after-sold-out | Paystack keys |
| Order page: receipt sent / resend / couldn't send | Brevo |
| Gift cards: buy (amount, colours, message), paid card with link, top up, the recipient's page | Paystack keys |
| Journal: home, six topic pages, story page, story not found | — |
| About: story, purpose, inspiration, craft / culture / community, vision, values, sign-up | Your photos |
| Error page when something breaks; offline message | — |
| Messages (toasts): done, problem, warning, news, offer, tip, Undo with countdown, Retry | — |

### Customer accounts (all need Brevo before they appear on the live shop)

| Screen | Needs |
|---|---|
| Sign in, two-step code, sign up with the Terms, prove the email with a code, forgot password, new password | Brevo |
| Overview, orders, profile with photo upload, change email | Brevo |
| Addresses (add, edit, default, remove) | Brevo |
| Security: password, two-step setup and turning it off, where you're signed in, recent activity, delete account | Brevo |
| Notifications: mailing list, sign-in alerts, back-in-stock requests | Brevo |
| Sign-out confirmation, "your session is about to end" warning | Brevo |

### Emails (can only be seen once Brevo is set up)

| Email | When |
|---|---|
| Six-digit code | Signing up |
| Password reset link | "Forgot password" |
| Code to a new email, and a notice to the old one | Changing email |
| New sign-in alert | A browser the account hasn't used signs in |
| **Receipt** (your email design) | An order is paid; the customer can resend it |
| **On its way**, with courier and tracking | You mark an order sent |

Paystack also sends its own receipt to the customer and a payment notice to you.

### Admin

| Screen | Needs |
|---|---|
| First-time setup and sign in; "session is about to end" warning | — |
| Orders: list, details, mark sent with tracking, mark refunded | — |
| Customers | — |
| Visitors (where people come from, what they look at) | — |
| Sales | — |
| Products: edit, photos, colours, sizes, drop time, "Write it for me" | Write it for me needs the Anthropic key |
| Home page: photos and words | — |
| Journal: write, schedule, hide, feature, cover photo, delete | — |
| Stock: counts, receive a delivery, history, download | — |
| List: mailing list and waiting list | — |
| Settings: delivery, free delivery, discount codes, gift cards, announcement, maintenance, footer pages, social links, price-guide rates, film link | — |
