# Copyright © 2026 Michael Shields
# SPDX-License-Identifier: MIT

# Repo tasks. Hugo is pinned via the `go tool` directive in go.mod, so these
# work with nothing installed but Go and uv.
HUGO   := go tool hugo
SITE   := site
PUBLIC := $(SITE)/public
CACHE  := $(or $(TMPDIR),/tmp)/gcv-hugo-cache
# Pinned for byte-reproducible woff2 (output depends on both versions).
PY     := uv run --quiet --with "fonttools[woff]==4.63.0" --with "brotli==1.2.0" python fonts/build.py

.PHONY: build serve fonts check-fonts check-html clean

## build: render the site to site/public
build:
	$(HUGO) -s $(SITE) --cacheDir "$(CACHE)" --cleanDestinationDir

## serve: live-reloading dev server
serve:
	$(HUGO) server -s $(SITE) --cacheDir "$(CACHE)"

## fonts: regenerate subsetted woff2 + outlined favicon from the vendored
## IBM Plex OTFs, with the glyph set derived from the rendered HTML.
fonts:
	$(HUGO) -s $(SITE) --cacheDir "$(CACHE)" --cleanDestinationDir
	$(PY) build $(PUBLIC)

## check-fonts: fail if the committed fonts miss any glyph the site renders.
check-fonts:
	$(HUGO) -s $(SITE) --cacheDir "$(CACHE)" --cleanDestinationDir
	$(PY) check $(PUBLIC)

## check-html: build and assert the go-import vanity tags, the /go -> pkg.go.dev
## redirect, and the robots.txt content signal survive in the rendered output.
check-html:
	$(HUGO) -s $(SITE) --cacheDir "$(CACHE)" --cleanDestinationDir
	@grep -qF 'name="go-import" content="gitcalver.org/go git https://github.com/gitcalver/go"' $(PUBLIC)/go/index.html || { echo "FAIL: go-import meta missing from /go/index.html"; exit 1; }
	@grep -qF 'name="go-source"' $(PUBLIC)/go/index.html || { echo "FAIL: go-source meta missing from /go/index.html"; exit 1; }
	@grep -qF 'http-equiv="refresh" content="0; url=https://pkg.go.dev/gitcalver.org/go"' $(PUBLIC)/go/index.html || { echo "FAIL: /go meta-refresh missing"; exit 1; }
	@! grep -qF 'name="go-import"' $(PUBLIC)/index.html || { echo "FAIL: go-import should be /go-only but appears on the home page"; exit 1; }
	@grep -qF 'Content-Signal:' $(PUBLIC)/robots.txt || { echo "FAIL: Content-Signal missing from robots.txt"; exit 1; }
	@grep -q '^Allow: /' $(PUBLIC)/robots.txt || { echo "FAIL: Allow missing from robots.txt"; exit 1; }
	@echo "html check OK"

## clean: remove build output
clean:
	rm -rf $(SITE)/public $(SITE)/resources
