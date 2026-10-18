---
name: publish-previews
description: Rebuild the MASQ. preview (the shop with its admin inside, running on stand-in data in the browser) and republish it to the owner's existing preview link. Use after any change the owner should be able to click through, or when they ask to see the latest version.
---

# Publish the previews

The preview is the real shop and admin built against `src/demo/api.js` (no server, data kept in the browser's localStorage under `masq:preview-store-N`, the `KEY` in `src/demo/api.js`), published as one claude.ai artifact. The shop and its admin live in that one link (OPEN THE ADMIN / OPEN THE SHOP on its bar), so they share one set of sample data, like the real shop's one database. Always update the existing link; never publish a new one.

| Preview | Link | Built page |
|---|---|---|
| Shop and admin | https://claude.ai/artifact/C7GwTxuGrFtSpHnCw5n6yF | `dist-preview/shop/index.html` |
| Old admin link | https://claude.ai/artifact/9ZbJaN9SpEdXrM3wcG9s1K | `tools/admin-moved.html`: a notice pointing to the link above. Leave it as it is. |

Two links used to hold two separate sets of sample data, and a setting changed in one never showed in the other; that confused the owner for days. Don't bring the second app back.

## Steps

1. `npm run build:preview`. It writes `dist-preview/shop` (and `dist-preview/admin`, no longer published) and strips the page skeleton the artifact host adds itself.
2. List what is published now (Artifact `list` with `scope: "files"` and the link) and what was just built (`ls dist-preview/<mode>/assets`). File names carry a content hash, so a changed file has a new name.
3. Publish with the Artifact tool: `url` = the link, `file_path` = `dist-preview/shop/index.html`, `root` = `dist-preview/shop`, and `files` mapping every **new or changed** path (`assets/index-XXXX.js`, the CSS, lazy chunks such as `assets/Admin-…js` and `assets/VisitorsTab-…js`, new images under `assets/img/`, `theme.js`) to itself, and every **old hashed name that is gone** to `null`. Unchanged files can be left out; they are kept. Add a short `label` naming the change.
4. If the store's shape changed, bump the localStorage key in `src/demo/api.js` (`masq:preview-store-N`) so old browsers start fresh, or migrate it in `load()`.
5. Give the owner the link and one plain sentence on what to look at. Each phone or computer keeps its own sample data, so say which device a change was made on if it matters.

Large photos and the brand film count toward each publish's size limit: send them only when they changed.
