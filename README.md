<!-- Copyright © 2026 Michael Shields. SPDX-License-Identifier: CC-BY-4.0 -->

# gitcalver.org

The specification and documentation site for [GitCalVer](https://gitcalver.org),
a versioning scheme that derives `YYYYMMDD.N` versions from a git branch’s
first-parent history.

The implementations live in separate repositories:

- [`gitcalver/sh`](https://github.com/gitcalver/sh)—POSIX shell reference
  implementation, conformance suite, and GitHub Action
- [`gitcalver/python`](https://github.com/gitcalver/python)—Python API, CLI, and
  Hatch plugin
- [`gitcalver/go`](https://github.com/gitcalver/go)—standalone Go CLI
- [`gitcalver/rust`](https://github.com/gitcalver/rust)—experimental Rust port

## Work on the site

The site is built with Hugo. Runtime versions are pinned in `.node-version` and
`.python-version`; uv enforces its version through `pyproject.toml`, and npm and
Python dependencies are locked in `package-lock.json` and `uv.lock`.

```sh
npm ci           # install the locked Node tooling
make build        # render to site/public
make serve        # run the local development server
make check-toolchain # verify Node, npm, uv, and Python versions
make lint         # check Markdown and Python tooling
make check-fonts  # verify the subsetted web fonts
make check-html   # verify routes and HTML
make check-links  # verify rendered internal links and fragments
make check-css    # verify syntax-highlight styles
```

Run `make fonts` and commit the regenerated font files whenever rendered text
introduces a codepoint that the current subsets do not contain.

The deployed site is served by a Cloudflare Static Assets Worker. Workers Builds
uses `make build` followed by `npm run deploy`, which invokes the locked
Wrangler. Canonical pages omit trailing slashes; keep internal links in that
form.

See [ROADMAP.md](ROADMAP.md) for release status and planned work.
