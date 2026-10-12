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
plugins. Its settings dashboard audits each one separately and shows its
installed version, enabled state, every watched setting, and the current and
expected value. Green rows match; red rows need attention. A shortcut opens
the companion's settings, or the Community plugins screen when it is missing
or disabled. Toolkit never installs, enables, disables, or configures another
plugin for you.

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

## Custom watch profile

The four workflow companions have built-in checks. You can also add any
installed community plugin to the watch profile from Toolkit's settings, then
select individual setting paths and capture their current values as defaults.
Checks can require an exact value, any value, a non-empty value, or one of a
JSON list of accepted values. These rules are stored as ordinary Toolkit data,
so adding another generic check does not require changing code.

Toolkit can import the selected settings from Community Install Manager's
`community-plugins-settings.json` profile. The import copies those selected
values into Toolkit's read-only watch profile; it does not make Toolkit a
second installer or settings writer.

The same dashboard also reports the coordinator's own responsibilities:
whether root workflow metadata is valid, which first-level book folders are
missing `index.md`, whether portable icon and accent metadata is valid, and
whether the note, date, title, sorting, and decoration services are active.

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

Enable the plugin, review the coordinator dashboard, and install or configure
anything that needs attention through Obsidian or a plugin manager of your
choice.

## Ecosystem versions

Root Books Toolkit, [Root Index Panels](https://github.com/VingGit/root-index-panels),
and [Custom File Explorer Sorting Support](https://github.com/VingGit/custom-file-explorer-sorting-support)
use the same release version. Matching versions share the same portable
`panel.icon` and `panel.accent` contract across Obsidian and Quartz.

## License

[0BSD](LICENSE)
