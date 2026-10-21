# Root Books Toolkit slim-down

## Objective

Keep Root Books Toolkit focused on the first-level-folder book workflow and
move generic companion installation, enablement, version pinning, and selected
settings application to Community Install Manager in the canonical thesis
template. Release compatible Root Books ecosystem versions together, update
the canonical template first, then synchronize its GitLab fork with identical
Obsidian settings.

## Non-negotiable product boundary

Retain:

- first-level folders as books with `index.md` folder notes;
- portable `panel.icon` and `panel.accent` metadata shared with Quartz;
- passive tab/book decoration, current-book status, book selection, and the
  appearance editor;
- inherited `template-date-format`, `add-date-to-new-notes`,
  `prefix-new-dates`, and `new-note-template` rules;
- the ordered new-note pipeline, unique-note action, filename-derived creation
  dates and collision-safe format migration;
- folder-note title synchronization and selective Custom Sort refreshes;
- read-only companion health reporting and narrow runtime adapters.

Remove from Root Books Toolkit:

- installation or enablement of companion plugins;
- writes to companion `data.json` or loaded settings objects;
- automatic disabling of Obsidian's core Unique Note Creator;
- the mutating onboarding modal and its `Accept all` flow.

The features archived in the repository history remain out of scope: managed
tab routing/groups, grids, pop-outs, pseudo-tab dragging, focused Explorer
trees, Article Navigator, `.obsidianignore`, bulk frontmatter deletion,
config-note move workflows, Canvas/Base templates, a second sorting engine,
and the retired `book-tabs:` mapping.

## Community Install Manager profile

- Add `automatic-installation-of-plugins` to the canonical template's enabled
  and tracked Obsidian plugins.
- Add a version-pinned `community-plugins-list.json` for registry companions.
- Add `community-plugins-settings.json` containing only the selected keys Root
  Books Toolkit currently recommends. Use merge semantics so unrelated plugin
  settings remain outside the profile.
- Do not put secrets, credentials, machine paths, caches, or whole unreviewed
  `data.json` payloads in the profile.
- Keep the explicit repository updater mapping for Root Books Toolkit until it
  is available from the official Obsidian community registry.
- Treat a graphical per-setting selector with `recommend`,
  `default-if-missing`, and `enforce` modes as an upstream Community Install
  Manager enhancement; the initial template integration uses its supported
  selected-key JSON profile.

## Execution order and status

- [x] Run the supported Quartz/template/plugin updater in the canonical thesis
      template and review upstream changes.
- [x] Run the same updater in the fork to expose fork-specific compatibility
      issues; do not preserve fork settings that differ from the template.
- [x] Add and configure Community Install Manager in the canonical template.
- [x] Rewrite Root Books Toolkit integration handling as read-only.
- [x] Update tests and human/agent documentation for the new responsibility
      boundary.
- [x] Run `npm ci`, formatting, typecheck, lint, tests, build, and diff checks
      in Root Books Toolkit.
- [x] Audit Root Index Panels and Custom File Explorer Sorting Support against
      the retained portable metadata/runtime contracts.
- [x] Bump and release all three Root Books ecosystem repositories together if
      the Toolkit source change requires a new ecosystem release.
- [x] Refresh the canonical template's tracked Obsidian bundles/profile against
      the released versions.
- [x] Run the template's documented Node/Quartz and integration checks, commit,
      push, and wait for its GitLab pipeline.
- [x] Merge the canonical template into `dh2df-pipeline/portal`, resolving all
      `.obsidian` settings in favor of the template, verify, commit, push, and wait
      for the fork pipeline.
- [x] Retain this task file instead of removing it because the user added the
      separate deferred fork-exclusion follow-up below.

## Coordinator dashboard enhancement

- [x] Replace the terse audit with per-plugin installation, enablement,
      version, current-value, and expected-value reporting.
- [x] Add clear ready/mismatch states and shortcuts to companion settings or
      Community plugins.
