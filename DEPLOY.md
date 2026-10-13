# Putting MASQ. online for free

Two free accounts, about twenty minutes, all in the browser. No card, no
computer needed — a phone will do.

- **Neon** keeps your orders, customers and stock.
- **Render** runs the shop and gives it a web address.

Neither should ask for a card. If one does, stop there and ask before going
further.

---

## 1. The database — Neon

1. Go to **neon.tech** and sign up. Signing in with GitHub is quickest.
2. Create a project.
   - **Name:** `masq`
   - **Region:** *AWS Europe Central 1 (Frankfurt)*. This matters: the shop
     will run in Frankfurt too, and a database on another continent makes every
     page slow.
3. On the project dashboard, find **Connect** (or *Connection string*).
   - Turn **Connection pooling** on.
   - Copy the string. It starts with `postgresql://` and has `-pooler` and
     `sslmode=require` in it.

Keep that string somewhere private for step 2. It is the key to your
database: never post it anywhere or put it in the code.

---

## 2. The shop — Render

1. Go to **render.com** and sign up **with GitHub**, so Render can see the
   repository.
2. Choose **New → Blueprint**.
3. Pick the **HKB-2019** repository. Render finds the `render.yaml` file in it
   and shows one service called `masq`, on the Free plan.
4. It asks for three values:

   | Box | What to put |
   | --- | --- |
   | `DATABASE_URL` | the Neon string from step 1. Required — the shop will not start without it. |
   | `PAYSTACK_SECRET_KEY` | your Paystack **test** secret key (starts `sk_test_`). No keys yet? Leave it blank — the shop and admin work without it; only checkout waits. |
   | `ADMIN_PASSWORD_HASH` | leave blank |

5. Choose **Apply**. The first build takes a few minutes.

When it says **Live**, your address is at the top of the page — something
like `https://masq-ab12.onrender.com`. Open it: that is your shop.

---

## 3. Your admin password

1. In Render, open the `masq` service and choose **Logs**.
2. Look for this box:

   ```
   ┌──────────────────────────────────────────────────────────┐
   │  No admin password yet. Open /admin and enter this code: │
   │      a1B2c3D4e5F6   ← yours will be different            │
   │  It works once, and a new one appears after a restart.   │
   └──────────────────────────────────────────────────────────┘
   ```

3. Open your address with `/admin` on the end, e.g.
   `https://masq-ab12.onrender.com/admin`.
4. Enter the code, choose a password of at least 12 characters, and you are
   in.

Only you can see Render's logs, so only you can see the code. Anyone who
finds `/admin` before you have done this still cannot claim it.

---

## 4. Before your first sale

Everything below is in the admin — no code.

1. **Set delivery prices.** *Settings → Delivery.* Switch on the areas you
   deliver to and type a fee for each. Until at least one is on, the shop
   shows "Checkout opens soon" and takes no orders. This is on purpose: a
   default fee of ₦0 would give delivery away.
2. **Replace the contact details.** *Settings → Footer pages → Contact.* The
   phone number and address there came with the design and are not real. The
   admin shows a warning until they change.
3. **Read the Privacy page.** It says what the shop collects (name, email,
   phone, address) and why, as the code actually does it. Change it if your
   practice is different.
4. **Add your social links** and, when you have it, the film link.
5. **Check your products.** *Products.* Prices, names, photos, sizes, counts.
   To use your own photos, choose **Change photo** — any phone photo works;
   it is cropped and shrunk before it uploads.
   Write a description for each — it shows on the product's own page, and
   in the preview when someone shares the link on WhatsApp.
6. **Make the home page yours.** *Home page.* Your own photos for the top of
   the page and the two bands, and every line of words. The menu names
   COLLECTIONS and JOURNAL came with the design: rename them, or switch them
   off.
7. **Read the size guide.** *Settings → Footer pages → Size guide.* It is
   linked from every product page and only says the pieces run true to size.
   Add your measurements.
