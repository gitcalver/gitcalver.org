#!/usr/bin/env python3
# Copyright © 2026 Michael Shields
# SPDX-License-Identifier: MIT
"""Guard the trimmed Chroma syntax theme in site/assets/css/main.css.

main.css ships Modus color rules only for the Chroma tokens the rendered code
samples actually emit (Chroma can tag far more than Modus colors, and the
samples exercise fewer still). This is the syntax-highlighting analog of
`make check-fonts`: it builds nothing itself but, given the rendered HTML, fails
if a content edit introduces a Modus-colored token that main.css no longer
styles — which would silently fall back to the default text color — and prints
the rule to restore.

  python check_css.py <rendered-html-dir>

Run via `make check-css`, which builds the site first.
"""

import pathlib
import re
import sys

CSS = pathlib.Path(__file__).resolve().parent / "site/assets/css/main.css"

# The complete Modus theme: every Chroma token it tints, grouped by the
# (light, dark) color it shares. A token absent here is left at the default
# text color on purpose (punctuation, whitespace, names Modus doesn't tint), so
# emitting it unstyled is fine. main.css carries rules for the subset of these
# that the samples currently emit; anything else here is a rule to re-add if a
# code edit starts emitting it.
_MODUS_GROUPS: dict[tuple[str, str], tuple[str, ...]] = {
    ("#5317ac", "#b6a0ff"): ("k", "kd", "kn", "kp", "kr"),
    ("#0000c0", "#00bcff"): ("kc", "l", "ld", "m", "mb", "mf", "mh", "mi", "il", "mo"),
    ("#005a5f", "#6ae4b9"): ("kt",),
    ("#8f0075", "#f78fe7"): ("nb", "bp"),
    ("#00538b", "#00d3d0"): ("nv", "vc", "vg", "vi", "vm", "o", "ow", "or"),
    ("#721045", "#feacd0"): ("nf", "fm"),
    ("#2544bb", "#79a8ff"): (
        "s", "sa", "sb", "sc", "dl", "sd", "s2",
        "se", "sh", "si", "sx", "sr", "s1", "ss",
    ),
    ("#505050", "#a8a8a8"): ("c", "ch", "cm", "c1", "cs", "cp", "cpf"),
}  # fmt: skip
MODUS: dict[str, tuple[str, str]] = {
    tok: colors for colors, toks in _MODUS_GROUPS.items() for tok in toks
}

# A styled token appears once in the light scope and once in the dark
# prefers-color-scheme block, so a fully-present rule shows up exactly twice;
# fewer means one mode lost its color.
RULES_PER_TOKEN = 2

# Chroma emits these span classes only when line numbers or hl_lines are
# enabled. Their layout rules (not Modus colors) were pruned from main.css with
# the rest of the theme, so any of them appearing means restoring the whole
# .chroma .hl/.lnt/.ln block from main.css's git history, not a color rule.
SCAFFOLDING = ("hl", "lnt", "ln")


def emitted_tokens(html_dir: pathlib.Path) -> set[str]:
    """Chroma token classes appearing inside real `pre.chroma` blocks.

    Scoped to Chroma output so it ignores the hand-written landing code block,
    whose `.code .cm`/`.pr`/`.out` spans reuse short class names that collide
    with Chroma's."""
    files = list(html_dir.rglob("*.html"))
    if not files:
        sys.exit(f"no .html under {str(html_dir)!r} — build the site first")
    pre = re.compile(
        r"<pre[^>]*\bclass=(?:\"[^\"]*chroma[^\"]*\"|[^\s\">]*chroma[^\s\">]*)"
        r"[^>]*>(.*?)</pre>",
        re.DOTALL,
    )
    span = re.compile(r"<span class=(\"[^\"]*\"|[^\s>]+)")
    tokens: set[str] = set()
    for p in files:
        text = p.read_text(encoding="utf-8", errors="replace")
        for block in pre.findall(text):
            for cls in span.findall(block):
                tokens.update(cls.strip('"').split())
    return tokens


def rule_count(css: str, token: str) -> int:
    """How many `.chroma .<token>` rules main.css carries (light + dark). The
    trailing boundary keeps `.s` from also matching `.s2`, `.sd`, `.sr`, …"""
    return len(re.findall(rf"\.chroma \.{re.escape(token)}\b", css))


def check(html_dir: pathlib.Path) -> None:
    css = CSS.read_text(encoding="utf-8")
    emitted = emitted_tokens(html_dir)
    missing = sorted(
        t for t in emitted if t in MODUS and rule_count(css, t) < RULES_PER_TOKEN
    )
    unstyled = sorted(t for t in emitted if t in SCAFFOLDING and not rule_count(css, t))
    if missing:
        print("CSS CHECK FAILED — the rendered code samples emit Modus-colored")
        print("Chroma tokens that site/assets/css/main.css no longer styles.")
        print("Add these (the dark color goes in the prefers-color-scheme block):")
        for tok in missing:
            light, dark = MODUS[tok]
            print(f"  .chroma .{tok}{{color:{light}}}   /* dark: {dark} */")
    if unstyled:
        print("CSS CHECK FAILED — line numbers or line highlights are enabled, but")
        print("their .chroma layout rules were pruned from site/assets/css/main.css;")
        print("restore the .hl/.lnt/.ln (and lntable) rules from its git history.")
    if missing or unstyled:
        sys.exit(1)
    print("css check OK — every Modus-colored token the samples emit is styled")


if __name__ == "__main__":
    match sys.argv[1:]:
        case [html_dir]:
            check(pathlib.Path(html_dir))
        case _:
            sys.exit(__doc__)
