export const ECOSYSTEM_VERSION = "0.11.0";

export const REQUIRED_PLUGIN_IDS = [
	"folder-notes",
	"custom-sort",
	"obsidian-front-matter-title-plugin",
	"frontmatter-date-manager",
] as const;

export type RequiredPluginId = (typeof REQUIRED_PLUGIN_IDS)[number];

export type WatchComparison = "equals" | "exists" | "one-of" | "non-empty";

export interface WatchedSetting {
	path: string;
	label: string;
	comparison: WatchComparison;
	expected?: unknown;
}

export interface WatchedPlugin {
	id: string;
	name: string;
	purpose: string;
	requireEnabled: boolean;
	checks: WatchedSetting[];
}

const WATCH_COMPARISONS = new Set<WatchComparison>([
	"equals",
	"exists",
	"one-of",
	"non-empty",
]);

function record(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

export function normalizeWatchedPlugins(value: unknown): WatchedPlugin[] {
	if (!Array.isArray(value)) return [];
	const result: WatchedPlugin[] = [];
	for (const candidate of value) {
		const plugin = record(candidate);
		if (
			!plugin ||
			typeof plugin.id !== "string" ||
			!plugin.id.trim() ||
			typeof plugin.name !== "string" ||
			typeof plugin.purpose !== "string" ||
			typeof plugin.requireEnabled !== "boolean" ||
			!Array.isArray(plugin.checks)
		)
			continue;
		const checks: WatchedSetting[] = [];
		for (const rawCheck of plugin.checks) {
			const check = record(rawCheck);
			if (
				!check ||
				typeof check.path !== "string" ||
				!check.path.trim() ||
				typeof check.label !== "string" ||
				typeof check.comparison !== "string" ||
				!WATCH_COMPARISONS.has(check.comparison as WatchComparison)
			)
				continue;
			checks.push({
				path: check.path.trim(),
				label: check.label.trim() || check.path.trim(),
				comparison: check.comparison as WatchComparison,
				expected: structuredClone(check.expected),
			});
		}
		result.push({
			id: plugin.id.trim(),
			name: plugin.name.trim() || plugin.id.trim(),
			purpose: plugin.purpose.trim(),
			requireEnabled: plugin.requireEnabled,
			checks,
		});
	}
	return result;
}

export interface RootBooksWorkspaceSettings {
	schemaVersion: 2;
	metadataMigrationVersion: number;
	lastValidDateFormat: string;
	optionalFilenameTimeFormat: string;
	colorTabs: boolean;
	showBookLabel: boolean;
	watchedPlugins: WatchedPlugin[];
}

export const DEFAULT_SETTINGS: RootBooksWorkspaceSettings = {
	schemaVersion: 2,
	metadataMigrationVersion: 0,
	lastValidDateFormat: "DD.MM.YYYY",
	optionalFilenameTimeFormat: "",
	colorTabs: true,
	showBookLabel: true,
	watchedPlugins: [],
};

export interface BookPanelMetadata {
	icon: string;
	accent: string;
}

export interface BookRecord {
	id: string;
	name: string;
	folderPath: string;
	indexPath: string;
	panel: BookPanelMetadata;
}

export interface IntegrationAudit {
	id: string;
	name: string;
	purpose: string;
	installed: boolean;
	enabled: boolean;
	configured: boolean;
	version: string | null;
	checks: SettingAudit[];
	issues: string[];
}

export interface SettingAudit {
	path: string;
	label: string;
	comparison: WatchComparison;
	expected?: unknown;
	actual: unknown;
	ok: boolean;
}

export type HealthStatus = "ok" | "warning" | "error";

export interface CoordinatorHealthItem {
	id: string;
	label: string;
	detail: string;
	status: HealthStatus;
}

export interface RuntimeCoordinatorState {
	initialized: boolean;
	newNotePipeline: boolean;
	filenameDateSync: boolean;
	folderTitleSync: boolean;
	sorting: boolean;
	bookDecorations: boolean;
}
