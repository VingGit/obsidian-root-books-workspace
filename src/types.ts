export const ECOSYSTEM_VERSION = "0.11.0";

export const REQUIRED_PLUGIN_IDS = [
	"folder-notes",
	"custom-sort",
	"obsidian-front-matter-title-plugin",
	"frontmatter-date-manager",
] as const;

export type RequiredPluginId = (typeof REQUIRED_PLUGIN_IDS)[number];

export type WatchComparison = "equals" | "exists" | "one-of" | "non-empty";

export type WatchTargetKind = "community-plugin" | "core-plugin" | "obsidian";

export const OBSIDIAN_OPTION_PAGES = [
	{ id: "general", name: "General" },
	{ id: "appearance", name: "Appearance" },
	{ id: "interface", name: "Interface" },
	{ id: "editor", name: "Editor" },
	{ id: "files", name: "Files and links" },
	{ id: "hotkeys", name: "Hotkeys" },
	{ id: "keychain", name: "Keychain" },
] as const;

export interface BooleanValueLabels {
	true: string;
	false: string;
}

export interface WatchedSetting {
	path: string;
	label: string;
	description?: string;
	comparison: WatchComparison;
	expected?: unknown;
	settingsLabel?: string;
	settingsChildLabel?: string;
	settingsTab?: string;
	booleanLabels?: BooleanValueLabels;
	locatable?: boolean;
}

export interface WatchedTarget {
	kind: WatchTargetKind;
	id: string;
	name: string;
	purpose: string;
	requireEnabled: boolean;
	checks: WatchedSetting[];
}

export interface WatchProfileFile {
	schemaVersion: 3;
	targets: WatchedTarget[];
}

const WATCH_COMPARISONS = new Set<WatchComparison>([
	"equals",
	"exists",
	"one-of",
	"non-empty",
]);

const WATCH_TARGET_KINDS = new Set<WatchTargetKind>([
	"community-plugin",
	"core-plugin",
	"obsidian",
]);

function record(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function normalizeBooleanLabels(
	value: unknown,
): BooleanValueLabels | undefined {
	const labels = record(value);
	return labels &&
		typeof labels.true === "string" &&
		typeof labels.false === "string"
		? { true: labels.true, false: labels.false }
		: undefined;
}

export function normalizeWatchedTargets(value: unknown): WatchedTarget[] {
	if (!Array.isArray(value)) return [];
	const result: WatchedTarget[] = [];
	for (const candidate of value) {
		const plugin = record(candidate);
		if (
			!plugin ||
			typeof plugin.kind !== "string" ||
			!WATCH_TARGET_KINDS.has(plugin.kind as WatchTargetKind) ||
			typeof plugin.id !== "string" ||
			!plugin.id.trim() ||
			typeof plugin.name !== "string" ||
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
			const settingsLabel =
				typeof check.settingsLabel === "string" &&
				check.settingsLabel.trim()
					? check.settingsLabel.trim()
					: undefined;
			const settingsChildLabel =
				typeof check.settingsChildLabel === "string" &&
				check.settingsChildLabel.trim()
					? check.settingsChildLabel.trim()
					: undefined;
			const description =
				typeof check.description === "string" &&
				check.description.trim()
					? check.description.trim()
					: undefined;
			const settingsTab =
				typeof check.settingsTab === "string" &&
				check.settingsTab.trim()
					? check.settingsTab.trim()
					: undefined;
			const booleanLabels = normalizeBooleanLabels(check.booleanLabels);
			checks.push({
				path: check.path.trim(),
				label: check.label.trim() || check.path.trim(),
				...(description ? { description } : {}),
				comparison: check.comparison as WatchComparison,
				expected: structuredClone(check.expected),
				...(settingsLabel ? { settingsLabel } : {}),
				...(settingsChildLabel ? { settingsChildLabel } : {}),
				...(settingsTab ? { settingsTab } : {}),
				...(booleanLabels ? { booleanLabels } : {}),
				...(check.locatable === false ? { locatable: false } : {}),
			});
		}
		result.push({
			kind: plugin.kind as WatchTargetKind,
			id: plugin.id.trim(),
			name: plugin.name.trim() || plugin.id.trim(),
			purpose:
				typeof plugin.purpose === "string" ? plugin.purpose.trim() : "",
			requireEnabled: plugin.requireEnabled,
			checks,
		});
	}
	return result;
}

export function normalizeWatchProfile(value: unknown): WatchProfileFile {
	const profile = record(value);
	if (profile?.schemaVersion !== 3)
		throw new Error("Unsupported watch profile schema.");
	return {
		schemaVersion: 3,
		targets: normalizeWatchedTargets(profile?.targets),
	};
}

export interface RootBooksWorkspaceSettings {
	schemaVersion: 3;
	lastValidDateFormat: string;
	optionalFilenameTimeFormat: string;
	colorTabs: boolean;
	showBookLabel: boolean;
	notifyOnAuditIssues: boolean;
	exportWatchProfileOnStartup: boolean;
}

export const DEFAULT_SETTINGS: RootBooksWorkspaceSettings = {
	schemaVersion: 3,
	lastValidDateFormat: "DD.MM.YYYY",
	optionalFilenameTimeFormat: "",
	colorTabs: true,
	showBookLabel: true,
	notifyOnAuditIssues: true,
	exportWatchProfileOnStartup: false,
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
	kind: WatchTargetKind;
	id: string;
	name: string;
	purpose: string;
	requireEnabled: boolean;
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
	description?: string;
	comparison: WatchComparison;
	expected?: unknown;
	actual: unknown;
	ok: boolean;
	settingsLabel?: string;
	settingsChildLabel?: string;
	settingsTab?: string;
	booleanLabels?: BooleanValueLabels;
	locatable?: boolean;
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
