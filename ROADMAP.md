<!-- Copyright © 2026 Michael Shields. SPDX-License-Identifier: CC-BY-4.0 -->

# GitCalVer roadmap

## Current status

Version 0.2 is published at [`/spec/0.2`](https://gitcalver.org/spec/0.2), and
`/spec` points to the current version. Version 0.1 remains available at its
immutable URL.

| Repository                | Role                                              | Current release                |
| ------------------------- | ------------------------------------------------- | ------------------------------ |
| `gitcalver/gitcalver.org` | Specification and Cloudflare Worker website       | [Specification 0.2][spec-02]   |
| `gitcalver/sh`            | Reference implementation, conformance, and Action | [`v20260719.1`][shell-release] |
| `gitcalver/python`        | Python API, CLI, and Hatch plugin                 | [`20260719.2`][python-release] |
| `gitcalver/go`            | Standalone CLI                                    | [`v0.20260719.3`][go-release]  |
| `gitcalver/rust`          | Experimental Rust library and CLI                 | Unreleased; use `gitcalver.sh` |
| `gitcalver/azure-devops`  | Azure DevOps prototype                            | Future work                    |

The shell, Python, and Go releases implement the 0.2 contract and pass the
shared conformance suite maintained in `gitcalver/sh`. Each implementation keeps
its own release cycle.

The Rust port is exploratory and is not a 0.2 release gate. Rust projects can
use the shell reference implementation during publication without adding version
state to the source manifest.

## Version 0.2

Version 0.2 makes branch selection, revision handling, incomplete-history
proofs, hashes, reverse lookup, and exit codes consistent across the released
implementations.

The contract keeps calculation offline and ties clean, increasing, reversible
versions to one fixed first-parent chain. It defines exact first-parent
membership, fixed seven-character object-ID suffixes, explicit-target workspace
behavior, proof requirements for shallow and partial histories, and immutable
canonical publication tags.

The canonical GitHub Action calculates locally during normal builds. Its
explicit publication mode refreshes remote state after CI, verifies first-parent
continuity, and claims the new tag without force.

## Future work

- Mature and release the native Rust implementation
- Azure DevOps task
- SHA-256 repository support where implementation libraries permit it
- Native package-manager integrations where a thin CLI invocation is
  insufficient
- Shell completions
- Additional platform-specific version-field recipes

[spec-02]: https://gitcalver.org/spec/0.2
[shell-release]: https://github.com/gitcalver/sh/releases/tag/v20260719.1
[python-release]: https://pypi.org/project/gitcalver/20260719.2/
[go-release]: https://github.com/gitcalver/go/tree/v0.20260719.3
