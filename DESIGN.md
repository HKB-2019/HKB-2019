---
name: MASQ.
description: Urban Rituals — modern identity wear rooted in culture, lit in electric violet on black.
colors:
  ground-night: "#050407"
  ground-night-2: "#09080d"
  ground-night-3: "#0d0c12"
  panel-night: "#0f0e14"
  ink-bone: "#f4f1eb"
  ink-bone-dim: "#c2c0bc"
  ink-bone-faint: "#8a8790"
  line-night: "#2a2833"
  electric-violet: "#5a2be0"
  electric-violet-hi: "#6b3df2"
  violet-light: "#9d85ff"
  indigo-band: "#0d0819"
  ground-paper: "#f6f3ee"
  panel-paper: "#fffdf9"
  ink-night: "#141217"
  ink-night-dim: "#46434c"
  violet-ink: "#4a22c4"
typography:
  display:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(72px, 9.6vw, 140px)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "EB Garamond, Georgia, serif"
    fontSize: "clamp(30px, 3.3vw, 48px)"
    fontWeight: 400
    lineHeight: 1.08
  body:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  panel: "4px"
  swatch: "50%"
spacing:
  pad: "clamp(22px, 5.2vw, 72px)"
  gap: "clamp(10px, 1.5vw, 22px)"
  section: "clamp(64px, 7.4vw, 112px)"
components:
  button-solid:
    backgroundColor: "{colors.electric-violet}"
    textColor: "{colors.ink-bone}"
    rounded: "{rounded.panel}"
    height: "52px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-bone}"
    rounded: "{rounded.panel}"
    height: "52px"
---

# MASQ. design

The source of truth is the variables at the top of `src/styles.css`; this file describes them. The owner's redesign (October 2026, pictures in `design/`, notes in `design/REDESIGN.md`) replaced the earlier quiet-gallery rules: where a rulebook in `.claude/skills/` disagrees, this file wins.

## Overview
Streetwear lit like a night shoot: black grounds, the model and the pieces under electric violet light, a bold MASQ., and the colourful brush wordmark from the logo. The top of the home page is the owner's landing design itself: the model before the violet eye wall, with the brush words on it. Confident and cultural, still uncluttered. A light theme (warm paper, near-black ink, the same violet) carries the same language; the photo-led sections stay dark in it.

## Colors
- **Ground:** near-black steps in dark, warm paper in light. **Panels** (product cards, the Essentials, countdown figures, admin tiles) sit one step lighter, with a soft border.
- **Ink:** bone white in dark, near-black in light, with dim and faint steps (all at least 4.5:1).
- **Accent:** electric violet for solid buttons, the bag count, chosen chips, the round arrow on hover; violet light (dark) / violet ink (light) for labels, links, the coloured word in a headline and the brush words.
- **The logo's colours** appear only in the wordmark (header, footer, admin), on the gift card and in photographs. Product colours live only in swatches and photos.
- **Stay dark in both themes:** the hero (and the menu over it), the craft band, the film strip, the full-screen photo view, the gift card stage.

## Typography
- **MASQ.** in Inter 800, tight, huge.
- **Serif lines** in EB Garamond 400: the hero's line, the manifesto (its last word in violet, never italic), the newsletter and pop-up headings, product names on their page.
- **Labels and menus**: Inter 500–700 capitals with modest tracking (.08–.1em); section titles bold. The craft band's title and the manifesto tag keep a wide tracking as the one ceremonial note.
- **Brush words** ("Wear identity, live culture") are painted on the wall in the hero picture itself, as in the owner's design.
- Body 15–16px at 400; never under 11px; inputs 16px on phones.

## Layout
1320px measure, fluid side padding. Products sit in square panels, four across on desktop and two on phones; the Essentials five across (three, then two, as the screen narrows). The hero picture fills the top at the design's own 2 : 1 shape with the words on its dark left; on a phone the picture comes first and the words follow.

## Elevation & Depth
Depth comes from violet light: soft violet shadows under panels on hover, a violet glow on the solid button and the brush words, violet bands behind the countdown and manifesto. Menus and toasts float with a shadow. No glass panels.

## Shapes
Panels and buttons are just off square (4px). Circles are for the round arrow buttons, the film's play disc, the bag count and colour swatches.

## Components
- **Buttons:** 52px, capitals, a short arrow that leans forward on hover; solid violet (fills lighter, glows) or outlined.
- **Product panel:** square photo, then name, price and colour dots on the left and a round arrow on the right; lifts with a violet border on hover; the second photo and quick add as before.
- **Round arrow:** 34px circle, outlined; fills violet when its panel is hovered, turns a little on its own hover.
- **Countdown:** each figure in its own panel, bold Inter, seconds in violet.
- **Manifesto:** left-aligned on a violet band, OUR STORY → on the right (plays the brand film).
- **Film strip:** People / Places / Patterns / Purpose on the left, an outlined play disc, PLAY BRAND FILM. With no film set in the admin it plays the brand film made in code (`video/`).
- **Promises:** delivery, returns, secure payment, in the owner's words and true to the Delivery and Returns pages.
- **Sign-up box:** an outlined email field with the violet JOIN attached, on the page and in the welcome pop-up.
- **Fields:** every text box and menu (checkout, tracking, gift cards, admin) is an outlined box with the same corners; labels above them are small capitals, 600, .1em.
- **Gift card:** unchanged (`src/components/GiftCard.jsx`): the owner's chosen design, five grounds, the logo's colours.
- **Admin:** the same type, panels, chips and violet fills; its layout is unchanged.

## Do's and Don'ts
- Do keep violet the one interface colour; the logo's colours stay in the wordmark, the gift card and photos.
- Do show only true promises and real proof: no invented reviews, stars, customer faces or delivery times.
- Don't put words inside photos (the hero's painted wall is the one exception, from the owner's design); headlines and buttons are live text.
- Do keep motion slow and purposeful, and respect reduced motion.
- Do check every change in both themes and at 360px.
