# Copyright © 2026 Michael Shields
# SPDX-License-Identifier: MIT
"""Prove the generated-asset comparison catches font and favicon tampering,
that a codepoint no vendored font covers or an OpenType feature the subsets
drop fails the build instead of shipping, and that seeding creates only the
placeholders a new face needs."""

import pathlib
import sys
import tempfile
from typing import TYPE_CHECKING

from fonts import build

if TYPE_CHECKING:
    from collections.abc import Callable


def matching_assets(
    root: pathlib.Path,
) -> tuple[pathlib.Path, pathlib.Path, pathlib.Path, pathlib.Path]:
    expected_fonts = root / "expected" / "fonts"
    actual_fonts = root / "actual" / "fonts"
    expected_fonts.mkdir(parents=True)
    actual_fonts.mkdir(parents=True)
    for name in build.GENERATED_FONT_FILES:
        content = f"generated {name}\n".encode()
        (expected_fonts / name).write_bytes(content)
        (actual_fonts / name).write_bytes(content)
    expected_favicon = root / "expected" / "favicon.svg"
    actual_favicon = root / "actual" / "favicon.svg"
    expected_favicon.write_bytes(b"<svg>generated</svg>\n")
    actual_favicon.write_bytes(expected_favicon.read_bytes())
    return expected_fonts, expected_favicon, actual_fonts, actual_favicon


def require_single_problem(
    problems: list[str],
    expected_name: str,
) -> None:
    if len(problems) != 1 or not problems[0].startswith(f"{expected_name}:"):
        sys.exit(
            f"tamper test failed: expected one {expected_name} mismatch, "
            f"got {problems!r}",
        )


def require_exit(what: str, needle: str, run: Callable[[], object]) -> None:
    """`run` must abort through sys.exit with `needle` in its message."""
    try:
        run()
    except SystemExit as exit_:
        if needle not in str(exit_.code):
            sys.exit(f"{what} test failed: unexpected exit {exit_.code!r}")
    else:
        sys.exit(f"{what} test failed: nothing aborted")


def page(root: pathlib.Path, body: str) -> str:
    """A one-page rendered site holding `body`, as build_assets takes it."""
    html_dir = root / "html"
    html_dir.mkdir(parents=True)
    (html_dir / "index.html").write_text(body, encoding="utf-8")
    return str(html_dir)


def build_of(root: pathlib.Path, body: str) -> Callable[[], int]:
    return lambda: build.build_assets(
        page(root, body),
        root / "fonts",
        root / "favicon.svg",
        announce=False,
    )


def require_feature_mapping(root: pathlib.Path) -> None:
    """Style elements and attributes both count; a feature switched off, or a
    keyword that only switches one off, does not; alternates are refused.
    Property names and font-variant-* keywords match case-insensitively, a
    multi-word longhand like font-variant-east-asian is recognized, and a
    feature-settings value needs no space before its on/off/integer state."""
    found = build.enabled_features(
        page(
            root / "mapping",
            '<style>p{font-feature-settings:"liga" 0,"ss01" 1,"cv01"1;'
            "Font-Variant-Numeric:Tabular-Nums;"
            "font-variant-east-asian:jis78}</style>"
            '<span style="font-variant-caps:all-small-caps;'
            'font-variant-ligatures:no-contextual">x</span>',
        ),
    )
    if set(found) != {"ss01", "cv01", "tnum", "jp78", "c2sc", "smcp"}:
        sys.exit(f"feature mapping test failed: {found!r}")
    require_exit(
        "alternates",
        "font-variant-alternates",
        lambda: build.enabled_features(
            page(
                root / "alternates",
                "<style>p{font-variant-alternates:stylistic(x)}</style>",
            ),
        ),
    )


def require_seed_only_missing(root: pathlib.Path) -> None:
    """Seeding creates exactly the absent woff2, empty, and touches nothing else."""
    fonts = root / "fonts"
    fonts.mkdir(parents=True)
    present = fonts / build.WEIGHTS[0][1]
    present.write_bytes(b"real")
    seeded = build.seed_placeholders(fonts)
    if (
        seeded != [fonts / out for _, out in build.WEIGHTS[1:]]
        or any(p.stat().st_size for p in seeded)
        or present.read_bytes() != b"real"
    ):
        sys.exit(f"seed test failed: {seeded!r}")
    if build.seed_placeholders(fonts):
        sys.exit("seed test failed: a second run seeded again")


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="gitcalver-font-test-") as tmp:
        root = pathlib.Path(tmp)
        # U+1F600 is in no vendored font.
        require_exit(
            "missing-glyph",
            "U+1F600",
            build_of(root / "missing-glyph", "<p>\U0001f600</p>"),
        )
        # tabular-nums stands for tnum, which LAYOUT_FEATURES drops.
        require_exit(
            "unkept-feature",
            "tnum",
            build_of(
                root / "unkept-feature",
                "<style>p{font-variant-numeric:tabular-nums}</style><p>1</p>",
            ),
        )
        require_feature_mapping(root)
        require_seed_only_missing(root / "seed")

        paths = matching_assets(root)
        if build.compare_assets(*paths):
            sys.exit("tamper test failed: identical generated assets did not match")

        font = paths[2] / build.GENERATED_FONT_FILES[0]
        font.write_bytes(font.read_bytes() + b"tampered")
        require_single_problem(build.compare_assets(*paths), font.name)

        paths = matching_assets(root / "favicon-case")
        paths[3].write_bytes(b"<svg>tampered</svg>\n")
        require_single_problem(build.compare_assets(*paths), paths[3].name)

    print("font tamper, glyph, feature, and seed tests OK")


if __name__ == "__main__":
    main()
