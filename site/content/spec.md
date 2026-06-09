---
title: "Specification"
description:
  "GitCalVer specification—version format, algorithm, output formats, and edge
  cases"
# Copyright © 2026 Michael Shields. SPDX-License-Identifier: CC-BY-4.0
---

**Version**: 0.1 (draft)

## Abstract

GitCalVer is a versioning scheme that derives version numbers deterministically
from git history. Each first-parent commit on the default branch maps to a
unique, strictly increasing version number based on the commit's UTC date and
its position within that day's commits.

## Version format

### Base format

```
YYYYMMDD.N
```

Where:

- `YYYYMMDD` is the UTC date of the commit's committer timestamp (4-digit year,
  2-digit month, 2-digit day, no separators)
- `N` is a positive integer: the count of consecutive first-parent commits from
  this commit (inclusive) that share the same UTC committer date

### Examples

A repository with 5 first-parent commits on main:

| Commit | Committer date (UTC) | Version      |
| ------ | -------------------- | ------------ |
| `e1`   | 2026-04-10 09:00:00  | `20260410.1` |
| `e2`   | 2026-04-10 14:30:00  | `20260410.2` |
| `e3`   | 2026-04-10 17:00:00  | `20260410.3` |
| `e4`   | 2026-04-11 10:00:00  | `20260411.1` |
| `e5`   | 2026-04-11 11:00:00  | `20260411.2` |

Commits `e1`–`e3` share the date 2026-04-10. The latest (`e3`) is the 3rd
consecutive commit with that date, so its version is `20260410.3`.

When `e4` is added on a new day, the count resets: `20260411.1`.

## Guarantees

### 1:1 mapping

Every first-parent commit on the default branch maps to exactly one version
number. Every version number identifies exactly one commit.

### Strictly increasing

Successive first-parent commits always produce strictly greater version numbers,
under the prerequisite that committer dates on the first-parent chain are
non-decreasing.

**Proof.** Within the same UTC date, each additional commit increments `N`, so
versions are strictly increasing. Across a date boundary, `YYYYMMDD` increases.
Since the first segment is compared first, `YYYYMMDD₂.1 > YYYYMMDD₁.K` for any
`K`, so the version still strictly increases.

**Prerequisite.** Committer dates on the first-parent chain must be
non-decreasing. This holds naturally when commits flow forward in time. History
rewrites (rebase, filter-repo, force push) that produce decreasing committer
dates void this guarantee. Implementations SHOULD validate this at the date
boundary and report an error if violated.

## Algorithm

To compute the version for HEAD:

1. Let `DATE` = the UTC committer date of HEAD, formatted as `YYYYMMDD`
2. Walk the first-parent chain starting from HEAD
3. Count consecutive commits whose UTC committer date equals `DATE`
4. Stop at the first commit with a different date
5. Let `N` = the count from step 3
6. The version is `DATE.N`

### Committer date

GitCalVer uses the **committer date**, not the author date. The committer date
reflects when a commit was applied to the branch (updated by rebase, amend,
cherry-pick). The author date reflects original authorship and is preserved
across history rewrites.

The committer date is chosen because it better represents the commit's position
in the branch's timeline.

### First-parent traversal

Only the first-parent chain is traversed. In a merge commit, the first parent is
the branch being merged into (typically main). Commits from merged branches are
not counted.

This means:

- Merge commits: the merge commit itself is counted; the merged branch's commits
  are not
- Squash merges: the resulting commit counts as 1
- Fast-forward merges: the forwarded commits are counted individually

### UTC

All dates are interpreted in UTC. A commit made at 23:00 local time in UTC+2 has
a UTC time of 21:00 and uses that UTC date.

Git stores timestamps as Unix epoch seconds (1-second granularity) plus a
timezone offset. The epoch seconds are inherently UTC-relative. The timezone
offset is metadata and does not affect the UTC interpretation.

## Dirty state

A version is dirty when either condition holds:

1. **Dirty workspace**: `git status --porcelain` produces any output (staged
   changes, unstaged changes, or untracked non-ignored files). Gitignored files
   do _not_ make the workspace dirty.
