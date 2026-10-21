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
| `action-feedback.webp` | Undo (with a countdown), Retry (retrying, succeeded, failed), Dismiss (remembered for the session), View details (code, time, reference, copy, contact), Receipt sent to email (view order, resend) | Not yet: kept for later |
| `journal-home-and-article.webp` | Journal home (big headline, topic filters, featured and latest stories, newsletter band) and an article page (drop cap, pull quote, symbols grid, closing quote) | Not yet: kept for later |
| `journal-pages.webp`, `journal-pages-numbered.webp` | Journal home, the Culture & Heritage topic page, the article page, and the headers of the other five topic pages (Style & Expression, People & Creatives, Behind the Design, Lifestyle & Community, Brand Stories) | Not yet: kept for later |
| `journal-style-and-expression.webp` | The Style & Expression topic page in full: breadcrumb, featured story, latest stories, trending list, Shop the Looks, editor's picks, quote | Not yet: kept for later |
| `journal-people-and-creatives.webp` | People & Creatives topic page: featured interview, trending creatives, latest stories, Meet the Creatives, featured creatives, quote | See `journal-*` row below |
| `journal-behind-the-design.webp` | Behind the Design topic page: featured story, the design process (5 steps), latest stories, collection deep dives, quote | See `journal-*` row below |
| `journal-lifestyle-and-community.webp` | Lifestyle & Community topic page: featured story, trending stories, latest, Events & Happenings, community stories, quote | See `journal-*` row below |
| `journal-brand-stories.webp` | Brand Stories topic page: featured story, latest announcements, latest, Explore Our Collections, campaigns & collections, quote | See `journal-*` row below |
| *(email receipt, shared in chat only)* | Order receipt email: desktop and phone versions, inbox header, plain-text version, design notes. The owner chose the desktop (left) one | Yes (`server/lib/emails.js`, also used for "on its way"); the green-lit bag photo at the top needs a picture from the owner |