- [x] Add persisted data-only watches for arbitrary installed plugins and
      selected setting paths, with equals, exists, non-empty, and one-of
      comparisons.
- [x] Add read-only import of Community Install Manager's selected-settings
      profile.
- [x] Report root workflow metadata, first-level book indexes, portable book
      appearance, Toolkit runtime services, and the Custom Sort refresh command.
- [x] Remove the canonical template's legacy `scripts/book-subrepos/` system
      and its updater/ignore coupling.
- [x] Publish the coordinated `0.11.0` tags after all three repository checks
      pass.
- [x] Refresh and verify the canonical template, then synchronize its fork with
      canonical `.obsidian` state.

## Resume checklist

1. Read `AGENTS.md` and every `.github/instructions/*.instructions.md` in each
   repository before editing.
2. Inspect `git status`, branch, remotes, and the latest commits in the Toolkit,
   both sibling ecosystem repositories, the canonical thesis template, and the
   thesis fork.
3. Continue from the first unchecked execution item and update this file after
   every durable checkpoint.
4. Never copy fork-specific `.obsidian` settings back into the canonical
   template. During the final merge, the canonical template wins every settings
   conflict.

## Deferred follow-up (separate prompt)

- [ ] As the final follow-up, study the fork-exclusion system in
      `C:\Users\Admin\git-projects\course material site generator\quartz-for-gitlab-template`
      and adapt the same capability to the thesis template monorepo. It must let
      each fork exclude selected template-owned Obsidian folders from template
      synchronization, so incidental template folders cannot leak into that
      fork. Preserve the monorepo's single-repository build and Pages contracts.
      Do not implement this during the Root Books Toolkit slim-down; handle it
      only in a separate later request.

## Verification evidence

Record commit IDs, release tags, updater output, and pipeline URLs here as the
work progresses.

- Initial plan created: 2026-10-12.
- Root Books Toolkit `0.10.0`: commit `68519c9`; release workflow passed.
- Root Index Panels `0.10.0`: merge commit `23f3137`; release workflow passed.
- Custom File Explorer Sorting Support `0.10.0`: commit `b763b71`; release
  workflow passed.
- Canonical template: commit `ddc4ece`; GitLab pipeline `135923` passed.
- Thesis fork: commit `46ebdf4`; GitLab pipeline `135924` passed; its tracked
  `.obsidian` tree matches the canonical template exactly.
- Root Books Toolkit `0.11.0`: commit `5e7d662`; local CI-equivalent checks
  passed; GitHub CI and the `0.11.0` release passed.
- Root Index Panels `0.11.0`: pull request
  `https://github.com/VingGit/root-index-panels/pull/30`; 171 tests, package,
  isolated Quartz, and watch diagnostics passed; merge commit `f5d1b66`; the
  `0.11.0` release passed.
- Custom File Explorer Sorting Support `0.11.0`: commit `492fab6`; unit,
  upstream-compatibility, fixture, repeat-build, package, and two-host Quartz
  integration checks passed; the `0.11.0` release passed.
- Canonical legacy subsystem removal was captured by automatic vault-backup
  commit `f9577a1`; the supported Quartz updater dry-run passed at upstream
  revision `65af9013940ed495c163f6c5e50a31b23a66838c`.
- Canonical template dashboard/dependency refresh: commit `94af4c4`; all 204
  active Obsidian tests and 2 Java tests passed, with 2 intentional skips;
  production builds, Pages assembly, and the clean Quartz updater dry-run
  passed; GitLab pipeline `136514` passed.
- Thesis fork synchronization: merge commit `9a9d6ec`; its tracked `.obsidian`
  tree hash `f8f039b6f90311eb4db62cd8d6cd9114896ee691` exactly matches the canonical
  template; tests, production builds, API docs, Pages assembly, and the Quartz
  updater dry-run passed; GitLab pipeline `136518` passed.