8. **Read the Terms of sale.** *Settings → Footer pages → Terms of sale.*
   It describes how the shop works (naira prices, Paystack, codes, refunds).
   Check it matches how you run things.
9. **Set the price-guide rates.** *Settings → Price guide.* How many naira
   make one dollar, pound and euro, for customers who view prices in those.
10. **Use tracked links.** *Visitors → Make a tracked link.* Put these in
   your Instagram bio, stories and WhatsApp broadcasts, so the Visitors tab
   can tell you which post brought which sales.

---

## 5. Connecting Paystack (when you have test keys)

1. In Paystack: **Settings → API Keys & Webhooks**, test mode.
2. Copy the **Test Secret Key** into Render: service → **Environment** →
   `PAYSTACK_SECRET_KEY` → save. Render restarts the shop by itself.
3. In the same Paystack page, set **Test Webhook URL** to your address plus
   `/api/paystack/webhook`, e.g.
   `https://masq-ab12.onrender.com/api/paystack/webhook`.

Then buy something from your own shop with one of Paystack's test cards, and
watch the order appear in the admin with the name and address you typed.

When a payment goes through, Paystack emails the customer a receipt and you
a notice. The shop does not send its own emails yet.

You do not need to set a callback URL — the shop works out its own address.

---

## What free costs you

**It falls asleep.** After about fifteen minutes with no visitors, Render
pauses the shop. The next visitor waits up to a minute while it wakes. Nothing
is lost; it is just slow to answer that first time.

**Paystack may knock while it is asleep.** When a payment goes through,
Paystack tells your shop straight away. If the shop is asleep, that message
can be missed. Three things make sure it does not cost you an order:

- when the customer lands back on your shop, it asks Paystack directly;
- Paystack tries again later;
- every few minutes while it is awake, and every time it wakes up, the shop
  checks every unfinished order with Paystack itself.

**Space.** Neon's free tier holds far more orders than a first drop will make.

When the shop is earning, Render's paid plan ($7/month) keeps it awake. It is
one setting to change; nothing else moves.

---

## If something goes wrong

**The log says `DATABASE_URL is not set`.** The database box was left empty
in step 2. In Render: service → **Environment** → add `DATABASE_URL` with the
Neon string → save. It restarts by itself.

**Forgot the admin password.** In Neon, open the **SQL Editor** and run:

```sql
DELETE FROM settings WHERE key = 'admin_password_hash';
```

Then in Render choose **Manual Deploy → Restart service**. A new setup code
appears in the logs; go back to step 3.

**Checkout says it could not reach the payment provider.** The Paystack key
is missing or wrong. Check `PAYSTACK_SECRET_KEY` in Render's Environment tab
— it must start `sk_test_` (or `sk_live_` once you go live).

**A customer is marked "refund due".** They paid after their order had timed
out, and the last one had already sold to someone else. The admin shows a red
line at the top when this happens. Refund them from the Paystack dashboard,
then press **refunded?** on the order so the shop's figures match. It should
be rare.

**Giving someone their money back.** The shop cannot move money itself.
Refund in the Paystack dashboard, then press **refunded?** on the order in
*Orders*. If the piece never left, keep "put the pieces back in stock" ticked.

**A discount code is not working for a customer.** *Sales → Discount codes*
says whether it is live, ended, switched off or used up. Codes take money
off the pieces only, so an order below its minimum spend before delivery is
refused, and the bag says why.

**Customers say checkout is closed.** No delivery area is switched on.
*Settings → Delivery*.

**A photo will not upload.** It must be a JPEG, PNG or WebP. On an iPhone,
photos are converted automatically when you choose them.

**The build failed.** Open **Events** in Render, then the failed deploy, and
send the last twenty lines of its log.

**Pull requests from Dependabot.** Once a week GitHub checks whether any of
the shop's building blocks has an update, and opens a pull request for it.
The tests run on it automatically. A green tick means it is safe to merge;
until someone merges it, nothing on the live shop changes.

**A red cross next to a commit on GitHub.** The automatic tests found
something broken in that change. Send me the link.
