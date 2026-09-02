# Fonts

Self-hosted web fonts for gitcalver.org: **Inter** for text and **IBM Plex
Mono** for code, both built from the official upstream releases.

## Sources (vendored, pinned)

`src/inter/` holds the static **TrueType** (`glyf`) builds from the
[Inter 4.1](https://github.com/rsms/inter/releases/tag/v4.1) release archive
(`Inter-4.1.zip`, sha256
`9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e`; tag `v4.1`
at commit
[`e3a3d4c`](https://github.com/rsms/inter/commit/e3a3d4c57d5ecc01453a575621882a384c1995a3),
2024-11-16), taken from its `extras/ttf/` directory: Regular (400), Italic (400,
for prose emphasis), Medium (500), SemiBold (600), and Bold (700), under the SIL
Open Font License 1.1 (`src/inter/LICENSE.txt`; Inter declares no Reserved Font
Name).

`src/ibm-plex/` holds the TrueType builds of IBM Plex Mono from
[IBM/plex](https://github.com/IBM/plex) at commit
[`2f9ba1b`](https://github.com/IBM/plex/commit/2f9ba1b25957d958db71a849e85d72e3ecfb845a)
(2026-05-26), under the SIL Open Font License 1.1 (`src/ibm-plex/OFL.txt`):
Regular (400), Medium (500), SemiBold (600).

Inter also ships a variable build (`InterVariable.ttf`, with weight and
optical-size axes). We ship static instances instead, on purpose. Lockdown
Mode's parser is reported to accept TrueType variable fonts but to disable their
variation, pinning every axis to its default
([lincolnquirk.com](https://www.lincolnquirk.com/2026/06/27/lockdown-fonts.html)),
so a variable Inter would render as Regular at every weight there. (The figure
renderer, `scripts/diagrams/render.mjs`, also measures label widths from the
static fonts' plain `hmtx` advances, though static snapshots could be instanced
for that if this ever changes.) That costs bytes: a variable subset built the
same way is one ~39 KB file, against ~16 KB per static face with three to five
faces per page. The static files come from the archive's `extras/ttf/`, which
are hinted, rather than its `web/` woff2, which are shipped unhinted to save
bytes; the subsetter keeps the hints, which matter for ClearType on low-density
Windows displays.

Both families are vendored as TrueType (`glyf`) builds, not the CFF `.otf`
builds each release also offers: iOS Lockdown Mode (Safari 26+) runs web fonts
through a memory-safe parser that rejects CFF's charstring interpreter, so a CFF
subset silently falls back to the system serif. The `glyf` outlines pass the
parser and render normally.

## Regenerating

The woff2 in `../site/assets/fonts/` are **subsets** — only the glyphs the site
actually renders (~105 KB for all eight faces). The glyph set is derived
automatically from the built HTML, so adding a character anywhere on the site is
handled by regenerating:

```sh
make fonts        # rebuild the subsets + favicon from src/, then commit them
make check-fonts  # byte-compare a clean rebuild and test tamper detection
```

`build.py` renders the site, collects every codepoint in the output HTML (plus
ASCII), and subsets each TTF to those. The subsets keep only the OpenType
features browsers apply by default (kerning, contextual alternates, glyph
composition, marks, language forms); Inter's optional stylistic sets and
character variants are dropped, since no CSS enables them, which halves its
subsets. `build.py` also outlines the `gcv` favicon
(`../site/static/favicon.svg`) from Inter SemiBold, so the favicon carries no
font dependency. `check-fonts` runs in CI (`.github/workflows/check.yml`) and
fails unless every committed font and the favicon exactly match a clean
regeneration. Because the glyph set comes from the rendered site, this also
catches a newly used glyph that has not been committed yet.

Adding a font file the templates reference is the one case `make fonts` cannot
bootstrap itself: the site render it starts from fails on the missing asset.
Seed an empty placeholder at the new path first, then run `make fonts` normally.

Output is **byte-reproducible**: `fonttools`/`brotli` are version-pinned in the
Python project and `uv.lock`, and the source `head.modified` timestamp is
preserved (`recalcTimestamp=False`), so `make fonts` yields identical woff2
every run.
