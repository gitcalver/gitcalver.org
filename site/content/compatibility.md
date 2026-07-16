---
title: "Compatibility"
description:
  "Choose the GitCalVer prefix, dirty suffix, and dependency range that fits
  your package ecosystem."
# Copyright © 2026 Michael Shields. SPDX-License-Identifier: CC-BY-4.0
---

GitCalVer’s base version is always `YYYYMMDD.N`. Some ecosystems accept that
directly; ecosystems that require three-part Semantic Versions need a prefix.
This page is current, nonnormative integration guidance. The
[versioned specification](/spec) defines the algorithm.

## Published versions

Publish only clean versions. Dirty forms are useful for local artifacts, but
they are not reversible and registries may reject them or give them surprising
ordering semantics.

| Ecosystem or field                                                                         | Prefix   | Clean example   | Local dirty flags                   | Notes                                                             |
| ------------------------------------------------------------------------------------------ | -------- | --------------- | ----------------------------------- | ----------------------------------------------------------------- |
| Scripts, OCI tags, Homebrew                                                                | _(none)_ | `20260412.3`    | `--dirty -dirty`                    | Uses the base form directly                                       |
| Python / PyPI                                                                              | _(none)_ | `20260412.3`    | `--dirty +dirty`                    | `+dirty.HASH` is a local version; do not upload it to PyPI        |
| npm, Cargo, NuGet, Swift packages, CocoaPods, pub.dev, Helm, Composer, Hex, Julia, VS Code | `0.`     | `0.20260412.3`  | `--dirty -dirty`                    | Three-part SemVer-compatible form for an initial or unstable line |
| Go modules                                                                                 | `v0.`    | `v0.20260412.3` | `--dirty -dirty`                    | The module tag includes Go’s required leading `v`                 |
| Terraform providers                                                                        | `v0.`    | `v0.20260412.3` | `--dirty -dirty`                    | Provider release tags require `v` before the SemVer               |
| Debian / Ubuntu                                                                            | _(none)_ | `20260412.3`    | `--dirty ~dirty`                    | `~dirty.HASH` sorts before the clean version                      |
| RPM                                                                                        | _(none)_ | `20260412.3`    | `--dirty ~dirty`                    | `~dirty.HASH` is accepted and sorts before the clean version      |
| RubyGems                                                                                   | _(none)_ | `20260412.3`    | `--dirty .pre.dirty`                | Alphabetic segments form a prerelease                             |
| Maven, Gradle, Clojars                                                                     | _(none)_ | `20260412.3`    | `--dirty -SNAPSHOT --no-dirty-hash` | Uses the conventional snapshot suffix                             |
| Apple `CFBundleShortVersionString`                                                         | `0.`     | `0.20260412.3`  | _(none)_                            | The field requires three period-separated integers                |
| Android `versionName`                                                                      | _(none)_ | `20260412.3`    | `--dirty -dirty`                    | Display string only; derive `versionCode` separately              |

The `0.` prefix denotes an initial or unstable line. If a project maintains
incompatible release lines, give each one a caller-managed major prefix or a
separate package namespace.

## Dependency ranges

The date occupies the minor component of `0.YYYYMMDD.N`. A normal caret range
such as `^0.20260412.3` therefore accepts later commits on April 12 but not the
next day. Use an explicit range when consumers should receive future dates:

| Ecosystem       | Range accepting later GitCalVer releases on the same `0.` line |
| --------------- | -------------------------------------------------------------- |
| npm, pnpm, Yarn | `>=0.20260412.3 <1`                                            |
| Cargo           | `>=0.20260412.3, <1`                                           |
| Python          | `>=20260412.3`                                                 |

For Python, `~=20260412.3` is likewise limited to the `20260412.*` date block.
Add a project-specific upper bound if future incompatible releases use the same
package name.

Go modules do not declare ranges. `go.mod` records a selected minimum module
version, and `go get example.com/module@latest` requests the latest available
release.

## Fields that need a derived value

GitCalVer does not fit directly in a single-integer field such as Android’s
`versionCode`, or in a field whose numeric components are smaller than the
eight-digit date, such as a Chrome extension’s `version`. Keep the GitCalVer
string as the release/display version and derive the constrained build value
with a separately documented, collision-free rule.

## References

- [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
- [Python version specifiers](https://packaging.python.org/en/latest/specifications/version-specifiers/)
- [npm package ranges](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#dependencies)
- [Cargo dependency requirements](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html)
- [Go module versions](https://go.dev/ref/mod#versions)
- [Terraform provider publishing](https://developer.hashicorp.com/terraform/registry/providers/publishing)
- [Apple bundle version strings](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleshortversionstring)
