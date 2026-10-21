# The owner's design boards

Screens the owner designed and uploaded, kept here so they outlive any one
working session. Build from these; where a board and `DESIGN.md` disagree,
ask the owner.

| Board | What it covers | Built? |
|---|---|---|
| `accounts-and-authentication.webp` | Sign-in (email, Google, Apple), email/OTP verification, profile, password reset, field states, security (password, 2FA, sessions, activity), saved profile, account deletion, sign-out | Not yet: customer accounts are still to build |
| `banner-variants.webp` | Announcement (default, with button, informational, dismissed), maintenance (scheduled, live, with countdown), persistent error banners, placement, dismissal rules | Partly: announcement and maintenance exist (`SiteNotices.jsx`) |
| `persistent-error.webp` | Page, form, upload, checkout, network, server, empty-with-error, detailed (expandable), stepper and list errors, with Retry and View details | Partly |
| `empty-states.webp` | Empty bag, wishlist, search, orders, saved searches, category, order history; small inline versions | Partly: bag, saved list and search exist |
| `session-expiry-warning.webp` | Session warning as modal, banner, toast and inline; countdown that turns amber then red; progress bar; extended / signing out / signed out | Partly: the admin's warning exists (`Admin.jsx`) |
