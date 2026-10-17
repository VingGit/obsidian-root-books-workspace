import type { IntegrationAudit, SettingAudit, WatchComparison } from "./types";

export interface AuditedRecommendation {
	path: string;
	label: string;
	description?: string;
	comparison?: WatchComparison;
	value?: unknown;
	expected?: unknown;
	settingsLabel?: string;
	settingsChildLabel?: string;
	settingsTab?: string;
	booleanLabels?: { true: string; false: string };
	locatable?: boolean;
}

function getPath(record: Record<string, unknown>, path: string): unknown {
	let current: unknown = record;
	for (const part of path.split(".")) {
		if (
			typeof current !== "object" ||
			current === null ||
			Array.isArray(current)
		) {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

export function equal(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function nonEmpty(value: unknown): boolean {
	if (typeof value === "string" || Array.isArray(value))
		return value.length > 0;
	if (typeof value === "object" && value !== null)
		return Object.keys(value).length > 0;
	return value !== undefined && value !== null;
}

function matches(
	actual: unknown,
	expected: unknown,
	comparison: WatchComparison,
): boolean {
	switch (comparison) {
		case "exists":
			return actual !== undefined;
		case "non-empty":
			return nonEmpty(actual);
		case "one-of":
			return (
				Array.isArray(expected) &&
				expected.some((candidate) => equal(actual, candidate))
			);
		case "equals":
			return equal(actual, expected);
	}
}

function expectedValue(recommendation: AuditedRecommendation): unknown {
	return "expected" in recommendation
		? recommendation.expected
		: recommendation.value;
}

export function auditRecommendations(
	settings: Record<string, unknown>,
	recommendations: readonly AuditedRecommendation[],
): SettingAudit[] {
	return recommendations.map((recommendation) => {
		const expected = expectedValue(recommendation);
		const actual = getPath(settings, recommendation.path);
		const comparison = recommendation.comparison ?? "equals";
		return {
			path: recommendation.path,
			label: recommendation.label,
			...(recommendation.description
				? { description: recommendation.description }
				: {}),
			comparison,
			expected,
			actual,
			ok: matches(actual, expected, comparison),
			...(recommendation.settingsLabel
				? { settingsLabel: recommendation.settingsLabel }
				: {}),
			...(recommendation.settingsChildLabel
				? { settingsChildLabel: recommendation.settingsChildLabel }
				: {}),
			...(recommendation.settingsTab
				? { settingsTab: recommendation.settingsTab }
				: {}),
			...(recommendation.booleanLabels
				? { booleanLabels: recommendation.booleanLabels }
				: {}),
			...(recommendation.locatable === false ? { locatable: false } : {}),
		};
	});
}

export function recommendationIssues(
	settings: Record<string, unknown>,
	recommendations: readonly AuditedRecommendation[],
): string[] {
	return auditRecommendations(settings, recommendations)
		.filter((check) => !check.ok)
		.map((check) => check.label);
}

export function watchAuditIssueKeys(audit: IntegrationAudit): string[] {
	const prefix = `${audit.kind}:${audit.id}`;
	if (!audit.installed) return [`${prefix}:not-installed`];
	const keys: string[] = [];
	if (audit.requireEnabled && !audit.enabled) keys.push(`${prefix}:disabled`);
	for (const check of audit.checks) {
		if (!check.ok) keys.push(`${prefix}:setting:${check.path}`);
	}
	return keys;
}
