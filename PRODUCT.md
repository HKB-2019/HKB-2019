# MASQ.

## Platform
web

## Stack
React 19 + Vite (`src/`), Express 5 + Postgres (`server/`), Paystack for payment in naira. Hosted on Render, database on Neon. Plain CSS with variables in `src/styles.css`; Framer Motion, GSAP, Lenis for motion.

## Users
Shoppers in Nigeria first (Lagos, Abuja, the rest), and the diaspora; mostly on phones, often on mobile data, often arriving from Instagram, TikTok or WhatsApp. One owner runs the shop from the admin (`/admin`), also often on a phone.

## Product Purpose
Sell MASQ.'s drops — identity wear rooted in culture: tees, hoodies, jackets, caps and small accessories — and let the owner run every part of it without a developer: products, colours, sizes, stock, photos, prices, delivery fees, discount codes, the home page's words and photos, orders and dispatch, and visitor numbers.

## Positioning
Modern artefacts, not merch. Each piece is presented like an object in a gallery: dark studio photography, few words, a mask motif drawn from old carvings.

## Operating Context
Small catalogue (around ten pieces per drop), limited stock, drops with a countdown. Prices in naira; other currencies are a guide only. Customers pay before anything ships.

## Capabilities and Constraints
- The server never trusts a price from the browser; stock is held at checkout and released if payment fails.
- Pieces are sold by colour and size, each with its own count.
- Light and dark themes; some sections stay dark in both (see DESIGN.md).
- Visitor counting without cookies or personal data.
- Everything must work on a 360px phone with no sideways scroll.

## Brand Commitments
The name is always written `MASQ.` with the full stop. Violet is the accent; the dark studio look is the brand. Small, widely spaced capital labels are part of the voice.

## Evidence on Hand
Sample photography cut from the design mockup and upscaled (`public/assets/img/`); to be replaced by real product photography.

## Product Principles
- Say only what is true: no invented reviews, stock or urgency.
- Never make a shopper guess: sizes, colours, delivery fee and total are shown before paying.
- The owner can change it without code.

## Accessibility & Inclusion
Text at least 4.5:1 in both themes; every control reachable by keyboard; reduced-motion respected for every animation; finger-sized tap targets on phones.
