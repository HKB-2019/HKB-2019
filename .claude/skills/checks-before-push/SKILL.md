---
name: checks-before-push
description: The checks MASQ. needs before any commit is pushed — server tests, end-to-end tests, both themes and a 360px phone, a secrets scan of the staged diff, and the commit trailer. Use before every push, and whenever the owner asks whether something is safe to put live.
---

# Checks before pushing

Run these in order and stop at the first failure. Report failures to the owner plainly, with the output; never push past one.

1. **Server tests:** `npm test` (in-memory Postgres, no setup). All must pass.
2. **End-to-end tests:** `npm run test:e2e` (Playwright, Chromium already installed — never run `playwright install`). All must pass.
3. **Look at it.** For any change people can see, take screenshots of the changed pages in the **dark and light themes**, at **desktop width and 360px**. The theme is the `masq:theme` key in localStorage (`dark` / `light`). Check: nothing overflows sideways at 360px, text stays readable on the photo-led sections (they stay dark in both themes), and nothing in the craft band has changed unless the owner asked.
4. **Scratch files out.** Delete `e2e/_*.mjs` and `e2e/_*.spec.js` before `git add`.
5. **Secrets scan.** `git diff --cached` must contain no keys, passwords or tokens: look for `sk_live`, `sk_test_` followed by real characters, `pk_live`, `sk-ant-`, `SESSION_SECRET=`, `ADMIN_PASSWORD_HASH=`, `DATABASE_URL=postgres` with a password. The CI file's throwaway test database is the one allowed exception. Secrets live only in the host's environment variables.
6. **Docs.** If behaviour changed, update `README.md` (and `DESIGN.md` for anything visual) in the same commit.
7. **Commit message** ends with the attribution lines the session gives, and names no model.
8. **Push** only to `claude/website-interactive-buttons-di7yqt` with `git push -u origin claude/website-interactive-buttons-di7yqt`. No pull request unless the owner asks.