2. **Off default branch**: HEAD is not on the default branch but is traceable to
   it (see Default branch). The version is computed from the merge-base commit.

### Behavior

- By default, implementations MUST refuse to produce a version for a dirty state
  (exit with a non-zero status).
- A `--dirty` flag opts in to dirty versions (see Output Format).

## Default branch

GitCalVer versions are derived from the default branch's first-parent history.

### Detection precedence

1. Explicit `--branch BRANCH` flag
2. `git symbolic-ref refs/remotes/origin/HEAD` (remote default)
3. Existence of `origin/main`, then `origin/master`
4. If no remote: existence of local `main`, then `master`
5. Error if no default branch can be determined

### HEAD relationship

Implementations MUST check HEAD's relationship to the default branch:

- **On the default branch**: HEAD is the branch tip or an ancestor of it
  (reachable via `git merge-base --is-ancestor HEAD <branch-ref>`). Produce a
  clean version (subject to workspace dirty checks). This includes detached HEAD
  pointing to a commit on the default branch, which is common in CI.
- **Off the default branch but traceable**: HEAD is not on the default branch
  but shares a common ancestor with it (`git merge-base HEAD <branch-ref>`
  succeeds). Treat as dirty: compute the version for the merge-base commit and
  apply dirty formatting. This covers feature branches and detached HEAD at
  non-default-branch commits.
- **Not traceable**: no common ancestor exists (e.g., orphan branches). Error.

## Committer date validation

Implementations SHOULD validate that committer dates on the first-parent chain
are non-decreasing. At minimum, when the counting walk (step 4 of the algorithm)
encounters the first commit with a different date, that date SHOULD be checked:

- If it is **later** than HEAD's date: error—committer dates are not
  non-decreasing. This indicates history was rewritten.
- If it is **earlier or equal**: valid.

This is a cheap check (O(1) at the boundary already visited). It does not
validate the entire history but catches the most common violation.

In practice, standard git workflows (direct commits, merges, rebases) maintain
the non-decreasing property. It can be violated by clock skew, explicit
`GIT_COMMITTER_DATE` manipulation, or
`git rebase --committer-date-is-author-date` with out-of-order author dates.

## Output format

The version string is composed from a fixed base version plus optional prefix
and dirty suffix, controlled by flags rather than named formats.

### Base version

The base version is always `YYYYMMDD.N`. This is the invariant core of GitCalVer
and cannot be changed.

### Prefix

A `--prefix PREFIX` flag prepends a literal string to the version. The default
prefix is empty.

Clean version: `{prefix}YYYYMMDD.N`

Common prefixes:

| Prefix    | Use case                                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(empty)_ | Default; Python, Debian, RPM, Ruby, R, Perl, Docker, Homebrew, Conda, Clojure, Conan, vcpkg, Alpine, Arch Linux, Nix, Snap, Flatpak, winget, Firefox |
| `0.`      | SemVer ecosystems: npm, Rust, .NET, Swift, CocoaPods, Dart, Helm, Terraform, PHP, Elixir, Haskell, Julia, Chocolatey, PowerShell, VS Code            |
| `v0.`     | Go modules                                                                                                                                           |

### Dirty flags

By default, implementations MUST refuse to produce a version for a dirty
workspace (exit with a non-zero status). The `--dirty` flag opts in to dirty
versions.

| Flag              | Effect                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `--dirty STRING`  | Enable dirty versions. Append `STRING.HASH` to the base version. `STRING` must not be empty. |
| `--no-dirty`      | Refuse dirty versions. Overrides `--dirty` set by configuration or environment.              |
| `--no-dirty-hash` | Suppress the `.HASH` suffix, appending only `STRING`. Requires `--dirty`.                    |

Where `HASH` is the short commit hash (`git rev-parse --short HEAD`). The `.`
before `HASH` is implicit and included automatically when the hash is present.

Dirty version (with hash): `{prefix}YYYYMMDD.N{dirty}.HASH` Dirty version (no
hash): `{prefix}YYYYMMDD.N{dirty}`

Validation:

