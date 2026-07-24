---
name: deploy-showcase-pages
description: >-
  Build the zero-backend "学习展板 / showcase" part of week8-fullstack's frontend and
  deploy it to the nicefreak.github.io GitHub Pages site under /skillup-week8/ for mobile
  review. Use this whenever the user wants to publish, rebuild, refresh, or update the
  Node.js Skillup learning board / showcase on GitHub Pages — including phrasings like
  "更新展板", "重新构建复习页", "把 weekN 传到 github pages", "deploy the review board",
  or "同步笔记到线上". Also use it when notes/topics changed and the online board needs
  a rebuild. It handles the SHOWCASE_ONLY build flag, the subpath base, the copy-to-Pages
  step, both commits, and the "Pages serves from main so it must be merged" caveat.
---

# Deploy the Skillup showcase board to GitHub Pages

## What this is

`week8-fullstack/src/frontend` is one Vite + React SPA with two hash routes:

- `#/showcase` — **学习展板**: 5 tabs (认证与授权 / OAuth2 流程 / 数据库聚合 / Node.js 运行时 /
  前端笔记). **Zero backend.** All topic data is baked into `*Topics.ts`; notes are inlined at
  build time via `?raw`. This is the part we publish for mobile review.
- `#/admin` — **管理后台**: real login / JWT / RBAC / reports. **Needs the week2-express backend.**
  Excluded from the Pages build.

The deploy target is the user's GitHub Pages user-site repo **`nicefreak.github.io`**, served
from its **`main`** branch at the repo root. The board lives at
`https://nicefreak.github.io/skillup-week8/`.

Both repos are developed on a shared feature branch (whatever branch the current task
designates). Never push straight to `main` — open PRs.

## The invariant that makes this safe

The showcase is backend-free *by construction*. Before publishing, sanity-check that no
component reached for the network under `#/showcase`: the only live call (`probe` in
`api.ts`, used by `AuthProbePanel`) lives in the admin `Dashboard`, not the showcase.
`OAuth2FlowPanel` is static even though it's exported from `Dashboard.tsx`. If someone adds
a `fetch`/`import ... from "./api"` to a showcase component, the Pages build will silently
ship a broken feature — grep for it:

```bash
cd week8-fullstack/src/frontend/src
grep -rn 'from "./api"\|fetch(' AuthBoard.tsx Showcase.tsx W3Board.tsx W5Board.tsx MarkdownNotes.tsx
```

Expect no matches. If there are, stop and tell the user which showcase component now needs a
backend before deploying.

## Build

The `VITE_SHOWCASE_ONLY=1` flag (read in `App.tsx`) hides the admin nav entry, the `#/admin`
route, the "打开管理后台实验" button, and swaps the footer — so a phone user can't tap into a
backend that isn't there. The `--base` must match the Pages subpath because assets are
referenced absolutely; the hash router means subpath hosting has no SPA-fallback 404 problem.

```bash
cd week8-fullstack/src/frontend
yarn install                      # yarn 3 (berry); node 24 per .nvmrc
VITE_SHOWCASE_ONLY=1 VITE_API_BASE="" yarn build --base=/skillup-week8/
```

`yarn typecheck` should also pass. Output lands in `dist/` (gitignored in this repo — it is
committed only in the Pages repo, see below).

## Deploy to the Pages repo

The shared `index.html` `<title>` is admin-oriented, so overwrite it in the deployed copy.

```bash
SRC=week8-fullstack/src/frontend/dist
DEST=../nicefreak.github.io/skillup-week8      # adjust to wherever the Pages repo is checked out
rm -rf "$DEST"/assets "$DEST"/index.html
mkdir -p "$DEST"
cp -r "$SRC"/* "$DEST"/
sed -i 's#<title>[^<]*</title>#<title>Node.js Skillup · 学习展板</title>#' "$DEST/index.html"
# keep the existing skillup-week8/README.md (it documents that this dir is generated)
```

Verify before committing:

```bash
grep -o "<title>.*</title>" "$DEST/index.html"          # → Node.js Skillup · 学习展板
grep -o "/skillup-week8/assets/[^\"]*" "$DEST/index.html" # → hashed asset paths under the subpath
```

The homepage entry link (`index.html` → `./skillup-week8/`) is already in place; leave it. If
publishing a *different* week, add a matching `<li>` there.

## Commit, push, PR

Two repos, same designated feature branch. Source repo (`nodejs-skillup`) carries only the
`src/` changes — never the built `dist/`. Pages repo (`nicefreak.github.io`) carries the built
output under `skillup-week8/` plus any homepage change.

```bash
# source repo
git -C nodejs-skillup add week8-fullstack/src/frontend/src
git -C nodejs-skillup commit -m "…"
git -C nodejs-skillup push -u origin <branch>

# pages repo
git -C nicefreak.github.io add skillup-week8 index.html
git -C nicefreak.github.io commit -m "…"
git -C nicefreak.github.io push -u origin <branch>
```

Then open a PR per repo (only when the user asks for PRs). Use the GitHub MCP tools; end every
PR body with the Claude Code attribution footer.

## The caveat you must always surface

Pages publishes from **`main`**. Pushing to the feature branch does **not** make the URL live —
it goes live ~1 minute after the Pages repo's branch is **merged into `main`**. Always tell the
user this, and that the source-repo PR is just code review (it doesn't affect what's served).

## Mobile note

The CSS already has a thorough `@media (max-width: 720px)` block, `<meta viewport>`, dark mode,
and reduced-motion. It's genuinely mobile-ready. The one rough edge: markdown tables set
`min-width: 520px`, so they scroll horizontally on narrow screens (contained, won't break
layout). Only touch this if the user complains.

## Markdown link behavior (already implemented, keep intact)

In `MarkdownNotes.tsx` the `a` renderer: external links open in a new tab; in-repo `.md`
cross-references that map to a board note switch the board in-app via `onTopicChange` (so they
work on mobile with no navigation away); other local paths fall back to a GitHub blob URL;
`#` anchors scroll. If you add notes, give each `NoteSource` its `file` + `repoPath` so this
keeps working.
