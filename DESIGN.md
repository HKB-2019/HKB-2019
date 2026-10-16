---
name: MASQ.
description: Urban Rituals — modern identity wear rooted in culture, shown like artefacts in a dark gallery.
colors:
  ground-night: "#050407"
  ground-night-2: "#08080c"
  ground-night-3: "#0b0b10"
  ink-bone: "#f4f1eb"
  ink-bone-dim: "#c2c0bc"
  ink-bone-faint: "#7e7c83"
  line-night: "#2e2e38"
  ritual-violet: "#23154e"
  ritual-violet-hi: "#32206e"
  violet-mist: "#a9a2cd"
  indigo-band: "#0a0915"
  ground-paper: "#f6f3ee"
  ground-paper-2: "#efebe4"
  ground-paper-3: "#e8e3da"
  ink-night: "#141217"
  ink-night-dim: "#46434c"
  violet-ink: "#4a3d91"
typography:
  display:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(66px, 10.4vw, 150px)"
    fontWeight: 200
    lineHeight: 0.88
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "clamp(28px, 3.2vw, 44px)"
    fontWeight: 400
    lineHeight: 1.12
  body:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.95
  label:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.16em"
rounded:
  none: "0px"
  swatch: "50%"
spacing:
  pad: "clamp(22px, 5.2vw, 72px)"
  gap: "clamp(10px, 1.5vw, 22px)"
  section: "clamp(64px, 7.4vw, 112px)"
components:
  button-solid:
    backgroundColor: "{colors.ritual-violet}"
    textColor: "{colors.ink-bone}"
    rounded: "{rounded.none}"
    height: "50px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-bone}"
    rounded: "{rounded.none}"
    height: "50px"
---

# MASQ. design

The source of truth is the variables at the top of `src/styles.css`; this file describes them.

## Overview
A dark gallery for modern artefacts. Studio photographs on black, few words, generous space, one violet accent. Quiet, confident, ceremonial — never playful or loud. A light theme exists (warm paper and near-black ink); the brand's dark sections keep their look in it.

## Colors
- **Ground:** near-black in dark (`ground-night` steps), warm paper in light (`ground-paper` steps).
- **Ink:** bone white in dark, near-black in light, each with dim and faint steps for secondary text (all at least 4.5:1).
- **Accent:** ritual violet for the solid button, badges and chosen states; violet mist (dark) / violet ink (light) for small accent text, focus rings and links.
- **Stay dark in both themes:** the hero (and the menu over it), the "Craft. Culture. Identity." band, the film strip, the Essentials carousel, the full-screen photo view.

## Typography
Inter for the interface (the giant thin MASQ. title included, its full stop in violet mist as in the footer); EB Garamond for editorial lines (hero line, manifesto, product names on their page), with its true italic, never a slanted roman, for the manifesto's second line. Micro labels are small (11px, never less), uppercase and widely tracked (.13–.24em) — this is the brand's voice, not decoration. Sentences are 13px or more; reading text 15–16px at about 62 characters a line; inputs 16px on phones.

## Layout
1320px measure, fluid side padding, a generous vertical rhythm. Product frames are portrait 5:6. Grids of four on desktop, two on phones; the product page is photo left, buying box right (stacked on phones).

## Elevation & Depth
Flat. Depth comes from photography and tone steps between grounds, not shadows. Only things that truly float (menus, toasts) carry a shadow. No blur, no grain.

## Shapes
Square corners everywhere; the only circles are colour swatches and the film's play disc. Hairline (1px) rules and frames in the line colour.

## Components
- Buttons: square, 50px tall, uppercase tracked labels; solid violet or ghost outline.
- Cards: photo, then name (tracked caps) left and price right on one line, like a gallery label (stacked on phones); photos fade in as they arrive; the owner's second photo shows on hover; quick-add slides up from the photo.
- Section heads: tracked caps title, a small faint count of the pieces (07), a hairline, the link.
- Countdown: serif numerals divided by hairlines, like a watch face.
- Swatches: round, ringed when chosen, struck through when sold out.
- Gift card: drawn as the physical card, from the logo's own artwork (`src/assets/giftcard`): deep violet, the full-colour MASQ. wordmark and mask on the front with the amount in serif, the symbol row, motto and code on the back. It is the one place the logo's colours, a card's rounded corners and type under 11px appear; everything on it is repeated at full size in the gallery label underneath.
- Panels (bag, saved, pages): slide or fade over a scrim; close on Escape or a tap outside.

## Do's and Don'ts
- Do keep violet as the only accent; don't add new hues to the interface (product colours live only in swatches and photos, the logo's colours only on the gift card).
- Do keep the uppercase tracked labels and hairlines — they are the brand, whatever a generic rulebook says about "eyebrows" or "thin rules".
- Don't add gradients, glass or glows; don't round corners.
- Do check every change in both themes and at 360px.
