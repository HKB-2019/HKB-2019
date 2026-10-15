# Working on MASQ.

The shop and its admin: React + Vite in `src/`, Express + Postgres in `server/`. `README.md` explains how everything works; `DEPLOY.md` how to put it live.

## Design skills in this project

`.claude/skills/` holds four third-party design rulebooks, installed at the owner's request:

| Skill | Source | For |
|---|---|---|
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0) | Critique, audit, polish, motion, typography |
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT) | Art direction for public pages |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT) | UX guidelines, palettes, font pairings, checklists |
| `apple-hig` | [ebuntario/apple-hig](https://github.com/ebuntario/apple-hig) (MIT) | Apple's Human Interface Guidelines |

**MASQ.'s own design wins.** `PRODUCT.md` and `DESIGN.md` describe the brand; where a rulebook disagrees (Taste Skill bans violet, eyebrow labels, thin rules and uppercase tracked labels; Apple's guidelines assume native apps), follow `DESIGN.md` and use the rulebook for everything else — accessibility, states, spacing, motion, copy.

Impeccable is installed without its launcher (`scripts/impeccable`), which downloads and runs a binary on first use; it falls back to reading `PRODUCT.md` and `DESIGN.md` directly. Taste Skill's and UI UX Pro Max's own scripts are included (local Node and Python, no installs); Taste Skill's `assets.mjs` fetches openly licensed pictures from public archives when asked.

## Checks before pushing

`npm test` (server, PGlite), `npm run test:e2e` (Playwright), and look at changes in both themes and at 360px.
