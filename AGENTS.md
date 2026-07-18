# AGENTS.md

This file provides guidance to AI agents when working with code in this
repository.

## What this is

`gitcalver.org` — the specification and marketing/docs website for
**GitCalVer**, a scheme that derives strictly-increasing calendar version
numbers (`YYYYMMDD.N`) from git history. This repo holds only the spec and the
Hugo site; the implementations live in sibling repos under
`github.com/gitcalver` (`sh`, `go`, `python`, `rust`). See `ROADMAP.md` for the
org layout.

The site itself is a build-time function of the date: `layouts/home.html`
renders _today's_ example version (`now.UTC`) into the hero, and client JS rolls
it over at UTC midnight, so live visitors always see the current date even
between deploys (the server-rendered hero shows the date of the last build).

## Commands

Everything runs through the `Makefile`. Hugo is pinned via the `go tool`
directive in `go.mod` (`go tool hugo`) and the font script's deps via
`pyproject.toml` + `uv.lock`, while Node tools are locked in
`package-lock.json`. Run `npm ci` before Node-backed tasks.

- `make serve` — live-reloading dev server
- `make build` — render to `site/public`
- `make fonts` — regenerate subsetted woff2 + favicon (see below); commit the
  result
- `make check-toolchain` — verify the pinned Node, npm, uv, and Python versions
- `make check-fonts` — CI guard; build the site, byte-compare a clean font and
  favicon regeneration, and test tamper detection
- `make check-html` — CI guard; build and assert the go-import tags, `/go`
  redirect, and `robots.txt` survive
- `make check-links` — CI guard; build and verify rendered internal links and
  fragments
- `make check-css` — CI guard; build and fail if a rendered code sample emits a
  syntax-highlight (Chroma) token the trimmed Modus theme in `main.css` dropped
  (see below)
- `make check-worker` — CI guard; serve the build through locked local Wrangler
  and assert routes, redirects, headers, and content types
- `make check-metadata` — CI guard; assert canonical and social metadata, the
  shared social card, the custom noindex 404, and RSS removal
- `make check-accessibility` — CI guard; run Axe and responsive browser checks
  at 320 px and desktop widths in light and dark modes (install the browser once
  with `node_modules/.bin/playwright install chromium` for local use)
- `make lighthouse` — build and audit every rendered content page with the
  locked Lighthouse CI
- `make social-card` — regenerate the shared 1200×630 social image from its SVG
  source with the locked Playwright browser
- `make lint` — Prettier `--check` on Markdown, Ruff + ty on the repo's Python
  (`fonts/build.py`, `check_css.py`; the gitignored `.venv` is skipped)
- `make fmt` — auto-format Markdown and apply Ruff fixes + formatting
- `make deploy` — deploy the rendered site with the locked Wrangler
- `make clean` — remove `site/public` and `site/resources`

CI (`.github/workflows/check.yml`) installs from both lockfiles, verifies the
toolchain, and runs lint, font, HTML, CSS, Worker, metadata, accessibility, and
Lighthouse gates on every push/PR. A Lefthook `pre-commit` hook runs the same
`make lint` locally — `lefthook install` enables it.

## Font pipeline (the non-obvious part)

The woff2 in `site/assets/fonts/` are **subsets** of the vendored IBM Plex
TrueType files in `fonts/src/` — only the glyphs the rendered HTML actually uses
(~90 KB total). `fonts/build.py` builds the site, scans every codepoint in the
output HTML, and subsets each weight to that set; it also outlines the `gcv`
favicon from Mono SemiBold so the favicon carries no font dependency.

The sources are the **TrueType (`glyf`) builds**, not the CFF `.otf` builds, on
purpose: iOS Lockdown Mode (Safari 26+) runs web fonts through a memory-safe
parser that rejects CFF's charstring interpreter, so CFF subsets silently fall
back to the system serif. `glyf` outlines pass it. Don't switch back to `.otf`.

**If you add a character the site doesn't already use** (a new symbol, accented
letter, arrow, etc.), `make check-fonts` will detect that a clean regeneration
differs. Fix it with `make fonts` and commit the regenerated woff2 +
`favicon.svg`.

Output is **byte-reproducible**: `fonttools`/`brotli` are version-pinned in
`pyproject.toml` (and locked in `uv.lock`) and source timestamps are preserved
(`recalcTimestamp=False`). Don't bump those versions casually — it changes the
woff2 bytes. See `fonts/README.md`.

## Hugo specifics

- **Flat layout structure** (Hugo ≥0.146): `layouts/baseof.html`, `home.html`,
  `page.html` live directly in `layouts/`, not under `_default/`.
