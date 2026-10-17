# Architecture

Root Books Toolkit is an orchestration layer rather than a second
implementation of its companion plugins.

- `main.ts` owns lifecycle only.
- `default-watch-profile.json` is the repository-owned profile for the four
  workflow companions. `watch-profile.ts` validates and transforms the current
  portable watch schema, including optional explanations and settings-page
  routes. Legacy watch schemas are rejected rather than migrated.
- `integrations.ts` reads community-plugin, core-plugin, and Obsidian settings;
  loads the vault's declarative profile override; exchanges exact values with
  Community Install Manager; and locates rendered settings rows across
  internal tabs and nested Manage screens without writing live values. Direct
  navigation adds a temporary return slip that restores the originating
  dashboard row and is removed when the user leaves Settings.
- `coordinator-health.ts` reports vault workflow, book metadata, and active
  runtime services without repairing them implicitly.
- `note-rules.ts`, `new-note-pipeline.ts`, and `created-from-filename.ts` own
  the note-creation and date pipeline.
- `sorting.ts` coalesces the few workflow events that legitimately require a
  Custom Sort refresh.
- `book-metadata.ts` is the only writer for shared `panel` appearance metadata.
- `decorations.ts` adds passive icon/accent UI to ordinary Obsidian leaves and
  first-level Explorer folders without routing or restoring workspace state.

The shared Quartz/Obsidian contract is intentionally limited to direct hex
colors and `lucide:<kebab-name>` icon identifiers. Obsidian-specific settings
remain in plugin data rather than frontmatter.

Provisioning is outside this plugin. Community Install Manager or the user may
install, enable, and configure companions; Toolkit only reports their current
state and recommended-setting differences. An explicit export may merge watched
community-plugin IDs and exact expected values into Community Install Manager's
profile files, but it never applies them to live plugins. Custom watches use a
fixed set of safe comparisons (`equals`, `exists`, `non-empty`, and `one-of`)
and never run user-supplied code.
