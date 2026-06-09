<!-- Copyright © 2026 Michael Shields. SPDX-License-Identifier: CC-BY-4.0 -->

# gitcalver Roadmap

## Current status

Phases 1–6 are complete: specification, conformance test suite, POSIX shell
reference implementation, licensing, Python package, Go CLI, Rust CLI, and
GitHub Action.

## Repository structure

All repositories live under the `gitcalver` GitHub organization
(`github.com/gitcalver`). Each component has its own repo with independent
versioning and release cycle.

| Repository                | Contents                                                                    | Package registry                     |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------------ |
| `gitcalver/gitcalver.org` | Specification, website (Cloudflare Pages)                                   | —                                    |
| `gitcalver/sh`            | POSIX shell reference implementation, conformance test suite, GitHub Action | —                                    |
| `gitcalver/python`        | Python package: hatch version source plugin, CLI                            | PyPI (`gitcalver`)                   |
| `gitcalver/go`            | Go CLI and library                                                          | `go install gitcalver.org/go@latest` |
| `gitcalver/rust`          | Rust library and CLI                                                        | crates.io (`gitcalver`)              |
| `gitcalver/azure-devops`  | Azure DevOps pipeline task                                                  | Visual Studio Marketplace            |

### Vanity imports

The `gitcalver.org` website (served from `gitcalver/gitcalver.org` via GitHub
Pages) serves `go-import` and `go-source` meta tags so that the Go module is
importable as `gitcalver.org/go` while the source lives in `gitcalver/go`.

### Why separate repos

- Each implementation has its own release lifecycle and version tags. A bugfix
  to the Python plugin should not bump the Go CLI version.
- Go modules need their own tag namespace for `go install` to work.
- Contributors working in one ecosystem don't need the full tree.

### Conformance testing

The conformance test suite in `gitcalver/sh` defines expected behavior for all
implementations. Other repos run `make acceptance` to execute the shell test
suite against their compiled binary, verifying spec compliance.

## Windows support

The POSIX shell reference implementation does not run natively in PowerShell or
cmd.exe. Windows users have several options:

- **Git Bash** (ships with Git for Windows): `gitcalver.sh` works as-is. This
  covers most developer workflows since Windows git users already have Git Bash
  installed.
- **WSL**: works trivially.
- **Go CLI**: a single `.exe` with no runtime dependencies. Uses go-git
  directly, so it doesn't even require `git.exe` on PATH.
- **Rust CLI**: a single `.exe` with no runtime dependencies. Uses gix directly,
  so it doesn't even require `git.exe` on PATH.
- **Python package**: pure Python, calls `git.exe` via subprocess. Works on
  Windows since Git for Windows puts `git.exe` on PATH.

No PowerShell port is planned. The Go and Rust CLIs provide native Windows
support without maintaining a separate implementation.

## Phase 2: Licensing

Add CC BY 4.0 license. No code changes required.

## Phase 3: Python hatch plugin

### Goal

Allow Python projects to use gitcalver natively in `pyproject.toml`:

```toml
[project]
dynamic = ["version"]

[tool.hatch.version]
source = "gitcalver"

[tool.hatch.version.gitcalver]
format = "pep440"
```

### Design

- Pure Python implementation of the gitcalver algorithm (no shell dependency)
- Use `subprocess.run(["git", ...])` to call git, same commands as the shell
  implementation
- Hatch version source plugin: implements the `hatch.version.source` hook
- Package name: `gitcalver` on PyPI
- Includes a `gitcalver` CLI entry point as an alternative to the shell script

### Repository: `gitcalver/python`

```
pyproject.toml
src/
  gitcalver/
    __init__.py           # Public API: get_version(), find_commit()
    _branch.py            # Branch detection
    _errors.py            # ExitError definitions
    _format.py            # Format definitions (calver, semver, pep440, etc.)
    _git.py               # Git subprocess wrapper
    _hatch_hooks.py       # Hatch plugin registration
    _hatch_source.py      # Hatch version source implementation
    _version.py           # Core algorithm (forward, reverse, walk_first_parent)
    cli.py                # CLI entry point (argparse)
    py.typed              # PEP 561 type stub marker
tests/
  conftest.py             # GitRepo fixture with commit_at() helper
  test_gitcalver.py       # Integration tests creating real git repos
```

