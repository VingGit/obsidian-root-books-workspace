import { App, normalizePath } from "obsidian";
import {
	auditRecommendations,
	type AuditedRecommendation,
} from "./integration-audit";
import type { IntegrationAudit, WatchedPlugin } from "./types";

export interface IntegrationDescriptor {
	id: string;
	name: string;
	purpose: string;
	requireEnabled: boolean;
	recommendations: AuditedRecommendation[];
}

export interface InstalledPluginSummary {
	id: string;
	name: string;
	version: string | null;
}

interface LoadedCompanion {
	settings?: Record<string, unknown>;
}

interface CommunityPluginManager {
	plugins?: Record<string, LoadedCompanion>;
	enabledPlugins?: Set<string>;
	manifests?: Record<string, PluginManifest>;
}

interface PluginManifest {
	id?: string;
	name?: string;
	version?: string;
}

interface CorePluginManager {
	getPluginById?: (id: string) => { enabled?: boolean } | undefined;
}

interface SettingsManager {
	open?: () => void;
	openTabById?: (id: string) => void;
}

function communityManager(app: App): CommunityPluginManager | undefined {
	return (app as App & { plugins?: CommunityPluginManager }).plugins;
}

function coreManager(app: App): CorePluginManager | undefined {
	return (app as App & { internalPlugins?: CorePluginManager })
		.internalPlugins;
}

function settingsManager(app: App): SettingsManager | undefined {
	return (app as App & { setting?: SettingsManager }).setting;
}

export const INTEGRATIONS: readonly IntegrationDescriptor[] = [
	{
		id: "folder-notes",
		name: "Folder Notes",
		purpose: "Creates and opens index.md folder notes inside each folder.",
		requireEnabled: true,
		recommendations: [
			{
				path: "folderNoteName",
				label: "Folder-note name is index",
				value: "index",
			},
			{
				path: "folderNoteType",
				label: "Folder notes use Markdown",
				value: ".md",
			},
			{
				path: "storageLocation",
				label: "Folder notes stay inside folders",
				value: "insideFolder",
			},
			{
				path: "templatePath",
				label: "Folder-note template is templates/index-template.md",
				value: "templates/index-template.md",
			},
			{
				path: "autoCreate",
				label: "Folder notes are created automatically",
				value: true,
			},
			{
				path: "hideFolderNote",
				label: "Folder-note files stay hidden in Explorer",
				value: true,
			},
			{
				path: "frontMatterTitle.enabled",
				label: "Front Matter Title integration is enabled",
				value: true,
			},
			{
				path: "frontMatterTitle.explorer",
				label: "Explorer uses folder-note titles",
				value: true,
			},
			{
				path: "frontMatterTitle.path",
				label: "Paths use folder-note titles",
				value: true,
			},
		],
	},
	{
		id: "custom-sort",
		name: "Custom File Explorer Sorting",
		purpose:
			"Applies inherited sorting-spec rules in Obsidian's File Explorer.",
		requireEnabled: true,
		recommendations: [
			{
				path: "indexNoteNameForFolderNotes",
				label: "Folder-note name is index",
				value: "index",
			},
			{
				path: "suspended",
				label: "Custom sorting is active",
				value: false,
			},
			{
				path: "automaticBookmarksIntegration",
				label: "Bookmark integration is enabled",
				value: true,
			},
		],
	},
	{
		id: "obsidian-front-matter-title-plugin",
		name: "Front Matter Title",
		purpose:
			"Uses each index.md title as the visible folder and link name.",
		requireEnabled: true,
		recommendations: [
			{
				path: "templates.common.main",
				label: "The common title property is title",
				value: "title",
			},
			{
				path: "features.alias.enabled",
				label: "Alias injection is disabled to avoid duplicate index suggestions",
				value: false,
			},
			{
				path: "features.explorer.enabled",
				label: "Explorer titles are enabled",
				value: true,
			},
			{
				path: "features.suggest.enabled",
				label: "Suggestion titles are enabled",
				value: true,
			},
			{
				path: "features.noteLink.enabled",
				label: "Note-link titles are enabled",
				value: true,
			},
			{
				path: "features.noteLink.strategy",
				label: "Only empty link aliases are filled",
				value: "onlyEmpty",
			},
		],
	},
	{
		id: "frontmatter-date-manager",
		name: "Frontmatter Date Manager",
		purpose:
			"Maintains reliable created and updated fields used by ordering.",
		requireEnabled: true,
		recommendations: [
			{
				path: "dateFormat",
				label: "Date and time use the portable ISO-like format",
				value: "yyyy-MM-dd'T'HH:mm:ss",
			},
			{
				path: "headerCreated",
				label: "The creation field is created",
				value: "created",
			},
			{
				path: "headerUpdated",
				label: "The update field is updated",
				value: "updated",
			},
			{
				path: "enableCreateTime",
				label: "Creation dates are enabled",
				value: true,
			},
			{
				path: "enableAutoUpdate",
				label: "Update dates are enabled",
				value: true,
			},
			{
				path: "filterRules",
				label: "Templates and root notes are skipped",
				value: "templates/\n./*",
			},
			{
				path: "enableAutoPopulateCache",
				label: "The date cache populates at startup",
				value: true,
			},
			{
				path: "inversionFixStrategy",
				label: "Out-of-order dates are preserved",
				value: "disabled",
			},
			{
				path: "postUpdateCommand",
				label: "Broad post-update sorting is disabled",
				value: "",
			},
		],
	},
] as const;

