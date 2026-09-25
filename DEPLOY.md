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
   | `DATABASE_URL` | the Neon string from step 1 |
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

## 4. Connecting Paystack (when you have test keys)

1. In Paystack: **Settings → API Keys & Webhooks**, test mode.
2. Copy the **Test Secret Key** into Render: service → **Environment** →
   `PAYSTACK_SECRET_KEY` → save. Render restarts the shop by itself.
3. In the same Paystack page, set **Test Webhook URL** to your address plus
   `/api/paystack/webhook`, e.g.
   `https://masq-ab12.onrender.com/api/paystack/webhook`.

Then buy something from your own shop with one of Paystack's test cards, and
watch the order appear in the admin.

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
line at the top when this happens. Refund them from the Paystack dashboard.
It should be rare.

**The build failed.** Open **Events** in Render, then the failed deploy, and
send the last twenty lines of its log.
