# Copyright © 2026 Michael Shields
# SPDX-License-Identifier: MIT

# Repo tasks. Hugo is pinned via the `go tool` directive in go.mod, Python and
# uv via .python-version + pyproject.toml, and Node tools via package-lock.json.
HUGO   := go tool hugo
SITE   := site
PUBLIC := $(SITE)/public
CACHE  := $(or $(TMPDIR),/tmp)/gcv-hugo-cache
NODE_BIN := node_modules/.bin
# The full site render every build-dependent target starts from.
RENDER := $(HUGO) -s $(SITE) --cacheDir "$(CACHE)" --cleanDestinationDir
# Font deps (incl. the version-pinned woff2 toolchain) come from pyproject.toml;
# --no-dev skips the lint tools the build itself doesn't need.
PY       := uv run --frozen --quiet --no-dev python fonts/build.py
FONT_TEST := uv run --frozen --quiet --no-dev python -m fonts.test_build
PRETTIER := $(NODE_BIN)/prettier '**/*.md'
RUFF     := uv run --frozen ruff
TY       := uv run --frozen ty
LINKS    := uv run --frozen --quiet --no-dev python check_links.py
LHCI     := $(NODE_BIN)/lhci

.PHONY: build serve fonts check-toolchain check-fonts check-html check-links check-css check-worker check-accessibility check-interactions lighthouse lint fmt deploy clean

## build: render the site to site/public
build:
	$(RENDER)

## serve: live-reloading dev server
serve:
	$(HUGO) server -s $(SITE) --cacheDir "$(CACHE)"

## fonts: regenerate subsetted woff2 + outlined favicon from the vendored
## IBM Plex TTFs, with the glyph set derived from the rendered HTML.
fonts:
	$(RENDER)
	$(PY) build $(PUBLIC)

## check-toolchain: fail unless the exact Node, npm, uv, and Python versions
## pinned for reproducible site work are active.
check-toolchain:
	@expected=$$(cat .node-version); test "$$(node --version)" = "v$$expected" || { echo "FAIL: Node $$expected required"; exit 1; }
	@expected=$$(node -p "require('./package.json').packageManager.slice(4)"); test "$$(npm --version)" = "$$expected" || { echo "FAIL: npm $$expected required"; exit 1; }
	@expected=$$(sed -n 's/^required-version = "==\(.*\)"$$/\1/p' pyproject.toml); test "$$(uv --version | awk '{print $$2}')" = "$$expected" || { echo "FAIL: uv $$expected required"; exit 1; }
	@expected=$$(cat .python-version); test "$$(uv run --frozen --quiet python --version)" = "Python $$expected" || { echo "FAIL: Python $$expected required"; exit 1; }
	@echo "toolchain check OK"

## check-fonts: byte-compare the committed fonts and favicon with a clean,
## pinned regeneration; then prove the comparison catches tampering.
check-fonts:
	$(RENDER)
	$(PY) check $(PUBLIC)
	$(FONT_TEST)

