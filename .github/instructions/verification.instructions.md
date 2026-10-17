---
name: Verification
description: Required automated and manual checks
applyTo: "{src,tests,scripts}/**,package.json,manifest.json,styles.css"
---

# Verification

Before pushing a source change, run:

```text
npm ci
npm run format
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Manually test the dashboard with all companions present, each companion
missing, a disabled companion, recommended settings drifting, and the core
Unique Note Creator enabled. Confirm versions and all current/expected values
render correctly; exposed setting shortcuts open, traverse internal tabs or
nested Manage dialogs when required, scroll to, and highlight the intended row.
Confirm the temporary return slip restores the originating dashboard row and is
removed after leaving or closing Settings. Confirm the Custom Sort runtime flag
renders as Active/Suspended.
Confirm community, core-plugin, and Obsidian-preference watches support add,
edit, remove, equals, exists, non-empty, and one-of, accept only detected stored
settings, derive navigation labels without raw key/name fields, and survive
reload through the vault override file. Confirm startup and live drift
notifications respect their toggle, do not repeat unchanged issues, and notify
again after a repaired setting drifts a second time. Confirm Community Install
Manager import and merge-safe export preserve unrelated list and settings
entries and export only exact values. Confirm the audit and health panels never
change plugin enablement or live settings. Test plugin disable/re-enable, new
notes, unique notes, folder renames, filename-date
renames, template application, Custom Sort refresh coalescing, appearance
editing, bundled-icon browsing, native tab icon/accent decoration, first-level
Explorer folder icon/accent decoration, and rejection of legacy watch and book
metadata shapes in a disposable vault.
