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

Manually test the read-only audit with all companions present, each companion
missing, a disabled companion, recommended settings drifting, and the core
Unique Note Creator enabled. Confirm the audit never changes plugin enablement
or settings. Test plugin disable/re-enable, new notes, unique notes, folder
renames, filename-date renames, template application, Custom Sort refresh
coalescing, appearance editing, and legacy conversion in a disposable vault.
