# Architecture

Root Books Toolkit is an orchestration layer rather than a second
implementation of its companion plugins.

- `main.ts` owns lifecycle only.
- `integrations.ts` combines built-in read-only descriptors with the user's
  declarative watch profile, imports selected Community Install Manager values,
  and opens companion settings without writing them.
- `coordinator-health.ts` reports vault workflow, book metadata, and active
  runtime services without repairing them implicitly.
- `note-rules.ts`, `new-note-pipeline.ts`, and `created-from-filename.ts` own
  the note-creation and date pipeline.
- `sorting.ts` coalesces the few workflow events that legitimately require a
  Custom Sort refresh.
- `book-metadata.ts` is the only writer for shared `panel` appearance metadata.
- `decorations.ts` adds passive UI to ordinary Obsidian leaves without routing
  or restoring workspace state.

The shared Quartz/Obsidian contract is intentionally limited to direct hex
colors and `lucide:<kebab-name>` icon identifiers. Obsidian-specific settings
remain in plugin data rather than frontmatter.

Provisioning is outside this plugin. Community Install Manager or the user may
install, enable, and configure companions; Toolkit only reports their current
state and recommended-setting differences. Custom watches use a fixed set of
safe comparisons (`equals`, `exists`, `non-empty`, and `one-of`) and never run
user-supplied code.
