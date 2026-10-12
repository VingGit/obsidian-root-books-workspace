import assert from "node:assert/strict";
import test from "node:test";
import {
	auditRecommendations,
	recommendationIssues,
} from "../src/integration-audit";
import { normalizeWatchedPlugins } from "../src/types";

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

test("normalizes portable custom watches and drops invalid entries", () => {
	assert.deepEqual(
		normalizeWatchedPlugins([
			{
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
