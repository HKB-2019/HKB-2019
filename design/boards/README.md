# The owner's design boards

Screens the owner designed and uploaded, kept here so they outlive any one
working session. Build from these; where a board and `DESIGN.md` disagree,
ask the owner.

| Board | What it covers | Built |
|---|---|---|
| `accounts-and-authentication.webp` | Sign-in, email code, profile, password reset, field states, security, saved profile, delete account, sign-out | Yes (`src/components/account`), including Addresses and Notifications (`Addresses.jsx`, `Notifications.jsx`) and changing the email; not sign-in with Google/Apple or SMS codes (need outside accounts), or Payment methods (saved cards) |
| `banner-variants.webp` | Announcement (default, with button, informational, closed), maintenance (planned, live, countdown), persistent errors, placement, closing rules | Yes (`SiteNotices.jsx`, `Notices.jsx`) |
| `persistent-error.webp` | Page, form, upload, checkout, offline, server, empty-with-error, detailed, stepper and list errors | Yes, except the row-level list error (no list loads row by row yet) |
| `empty-states.webp` | Bag, wishlist, search, orders, saved searches, category, order history, small inline versions | Bag, wishlist, search, orders and the inline rows; not the 3D illustrations (need images), saved searches or category (those features don't exist yet) |
| `session-expiry-warning.webp` | Countdown panel, colours by time left, bar, action messages | Yes (`SessionExpiry.jsx`), as the panel; the banner, toast and inline versions are alternatives not used |
| `progress-states.webp` | Loading, processing, pending, button, form, upload, overlay, step states | Yes, across the shop; "Loading MASQ…" for the whole site is not used (pages draw at once) |
| `inline-feedback.webp`, `inline-feedback-components.webp` | Valid / invalid / warning / helper on every kind of box | Yes, except card fields (Paystack takes cards; the shop never sees them) and address search (needs Google Places) |
| `modal-variants.webp` | Success, error, confirmation, order result, information, warning, session, delete account, generic error, sizes, scroll | Yes |
