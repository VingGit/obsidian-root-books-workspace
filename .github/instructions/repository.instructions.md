---
name: Repository boundaries
description: Human/agent documentation, source, privacy, and release boundaries
applyTo: "**"
---

# Repository boundaries

- Root Books Toolkit is an Obsidian community plugin. Source lives in `src/`.
- Keep `src/main.ts` limited to lifecycle and orchestration.
- Keep human documentation in `README.md` and `CHANGELOG.md`. Agent-only
  material belongs in `AGENTS.md` or `.github/`.
- Use npm and keep `package-lock.json` reproducible.
- Do not commit `main.js`; attach `main.js`, `manifest.json`, and `styles.css`
  to releases.
- Operate locally and offline. Do not add telemetry, remote code, dependency
  installation, or filesystem access outside the vault.
- Never change companion-plugin settings or enablement. Community Install
  Manager or the user owns provisioning; Toolkit only audits and explains its
  recommendations.
- Preserve unrelated vault frontmatter and note bodies. All migrations must be
  idempotent.
- Inspect status, diff, ignored files, secrets, author identity, branch, and
  remote before every commit and push.
- The project is still in development. Do not preserve legacy profiles,
  schemas, fields, or behavior by default. When legacy support would affect a
  change, ask the user whether to keep or discard it before implementing that
  support.
- Use the canonical thesis template vault for local plugin development and
  direct build installation only. Treat the thesis fork as the release
  consumer: update Root Books Toolkit there only through Obsidian's official
  Community plugins update action. Never copy local development artifacts into
  the fork when validating a release.
