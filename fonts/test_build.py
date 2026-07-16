# Copyright © 2026 Michael Shields
# SPDX-License-Identifier: MIT
"""Prove the generated-asset comparison catches font and favicon tampering."""

import pathlib
import sys
import tempfile

from fonts import build


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


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="gitcalver-font-test-") as tmp:
        paths = matching_assets(pathlib.Path(tmp))
        if build.compare_assets(*paths):
            sys.exit("tamper test failed: identical generated assets did not match")

        font = paths[2] / build.GENERATED_FONT_FILES[0]
        font.write_bytes(font.read_bytes() + b"tampered")
        require_single_problem(build.compare_assets(*paths), font.name)

        paths = matching_assets(pathlib.Path(tmp) / "favicon-case")
        paths[3].write_bytes(b"<svg>tampered</svg>\n")
        require_single_problem(build.compare_assets(*paths), paths[3].name)

    print("font tamper tests OK")


if __name__ == "__main__":
    main()
