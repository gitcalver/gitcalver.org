#!/usr/bin/env python3
# Copyright © 2026 Michael Shields
# SPDX-License-Identifier: MIT
"""Regenerate the site's subsetted web fonts and outlined favicon from the
vendored IBM Plex TrueType files (fonts/src/), deriving the glyph set from the
actually rendered HTML so any character used on the site is covered.

TrueType (glyf) outlines, not the CFF .otf build: iOS Lockdown Mode (Safari 26+)
runs web fonts through a memory-safe parser that rejects CFF's charstring VM, so
CFF fonts silently fall back. glyf outlines pass it.

  python fonts/build.py build <rendered-html-dir>   # write woff2 + favicon
  python fonts/build.py check <rendered-html-dir>    # verify committed bytes

Run via `make fonts` / `make check-fonts`, which build the site first.
"""

import hashlib
import html
import pathlib
import sys
import tempfile

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

REPO = pathlib.Path(__file__).resolve().parent.parent
SRC = REPO / "fonts" / "src"
OUT_FONTS = REPO / "site" / "assets" / "fonts"
FAVICON = REPO / "site" / "static" / "favicon.svg"

# Source TTF -> published woff2. The @font-face weights in main.css match these.
WEIGHTS = [
    ("IBMPlexSans-Text.ttf", "ibm-plex-sans-450.woff2"),
    ("IBMPlexSans-Medium.ttf", "ibm-plex-sans-500.woff2"),
    ("IBMPlexSans-SemiBold.ttf", "ibm-plex-sans-600.woff2"),
    ("IBMPlexSans-Bold.ttf", "ibm-plex-sans-700.woff2"),
    ("IBMPlexMono-Regular.ttf", "ibm-plex-mono-400.woff2"),
    ("IBMPlexMono-Medium.ttf", "ibm-plex-mono-500.woff2"),
    ("IBMPlexMono-SemiBold.ttf", "ibm-plex-mono-600.woff2"),
]
FAVICON_SRC = "IBMPlexMono-SemiBold.ttf"
GENERATED_FONT_FILES = [out for _, out in WEIGHTS] + ["OFL.txt"]

# Always keep printable ASCII + NBSP, independent of the current content.
MIN_CODEPOINT = 0x20  # drop C0 control characters
SURROGATES = range(0xD800, 0xE000)  # UTF-16 surrogate halves, never standalone
REPLACEMENT = 0xFFFD  # U+FFFD, emitted by decode errors
BASELINE = set(range(MIN_CODEPOINT, 0x7F)) | {0xA0}


def collect_codepoints(html_dir: str) -> set[int]:
    """Every codepoint appearing in the rendered HTML (a safe superset of the
    visible text — markup/URLs are ASCII and harmless to include). This also
    captures JS-injected strings, which are literals in the page source.

    Entities are decoded first so typographer output like `&rsquo;` / `&mdash;`
    counts as the glyph the browser renders, not as the ASCII of `&rsquo;`."""
    cps = set(BASELINE)
    files = list(pathlib.Path(html_dir).rglob("*.html"))
    if not files:
        sys.exit(f"no .html under {html_dir!r} — build the site first")
    for p in files:
        text = html.unescape(p.read_text(encoding="utf-8", errors="replace"))
        cps.update(ord(c) for c in text)
    return {
        c
        for c in cps
        if c >= MIN_CODEPOINT and c not in SURROGATES and c != REPLACEMENT
    }


def _cmap(font: TTFont) -> dict[int, str]:
    """The font's best Unicode cmap, or fail loudly if it lacks one."""
    cmap = font.getBestCmap()
    if cmap is None:
        sys.exit("font has no usable Unicode cmap")
    return cmap


def _subsetter() -> Subsetter:
    opt = Options()
    opt.flavor = "woff2"
    opt.layout_features = ["*"]  # keep kerning et al.
    # Keep the full name table for license identification. fontTools accepts the
    # "*" wildcard at runtime, though its stub types name_IDs as list[int].
    opt.name_IDs = ["*"]  # ty: ignore[invalid-assignment]
    opt.drop_tables = [*opt.drop_tables, "meta"]  # not web-relevant; drop quietly
    # (new list, not += — Options.drop_tables is a shared class default)
    return Subsetter(options=opt)


