---
name: publish-previews
description: Rebuild the two MASQ. preview pages (the shop and the admin, running on stand-in data in the browser) and republish them to the owner's existing preview links. Use after any change the owner should be able to click through, or when they ask to see the latest version.
---

# Publish the previews

The previews are the real shop and admin built against `src/demo/api.js` (no server, data kept in the browser's localStorage under `masq:preview-store-5`), published as two claude.ai artifacts. Always update the existing links; never publish new ones.

| Preview | Link | Built page |
|---|---|---|
| Shop | https://claude.ai/artifact/C7GwTxuGrFtSpHnCw5n6yF | `dist-preview/shop/index.html` |
| Admin | https://claude.ai/artifact/9ZbJaN9SpEdXrM3wcG9s1K | `dist-preview/admin/index.html` |

## Steps

1. `npm run build:preview`. It writes both folders and strips the page skeleton the artifact host adds itself.
2. For each preview, list what is published now (Artifact `list` with `scope: "files"` and the link) and what was just built (`ls dist-preview/<mode>/assets`). File names carry a content hash, so a changed file has a new name.
3. Publish with the Artifact tool: `url` = the link, `file_path` = the built `index.html`, `root` = `dist-preview/<mode>`, and `files` mapping every **new or changed** path (`assets/index-XXXX.js`, the CSS, lazy chunks such as `assets/Admin-…js` and `assets/VisitorsTab-…js`, new images under `assets/img/`, `theme.js`) to itself, and every **old hashed name that is gone** to `null`. Unchanged files can be left out; they are kept. Add a short `label` naming the change.
4. If the store's shape changed, bump the localStorage key in `src/demo/api.js` (`masq:preview-store-N`) so old browsers start fresh, or migrate it in `load()`.
5. Give the owner both links and one plain sentence on what to look at.

Large photos and the brand film count toward each publish's size limit: send them only when they changed.