- **No comment before `{{ define }}`** in a layout — put the copyright inside
  the template comment (`{{- /* ... */ -}}`), as the existing layouts do, or the
  define won't register (Hugo then skips `baseof.html` and the page renders
  blank). Keep that comment on a single line: an auto-formatter that reflows it
  across lines splits `*/` from `-}}` and re-triggers this.
  `site/layouts/.dir-locals.el` sets `apheleia-inhibit` to keep Prettier (via
  Emacs apheleia) off these files for exactly this reason — the layouts are
  hand-formatted on purpose.
- `site/assets/css/main.css` is run through `resources.ExecuteAsTemplate` — it
  contains Hugo template syntax (`{{ ... }}` for fingerprinted font URLs), then
  is minified and inlined into every page's `<style>`. It is a template, not
  plain CSS, so every byte ships on each load.
- The `.chroma` syntax-highlight rules at the end of `main.css` are a **pruned**
  Modus theme: only the Chroma tokens the rendered code samples actually emit
  are styled (Chroma tags far more than the samples use). If you add or edit a
  code block that introduces a new token, `make check-css` fails and prints the
  exact rule to paste back in (light + dark); `check_css.py` holds the full
  Modus palette as the reference. Don't restore the whole theme — just the rules
  it names.
- Markdown allows raw HTML (`markup.goldmark.renderer.unsafe = true`); the spec
  and getting-started pages rely on this.
- **Analytics** is Cloudflare Web Analytics in _automatic_ mode — the beacon is
  injected at the edge, so the site ships no analytics `<script>` and needs no
  `CF_ANALYTICS_TOKEN`. Don't re-add a manual beacon, or page views
  double-count.

## Deployment

gitcalver.org is served by a Cloudflare **Worker (Static Assets)**, built and
deployed by **Workers Builds** from `main` on push — build command `make build`
(output `site/public`), deploy command `npm run deploy`. `wrangler.jsonc` (repo
root) is the assets-only Worker config pointing at `site/public`, with
`html_handling: drop-trailing-slash` so pages serve at canonical no-slash URLs
(`/spec`, not `/spec/`) and `/spec/` 307-redirects to `/spec`. A custom
`layouts/sitemap.xml` emits those no-slash URLs (Hugo's `.Permalink` keeps the
trailing slash); keep hand-written internal links no-slash too.
`site/static/_headers` sets immutable long-cache on the fingerprinted `/fonts/*`
(the CSS is inlined into the HTML, so the fonts are the only fingerprinted
assets left). `make check-worker` exercises those headers and the following
redirects through local Wrangler. `site/static/_redirects` redirects `/sh` to
`/gitcalver.sh` — the install script, vendored at `site/static/gitcalver.sh`
from `gitcalver/sh` (Workers Static Assets reject a 200-proxy to an external
URL, so it's hosted here) — and `/go/*` to `/go` (a 301 splat; see below). `/go`
is a standalone static page (`site/static/go.html`) carrying the
`go-import`/`go-source` meta tags that make `gitcalver.org/go` a vanity import
path, plus a `<meta refresh>` so browsers land on pkg.go.dev while `go get`
reads the tags. Served as a top-level file (not `/go/index.html`), `/go` itself
returns 200 — the path `go get` requests. Subpackage imports
(`go get gitcalver.org/go/<subpkg>`) fetch `/go/<subpkg>`, which has no asset;
the splat 301-redirects it to `/go`, whose `go-import` prefix matches, and
`go get` follows the redirect. The redirect is applied before the custom
`404-page` fallback used for other missing routes.

The build needs only Go — Hugo is pinned via the `go tool` directive in
`go.mod`, so there is no separate `HUGO_VERSION` to pin; `go tool hugo` resolves
the version from `go.mod`. Set `GO_VERSION` in the Workers build settings to
match the `go` directive in `go.mod` (currently `1.26.4`).

## Conventions

These follow the shared standards in
[`shields/right-answers`](https://github.com/shields/right-answers) — the
canonical source for the Makefile, lint/CI, Renovate, and typography conventions
referenced here.

- **Brand casing**: "GitCalVer" in prose; lowercase `gitcalver` for the logo,
  command, package names, URLs, and the site `title`.
- **Typography** (rendered, human-facing HTML — including Markdown content):
  curly quotes, en dashes for ranges, and em dashes _without_ surrounding
  spaces. The Markdown pages get curly quotes from Hugo's typographer, but the
  hand-written layouts (`baseof.html`, `home.html`) don't, and nothing fixes em
  dash spacing automatically — apply both by hand there.
- Source files carry an SPDX header: site content/layouts/CSS are `CC-BY-4.0`;
  build tooling (`Makefile`, `fonts/build.py`, `check_css.py`, `pyproject.toml`,
  `lefthook.yml`, workflows, Renovate config) is `MIT`.
