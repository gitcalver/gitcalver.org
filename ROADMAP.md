<!-- Copyright © 2026 Michael Shields. SPDX-License-Identifier: CC-BY-4.0 -->

# GitCalVer roadmap

## Current status

The version 0.1 specification is published at
[`/spec/0.1`](https://gitcalver.org/spec/0.1), with `/spec` reserved as the
latest-version redirect.

| Repository                | Current role                                      | Distribution                         |
| ------------------------- | ------------------------------------------------- | ------------------------------------ |
| `gitcalver/gitcalver.org` | Specification and Cloudflare Worker website       | `gitcalver.org`                      |
| `gitcalver/sh`            | Reference implementation, conformance, and Action | GitHub release asset and Action      |
| `gitcalver/python`        | Python API, CLI, and Hatch plugin                 | PyPI package `gitcalver`             |
| `gitcalver/go`            | Standalone CLI                                    | `gitcalver.org/go/cmd/gitcalver`     |
| `gitcalver/rust`          | Experimental Rust library and CLI                 | Unreleased                           |
| `gitcalver/azure-devops`  | Azure DevOps prototype                            | Future work; outside the 0.2 release |

The shell, Python, Go, and Rust implementations share the conformance suite in
`gitcalver/sh`. Each implementation has an independent release cycle.

## Version 0.2

Version 0.2 will make branch selection, revision handling, incomplete-history
proofs, output parsing, hashes, reverse lookup, and exit codes consistent across
all four implementations.

The work is ordered as follows:

1. Harden the site, documentation, installer provenance, build, accessibility,
   interactions, and metadata without changing the active specification.
2. Freeze the 0.2 behavior in the shell reference implementation and shared
   conformance suite.
3. Port that frozen contract to Python, Go, and Rust on their `release/0.2`
   integration branches.
4. Harden the canonical GitHub Action and release shell, Go, Python, and Rust.
5. Publish immutable `/spec/0.2`, point `/spec` to it, and update the site only
   after every implementation passes its native and shared suites.

The 0.2 contract keeps version calculation offline and ties clean, increasing,
reversible versions to one fixed first-parent chain. It also defines fixed
seven-character object-ID suffixes, explicit behavior for supplied revisions,
proof requirements for incomplete history, and protected canonical publication
tags.

## Release gates

- Protect canonical tag namespaces before enabling publication.
- Serialize publication workflows and require that they operate on the latest
  integration-branch tip.
- Do not activate the 0.2 specification until all four implementations have
  published conforming releases.
- Keep the Azure DevOps prototype and other integrations outside the 0.2 gate.

## Future work

- Azure DevOps task
- Native package-manager integrations where a thin CLI invocation is
  insufficient
- Shell completions
- Additional platform-specific version-field recipes