- `--dirty ""` is an error (dirty version would be indistinguishable from clean)
- `--no-dirty-hash` without `--dirty` is an error (no dirty mode to modify)
- `--no-dirty` and `--dirty` together: `--no-dirty` wins

### Non-uniqueness

Dirty versions are not uniquely reversible. The 1:1 mapping guarantee applies
only to clean versions. Multiple distinct states can produce the same dirty
version string—for example, two dirty builds from the same commit with different
uncommitted changes.

### Dirty version sort order

In most ecosystems, the dirty version sorts **before** (lower than) the clean
version. This is correct: a dirty build is not yet the release.

Exceptions:

- PEP 440: the `+` local segment sorts **after** the public version in local
  comparisons, but local versions are not permitted on PyPI
- Debian: the `+` suffix sorts after the base version

### Ecosystem mapping

| Ecosystem                     | `--prefix` | `--dirty`    | `--no-dirty-hash` | Clean             | Dirty                          | Version spec                                      |
| ----------------------------- | ---------- | ------------ | ----------------- | ----------------- | ------------------------------ | ------------------------------------------------- |
| Generic / scripts             | —          | `-dirty`     | —                 | `20260412.3`      | `20260412.3-dirty.abc1234`     | —                                                 |
| Python (PyPI)                 | —          | `+dirty`     | —                 | `20260412.3`      | `20260412.3+dirty.abc1234`     | [PEP 440][pep440]                                 |
| npm                           | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [SemVer 2.0.0][semver], [node-semver][nodesemver] |
| Go modules                    | `v0.`      | `-dirty`     | —                 | `v0.20260412.3`   | `v0.20260412.3-dirty.abc1234`  | [Go Modules Reference][gomod]                     |
| Rust (Cargo)                  | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [Cargo dependencies][cargo]                       |
| .NET (NuGet)                  | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [NuGet versioning][nuget]                         |
| Debian/Ubuntu                 | —          | `+dirty`     | —                 | `20260412.3`      | `20260412.3+dirty.abc1234`     | [Debian Policy §5.6.12][debian]                   |
| RPM (Fedora/RHEL)             | —          | `~dirty`     | yes               | `20260412.3`      | `20260412.3~dirty`             | [RPM spec format][rpm]                            |
| R (CRAN)                      | —          | —            | —                 | `20260412.3`      | _(not expressible)_            | [Writing R Extensions][cran]                      |
| Perl (CPAN)                   | —          | `-dirty`     | —                 | `20260412.3`      | `20260412.3-dirty.abc1234`     | [Perl `version`][cpan]                            |
| Ruby (RubyGems)               | —          | `.pre.dirty` | —                 | `20260412.3`      | `20260412.3.pre.dirty.abc1234` | [RubyGems specification][rubygems]                |
| Java (Maven/Gradle)           | —          | `-SNAPSHOT`  | yes               | `20260412.3`      | `20260412.3-SNAPSHOT`          | [Maven version order][maven]                      |
| Docker/OCI                    | —          | `-dirty`     | —                 | `20260412.3`      | `20260412.3-dirty.abc1234`     | [OCI Distribution Spec][oci]                      |
| Homebrew                      | —          | `-dirty`     | —                 | `20260412.3`      | `20260412.3-dirty.abc1234`     | —                                                 |
| Swift Package Manager         | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [SPM documentation][spm]                          |
| CocoaPods                     | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [Podspec syntax][cocoapods]                       |
| iOS/macOS (`CFBundleVersion`) | —          | —            | —                 | `20260412.3`      | _(not expressible)_            | [Apple bundle versioning][applebundle]            |
| Android (`versionName`)       | —          | `-dirty`     | —                 | `20260412.3`      | `20260412.3-dirty.abc1234`     | [Android app versioning][androidver]              |
| Flutter/Dart (pub.dev)        | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [Dart package versioning][dartver]                |
| Helm charts                   | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [Helm chart best practices][helm]                 |
| Terraform providers           | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [Terraform provider versioning][terraform]        |
| PHP Composer                  | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [Composer versions][composer]                     |
| Conda                         | —          | `+dirty`     | —                 | `20260412.3`      | `20260412.3+dirty.abc1234`     | [Conda version spec][conda]                       |
| HomeKit (`FirmwareRevision`)  | —          | —            | —                 | `20260412.3`      | _(not expressible)_            | [HAP Specification §9.40][homekit]                |
| Elixir (Hex)                  | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [Elixir `Version`][hex]                           |
| Haskell (Hackage)             | `0.`       | —            | —                 | `0.20260412.3`    | _(not expressible)_            | [PVP][pvp]                                        |
| Julia (Pkg)                   | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [Pkg.jl versioning][julia]                        |
| Clojure (Clojars)             | —          | `-SNAPSHOT`  | yes               | `20260412.3`      | `20260412.3-SNAPSHOT`          | [Clojars][clojars]                                |
| Conan (C/C++)                 | —          | `-dirty`     | —                 | `20260412.3`      | `20260412.3-dirty.abc1234`     | [Conan versioning][conan]                         |
| vcpkg (C/C++)                 | —          | `-dirty`     | —                 | `20260412.3`      | `20260412.3-dirty.abc1234`     | [vcpkg versioning][vcpkg]                         |
| Alpine (apk)                  | —          | `_pre`       | yes               | `20260412.3`      | `20260412.3_pre`               | [Alpine packaging][alpine]                        |
| Arch Linux (pacman)           | —          | `~dirty`     | yes               | `20260412.3`      | `20260412.3~dirty`             | [Arch packaging][archlinux]                       |
| Nix                           | —          | `pre`        | yes               | `20260412.3`      | `20260412.3pre`                | [Nix `compareVersions`][nix]                      |
| Snap                          | —          | `-dirty`     | —                 | `20260412.3`      | `20260412.3-dirty.abc1234`     | [Snap format][snap]                               |
| Flatpak                       | —          | `-dirty`     | —                 | `20260412.3`      | `20260412.3-dirty.abc1234`     | [Flatpak conventions][flatpak]                    |
| Chocolatey                    | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [Chocolatey versioning][chocolatey]               |
| winget                        | —          | `-dirty`     | —                 | `20260412.3`      | `20260412.3-dirty.abc1234`     | [winget manifest][winget]                         |
| PowerShell Gallery            | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [PowerShell modules][psgallery]                   |
| VS Code extensions            | `0.`       | `-dirty`     | —                 | `0.20260412.3`    | `0.20260412.3-dirty.abc1234`   | [VS Code extension manifest][vscode]              |
| Chrome extensions             | —          | —            | —                 | _(not supported)_ | _(not supported)_              | [Chrome manifest version][chrome]                 |
| Firefox add-ons               | —          | —            | —                 | `20260412.3`      | _(not expressible)_            | [WebExtensions manifest][firefox]                 |

