import { App, normalizePath } from "obsidian";
import { recommendationIssues } from "./integration-audit";
import type { IntegrationAudit, RequiredPluginId } from "./types";

interface Recommendation {
	path: string;
	label: string;
	value: unknown;
}

interface IntegrationDescriptor {
	id: RequiredPluginId;
	name: string;
	purpose: string;
	recommendations: Recommendation[];
}

interface LoadedCompanion {
	settings?: Record<string, unknown>;
}

interface CommunityPluginManager {
	plugins?: Record<string, LoadedCompanion>;
	enabledPlugins?: Set<string>;
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

async function pluginSettings(
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

async function pluginInstalled(app: App, id: string): Promise<boolean> {
	return app.vault.adapter.exists(
		normalizePath(`${app.vault.configDir}/plugins/${id}/manifest.json`),
	);
}

function pluginEnabled(app: App, id: string): boolean {
	const manager = communityManager(app);
	return Boolean(manager?.enabledPlugins?.has(id) || manager?.plugins?.[id]);
}

export async function auditIntegrations(app: App): Promise<IntegrationAudit[]> {
	return Promise.all(
		INTEGRATIONS.map(async (descriptor) => {
			const installed = await pluginInstalled(app, descriptor.id);
			const enabled = installed && pluginEnabled(app, descriptor.id);
			const settings = installed
				? await pluginSettings(app, descriptor.id)
				: {};
			const issues = recommendationIssues(
				settings,
				descriptor.recommendations,
			);
			return {
				id: descriptor.id,
				name: descriptor.name,
				purpose: descriptor.purpose,
				installed,
				enabled,
				configured: installed && issues.length === 0,
				issues,
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

export function integrationDescriptor(
	id: RequiredPluginId,
): IntegrationDescriptor {
	const descriptor = INTEGRATIONS.find((candidate) => candidate.id === id);
	if (!descriptor) throw new Error(`Unknown integration: ${id}`);
	return descriptor;
}
