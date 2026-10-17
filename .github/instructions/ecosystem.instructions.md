---
name: Root Books ecosystem
description: Shared-contract versioning and sibling repository compatibility
applyTo: "**"
---

# Root Books ecosystem

This project shares a portable book contract with:

- `VingGit/root-index-panels`
- `VingGit/custom-file-explorer-sorting-support`

The packages may release independently when a change does not alter the shared
`panel.icon` and `panel.accent` contract or require companion code changes.
Every release still requires a compatibility audit of the other two projects
and synchronized instructions or human documentation where affected.

`ECOSYSTEM_VERSION` identifies the shared portable-contract line, not the
Toolkit package version. Change that value and release all three packages at
the same version only when the shared contract changes. Package release tags
must exactly equal that package's version without a leading `v`.

No instruction or fixture may contain a contributor's machine-specific path,
vault contents, account data, or credentials.