### Testing

- Integration tests that create real git repos with controlled committer dates
- Test matrix: Python 3.10+

## Phase 4: Go CLI

### Goal

A single compiled binary with no runtime dependencies, installable via:

```sh
go install gitcalver.org/go@latest
```

Or downloadable as a prebuilt binary from GitHub releases.

### Design

- Pure Go implementation of the gitcalver algorithm
- Use [go-git](https://github.com/go-git/go-git) for direct repository access —
  no `git` CLI dependency at runtime. This makes the binary fully self-contained
  and avoids subprocess overhead. go-git provides first-parent traversal, commit
  date access, status/dirty detection, and ref resolution — everything the
  algorithm needs.
- CLI flags mirror the shell script: `--format`, `--semver`, `--allow-dirty`,
  `--branch`

### Repository: `gitcalver/go`

```
go.mod                           # module gitcalver.org/go
go.sum
Makefile
gitcalver.go                     # Public API: Version(), Options{}
format.go                        # Format handling
branch.go                        # Branch detection
shorthash.go                     # Short hash computation
gitcalver_test.go                # Tests using go-git in-memory repos
cmd/gitcalver/
  main.go                        # CLI entry point
```

### Build and release

- Makefile with build, test, lint, fmt, acceptance, image targets
- Container images built with [ko](https://ko.build/)

### Testing

- Integration tests using go-git to create in-memory repos
- `go test ./...`
- `make acceptance` runs the conformance test suite from `gitcalver/sh`

## Phase 5: Rust CLI

### Goal

A single compiled binary with no runtime dependencies, installable via:

```sh
cargo install gitcalver-cli
```

Or downloadable as a prebuilt binary from GitHub releases.

### Design

- Pure Rust implementation of the gitcalver algorithm
- Use [gix](https://github.com/GitoxideLabs/gitoxide) for direct repository
  access — no `git` CLI dependency at runtime. gix provides first-parent
  traversal, commit date access, status/dirty detection, and ref resolution.
- Cargo workspace with two crates: `gitcalver` (library) and `gitcalver-cli`
  (binary). The library crate can be used as a dependency for `build.rs` version
  injection.
- CLI flags mirror the shell script: `--format`, `--semver`, `--allow-dirty`,
  `--branch`
- Edition 2024, `unsafe_code = "forbid"`, strict Clippy lints

### Repository: `gitcalver/rust`

```
Cargo.toml                       # Workspace root
Cargo.lock
Makefile
gitcalver/
  Cargo.toml                     # Library crate
  src/
    lib.rs                       # Core algorithm (forward, reverse, run)
    format.rs                    # Format handling
gitcalver-cli/
  Cargo.toml                     # Binary crate, depends on gitcalver library
  src/
    main.rs                      # CLI entry point
```

### Testing

- `cargo test`
- `make acceptance` runs the conformance test suite from `gitcalver/sh`

## Phase 6: GitHub Action

### Goal

A GitHub Action usable in workflows:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: gitcalver/sh@v20260412.1
  id: version
  with:
    prefix: "0." # optional, for semver ecosystems
- run: echo "Version is ${{ steps.version.outputs.version }}"
```

### Design

- Composite action (not Docker-based) for fastest startup
- Lives in `gitcalver/sh` alongside `gitcalver.sh` — no copy or sync needed
- Inputs mirror the CLI flags directly: `prefix`, `dirty`, `no-dirty-hash`,
  `branch`
- Outputs: `version`, `date`, `count`, `dirty` (boolean), `hash` (short SHA)
- Detached HEAD: `actions/checkout` creates `origin/main` (or `origin/master`),
  so `gitcalver.sh`'s auto-detection works without any special handling. The
  `branch` input is only needed for repos whose default branch has a
  non-standard name.
- Shallow clones: `gitcalver.sh` already warns per the specification.

### Rejected: tag input

We considered adding a `tag: true` input to create and push a git tag with the
computed version. This was rejected because it would require `contents: write`
permissions on the workflow token, and we don't want to encourage running the
action with write access.

### Repository

The action lives in `gitcalver/sh` (not a separate repo). This eliminates the
need to copy `gitcalver.sh` into a separate repository and keep it in sync. The
action's version naturally matches the shell script's version.

```
action.yml              # Composite action definition
gitcalver.sh            # Reference implementation (shared)
```

### Testing

- CI workflow in `.github/workflows/test.yml` exercises the action on push and
  pull request events
- Jobs test default output, prefix variants, and dirty workspace handling
- Outputs are validated against expected format patterns

## Phase 7: Azure DevOps pipeline task

### Goal

An Azure DevOps pipeline task that sets the version as a pipeline variable:

```yaml
- task: gitcalver@v20260412.1
  inputs:
    format: semver
  name: version

- script: echo $(version.version)
```

### Design

- Node.js-based task (Azure DevOps tasks run as Node.js scripts)
- Bundles the shell script and calls it via `child_process.execSync`, OR
  reimplements the algorithm in TypeScript/Node
- Sets output variables via `##vso[task.setvariable]` commands
- Handles Azure DevOps checkout behavior:
  1. Azure DevOps checks out in detached HEAD by default
  2. The `Build.SourceBranch` variable provides the branch name (e.g.,
     `refs/heads/main`)
  3. Pass extracted branch name as `--branch`

### Repository: `gitcalver/azure-devops`

```
task.json                # Task manifest
index.ts                 # Task entry point
package.json
tsconfig.json
```

### Distribution

- Published to the Visual Studio Marketplace as an Azure DevOps extension
- Versioned independently from the core spec

### Testing

- Unit tests for the Node.js wrapper
- Integration test pipeline in Azure DevOps (manual verification)

## Possible future work

### Gradle plugin

Version injection for Java/Kotlin/Android builds via a Gradle plugin:

```kotlin
plugins {
    id("org.gitcalver") version "20260412.1"
}

gitcalver {
    format = "maven"
}

// project.version is automatically set
```

Implementation: Kotlin, calls `git` via `ProcessBuilder`. Published to Gradle
Plugin Portal.

### npm package

Node.js implementation usable as a `package.json` script:

```json
{
  "scripts": {
    "version": "gitcalver --format semver"
  }
}
```

Could be a thin wrapper around the shell script, or a pure JS reimplementation.
Published to npm as `gitcalver`.

### pre-commit hook

A `.pre-commit-hooks.yaml` entry for the [pre-commit](https://pre-commit.com/)
framework. Validates that git tags match gitcalver versions, or prevents commits
that would break non-decreasing committer date ordering.

### Xcode / Swift Package Manager integration

SPM uses semver git tags. An Xcode build phase script or SPM plugin that:

- Sets `CFBundleShortVersionString` to `0.YYYYMMDD.N` (semver format)
- Sets `CFBundleVersion` to `YYYYMMDD.N` (calver format, satisfies App Store /
  TestFlight monotonicity requirements)
- Works via `agvtool` or direct Info.plist manipulation

### Android Gradle integration

The Gradle plugin (above) with Android-specific support:

- Sets `versionName` to `YYYYMMDD.N`
- Derives `versionCode` as `YYYYMMDD * 100 + N` (Int32-safe, limits N to 99/day)
- Configurable multiplier for projects needing more than 99 builds/day

### HomeKit accessory firmware versioning

Documentation and examples for using `YYYYMMDD.N` as the HAP `FirmwareRevision`
characteristic (§9.40). Each segment is uint32; `20260412` fits. The
strictly-increasing guarantee satisfies the HAP requirement that firmware
revision must change after every update.

### Shell completions

bash/zsh/fish completions for the `gitcalver` CLI. Could be generated from the
Go CLI using cobra or similar, or hand-written for the shell script.
