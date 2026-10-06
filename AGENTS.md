# AGENTS.md

`gitcalver.org` is the specification and docs site for **GitCalVer**, which
derives strictly increasing calendar versions (`YYYYMMDD.N`) from git history.
This repo holds only the spec and the Hugo site; the implementations live in
sibling repos under `github.com/gitcalver`. See `ROADMAP.md`.

The example version in the hero and in the "run it" sample is the current UTC
date: `layouts/home.html` renders the build date, and client JS replaces it with
the visitor's current UTC date on load and again at each UTC midnight.

## Commands

Every task is a `Makefile` target; the `##` comment above each says what it
does. Toolchains are pinned: Hugo by `go.mod` (`go tool hugo`), Python by
`pyproject.toml` + `uv.lock`, Node and npm by `.node-version` and
`package.json`, and Node tools by `package-lock.json` (run `npm ci` first);
`make check-toolchain` verifies Node, npm, and Python versions and the uv floor.
`check-accessibility`, `check-interactions`, and `social-card` need the locked
Playwright browser (`node_modules/.bin/playwright install chromium`, rerun after
each Playwright bump); `lighthouse` needs Chrome. CI runs the `check-*` guards,
`lint`, and `lighthouse`. A Lefthook hook runs `make lint` on commit
(`lefthook install`).

## Generated files

Never hand-edit these; change the source and regenerate.

- **Figures** (`site/assets/diagrams/*.svg`): from the gitgraph.js scenes in
  `scripts/diagrams/figures/` via `make diagrams`. Scenes use only the site's
  CSS custom properties for color, give every commit an explicit
  `fig-N-`-prefixed hash, and use only glyphs the site already has.
- **Fonts** (`site/assets/fonts/*.woff2`, `site/static/favicon.svg`): glyph
  subsets built by `make fonts`. Adding a character the site doesn't use, or
  enabling an OpenType feature (`font-feature-settings`, `font-variant-*`) that
  `LAYOUT_FEATURES` in `fonts/build.py` doesn't keep, fails `make check-fonts`.
  Add the tag to `LAYOUT_FEATURES` first if needed, then run `make fonts` and
  commit the result. The sources are TrueType (`glyf`), not CFF `.otf`, because
  iOS Lockdown Mode rejects CFF; don't switch back. Don't bump the pinned
  `fonttools`/`brotli` casually, since output is byte-reproducible. See
  `fonts/README.md`.
- **Social card** (`site/static/social-card.png`): rendered from
  `site/assets/images/social-card.svg` by `make social-card`. No check compares
  the two, so rerun it after editing the SVG or the `fonts/src` TTFs it loads.

## Hugo specifics

- Layouts are flat (Hugo ≥0.146): `layouts/baseof.html`, `home.html`, and
  `page.html` live directly in `layouts/`, not under `_default/`.
- **No HTML comment before `{{ define }}`** in a layout. Put the copyright in a
  single-line template comment (`{{- /* ... */ -}}`), as the existing layouts
  do, or the define won't register and the page renders blank. An auto-formatter
  that reflows that comment does the same, so the layouts are hand-formatted and
  `site/layouts/.dir-locals.el` keeps Emacs apheleia (Prettier) off them.
- `site/assets/css/main.css` is a template (`{{ ... }}` fingerprints the font
  URLs), minified and inlined into every page, so every byte ships on each load.
- Its `.chroma` rules are a pruned Modus theme covering the tokens the code
  samples emit. A new color token fails `make check-css`, which prints the exact
  rule to paste back; restore only that rule, not the whole theme.
- `baseof.html` preloads the font faces each page uses, adding Inter italic and
  Mono 600 only where the content needs them (`<em>`, `<i>`, `<cite>`; code in
  an `h1` to `h4` heading, table header, or `<strong>`). A face used without a
  preload fails `make lighthouse` on the `network-dependency-tree-insight`
  audit, which doesn't name the face. `h5`, `h6`, `<b>`, `<var>`, `<dfn>`, and
  `<th>` outside `<thead>` use faces the detection misses, so extend it before
  using them.
- Markdown allows raw HTML (`markup.goldmark.renderer.unsafe = true`); only
  `site/content/spec/0.3.md` needs it, for the `<figure>` and `<figcaption>`
  wrappers around its diagram shortcodes and the `<br>` that keeps its exit-code
  table inside the prose column.
- Analytics is Cloudflare Web Analytics in automatic mode: the edge injects the
  beacon. Don't add a manual analytics `<script>`, or page views double-count.

## Deployment

A Cloudflare **Worker (Static Assets)** serves the site; **Workers Builds**
builds and deploys it from `main` (build `npm ci && make build`, output
`site/public`; deploy `npm run deploy`). Settings that live only in the
dashboard:

- `GO_VERSION` must match the `go` directive in `go.mod`. There is no
  `HUGO_VERSION`; Hugo comes from `go.mod`.
- `SKIP_DEPENDENCY_INSTALL=true` must stay set, or the build image runs
  `uv sync` with its own unpinnable uv, which the build doesn't need (fonts are
  committed). It also disables the automatic `npm clean-install`, hence `npm ci`
  in the build command.

Routing (`wrangler.jsonc`, `site/static/_redirects`, `_headers`; all exercised
by `make check-worker`):

- Canonical URLs have no trailing slash (`/getting-started`); the slash form
  307-redirects. Keep hand-written internal links no-slash.
  `layouts/sitemap.xml` is custom for the same reason.
- `/spec` and `/spec/` are not pages; `_redirects` 302s both to the current spec
  version.
- `/sh` redirects to `/gitcalver.sh`, the install script vendored from
  `gitcalver/sh`, because Workers Static Assets reject a 200-proxy to an
  external URL. To bump the release, set `SHELL_RELEASE` in the `Makefile`
  (Renovate does, along with the doc pins) and run `make vendor-sh`; on a
  Renovate PR, run it on the branch, since `make check-html` fails until then.
  It re-vendors `site/static/gitcalver.sh` after checking it against GitHub's
  digest, sets `SHELL_SHA256`, rewrites any stale pin, and re-pads the
  `ROADMAP.md` table. Then verify with `make check-html` and `make check-pins`
  in a separate invocation. Read the script's diff before merging; Renovate
  doesn't automerge this dependency.
- `/go` is a static page (`site/static/go.html`) carrying the vanity-import meta
  tags for `gitcalver.org/go`. Keep it a top-level file: it serves at `/go`
  under `drop-trailing-slash` and the default `auto-trailing-slash`, whereas
  `go/index.html` would loop against the `/go/*` splat redirect (307 to `/go/`,
  301 back) under `auto-trailing-slash`. That redirect sends subpackage imports
  to `/go`.

## Conventions

These follow
[`shields/right-answers`](https://github.com/shields/right-answers).

- **Brand casing**: "GitCalVer" in prose; lowercase `gitcalver` for the logo,
  command, package names, URLs, and the site `title`.
- **Typography** in rendered HTML, including Markdown content: curly quotes, en
  dashes for ranges, and em dashes without surrounding spaces. Hugo's
  typographer curls quotes in Markdown pages but never fixes em dash spacing, so
  type em dashes unspaced everywhere. The hand-written layouts and raw HTML
  blocks get no typographer, so curl quotes there by hand.
- **SPDX headers**: site content, layouts, and CSS are `CC-BY-4.0`; build
  tooling (`Makefile`, `fonts/build.py`, `check_css.py`, `pyproject.toml`,
  `lefthook.yml`, workflows, Renovate config) is `MIT`.