def build_assets(
    html_dir: str,
    out_fonts: pathlib.Path,
    favicon: pathlib.Path,
    *,
    announce: bool,
) -> int:
    """Generate every published font asset at caller-selected paths."""
    cps = collect_codepoints(html_dir)
    if announce:
        print(f"building fonts for {len(cps)} codepoints derived from {html_dir}")
    out_fonts.mkdir(parents=True, exist_ok=True)
    for ttf, out in WEIGHTS:
        # recalcTimestamp=False keeps the source's head.modified instead of
        # stamping "now", so the output woff2 are byte-reproducible.
        font = TTFont(SRC / ttf, recalcTimestamp=False)
        ss = _subsetter()
        ss.populate(unicodes=cps)
        ss.subset(font)
        font.flavor = "woff2"
        font.save(out_fonts / out)
        if announce:
            print(f"  {out:28} {(out_fonts / out).stat().st_size:>7} bytes")
    (out_fonts / "OFL.txt").write_bytes((SRC / "OFL.txt").read_bytes())
    _favicon(favicon)
    if announce:
        print("  favicon.svg (outlined paths)")
    return len(cps)


def build(html_dir: str) -> None:
    build_assets(html_dir, OUT_FONTS, FAVICON, announce=True)


def _favicon(path: pathlib.Path) -> None:
    """Outline 'gcv' (Mono SemiBold) to SVG paths — no font dependency."""
    font = TTFont(SRC / FAVICON_SRC)
    scale = 21.0 / font["head"].unitsPerEm  # ty: ignore[unresolved-attribute]
    cmap, gs, hmtx = _cmap(font), font.getGlyphSet(), font["hmtx"]
    names = [cmap[ord(c)] for c in "gcv"]
    penx, x = [], 0.0
    for n in names:
        penx.append(x)
        x += hmtx[n][0] * scale + -1.2  # advance + letter-spacing
    bounds = BoundsPen(gs)
    for n, px in zip(names, penx, strict=True):
        gs[n].draw(TransformPen(bounds, Transform(scale, 0, 0, -scale, px, 0)))
    if bounds.bounds is None:
        sys.exit("favicon: glyphs produced empty bounds")
    x0, y0, x1, y1 = bounds.bounds
    tx, ty = 32.0 - (x0 + x1) / 2.0, 34.0 - (y0 + y1) / 2.0  # centre at (32,34)
    pen = SVGPathPen(gs, ntos=lambda v: format(round(v, 2) + 0, "g"))
    for n, px in zip(names, penx, strict=True):
        gs[n].draw(TransformPen(pen, Transform(scale, 0, 0, -scale, px + tx, ty)))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
        '  <rect width="64" height="64" rx="14" fill="#23262b"/>\n'
        f'  <path d="{pen.getCommands()}" fill="#ffffff"/>\n'
        "</svg>\n",
        encoding="utf-8",
    )


def _sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def compare_assets(
    expected_fonts: pathlib.Path,
    expected_favicon: pathlib.Path,
    actual_fonts: pathlib.Path,
    actual_favicon: pathlib.Path,
) -> list[str]:
    """Return every missing or byte-different generated asset."""
    pairs = [
        *(
            (expected_fonts / name, actual_fonts / name)
            for name in GENERATED_FONT_FILES
        ),
        (expected_favicon, actual_favicon),
    ]
    problems = []
    for expected, actual in pairs:
        if not actual.is_file():
            problems.append(f"{actual.name}: missing")
        elif expected.read_bytes() != actual.read_bytes():
            problems.append(
                f"{actual.name}: committed sha256 {_sha256(actual)} "
                f"!= regenerated sha256 {_sha256(expected)}",
            )
    return problems


def check(html_dir: str) -> None:
    with tempfile.TemporaryDirectory(prefix="gitcalver-fonts-") as tmp:
        root = pathlib.Path(tmp)
        expected_fonts = root / "fonts"
        expected_favicon = root / "favicon.svg"
        used_count = build_assets(
            html_dir,
            expected_fonts,
            expected_favicon,
            announce=False,
        )
        problems = compare_assets(
            expected_fonts,
            expected_favicon,
            OUT_FONTS,
            FAVICON,
        )
    if problems:
        print(
            "FONT CHECK FAILED — committed generated assets differ from the "
            "pinned build; run `make fonts` and commit the result:",
        )
        for p in problems:
            print("  " + p)
        sys.exit(1)
    print(
        "font check OK — committed fonts and favicon exactly match the pinned "
        f"build for all {used_count} used codepoints",
    )


if __name__ == "__main__":
    match sys.argv[1:]:
        case ["build", html_dir]:
            build(html_dir)
        case ["check", html_dir]:
            check(html_dir)
        case _:
            sys.exit(__doc__)
