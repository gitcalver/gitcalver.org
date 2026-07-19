---
title: "Getting Started"
description:
  "Add GitCalVer to your build—shell, Python, Go, Rust, GitHub Actions, npm,
  Docker"
# Copyright © 2026 Michael Shields. SPDX-License-Identifier: CC-BY-4.0
---

## Shell script

The reference implementation is a single POSIX shell script with no dependencies
beyond `git`.

Quick version check:

```sh
curl -sL https://gitcalver.org/sh | sh
```

Or install locally:

```sh
curl -sLO https://gitcalver.org/sh && chmod +x sh && mv sh gitcalver.sh
./gitcalver.sh                # → 20260411.3
./gitcalver.sh --prefix "0."  # → 0.20260411.3
./gitcalver.sh --prefix "v0." # → v0.20260411.3
```

Options:

```sh
./gitcalver.sh --prefix "0." --dirty "-dirty"  # SemVer ecosystems, allow dirty
./gitcalver.sh --branch "release"              # mint versions on a specific branch
```

## Python (Hatch)

Add GitCalVer as a [Hatch](https://hatch.pypa.io/) version source plugin in your
`pyproject.toml`:

```toml
[project]
dynamic = ["version"]

[build-system]
requires = ["hatchling", "gitcalver"]
build-backend = "hatchling.build"

[tool.hatch.version]
source = "gitcalver"
dirty = "+dirty"
```

Build and the version is derived automatically:

```sh
pip install gitcalver
hatch build  # version comes from git history
```

## Go

Install the CLI:

```sh
go install gitcalver.org/go/cmd/gitcalver@latest
```

The Go implementation intentionally exposes only a CLI. Set an application’s
version at build time with `-ldflags`:

```sh
VERSION=$(gitcalver --prefix 0.)
go build -ldflags "-X main.version=$VERSION" .
```

## Rust (Cargo)

Use the shell reference implementation to compute a crate’s version:

```sh
VERSION=$(./gitcalver.sh --prefix 0.)
```

Cargo requires the version in `Cargo.toml`; it has no built-in command-line
override. Have the project’s release script update a temporary publication copy
with `$VERSION`, then run `cargo publish`, so the source manifest does not
become version state.

## GitHub Actions

```yaml
- uses: actions/checkout@v6
  with:
    fetch-depth: 0 # Make the complete first-parent history available

- uses: gitcalver/sh@v20260719.1
  id: version
  with:
    prefix: "0." # optional, for semver ecosystems

- run: echo "Building version ${{ steps.version.outputs.version }}"
```

The action outputs:

| Output    | Example         |
| --------- | --------------- |
| `version` | `0.20260411.3`  |
| `date`    | `20260411`      |
| `count`   | `3`             |
| `dirty`   | `false`         |
| `hash`    | `a1b2c3d`       |
| `tag`     | `v0.20260411.3` |

In a release workflow, `tag-prefix: "v"` and `tag: "true"` make the action claim
the publication tag without force after preceding checks succeed.

## npm

Use the shell script or Go CLI to set the version before publishing:

```sh
VERSION=$(./gitcalver.sh --prefix 0.)
npm version "$VERSION" --no-git-tag-version
npm publish
```

Or in `package.json` scripts:

```json
{
  "scripts": {
    "version:gitcalver": "npm version $(./gitcalver.sh --prefix 0.) --no-git-tag-version",
    "prepublishOnly": "npm run version:gitcalver"
  }
}
```

Do not name this helper `version`: npm reserves that name for the lifecycle run
by `npm version`, which would call the helper recursively.

## Docker

Tag images with the GitCalVer version:

```sh
VERSION=$(./gitcalver.sh)
docker build -t myapp:"$VERSION" .
docker push myapp:"$VERSION"
```

Or in CI:

```yaml
- run: |
    VERSION=$(./gitcalver.sh)
    docker build -t ghcr.io/${{ github.repository }}:$VERSION .
    docker push ghcr.io/${{ github.repository }}:$VERSION
```

## All formats

See [Compatibility](/compatibility) for package-manager prefixes, dirty forms,
dependency ranges, and constrained platform fields.
