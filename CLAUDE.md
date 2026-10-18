# Working on MASQ.

The shop and its admin: React + Vite in `src/`, Express + Postgres in `server/`. `README.md` explains how everything works; `DEPLOY.md` how to put it live.

## Design skills in this project

`.claude/skills/` holds third-party design rulebooks, installed at the owner's request:

| Skill | Source | For |
|---|---|---|
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0) | Critique, audit, polish, motion, typography |
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT) | Art direction for public pages |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT) | UX guidelines, palettes, font pairings, checklists |
| `apple-hig` | [ebuntario/apple-hig](https://github.com/ebuntario/apple-hig) (MIT) | Apple's Human Interface Guidelines |
| `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, `animation-performance`, `find-animation-opportunities`, `animation-vocabulary`, `break-ui` | [emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT) | Emil Kowalski's motion and polish craft: when to animate, easing and timing, interruption, frame budget (Framer Motion, GSAP, CSS), worst-case data |

**MASQ.'s own design wins.** `PRODUCT.md` and `DESIGN.md` describe the brand; where a rulebook disagrees (Taste Skill bans violet, eyebrow labels, thin rules and uppercase tracked labels; Apple's guidelines assume native apps), follow `DESIGN.md` and use the rulebook for everything else — accessibility, states, spacing, motion, copy.

From Emil Kowalski's repo only the web skills are installed (not the Expo, Swift, native-mobile, Sonner, prototype or UI-library-picker ones); they are plain instructions with nothing to run. His rule that the best animation is often none fits the brand: MASQ.'s motion stays slow, quiet and purposeful, and always respects reduced motion.

Impeccable is installed without its launcher (`scripts/impeccable`), which downloads and runs a binary on first use; it falls back to reading `PRODUCT.md` and `DESIGN.md` directly. Taste Skill's and UI UX Pro Max's own scripts are included (local Node and Python, no installs); Taste Skill's `assets.mjs` fetches openly licensed pictures from public archives when asked.

## Project helpers

- **Skills:** `checks-before-push` (the full list below, plus the secrets scan) and `publish-previews` (rebuild and republish the shop and admin previews to their existing links).
- **Agent:** `payments-reviewer` reads changes to checkout, the Paystack webhook, orders, gift cards, discounts and the admin sign-in, and reports ways to lose money.
- **Hooks** (`.claude/hooks/guard.mjs`, wired in `.claude/settings.json`): edits to `.env` files and `package-lock.json` are refused; editing a payment file adds a reminder of which tests cover it.
- **Plugins:** Claude Code Setup (automation recommendations) and Claude Code Security (`/claude-security` for a full scan), both from Anthropic's official marketplace.

## Checks before pushing

`npm test` (server, PGlite), `npm run test:e2e` (Playwright), and look at changes in both themes and at 360px.
