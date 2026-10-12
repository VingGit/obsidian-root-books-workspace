---
name: Product architecture
description: Supported integrations and first-version feature boundary
applyTo: "{src,tests}/**,manifest.json,package.json,styles.css"
---

# Product architecture

Root Books Toolkit coordinates four independently installed plugins:

- Folder Notes (`folder-notes`)
- Custom File Explorer Sorting (`custom-sort`)
- Front Matter Title (`obsidian-front-matter-title-plugin`)
- Frontmatter Date Manager (`frontmatter-date-manager`)

Read-only audit adapters must be isolated by plugin ID, feature-detected, and
visually separate in settings. Adding another integration should require one
new descriptor rather than conditionals spread through the product. Toolkit
must not install, enable, disable, or write settings for companion plugins.

The portable book model is one first-level folder per book. `index.md` is the
folder note. Shared appearance metadata is exclusively:

```yaml
panel:
  icon: "lucide:book-open"
  accent: "#0ea5e9"
```

Only `lucide:<kebab-name>` icons and direct hexadecimal accents are valid.
Legacy values may be converted once, but they are never read as a second live
configuration source.

The first version owns read-only dependency auditing, folder-note title synchronization,
filename-derived creation dates, inherited Markdown templates/date prefixes,
selective Custom Sort refreshes, a replacement unique-note command, appearance
editing, and passive book decoration.

It does not own book-aware routing, managed groups, grids, pop-outs, pseudo-tab
dragging, focused Explorer trees, Article Navigator, `.obsidianignore`, bulk
frontmatter deletion, config-note move resolution, Canvas/Base templates, a
second sorting engine, or the retired `book-tabs:` settings mapping.
