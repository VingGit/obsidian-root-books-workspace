# Changelog

## Unreleased

## 0.12.0

- Reorganized the watched-state dashboard into Community plugins, Core
  plugins, and Options, with Add, Edit, and red Remove actions directly on the
  colored status surface instead of duplicated profile cards.
- Added optional target and per-setting explanations, systematic Options-page
  selection, and a detected-setting picker that keeps internal keys and
  rendered-row matching out of the user-facing form.
- Made setting shortcuts follow Obsidian's separate Settings window, prefer an
  exact rendered name, click through a plugin's internal settings tabs and
  nested Manage screens, and provide a temporary return slip back to the same
  dashboard item before falling back to Settings search.
- Audited the four bundled companion settings against their live Obsidian
  screens, corrected the Folder Notes file-type route, and stopped offering
  shortcuts for two Frontmatter Date Manager values that have no visible row.
- Added an in-app browser for Obsidian's bundled Lucide icons and applied each
  book's icon and accent to native tab titles and first-level Explorer folders.
- Moved the four bundled companion checks into a versioned default watch
  profile with a Git-trackable vault override that survives plugin updates.
- Added separate community-plugin, Obsidian core-plugin, and Obsidian preference
  watches, with Edit and Remove actions for every target.
- Added startup and three-second live drift notifications plus direct setting
  shortcuts that open, scroll to, focus, and highlight settings exposed by the
  target UI.
- Added merge-safe Community Install Manager import and export, including an
  opt-in startup export for plugin IDs and exact expected values.
- Presented Custom Sort's internal `suspended: false` runtime state as the
  positive **Active** state and stopped treating it as a settings-page toggle.
- Rejected legacy watch-profile schemas instead of silently migrating them.
- Removed the startup conversion path and persisted migration flag for retired
  `book-tabs`, loose color, and unprefixed icon metadata.

## 0.11.0

- Replaced the terse companion summary with a coordinator dashboard showing
  installation, enablement, version, and every current-versus-expected setting
  value with clear ready and mismatch states.
- Added direct shortcuts to companion settings and the Community plugins page.
- Added a declarative custom watch profile so users can monitor installed
  plugins and selected setting paths without changing Toolkit code.
- Added read-only import of Community Install Manager's selected-settings
  profile.
- Added health reporting for root workflow metadata, first-level book indexes,
  portable appearance metadata, Toolkit runtime services, and the Custom Sort
  refresh command.

## 0.10.0

- Reduced companion integration to a read-only health audit. Root Books Toolkit
  no longer installs or enables plugins, rewrites their settings, disables the
  core Unique Note Creator, or opens a mutating onboarding flow.
- Moved reusable companion provisioning to the thesis template's curated
  Community Install Manager profile while preserving manual configuration for
  other vaults.
- Kept the first-level-book workflow, portable appearance metadata, note/date
  pipeline, folder-title synchronization, selective sorting refreshes, and
  unique-note action unchanged.

## 0.9.3

- Coordinated the ecosystem release with folder-page directory sorting in
  Custom File Explorer Sorting Support. Root Books Toolkit behavior is unchanged.

## 0.9.2

- Renamed the plugin display name to Root Books Toolkit so the replacement
  repository can be submitted independently of the archived community entry
  that still reserves Root Books Workspace.
- Kept the stable `root-books-workspace` plugin ID and installation directory.

## 0.9.1

- Published Root Books Workspace from a fresh repository so Obsidian can bind
  the new `root-books-workspace` plugin ID without conflicting with the
  registered `scope-tabs` ID in the archived Root Books Tabs repository.
- Adopted Obsidian 1.13's declarative, searchable settings API and removed
  manual settings headings.
- Added typed frontmatter boundaries so release scans no longer report unsafe
  assignments or member access.
- Added GitHub build-provenance attestations for release assets and replaced
  the license text with GitHub's recognized 0BSD form.

## 0.9.0

- Replaced the archived Root Books Tabs implementation with Root Books
  Workspace and a new `root-books-workspace` plugin ID.
- Added explicit setup and isolated audits for Folder Notes, Custom File
  Explorer Sorting, Front Matter Title, and Frontmatter Date Manager.
- Added portable `panel.icon` and direct-hex `panel.accent` book metadata,
  appearance editing, passive tab decoration, and a current-book status item.
- Added folder-note title synchronization, inherited note templates and date
  prefixes, filename-derived creation dates, and selective ordering refreshes.
- Added a replacement unique-note command and ribbon action. The core Unique
  Note Creator is disabled only when the user accepts the recommended setup.
- Kept workspace routing, managed groups, grids, pop-outs, focused Explorer
  views, Article Navigator, bulk frontmatter tools, and the legacy sorting and
  `book-tabs` configuration outside this first release.