export async function pluginSettings(
	app: App,
	id: string,
): Promise<Record<string, unknown>> {
	const loaded = communityManager(app)?.plugins?.[id]?.settings;
	if (loaded) return structuredClone(loaded);
	const path = normalizePath(
		`${app.vault.configDir}/plugins/${id}/data.json`,
	);
	try {
		const raw = await app.vault.adapter.read(path);
		const value: unknown = JSON.parse(raw);
		return typeof value === "object" &&
			value !== null &&
			!Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

async function pluginManifest(
	app: App,
	id: string,
): Promise<InstalledPluginSummary | null> {
	const known = communityManager(app)?.manifests?.[id];
	if (known) {
		return {
			id,
			name: known.name?.trim() || id,
			version: known.version?.trim() || null,
		};
	}

	const path = normalizePath(
		`${app.vault.configDir}/plugins/${id}/manifest.json`,
	);
	try {
		const raw = await app.vault.adapter.read(path);
		const value: unknown = JSON.parse(raw);
		if (typeof value !== "object" || value === null || Array.isArray(value))
			return null;
		const manifest = value as PluginManifest;
		return {
			id,
			name: manifest.name?.trim() || id,
			version: manifest.version?.trim() || null,
		};
	} catch {
		return null;
	}
}

function pluginEnabled(app: App, id: string): boolean {
	const manager = communityManager(app);
	return Boolean(manager?.enabledPlugins?.has(id) || manager?.plugins?.[id]);
}

function customDescriptor(watch: WatchedPlugin): IntegrationDescriptor {
	return {
		id: watch.id,
		name: watch.name,
		purpose: watch.purpose,
		requireEnabled: watch.requireEnabled,
		recommendations: watch.checks.map((check) => ({
			path: check.path,
			label: check.label,
			comparison: check.comparison,
			expected: check.expected,
		})),
	};
}

function mergedDescriptors(
	customWatches: readonly WatchedPlugin[],
): IntegrationDescriptor[] {
	const result = INTEGRATIONS.map((descriptor) => ({
		...descriptor,
		recommendations: [...descriptor.recommendations],
	}));
	for (const watch of customWatches) {
		const existing = result.find(
			(descriptor) => descriptor.id === watch.id,
		);
		if (!existing) {
			result.push(customDescriptor(watch));
			continue;
		}
		existing.requireEnabled ||= watch.requireEnabled;
		const knownPaths = new Set(
			existing.recommendations.map(
				(recommendation) => recommendation.path,
			),
		);
		for (const recommendation of customDescriptor(watch).recommendations) {
			if (!knownPaths.has(recommendation.path))
				existing.recommendations.push(recommendation);
		}
	}
	return result;
}

export async function auditIntegrations(
	app: App,
	customWatches: readonly WatchedPlugin[] = [],
): Promise<IntegrationAudit[]> {
	return Promise.all(
		mergedDescriptors(customWatches).map(async (descriptor) => {
			const manifest = await pluginManifest(app, descriptor.id);
			const installed = manifest !== null;
			const enabled = installed && pluginEnabled(app, descriptor.id);
			const settings = installed
				? await pluginSettings(app, descriptor.id)
				: {};
			const checks = auditRecommendations(
				settings,
				descriptor.recommendations,
			);
			const issues = checks
				.filter((check) => !check.ok)
				.map((check) => check.label);
			return {
				id: descriptor.id,
				name: descriptor.name,
				purpose: descriptor.purpose,
				installed,
				enabled,
				configured:
					installed &&
					(!descriptor.requireEnabled || enabled) &&
					issues.length === 0,
				version: manifest?.version ?? null,
				checks,
				issues,
			};
		}),
	);
}

function flattenSettings(
	value: unknown,
	prefix = "",
): Array<{ path: string; value: unknown }> {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return prefix ? [{ path: prefix, value }] : [];
	const result: Array<{ path: string; value: unknown }> = [];
	for (const [key, child] of Object.entries(value)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (
			typeof child === "object" &&
			child !== null &&
			!Array.isArray(child)
		) {
			result.push(...flattenSettings(child, path));
		} else {
			result.push({ path, value: structuredClone(child) });
		}
	}
	return result;
}

export async function availableSettingPaths(
	app: App,
	id: string,
): Promise<Array<{ path: string; value: unknown }>> {
	return flattenSettings(await pluginSettings(app, id)).sort((left, right) =>
		left.path.localeCompare(right.path),
	);
}

export async function installedPlugins(
	app: App,
): Promise<InstalledPluginSummary[]> {
	const ids = new Set(Object.keys(communityManager(app)?.manifests ?? {}));
	try {
		const directory = normalizePath(`${app.vault.configDir}/plugins`);
		const listed = await app.vault.adapter.list(directory);
		for (const folder of listed.folders) {
			const id = folder.split("/").filter(Boolean).at(-1);
			if (id) ids.add(id);
		}
	} catch {
		// The plugin directory can be absent in a new vault.
	}
	const manifests = await Promise.all(
		[...ids].map((id) => pluginManifest(app, id)),
	);
	return manifests
		.filter(
			(manifest): manifest is InstalledPluginSummary => manifest !== null,
		)
		.sort((left, right) => left.name.localeCompare(right.name));
}

function readablePath(path: string): string {
	return path
		.split(".")
		.at(-1)!
		.replaceAll(/([a-z])([A-Z])/g, "$1 $2")
		.replaceAll(/[-_]+/g, " ");
}

export async function communityInstallManagerWatches(
	app: App,
): Promise<WatchedPlugin[]> {
	const path = normalizePath(
		`${app.vault.configDir}/community-plugins-settings.json`,
	);
	let value: unknown;
	try {
		value = JSON.parse(await app.vault.adapter.read(path));
	} catch {
		return [];
	}
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return [];

	return Promise.all(
		Object.entries(value).map(async ([id, settings]) => {
			const manifest = await pluginManifest(app, id);
			return {
				id,
				name: manifest?.name ?? id,
				purpose:
					"Matches the selected Community Install Manager profile.",
				requireEnabled: true,
				checks: flattenSettings(settings).map(
					({ path, value: expected }) => ({
						path,
						label: readablePath(path),
						comparison: "equals" as const,
						expected,
					}),
				),
			};
		}),
	);
}

export function isCoreUniqueNoteCreatorEnabled(app: App): boolean {
	return coreManager(app)?.getPluginById?.("zk-prefixer")?.enabled === true;
}

export function openCommunityPluginSettings(app: App): void {
	const manager = settingsManager(app);
	manager?.open?.();
	manager?.openTabById?.("community-plugins");
}

export function openPluginSettings(app: App, id: string): void {
	const manager = settingsManager(app);
	manager?.open?.();
	if (pluginEnabled(app, id)) manager?.openTabById?.(id);
	else manager?.openTabById?.("community-plugins");
}

export function integrationDescriptor(id: string): IntegrationDescriptor {
	const descriptor = INTEGRATIONS.find((candidate) => candidate.id === id);
	if (!descriptor) throw new Error(`Unknown integration: ${id}`);
	return descriptor;
}
