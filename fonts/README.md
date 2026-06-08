# Fonts

Self-hosted web fonts for gitcalver.org, built from **official IBM Plex**.

## Source (vendored, pinned)

`src/` holds the upstream OTFs from [IBM/plex](https://github.com/IBM/plex) at
commit [`2f9ba1b`](https://github.com/IBM/plex/commit/2f9ba1b25957d958db71a849e85d72e3ecfb845a)
(plex-sans 1.1.0, 2026-05-26), under the SIL Open Font License 1.1
(`src/OFL.txt`). IBM Plex has no variable build, so we ship static weights:
Sans Text (450), Medium (500), SemiBold (600), Bold (700); Mono Regular (400),
Medium (500), SemiBold (600).

## Regenerating

The woff2 in `../site/assets/fonts/` are **subsets** — only the glyphs the site
actually renders (~90 KB for all seven weights). The glyph set is derived
automatically from the built HTML, so adding a character anywhere on the site
is handled by regenerating:

```sh
make fonts        # rebuild the subsets + favicon from src/, then commit them
make check-fonts  # CI guard: fails if the committed fonts miss a used glyph
```

`build.py` renders the site, collects every codepoint in the output HTML
(plus ASCII), and subsets each OTF to those. It also outlines the `gcv`
favicon (`../site/static/favicon.svg`) from Mono SemiBold, so the favicon
carries no font dependency. `check-fonts` runs in CI
(`.github/workflows/check.yml`) and fails the build if a glyph the site uses
is absent from the committed subset — the prompt is to run `make fonts`.

Output is **byte-reproducible**: `fonttools`/`brotli` are version-pinned in the
`Makefile` and the source `head.modified` timestamp is preserved
(`recalcTimestamp=False`), so `make fonts` yields identical woff2 every run.
