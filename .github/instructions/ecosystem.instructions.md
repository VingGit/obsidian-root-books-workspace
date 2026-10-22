---
name: Root Books ecosystem
description: Shared-contract versioning and sibling repository compatibility
applyTo: "**"
---

# Root Books ecosystem

This project implements the following independently versioned contracts from
`obsidian-material-plugins/plugin-contracts`:

- `book-structure/v1`
- `book-appearance/v1`

The Quartz counterpart is
`obsidian-material-plugins/quartz-root-books-workspace`. Optional navigation
sorting is provided by
`obsidian-material-plugins/quartz-custom-file-explorer-sorting` through its own
runtime capability. Every package releases independently. A contract change
creates a new contract version and a compatibility audit; it never requires
unrelated package versions to move together.

Package release tags exactly equal this package's version without a leading
`v`. Do not add a monolithic ecosystem version to settings, package metadata,
or release workflows.

No instruction or fixture may contain a contributor's machine-specific path,
vault contents, account data, or credentials.
