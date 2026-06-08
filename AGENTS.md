# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## What this is

`gitcalver.org` — the specification and marketing/docs website for **GitCalVer**, a
scheme that derives strictly-increasing calendar version numbers (`YYYYMMDD.N`)
from git history. This repo holds only the spec and the Hugo site; the
implementations live in sibling repos under `github.com/gitcalver` (`sh`, `go`,
`python`, `rust`). See `ROADMAP.md` for the org layout.

The site itself is a build-time function of the date: `layouts/home.html` renders
*today's* example version (`now.UTC`) into the hero, and client JS rolls it over
at UTC midnight. The `daily-build` workflow pokes a Cloudflare deploy hook every
day so a freshly-built page always shows the current date.

## Commands

Everything runs through the `Makefile`. Hugo is **not** installed globally — it is
pinned via the `go tool` directive in `go.mod` (`go tool hugo`), so the only host
deps are Go and `uv`.

- `make serve` — live-reloading dev server
- `make build` — render to `site/public`
- `make fonts` — regenerate subsetted woff2 + favicon (see below); commit the result
- `make check-fonts` — CI guard; build the site and fail if committed fonts miss a glyph
- `make clean` — remove `site/public` and `site/resources`

CI (`.github/workflows/check.yml`) runs `make check-fonts` on every push/PR, which
also catches Hugo template errors since it builds the site first.

## Font pipeline (the non-obvious part)

The woff2 in `site/assets/fonts/` are **subsets** of the vendored IBM Plex OTFs in
`fonts/src/` — only the glyphs the rendered HTML actually uses (~90 KB total).
`fonts/build.py` builds the site, scans every codepoint in the output HTML, and
subsets each weight to that set; it also outlines the `gcv` favicon from Mono
SemiBold so the favicon carries no font dependency.

**If you add a character the site doesn't already use** (a new symbol, accented
letter, arrow, etc.), `make check-fonts` will fail. Fix it with `make fonts` and
commit the regenerated woff2 + `favicon.svg`.

Output is **byte-reproducible**: `fonttools`/`brotli` are version-pinned in the
`Makefile`'s `PY` variable and source timestamps are preserved
(`recalcTimestamp=False`). Don't bump those versions casually — it changes the
woff2 bytes. See `fonts/README.md`.

## Hugo specifics

- **Flat layout structure** (Hugo ≥0.146): `layouts/baseof.html`, `home.html`,
  `page.html` live directly in `layouts/`, not under `_default/`.
- **No comment before `{{ define }}`** in a layout — put the copyright inside the
  template comment (`{{- /* ... */ -}}`), as the existing layouts do, or the
  define won't register (Hugo then skips `baseof.html` and the page renders
  blank). Keep that comment on a single line: an auto-formatter that reflows it
  across lines splits `*/` from `-}}` and re-triggers this. `site/layouts/.dir-locals.el`
  sets `apheleia-inhibit` to keep Prettier (via Emacs apheleia) off these files
  for exactly this reason — the layouts are hand-formatted on purpose.
- `site/assets/css/main.css` is run through `resources.ExecuteAsTemplate` — it
  contains Hugo template syntax (`{{ ... }}` for fingerprinted font URLs), then is
  minified and fingerprinted. It is a template, not plain CSS.
- Markdown allows raw HTML (`markup.goldmark.renderer.unsafe = true`); the spec
  and getting-started pages rely on this.
- `CF_ANALYTICS_TOKEN` is read at build time and is explicitly allowlisted in
  `hugo.toml` under `[security.funcs] getenv` (the default allowlist is `HUGO_*`/`CI`
  only). The analytics `<script>` only renders when that env var is set.

## Deployment

Cloudflare Pages, from `site/public`. `site/static/_headers` sets immutable
long-cache on fingerprinted `/css/*` and `/fonts/*`; `site/static/_redirects`
maps `/sh` to the raw script and `/go*` to the home page (the `go-import` meta tag
in `baseof.html` makes `gitcalver.org/go` a vanity import path). Pin
`HUGO_VERSION` in the Cloudflare build settings to match `go.mod`.

## Conventions

- **Brand casing**: "GitCalVer" in prose; lowercase `gitcalver` for the logo,
  command, package names, URLs, and the site `title`.
- Source files carry an SPDX header: site content/layouts/CSS are `CC-BY-4.0`;
  build tooling (`Makefile`, `fonts/build.py`, workflows) is `MIT`.
