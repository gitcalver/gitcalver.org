---
title: "Getting Started"
description: "Add gitcalver to your build — shell, Python, Go, GitHub Actions, npm, Docker"
# Copyright © 2026 Michael Shields. SPDX-License-Identifier: CC-BY-4.0
---

## Shell script

The reference implementation is a single POSIX shell script with no
dependencies beyond `git`.

Quick version check:

```sh
curl -sL https://gitcalver.org/sh | sh
```

Or install locally:

```sh
curl -sLO https://gitcalver.org/sh && chmod +x sh && mv sh gitcalver.sh
./gitcalver.sh              # → 20260411.3
./gitcalver.sh --prefix 0.  # → 0.20260411.3
./gitcalver.sh --prefix v0. # → v0.20260411.3
```

Options:

```sh
./gitcalver.sh --prefix 0. --dirty -dirty  # SemVer ecosystems
./gitcalver.sh --allow-dirty      # Allow dirty workspace
./gitcalver.sh --branch release   # Use a specific branch
```

## Python (Hatch)

Add gitcalver as a [Hatch](https://hatch.pypa.io/) version source plugin in
your `pyproject.toml`:

```toml
[project]
dynamic = ["version"]

[build-system]
requires = ["hatchling", "gitcalver"]
build-backend = "hatchling.build"

[tool.hatch.version]
source = "gitcalver"

[tool.hatch.version.gitcalver]
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
go install gitcalver.org/go@latest
```

Or use it as a library:

```go
package main

import (
	"fmt"
	"gitcalver.org/go"
)

func main() {
	v, err := gitcalver.Version(gitcalver.Options{
		Prefix: "v0.",
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(v) // → v0.20260411.3
}
```

Set the version at build time with `-ldflags`:

```sh
VERSION=$(gitcalver --prefix v0.)
go build -ldflags "-X main.version=$VERSION" .
```

## GitHub Actions

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Full history needed for accurate count

- uses: gitcalver/sh@v20260412.1
  id: version
  with:
    prefix: '0.'          # optional, for semver ecosystems

- run: echo "Building version ${{ steps.version.outputs.version }}"
```

The action outputs:

| Output | Example |
|---|---|
| `version` | `0.20260411.3` |
| `date` | `20260411` |
| `count` | `3` |
| `dirty` | `false` |
| `hash` | `a1b2c3d` |

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
    "version": "npm version $(./gitcalver.sh --prefix 0.) --no-git-tag-version",
    "prepublishOnly": "npm run version"
  }
}
```

## Docker

Tag images with the gitcalver version:

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

See the [ecosystem mapping](/spec/#ecosystem-mapping) in the specification for
the recommended `--prefix` and `--dirty` flags for each package manager.
