# Root Books Toolkit

Root Books Toolkit turns the first-level folders in an Obsidian vault into a
small, portable book workspace. Each book uses an `index.md` folder note and
can share the same appearance with Quartz through two frontmatter values:

```yaml
panel:
  icon: "lucide:book-open"
  accent: "#0ea5e9"
```

The plugin deliberately keeps this model simple. It applies each book's icon
and accent to ordinary file-backed tabs and its first-level Explorer folder,
adds a current-book status item, lets you browse Obsidian's bundled Lucide icons
while editing appearance, and opens a chosen book's folder note. It does not
route files into managed tab groups or take over Obsidian's workspace layout.

## What it coordinates

Root Books Toolkit works with four independently installed community
plugins. Its settings dashboard audits each one separately and shows its
installed version, enabled state, every watched setting, and the current and
expected value. Green rows match; red rows need attention. Community plugins,
core plugins, and Obsidian options have separate dashboard sections, and each
colored target card owns its Edit and Remove actions. Each setting exposed in a
settings screen is chosen from the target's detected stored values; users do
not type internal keys or visible row names. Its shortcut opens Obsidian's
separate Settings window, checks the live rendered row names, clicks through a
plugin's own settings tabs or nested Manage screen when required, and then
scrolls to, focuses, and highlights the matching row. A temporary return slip
goes back to the same dashboard item and disappears when Settings is closed or
another settings page is chosen. Toolkit falls back to a settings search when
a setting is not represented in the current target UI. It never installs,
enables, disables, or configures another plugin for you.

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

Toolkit can show one startup summary when a watched target is missing,
disabled, or misconfigured. It then checks the watched state every three
seconds and notifies only when a new problem appears; a repaired setting can
trigger another notification if it drifts again. Notifications can be turned
off independently of the dashboard.

## Watch profile

The four workflow companions come from the repository's
`default-watch-profile.json`. Every target and setting may explain why it is
watched; the bundled companions include those explanations. The dashboard is
also where targets are added, edited, and removed. The first change creates the vault-specific override
`.obsidian/root-books-watch-profile.json`, which can be tracked in Git and is
not replaced by plugin updates. **Restore bundled defaults** removes the
override and uses the default profile shipped with the currently installed
Toolkit version.

The settings screen keeps community plugins, core plugins, and Obsidian Options
separate. Options can target General, Appearance, Interface, Editor, Files and
links, Hotkeys, or Keychain while reading only safe stored values detected in
`app.json`, `appearance.json`, `hotkeys.json`, and `types.json`; Toolkit never
reads Keychain secrets. Checks can
require an exact value, any value, a non-empty value, or one of a JSON list of
accepted values. Core plugins expose their settings through their live options
or their vault configuration file; a core plugin that exposes neither can still
be watched for enablement.

Custom File Explorer Sorting stores its active state under the internal key
`suspended`. Therefore `false` means the sorting runtime is active. Toolkit
renders this positively as **Active** and does not pretend it is a toggle in the
plugin's settings screen; the state is controlled by Custom Sort's ribbon icon
and commands.

Toolkit can import Community Install Manager's plugin list and selected settings
into its watch profile. It can also merge watched community-plugin IDs into
`community-plugins-list.json` and exact expected values into
`community-plugins-settings.json`, either with a button or through an opt-in
startup export. Existing unrelated entries and version pins are preserved.
Existence, non-empty, and one-of checks are intentionally skipped because they
do not identify one value for Community Install Manager to apply. Toolkit still
does not install, enable, disable, or write live plugin settings.

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

Install or update Root Books Toolkit through Obsidian's Community plugins
screen. Manual installations need the three standard release assets:
`main.js`, `manifest.json`, and `styles.css`. The default watch profile is
compiled into `main.js`.

```text
.obsidian/plugins/root-books-workspace/
```

Enable the plugin, review the coordinator dashboard, and install or configure
anything that needs attention through Obsidian or a plugin manager of your
choice.

The canonical thesis template vault is the local-development host. The thesis
fork is a release consumer and is deliberately updated only through Obsidian's
official Community plugins update action; local builds are never copied into
that fork.

## Ecosystem versions

Root Books Toolkit, [Root Index Panels](https://github.com/VingGit/root-index-panels),
and [Custom File Explorer Sorting Support](https://github.com/VingGit/custom-file-explorer-sorting-support)
share the same portable `panel.icon` and `panel.accent` contract across Obsidian
and Quartz. Package releases may advance independently when that contract does
not change; the dashboard's ecosystem version identifies the shared contract
line rather than the installed Toolkit package version.

## License

[0BSD](LICENSE)