## check-html: build and assert the documentation routes, versioned
## specification, redirects, go-import vanity tags, robots.txt, and hosted
## install script survive in the output.
check-html:
	$(RENDER)
	@test -f $(PUBLIC)/compatibility/index.html || { echo "FAIL: /compatibility page missing"; exit 1; }
	@test -f $(PUBLIC)/spec/0.1/index.html || { echo "FAIL: immutable /spec/0.1 page missing"; exit 1; }
	@test ! -f $(PUBLIC)/spec/index.html || { echo "FAIL: /spec must not render a page (would shadow the /spec -> /spec/0.1 redirect)"; exit 1; }
	@grep -qF 'Erratum (nonnormative).' $(PUBLIC)/spec/0.1/index.html || { echo "FAIL: /spec/0.1 erratum missing"; exit 1; }
	@grep -qF '/spec /spec/0.1 302' $(PUBLIC)/_redirects || { echo "FAIL: /spec -> /spec/0.1 redirect missing from _redirects"; exit 1; }
	@grep -qF '<loc>https://gitcalver.org/spec/0.1</loc>' $(PUBLIC)/sitemap.xml || { echo "FAIL: /spec/0.1 missing from sitemap"; exit 1; }
	@grep -qF '<loc>https://gitcalver.org/compatibility</loc>' $(PUBLIC)/sitemap.xml || { echo "FAIL: /compatibility missing from sitemap"; exit 1; }
	@! grep -qF '<loc>https://gitcalver.org/spec</loc>' $(PUBLIC)/sitemap.xml || { echo "FAIL: redirecting /spec must not appear in sitemap"; exit 1; }
	@grep -qF 'name="go-import" content="gitcalver.org/go git https://github.com/gitcalver/go"' $(PUBLIC)/go.html || { echo "FAIL: go-import meta missing from /go.html"; exit 1; }
	@grep -qF 'name="go-source"' $(PUBLIC)/go.html || { echo "FAIL: go-source meta missing from /go.html"; exit 1; }
	@grep -qF 'http-equiv="refresh" content="0; url=https://pkg.go.dev/gitcalver.org/go"' $(PUBLIC)/go.html || { echo "FAIL: /go meta-refresh missing"; exit 1; }
	@grep -qF '/go/* /go' $(PUBLIC)/_redirects || { echo "FAIL: /go/* -> /go subpackage redirect missing from _redirects"; exit 1; }
	@! grep -qF 'name="go-import"' $(PUBLIC)/index.html || { echo "FAIL: go-import should be /go-only but appears on the home page"; exit 1; }
	@grep -qF 'Content-Signal:' $(PUBLIC)/robots.txt || { echo "FAIL: Content-Signal missing from robots.txt"; exit 1; }
	@grep -q '^Allow: /' $(PUBLIC)/robots.txt || { echo "FAIL: Allow missing from robots.txt"; exit 1; }
	@grep -qF 'Sitemap: https://gitcalver.org/sitemap.xml' $(PUBLIC)/robots.txt || { echo "FAIL: Sitemap missing from robots.txt"; exit 1; }
	@grep -q '^#!/bin/sh' $(PUBLIC)/gitcalver.sh || { echo "FAIL: /gitcalver.sh install script missing"; exit 1; }
	$(LINKS) $(PUBLIC)
	@echo "html check OK"

## check-links: build and verify every rendered internal page and fragment link.
check-links:
	$(RENDER)
	$(LINKS) $(PUBLIC)

## check-css: fail if the rendered code samples emit a Modus-colored Chroma
## token the trimmed syntax theme in main.css no longer styles (see check_css.py).
check-css:
	$(RENDER)
	uv run --frozen --quiet --no-dev python check_css.py $(PUBLIC)

## check-worker: run the built site through locked local Wrangler and assert
## canonical routes, redirects, headers, content types, and private rule files.
check-worker:
	$(RENDER)
	npm run test:worker

## check-accessibility: run Axe and responsive browser assertions at 320px and
## desktop widths in both light and dark modes. Install the pinned browser with
## `node_modules/.bin/playwright install chromium` once before running locally.
check-accessibility:
	$(RENDER)
	npm run test:accessibility

## check-interactions: exercise keyboard TOCs and scrollspy, Clipboard API and
## fallback outcomes, and keyboard-accessible horizontal overflow.
check-interactions:
	$(RENDER)
	npm run test:interactions

## lighthouse: build the site and audit it with Lighthouse
## (lighthouse:recommended) via lhci's static server; see lighthouserc.cjs.
lighthouse:
	$(RENDER)
	$(LHCI) collect --config=lighthouserc.cjs
	$(LHCI) assert --config=lighthouserc.cjs

## lint: check Markdown formatting and lint/typecheck the Python tooling;
## Ruff/ty walk the repo and skip the gitignored .venv, so any new script is
## covered without listing it here.
lint:
	$(PRETTIER) --check
	$(RUFF) format --check .
	$(RUFF) check .
	$(TY) check .

## fmt: auto-format Markdown and apply safe Python fixes + formatting
fmt:
	$(PRETTIER) --write
	$(RUFF) check --fix .
	$(RUFF) format .

## deploy: upload the rendered site with the package-lock-pinned Wrangler.
deploy:
	npm run deploy

## clean: remove build output
clean:
	rm -rf $(SITE)/public $(SITE)/resources
