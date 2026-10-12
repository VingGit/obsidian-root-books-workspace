# Root Books Toolkit

Root Books Toolkit turns the first-level folders in an Obsidian vault into a
small, portable book workspace. Each book uses an `index.md` folder note and
can share the same appearance with Quartz through two frontmatter values:

```yaml
panel:
  icon: "lucide:book-open"
  accent: "#0ea5e9"
```

The plugin deliberately keeps this model simple. It decorates ordinary
file-backed tabs, adds a current-book status item, lets you edit a book's icon
and color, and opens a chosen book's folder note. It does not route files into
managed tab groups or take over Obsidian's workspace layout.

## What it coordinates

Root Books Toolkit works with four independently installed community
plugins. Its setup screen audits each one separately, explains the recommended
settings, and reports differences without changing another plugin. It never
installs, enables, disables, or configures plugins for you.

- **Folder Notes** owns `index.md` folder notes.
- **Custom File Explorer Sorting** owns File Explorer ordering.
- **Front Matter Title** displays folder-note titles without injecting aliases.
- **Frontmatter Date Manager** owns `created` and `updated` timestamps.

The plugin supplies a replacement **Create new unique note** command and ribbon
button. If Obsidian's core Unique Note Creator is also enabled, the settings
screen reports the overlap and leaves the choice to you.

The thesis template uses Community Install Manager to install registry plugins
and merge a curated selection of companion settings. Other vaults can use the
same approach or configure the four companions manually.

## Note workflow

The root `index.md` may define:

```yaml
template-date-format: DD.MM.YYYY
add-date-to-new-notes: false
new-note-template: "[[templates/note-template]]"
```

Nested folder notes may override date-prefix behavior with
`prefix-new-dates` and may override `new-note-template`. New Markdown notes get
the configured date fields, then the inherited Markdown template, then one
coalesced Custom Sort refresh. A date parsed from a filename becomes the
note's creation date. Changing the root filename format migrates matching
filenames when the destination is free.

The plugin preserves unrelated frontmatter and existing note bodies. Templates
never import their own creation or update timestamps.

## Installation

Download `main.js`, `manifest.json`, and `styles.css` from a release and place
them in:

```text
.obsidian/plugins/root-books-workspace/
```

Enable the plugin, review the read-only companion status in its settings, and
install or configure any missing companions through Obsidian or a plugin
manager of your choice.

## Ecosystem versions

Root Books Toolkit, [Root Index Panels](https://github.com/VingGit/root-index-panels),
and [Custom File Explorer Sorting Support](https://github.com/VingGit/custom-file-explorer-sorting-support)
use the same release version. Matching versions share the same portable
`panel.icon` and `panel.accent` contract across Obsidian and Quartz.

## License

[0BSD](LICENSE)