**R/CRAN limitation:** R version strings are sequences of at least two
non-negative integers separated by `.` or `-` ([Writing R Extensions][cran]). No
alphabetic characters are permitted. `YYYYMMDD.N` is valid for clean builds.
Dirty versions are not expressible in R-compatible version strings.

**Haskell/Hackage limitation:** PVP version strings are sequences of
non-negative integers separated by `.` ([PVP][pvp]). No alphabetic characters
are permitted. `0.YYYYMMDD.N` is valid for clean builds. Dirty versions are not
expressible in PVP-compatible version strings.

**CFBundleVersion limitation:** `CFBundleVersion` segments are numeric only.
Dirty versions are not expressible.

**HomeKit limitation:** `FirmwareRevision` segments are numeric only (uint32).
Dirty versions are not expressible.

**Chrome extension limitation:** Chrome extension versions (`version`) are 1–4
dot-separated integers, each between 0 and 65,535 ([Chrome manifest
version][chrome]). Since `YYYYMMDD` values (e.g., `20260412`) exceed 65,535,
GitCalVer versions cannot be used as the `version`. However, Chrome's
`version_name` is a freeform string displayed to users instead of `version` when
present. GitCalVer can be used as the `version_name`.

**Firefox add-on limitation:** Firefox add-on versions are 1–4 dot-separated
integers, each up to 2,147,483,647 ([WebExtensions manifest][firefox]).
`YYYYMMDD.N` is valid for clean builds. Dirty versions are not expressible since
no alphabetic characters are permitted.

