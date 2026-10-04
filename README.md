<!-- Copyright © 2026 Michael Shields. SPDX-License-Identifier: CC-BY-4.0 -->

# gitcalver.org

The specification and documentation site for [GitCalVer](https://gitcalver.org),
a versioning scheme that derives unique, increasing `YYYYMMDD.N` versions from a
default branch’s git history.

The implementations live in separate repositories:

- [`gitcalver/sh`](https://github.com/gitcalver/sh)—POSIX shell reference
  implementation, conformance suite, and GitHub Action
- [`gitcalver/python`](https://github.com/gitcalver/python)—Python API, CLI, and
  Hatch plugin
- [`gitcalver/go`](https://github.com/gitcalver/go)—standalone Go CLI
- [`gitcalver/rust`](https://github.com/gitcalver/rust)—experimental Rust port

## Work on the site

The site is built with Hugo. Node is pinned in `.node-version`; `pyproject.toml`
pins Python exactly and sets a uv version floor, and npm and Python dependencies
are locked in `package-lock.json` and `uv.lock`.

```sh
npm ci       # install the locked Node tooling
make build   # render to site/public
make serve   # run the local development server
make lint    # check Markdown and Python tooling
```

Each `Makefile` target has a `##` description, and CI runs the `check-*` guards.
`make check-accessibility`, `make check-interactions`, and `make social-card`
need the locked browser, installed with
`node_modules/.bin/playwright install chromium` and reinstalled after any
Playwright version change.

Run `make fonts` and commit the regenerated font files whenever rendered text
introduces a codepoint that the current subsets lack.

The deployed site is served by a Cloudflare Static Assets Worker. Workers Builds
runs `npm ci && make build`, then `npm run deploy`, which invokes the locked
Wrangler. `make check-worker` exercises the same configuration locally.
Canonical pages omit trailing slashes; keep internal links in that form.

See [ROADMAP.md](ROADMAP.md) for release status and planned work.
