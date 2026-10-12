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
render correctly; companion-setting shortcuts open the intended screen; custom
equals, exists, non-empty, and one-of watches survive reload; and Community
Install Manager import adds only selected setting values. Confirm the audit and
health panels never change plugin enablement or settings. Test plugin
disable/re-enable, new notes, unique notes, folder renames, filename-date
renames, template application, Custom Sort refresh coalescing, appearance
editing, and legacy conversion in a disposable vault.
