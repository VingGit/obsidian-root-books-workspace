import assert from "node:assert/strict";
import test from "node:test";
import { recommendationIssues } from "../src/integration-audit";

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
