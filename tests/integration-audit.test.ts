import assert from "node:assert/strict";
import test from "node:test";
import {
	auditRecommendations,
	recommendationIssues,
	watchAuditIssueKeys,
} from "../src/integration-audit";
import {
	normalizeWatchedTargets,
	normalizeWatchProfile,
	OBSIDIAN_OPTION_PAGES,
} from "../src/types";
import {
	buildCommunityManagerExport,
	builtInWatchProfile,
} from "../src/watch-profile";

const recommendations = [
	{ path: "enabled", label: "Enabled", value: true },
	{ path: "nested.mode", label: "Nested mode", value: "portable" },
] as const;

test("reports only settings that differ from the recommendation profile", () => {
	assert.deepEqual(
		recommendationIssues(
			{ enabled: true, nested: { mode: "local" }, unrelated: 42 },
			recommendations,
		),
		["Nested mode"],
	);
});

test("auditing recommendations never mutates plugin settings", () => {
	const settings = { enabled: false, nested: { mode: "portable" } };
	const before = structuredClone(settings);

	recommendationIssues(settings, recommendations);

	assert.deepEqual(settings, before);
});

test("returns current and expected values for every watched setting", () => {
	assert.deepEqual(
		auditRecommendations(
			{ enabled: false, nested: { mode: "portable" } },
			recommendations,
		),
		[
			{
				path: "enabled",
				label: "Enabled",
				comparison: "equals",
				expected: true,
				actual: false,
				ok: false,
			},
			{
				path: "nested.mode",
				label: "Nested mode",
				comparison: "equals",
				expected: "portable",
				actual: "portable",
				ok: true,
			},
		],
	);
});

test("supports declarative existence, non-empty, and one-of comparisons", () => {
	const checks = auditRecommendations(
		{ present: false, title: "Book", mode: "portable" },
		[
			{
				path: "present",
				label: "Present",
				comparison: "exists",
			},
			{
				path: "title",
				label: "Title",
				comparison: "non-empty",
			},
			{
				path: "mode",
				label: "Mode",
				comparison: "one-of",
				expected: ["portable", "shared"],
			},
		],
	);
	assert.equal(
		checks.every((check) => check.ok),
		true,
	);
});

test("audit rows retain explanations and exact settings locations", () => {
	const [check] = auditRecommendations({ enabled: true }, [
		{
			path: "enabled",
			label: "Enabled",
			description: "Required for the workflow.",
			settingsLabel: "Enable feature",
			settingsChildLabel: "Strategy",
			settingsTab: "editor",
			expected: true,
		},
	]);
	assert.equal(check?.description, "Required for the workflow.");
	assert.equal(check?.settingsLabel, "Enable feature");
	assert.equal(check?.settingsChildLabel, "Strategy");
	assert.equal(check?.settingsTab, "editor");
});

test("normalizes portable custom watches and drops invalid entries", () => {
	assert.deepEqual(
		normalizeWatchedTargets([
			{
				kind: "community-plugin",
				id: "sample-plugin",
				name: "Sample",
				purpose: "Custom watch",
				requireEnabled: true,
				checks: [
					{
						path: " mode ",
						label: " Mode ",
						comparison: "equals",
						expected: "portable",
					},
					{ path: "ignored", label: "Ignored", comparison: "script" },
				],
			},
			{ id: "broken" },
		]),
		[
			{
				kind: "community-plugin",
				id: "sample-plugin",
				name: "Sample",
				purpose: "Custom watch",
				requireEnabled: true,
				checks: [
					{
						path: "mode",
						label: "Mode",
						comparison: "equals",
						expected: "portable",
					},
				],
			},
		],
	);
});

test("normalizes explicitly typed core and Obsidian watch targets", () => {
	assert.deepEqual(
		normalizeWatchedTargets([
			{
				kind: "core-plugin",
				id: "daily-notes",
				name: "Daily notes",
				purpose: "Core settings",
				requireEnabled: true,
				checks: [],
			},
			{
				kind: "obsidian",
				id: "app",
				name: "Obsidian preferences",
				purpose: "App settings",
				requireEnabled: false,
				checks: [],
			},
		]),
		[
			{
				kind: "core-plugin",
				id: "daily-notes",
				name: "Daily notes",
				purpose: "Core settings",
				requireEnabled: true,
				checks: [],
			},
			{
				kind: "obsidian",
				id: "app",
				name: "Obsidian preferences",
				purpose: "App settings",
				requireEnabled: false,
				checks: [],
			},
		],
	);
});

test("normalizes optional explanations and exact settings locations", () => {
	const [target] = normalizeWatchedTargets([
		{
			kind: "obsidian",
			id: "app",
			name: "Obsidian options",
			purpose: "Portable editor behavior",
			requireEnabled: false,
			checks: [
				{
					path: "app.alwaysUpdateLinks",
					label: "Update links",
					description: "Keep links valid after renames.",
					comparison: "equals",
					expected: true,
					settingsLabel: "Automatically update internal links",
					settingsTab: "files",
				},
			],
		},
	]);

	assert.deepEqual(target?.checks[0], {
		path: "app.alwaysUpdateLinks",
		label: "Update links",
		description: "Keep links valid after renames.",
		comparison: "equals",
		expected: true,
		settingsLabel: "Automatically update internal links",
		settingsTab: "files",
	});
});

