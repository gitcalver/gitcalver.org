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

.PHONY: build serve fonts check-fonts clean

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

## clean: remove build output
clean:
	rm -rf $(SITE)/public $(SITE)/resources
