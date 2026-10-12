export interface AuditedRecommendation {
	path: string;
	label: string;
	value: unknown;
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

function equal(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

export function recommendationIssues(
	settings: Record<string, unknown>,
	recommendations: readonly AuditedRecommendation[],
): string[] {
	return recommendations
		.filter(
			(recommendation) =>
				!equal(
					getPath(settings, recommendation.path),
					recommendation.value,
				),
		)
		.map((recommendation) => recommendation.label);
}