test("exports exact community watches without replacing existing manager data", () => {
	const result = buildCommunityManagerExport(
		[
			{
				kind: "community-plugin",
				id: "sample-plugin",
				name: "Sample",
				purpose: "Sample settings",
				requireEnabled: true,
				checks: [
					{
						path: "nested.mode",
						label: "Mode",
						comparison: "equals",
						expected: "portable",
					},
					{
						path: "token",
						label: "Token exists",
						comparison: "exists",
					},
				],
			},
			{
				kind: "core-plugin",
				id: "daily-notes",
				name: "Daily notes",
				purpose: "Core settings",
				requireEnabled: true,
				checks: [],
			},
		],
		[{ id: "existing-plugin", version: "1.0.0" }],
		{ "sample-plugin": { untouched: true } },
	);

	assert.deepEqual(result.pluginList, [
		{ id: "existing-plugin", version: "1.0.0" },
		"sample-plugin",
	]);
	assert.deepEqual(result.settings, {
		"sample-plugin": { untouched: true, nested: { mode: "portable" } },
	});
	assert.equal(result.addedPlugins, 1);
	assert.equal(result.exportedSettings, 1);
	assert.equal(result.skippedChecks, 1);
});

test("bundled profile keeps Custom Sort's inverted runtime flag user-friendly", () => {
	const profile = builtInWatchProfile();
	assert.equal(profile.schemaVersion, 3);
	assert.equal(profile.targets.length, 4);
	const customSort = profile.targets.find(
		(target) => target.id === "custom-sort",
	);
	const runtime = customSort?.checks.find(
		(check) => check.path === "suspended",
	);
	assert.deepEqual(runtime, {
		path: "suspended",
		label: "Custom sorting runtime is active",
		description:
			"The stored flag is inverted: false means Custom Sort is running and applying the configured order.",
		comparison: "equals",
		expected: false,
		booleanLabels: { true: "Suspended", false: "Active" },
		locatable: false,
	});
});

test("bundled checks explain their purpose and locate every visible setting", () => {
	const profile = builtInWatchProfile();
	for (const target of profile.targets) {
		assert.notEqual(target.purpose, "", `${target.id} has no description`);
		for (const check of target.checks) {
			assert.ok(
				check.description,
				`${target.id}:${check.path} has no explanation`,
			);
			if (check.locatable !== false)
				assert.ok(
					check.settingsLabel,
					`${target.id}:${check.path} has no exact settings label`,
				);
		}
	}
});

test("profiles without an explicit target kind are rejected", () => {
	assert.deepEqual(
		normalizeWatchedTargets([
			{
				id: "old-profile",
				name: "Old profile",
				requireEnabled: true,
				checks: [],
			},
		]),
		[],
	);
});

test("legacy watch-profile schemas are rejected", () => {
	assert.throws(
		() => normalizeWatchProfile({ schemaVersion: 2, targets: [] }),
		/Unsupported watch profile schema/,
	);
});

test("bundled shortcuts match the live companion settings structure", () => {
	const profile = builtInWatchProfile();
	const folderNotes = profile.targets.find(
		(target) => target.id === "folder-notes",
	);
	assert.equal(
		folderNotes?.checks.find((check) => check.path === "folderNoteType")
			?.settingsLabel,
		"Default file type for new folder notes",
	);
	const frontMatterTitle = profile.targets.find(
		(target) => target.id === "obsidian-front-matter-title-plugin",
	);
	assert.deepEqual(
		frontMatterTitle?.checks.find(
			(check) => check.path === "features.noteLink.strategy",
		),
		{
			path: "features.noteLink.strategy",
			label: "Only empty link aliases are filled",
			description:
				"Existing hand-written link text stays untouched; only links without an alias receive the resolved title.",
			settingsLabel: "Note Link",
			settingsChildLabel: "Strategy",
			comparison: "equals",
			expected: "onlyEmpty",
		},
	);
	const dateManager = profile.targets.find(
		(target) => target.id === "frontmatter-date-manager",
	);
	assert.deepEqual(
		dateManager?.checks
			.filter((check) => check.locatable === false)
			.map((check) => check.path),
		["enableAutoPopulateCache", "postUpdateCommand"],
	);
});

test("Obsidian options expose every first-party settings page category", () => {
	assert.deepEqual(
		OBSIDIAN_OPTION_PAGES.map((page) => page.name),
		[
			"General",
			"Appearance",
			"Interface",
			"Editor",
			"Files and links",
			"Hotkeys",
			"Keychain",
		],
	);
});

test("live audit monitoring tracks missing, disabled, and mismatched states", () => {
	const base = {
		kind: "community-plugin" as const,
		id: "sample-plugin",
		name: "Sample plugin",
		purpose: "Test target",
		requireEnabled: true,
		installed: true,
		enabled: true,
		configured: false,
		version: "1.0.0",
		issues: ["Portable mode"],
		checks: [
			{
				path: "mode",
				label: "Portable mode",
				comparison: "equals" as const,
				expected: "portable",
				actual: "local",
				ok: false,
			},
		],
	};

	assert.deepEqual(watchAuditIssueKeys(base), [
		"community-plugin:sample-plugin:setting:mode",
	]);
	assert.deepEqual(watchAuditIssueKeys({ ...base, enabled: false }), [
		"community-plugin:sample-plugin:disabled",
		"community-plugin:sample-plugin:setting:mode",
	]);
	assert.deepEqual(
		watchAuditIssueKeys({ ...base, installed: false, enabled: false }),
		["community-plugin:sample-plugin:not-installed"],
	);
});