**Alpine dirty-version note:** Alpine uses pre-release suffixes (`_alpha`,
`_beta`, `_pre`, `_rc`) that sort before the base version. `--dirty _pre`
produces `YYYYMMDD.N_pre`, which apk correctly sorts below the clean version.

**Nix dirty-version note:** Nix's `builtins.compareVersions` treats `pre` as a
special component that sorts before an empty component. `--dirty pre` produces
`YYYYMMDD.Npre`, which Nix correctly sorts below the clean version.

### Mobile platform details

**iOS/macOS (Apple):**

- `CFBundleShortVersionString` (marketing version, shown to users): use
  `--prefix 0.` → `0.YYYYMMDD.N`
- `CFBundleVersion` (build number, must be unique and increasing per App Store
  upload): use no prefix → `YYYYMMDD.N`. Each segment is a uint32 (max
  4,294,967,295); `20260412` fits. The strictly-increasing guarantee satisfies
  TestFlight and App Store Connect requirements.

**Android:**

- `versionName` (displayed to users): any string → `YYYYMMDD.N` works
- `versionCode` (integer, must increase, Int32 max 2,147,483,647): cannot use
  `YYYYMMDD.N` directly since it requires a single integer. Derive as
  `YYYYMMDD * 100 + N` → e.g., `2026041203`. This fits in Int32 and provides
  strictly-increasing values, but limits N to 99 per day. For most projects this
  is more than sufficient.

**HomeKit:**

- `FirmwareRevision` characteristic: format is `x[.y[.z]]` where each segment is
  a uint32. `YYYYMMDD.N` (two segments) is valid and `20260412` fits within
  uint32. The value must change after every firmware update, which GitCalVer
  guarantees.

### Numeric limits

The `YYYYMMDD` segment (e.g., `20260412`) must fit within each ecosystem's
numeric constraints:

| Ecosystem                  | Segment type          | Maximum                    | `20260412` fits?        |
| -------------------------- | --------------------- | -------------------------- | ----------------------- |
| NuGet (.NET)               | Int32                 | 2,147,483,647              | Yes                     |
| npm (node-semver)          | JS integer            | 9,007,199,254,740,991      | Yes                     |
| R (CRAN)                   | 32-bit int            | 2,147,483,647              | Yes                     |
| Cargo (Rust)               | u64                   | 18,446,744,073,709,551,615 | Yes                     |
| Go modules                 | string-compared       | No limit                   | Yes                     |
| Python (PEP 440)           | arbitrary int         | No limit                   | Yes                     |
| Debian                     | string-compared       | No limit                   | Yes                     |
| RPM                        | string-compared       | No limit                   | Yes                     |
| Maven                      | BigInteger            | No limit                   | Yes                     |
| Apple (CFBundleVersion)    | uint32                | 4,294,967,295              | Yes                     |
| Android (versionCode)      | Int32                 | 2,147,483,647              | Yes (as YYYYMMDD×100+N) |
| HomeKit (FirmwareRevision) | uint32                | 4,294,967,295              | Yes                     |
| Elixir (Hex)               | arbitrary int         | No limit                   | Yes                     |
| Haskell (Hackage)          | arbitrary int         | No limit                   | Yes                     |
| Julia (Pkg)                | arbitrary int         | No limit                   | Yes                     |
| Clojure (Clojars)          | BigInteger            | No limit                   | Yes                     |
| Conan                      | string                | No limit                   | Yes                     |
| vcpkg                      | string                | No limit                   | Yes                     |
| Alpine (apk)               | numeric string        | No limit                   | Yes                     |
| Arch Linux (pacman)        | string-compared       | No limit                   | Yes                     |
| Nix                        | integer               | No limit                   | Yes                     |
| Snap                       | string (max 32 chars) | No limit                   | Yes                     |
| Flatpak                    | string                | No limit                   | Yes                     |
| Chocolatey                 | Int32 (NuGet)         | 2,147,483,647              | Yes                     |
| winget                     | string                | No limit                   | Yes                     |
| PowerShell Gallery         | Int32 (.NET)          | 2,147,483,647              | Yes                     |
| VS Code extensions         | arbitrary int         | No limit                   | Yes                     |
| Chrome extensions          | uint16                | 65,535                     | **No**                  |
| Firefox add-ons            | Int32                 | 2,147,483,647              | Yes                     |

