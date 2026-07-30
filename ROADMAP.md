<!-- Copyright © 2026 Michael Shields. SPDX-License-Identifier: CC-BY-4.0 -->

# GitCalVer roadmap

## Current status

Version 0.3 is published at [`/spec/0.3`](https://gitcalver.org/spec/0.3), and
`/spec` points to the current version. Versions 0.1 and 0.2 remain available at
their immutable URLs; 0.2 now carries a nonnormative erratum describing the
defect 0.3 fixes.

| Repository                | Role                                              | Current release                |
| ------------------------- | ------------------------------------------------- | ------------------------------ |
| `gitcalver/gitcalver.org` | Specification and Cloudflare Worker website       | [Specification 0.3][spec-03]   |
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

## Version 0.3

Version 0.3 fixes an unsound guarantee in 0.2: counting a commit’s position
within its selected-chain date block broke under a merge-then-fast-forward that
reparents the selected branch’s own commits behind a feature branch, letting a
published tip version decrease. 0.3 redefines `N` as the size of the target’s
date cohort—the count of all commits reachable from it, through any parent, that
share its UTC committer date. This count is provably non-decreasing as the
selected branch tip advances by any combination of new commits and
fast-forwards, regardless of which parent a merge records as first.

The new count is sparse: a merge that brings in several same-date commits can
jump `N` by more than one, so `YYYYMMDD.N` values that were never assigned to a
commit are expected, and reverse lookup reports them as not found rather than
guessing a nearest commit. Because `N`’s meaning changed, a version string
computed under 0.2 MAY name a different commit—or none—once recomputed under
0.3.

Canonical publication’s tag-continuity check also moves from first-parent
ancestry to reachability through any parent with a non-later committer date:
under the same reparenting topology, the previous release’s tag was still
reachable but no longer a first-parent ancestor, so 0.2’s stricter check would
have blocked all further publication even after the counting fix. The
greater-than check is unchanged and still prevents overwriting an
already-published 0.2-era tag.

Off-chain and dirty-version handling, branch selection, prefixes, and exit codes
are unchanged from 0.2.

## Future work

- Update `sh`, `python`, and `go` to the 0.3 date-cohort counting rule
- Mature and release the native Rust implementation
- Azure DevOps task
- SHA-256 repository support where implementation libraries permit it
- Native package-manager integrations where a thin CLI invocation is
  insufficient
- Shell completions
- Additional platform-specific version-field recipes

[spec-03]: https://gitcalver.org/spec/0.3
[shell-release]: https://github.com/gitcalver/sh/releases/tag/v20260719.1
[python-release]: https://pypi.org/project/gitcalver/20260719.2/
[go-release]: https://github.com/gitcalver/go/tree/v0.20260719.3
