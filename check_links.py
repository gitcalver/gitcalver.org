#!/usr/bin/env python3
# Copyright © 2026 Michael Shields
# SPDX-License-Identifier: MIT
"""Check internal links and fragments in a rendered GitCalVer site.

  python check_links.py <rendered-site-dir>

Run via `make check-links`, or implicitly through `make check-html`.
"""

import pathlib
import posixpath
import sys
from html.parser import HTMLParser
from urllib.parse import unquote, urljoin, urlsplit


class Document(HTMLParser):
    def __init__(self, path: pathlib.Path) -> None:
        super().__init__()
        self.path = path
        self.ids: set[str] = set()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if identifier := attributes.get("id"):
            self.ids.add(identifier)
        if tag == "a" and (href := attributes.get("href")):
            self.links.append(href)


def route_for(path: pathlib.Path, root: pathlib.Path) -> str:
    relative = path.relative_to(root).as_posix()
    if relative == "index.html":
        return "/"
    if relative.endswith("/index.html"):
        return "/" + relative.removesuffix("/index.html")
    return "/" + relative.removesuffix(".html")


def load_documents(root: pathlib.Path) -> dict[str, Document]:
    documents: dict[str, Document] = {}
    for path in root.rglob("*.html"):
        document = Document(path)
        document.feed(path.read_text(encoding="utf-8", errors="replace"))
        documents[route_for(path, root)] = document
    if not documents:
        sys.exit(f"no .html under {str(root)!r}—build the site first")
    return documents


def load_redirects(root: pathlib.Path) -> dict[str, str]:
    redirects: dict[str, str] = {}
    path = root / "_redirects"
    if not path.exists():
        return redirects
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        source, target, *_ = line.split()
        if "*" not in source:
            redirects[source] = target
    return redirects


def normalize(path: str) -> str:
    normalized = posixpath.normpath(unquote(path))
    return normalized if normalized.startswith("/") else "/" + normalized


def resolve(
    source: str,
    href: str,
    redirects: dict[str, str],
) -> tuple[str, str] | None:
    parsed = urlsplit(href)
    if parsed.scheme or parsed.netloc:
        return None

    if not parsed.path:
        path = normalize(source)
    elif parsed.path.startswith("/"):
        path = normalize(parsed.path)
    else:
        path = normalize(urljoin(source, parsed.path))
    fragment = unquote(parsed.fragment)

    visited: set[str] = set()
    while target := redirects.get(path):
        if path in visited:
            sys.exit(f"redirect loop while checking {path}")
        visited.add(path)
        parsed_target = urlsplit(target)
        if parsed_target.scheme or parsed_target.netloc:
            return None
        path = normalize(urljoin(path, parsed_target.path))
        fragment = unquote(parsed_target.fragment) or fragment
    return path, fragment


def check(root: pathlib.Path) -> None:
    documents = load_documents(root)
    redirects = load_redirects(root)
    assets = {
        "/" + path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file()
    }
    problems: list[str] = []

    for source, document in documents.items():
        for href in document.links:
            resolved = resolve(source, href, redirects)
            if resolved is None:
                continue
            target, fragment = resolved
            if target not in documents and target not in assets:
                problems.append(f"{source}: {href!r} points to missing {target}")
                continue
            if fragment and (
                target not in documents or fragment not in documents[target].ids
            ):
                problems.append(
                    f"{source}: {href!r} points to missing fragment #{fragment}",
                )

    if problems:
        print("LINK CHECK FAILED")
        for problem in sorted(problems):
            print(f"  {problem}")
        sys.exit(1)
    print(f"link check OK—{len(documents)} rendered pages have valid internal links")


if __name__ == "__main__":
    match sys.argv[1:]:
        case [root]:
            check(pathlib.Path(root))
        case _:
            sys.exit(__doc__)