## Shallow clones

GitCalVer works with shallow clones as long as the clone includes all
first-parent commits for the current UTC date. If the clone is too shallow (the
oldest commit in the walked history shares HEAD's date), the count may be
incomplete. Implementations SHOULD detect this and warn.

A safe shallow clone depth for GitCalVer is any depth that includes at least one
commit from the previous UTC date, for example:

```sh
git clone --shallow-since=yesterday
```

## References

[semver]: https://semver.org/spec/v2.0.0.html
[pep440]: https://peps.python.org/pep-0440/
[gomod]: https://go.dev/ref/mod#versions
[nodesemver]: https://github.com/npm/node-semver
[cargo]: https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html
[nuget]: https://learn.microsoft.com/en-us/nuget/concepts/package-versioning
[debian]: https://www.debian.org/doc/debian-policy/ch-controlfields.html#version
[rpm]: https://rpm-software-management.github.io/rpm/manual/spec.html
[cran]: https://cran.r-project.org/doc/manuals/R-exts.html#The-DESCRIPTION-file
[cpan]: https://perldoc.perl.org/version
[rubygems]: https://guides.rubygems.org/specification-reference/
[maven]:
  https://maven.apache.org/ref/3.9.9/maven-artifact/apidocs/org/apache/maven/artifact/versioning/ComparableVersion.html
[oci]: https://github.com/opencontainers/distribution-spec/blob/main/spec.md
[spm]:
  https://developer.apple.com/documentation/packagedescription/package/dependency
[cocoapods]: https://guides.cocoapods.org/syntax/podspec.html#version
[applebundle]:
  https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleversion
[androidver]: https://developer.android.com/studio/publish/versioning
[dartver]: https://dart.dev/tools/pub/versioning
[helm]: https://helm.sh/docs/chart_best_practices/conventions/#version-numbers
[terraform]:
  https://developer.hashicorp.com/terraform/registry/providers/publishing#creating-a-github-release
[composer]: https://getcomposer.org/doc/articles/versions.md
[conda]:
  https://conda.io/projects/conda/en/latest/user-guide/concepts/pkg-specs.html#package-match-specifications
[homekit]: https://developer.apple.com/homekit/specification/
[hex]: https://hexdocs.pm/elixir/Version.html
[pvp]: https://pvp.haskell.org/
[julia]: https://pkgdocs.julialang.org/v1/compatibility/
[clojars]: https://github.com/clojars/clojars-web/wiki
[conan]: https://docs.conan.io/2/tutorial/versioning.html
[vcpkg]: https://learn.microsoft.com/en-us/vcpkg/users/versioning
[alpine]: https://wiki.alpinelinux.org/wiki/Creating_an_Alpine_package
[archlinux]: https://wiki.archlinux.org/title/Arch_package_guidelines
[nix]:
  https://nix.dev/manual/nix/latest/language/builtins#builtins-compareVersions
[snap]: https://snapcraft.io/docs/the-snap-format
[flatpak]: https://docs.flatpak.org/en/latest/conventions.html
[chocolatey]:
  https://docs.chocolatey.org/en/latest/create/create-packages/#versioning-recommendations
[winget]:
  https://learn.microsoft.com/en-us/windows/package-manager/package/manifest
[psgallery]:
  https://learn.microsoft.com/en-us/powershell/scripting/gallery/concepts/module-prerelease-support
[vscode]: https://code.visualstudio.com/api/references/extension-manifest
[chrome]:
  https://developer.chrome.com/docs/extensions/reference/manifest/version
[firefox]:
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/version
