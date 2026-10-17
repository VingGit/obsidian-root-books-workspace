import { App, normalizePath } from "obsidian";
import { auditRecommendations } from "./integration-audit";
import {
	normalizeWatchProfile,
	normalizeWatchedTargets,
	OBSIDIAN_OPTION_PAGES,
	type IntegrationAudit,
	type WatchedTarget,
	type WatchProfileFile,
	type WatchTargetKind,
} from "./types";
import {
	buildCommunityManagerExport,
	builtInWatchProfile,
	WATCH_PROFILE_FILENAME,
} from "./watch-profile";

export interface InstalledTargetSummary {
	id: string;
	name: string;
	version: string | null;
}

interface LoadedCompanion {
	settings?: Record<string, unknown>;
}

interface PluginManifest {
	id?: string;
	name?: string;
	version?: string;
}

interface CommunityPluginManager {
	plugins?: Record<string, LoadedCompanion>;
	enabledPlugins?: Set<string>;
	manifests?: Record<string, PluginManifest>;
}

interface CorePluginInstance {
	manifest?: PluginManifest;
	options?: unknown;
	settings?: unknown;
}

interface CorePluginEntry {
	id?: string;
	name?: string;
	enabled?: boolean;
	instance?: CorePluginInstance;
	options?: unknown;
	settings?: unknown;
}

interface CorePluginManager {
	plugins?: Record<string, CorePluginEntry>;
	getPluginById?: (id: string) => CorePluginEntry | undefined;
}

interface SettingsManager {
	open?: () => void;
	openTabById?: (id: string) => void;
	win?: Window;
	containerEl?: HTMLElement;
	modalEl?: HTMLElement;
	activeTab?: {
		id?: string;
		containerEl?: HTMLElement;
	};
}

interface ProfileLoadResult {
	profile: WatchProfileFile;
	hasOverride: boolean;
	error?: string;
}

export interface CommunityProfileExportResult {
	addedPlugins: number;
	exportedSettings: number;
	skippedChecks: number;
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

function record(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function cloneRecord(value: unknown): Record<string, unknown> | null {
	const source = record(value);
	if (!source) return null;
	try {
		return structuredClone(source);
	} catch {
		try {
			return JSON.parse(JSON.stringify(source)) as Record<
				string,
				unknown
			>;
		} catch {
			return null;
		}
	}
}

async function readJson(app: App, path: string): Promise<unknown> {
	try {
		return JSON.parse(await app.vault.adapter.read(path)) as unknown;
	} catch {
		return undefined;
	}
}

async function writeJson(
	app: App,
	path: string,
	value: unknown,
): Promise<void> {
	await app.vault.adapter.write(
		path,
		`${JSON.stringify(value, null, "\t")}\n`,
	);
}

function profilePath(app: App): string {
	return normalizePath(`${app.vault.configDir}/${WATCH_PROFILE_FILENAME}`);
}

export async function loadWatchProfile(app: App): Promise<ProfileLoadResult> {
	const path = profilePath(app);
	if (await app.vault.adapter.exists(path)) {
		try {
			const parsed: unknown = JSON.parse(
				await app.vault.adapter.read(path),
			);
			const profile = normalizeWatchProfile(parsed);
			return {
				profile,
				hasOverride: true,
			};
		} catch (error) {
			return {
				profile: builtInWatchProfile(),
				hasOverride: false,
				error: `Could not read ${WATCH_PROFILE_FILENAME}: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	return {
		profile: builtInWatchProfile(),
		hasOverride: false,
	};
}

export async function saveWatchProfile(
	app: App,
	targets: readonly WatchedTarget[],
): Promise<void> {
	const profile: WatchProfileFile = {
		schemaVersion: 3,
		targets: normalizeWatchedTargets(targets),
	};
	await writeJson(app, profilePath(app), profile);
}

export async function resetWatchProfile(app: App): Promise<WatchProfileFile> {
	const path = profilePath(app);
	if (await app.vault.adapter.exists(path))
		await app.vault.adapter.remove(path);
	return builtInWatchProfile();
}

export function watchProfileDisplayPath(app: App): string {
	return normalizePath(`${app.vault.configDir}/${WATCH_PROFILE_FILENAME}`);
}

export async function pluginSettings(
	app: App,
	id: string,
): Promise<Record<string, unknown>> {
	const loaded = cloneRecord(communityManager(app)?.plugins?.[id]?.settings);
	if (loaded) return loaded;
	const path = normalizePath(
		`${app.vault.configDir}/plugins/${id}/data.json`,
	);
	return cloneRecord(await readJson(app, path)) ?? {};
}

async function pluginManifest(
	app: App,
	id: string,
): Promise<InstalledTargetSummary | null> {
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
	const manifest = record(await readJson(app, path));
	if (!manifest) return null;
	return {
		id,
		name:
			typeof manifest.name === "string" && manifest.name.trim()
				? manifest.name.trim()
				: id,
		version:
			typeof manifest.version === "string" && manifest.version.trim()
				? manifest.version.trim()
				: null,
	};
}

function pluginEnabled(app: App, id: string): boolean {
	const manager = communityManager(app);
	return Boolean(manager?.enabledPlugins?.has(id) || manager?.plugins?.[id]);
}

function corePluginEntry(app: App, id: string): CorePluginEntry | undefined {
	const manager = coreManager(app);
	return manager?.plugins?.[id] ?? manager?.getPluginById?.(id);
}

function corePluginEnabled(app: App, id: string): boolean {
	const entry = corePluginEntry(app, id);
	return entry?.enabled ?? Boolean(entry?.instance);
}

async function corePluginSettings(
	app: App,
	id: string,
): Promise<Record<string, unknown>> {
	const entry = corePluginEntry(app, id);
	const runtime =
		cloneRecord(entry?.instance?.options) ??
		cloneRecord(entry?.instance?.settings) ??
		cloneRecord(entry?.options) ??
		cloneRecord(entry?.settings);
	if (runtime) return runtime;
	return (
		cloneRecord(
			await readJson(
				app,
				normalizePath(`${app.vault.configDir}/${id}.json`),
			),
		) ?? {}
	);
}

async function obsidianSettings(app: App): Promise<Record<string, unknown>> {
	const readConfig = async (name: string): Promise<Record<string, unknown>> =>
		cloneRecord(
			await readJson(
				app,
				normalizePath(`${app.vault.configDir}/${name}.json`),
			),
		) ?? {};
	const appSettings = await readConfig("app");
	return {
		...appSettings,
		app: appSettings,
		appearance: await readConfig("appearance"),
		hotkeys: await readConfig("hotkeys"),
		types: await readConfig("types"),
	};
}

async function targetSettings(
	app: App,
	kind: WatchTargetKind,
	id: string,
): Promise<Record<string, unknown>> {
	switch (kind) {
		case "community-plugin":
			return pluginSettings(app, id);
		case "core-plugin":
			return corePluginSettings(app, id);
		case "obsidian":
			return obsidianSettings(app);
	}
}

export async function auditWatchTargets(
	app: App,
	targets: readonly WatchedTarget[],
): Promise<IntegrationAudit[]> {
	return Promise.all(
		targets.map(async (target) => {
			const manifest =
				target.kind === "community-plugin"
					? await pluginManifest(app, target.id)
					: null;
			const coreEntry =
				target.kind === "core-plugin"
					? corePluginEntry(app, target.id)
					: undefined;
			const installed =
				target.kind === "community-plugin"
					? manifest !== null
					: target.kind === "core-plugin"
						? coreEntry !== undefined
						: true;
			const enabled =
				target.kind === "community-plugin"
					? installed && pluginEnabled(app, target.id)
					: target.kind === "core-plugin"
						? installed && corePluginEnabled(app, target.id)
						: true;
			const settings = installed
				? await targetSettings(app, target.kind, target.id)
				: {};
			const checks = auditRecommendations(settings, target.checks);
			const issues = checks
				.filter((check) => !check.ok)
				.map((check) => check.label);
			return {
				kind: target.kind,
				id: target.id,
				name: target.name,
				purpose: target.purpose,
				requireEnabled: target.requireEnabled,
				installed,
				enabled,
				configured:
					installed &&
					(!target.requireEnabled || enabled) &&
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

export async function availableTargetSettingPaths(
	app: App,
	kind: WatchTargetKind,
	id: string,
): Promise<Array<{ path: string; value: unknown }>> {
	const settings = await targetSettings(app, kind, id);
	const paths =
		kind === "obsidian"
			? ["app", "appearance", "hotkeys", "types"].flatMap((source) =>
					flattenSettings(settings[source], source),
				)
			: flattenSettings(settings);
	return paths.sort((left, right) => left.path.localeCompare(right.path));
}

export async function installedCommunityPlugins(
	app: App,
): Promise<InstalledTargetSummary[]> {
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
			(manifest): manifest is InstalledTargetSummary => manifest !== null,
		)
		.sort((left, right) => left.name.localeCompare(right.name));
}

function readablePath(path: string): string {
	const lastPart = path.split(".").at(-1) ?? path;
	return lastPart
		.replaceAll(/([a-z])([A-Z])/g, "$1 $2")
		.replaceAll(/[-_]+/g, " ")
		.replace(/^./, (character) => character.toUpperCase());
}

export function installedCorePlugins(app: App): InstalledTargetSummary[] {
	return Object.entries(coreManager(app)?.plugins ?? {})
		.map(([id, entry]) => ({
			id,
			name:
				entry.name?.trim() ||
				entry.instance?.manifest?.name?.trim() ||
				readablePath(id),
			version: null,
		}))
		.sort((left, right) => left.name.localeCompare(right.name));
}

function communityListIds(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const ids: string[] = [];
	for (const item of value) {
		if (typeof item === "string") ids.push(item);
		else {
			const candidate = record(item);
			if (typeof candidate?.id === "string") ids.push(candidate.id);
		}
	}
	return ids;
}

export async function communityInstallManagerWatches(
	app: App,
): Promise<WatchedTarget[]> {
	const settingsValue = await readJson(
		app,
		normalizePath(`${app.vault.configDir}/community-plugins-settings.json`),
	);
	const listValue = await readJson(
		app,
		normalizePath(`${app.vault.configDir}/community-plugins-list.json`),
	);
	const settings = record(settingsValue) ?? {};
	const ids = new Set([
		...communityListIds(listValue),
		...Object.keys(settings),
	]);
	return Promise.all(
		[...ids].map(async (id) => {
			const manifest = await pluginManifest(app, id);
			return {
				kind: "community-plugin" as const,
				id,
				name: manifest?.name ?? id,
				purpose:
					"Matches the selected Community Install Manager profile.",
				requireEnabled: true,
				checks: flattenSettings(settings[id]).map(
					({ path, value: expected }) => ({
						path,
						label: readablePath(path),
						comparison: "equals" as const,
						expected,
						locatable: true,
					}),
				),
			};
		}),
	);
}

export async function exportCommunityInstallManagerProfile(
	app: App,
	targets: readonly WatchedTarget[],
): Promise<CommunityProfileExportResult> {
	const listPath = normalizePath(
		`${app.vault.configDir}/community-plugins-list.json`,
	);
	const settingsPath = normalizePath(
		`${app.vault.configDir}/community-plugins-settings.json`,
	);
	const exported = buildCommunityManagerExport(
		targets,
		await readJson(app, listPath),
		await readJson(app, settingsPath),
	);
	await writeJson(app, listPath, exported.pluginList);
	await writeJson(app, settingsPath, exported.settings);
	return {
		addedPlugins: exported.addedPlugins,
		exportedSettings: exported.exportedSettings,
		skippedChecks: exported.skippedChecks,
	};
}

export function isCoreUniqueNoteCreatorEnabled(app: App): boolean {
	return corePluginEnabled(app, "zk-prefixer");
}

function optionPage(id?: string): { id: string; name: string } {
	return (
		OBSIDIAN_OPTION_PAGES.find((page) => page.id === id) ??
		OBSIDIAN_OPTION_PAGES.find((page) => page.id === "editor") ?? {
			id: "editor",
			name: "Editor",
		}
	);
}

function settingsDocuments(app: App): Document[] {
	const manager = settingsManager(app);
	return [
		manager?.win?.document,
		manager?.modalEl?.ownerDocument,
		manager?.containerEl?.ownerDocument,
		manager?.activeTab?.containerEl?.ownerDocument,
		document,
	].filter(
		(candidate, index, documents): candidate is Document =>
			candidate !== undefined && documents.indexOf(candidate) === index,
	);
}

function settingsModal(app: App): HTMLElement | null {
	const manager = settingsManager(app);
	if (manager?.modalEl?.isConnected) return manager.modalEl;
	for (const settingsDocument of settingsDocuments(app)) {
		const modal = settingsDocument.querySelector<HTMLElement>(
			".modal-container.mod-settings .modal, .modal.mod-settings, .modal-container.mod-settings",
		);
		if (modal) return modal;
	}
	return null;
}

function settingsContent(app: App): HTMLElement | null {
	const activeContainer = settingsManager(app)?.activeTab?.containerEl;
	if (activeContainer?.isConnected) return activeContainer;
	const modal = settingsModal(app);
	if (!modal) return null;
	return (
		Array.from(
			modal.querySelectorAll<HTMLElement>(
				".vertical-tab-content, .setting-tab",
			),
		).find((candidate) => candidate.offsetParent !== null) ?? modal
	);
}

function clickSettingsNavigation(app: App, label: string): boolean {
	const modal = settingsModal(app);
	if (!modal) return false;
	const wanted = normalizedText(label);
	const tabs = Array.from(
		modal.querySelectorAll<HTMLElement>(
			".vertical-tab-nav-item, [role='tab']",
		),
	);
	const tab = tabs.find(
		(candidate) =>
			normalizedText(
				candidate.innerText || candidate.textContent || "",
			) === wanted,
	);
	if (!tab) return false;
	tab.click();
	return true;
}

const TOOLKIT_SETTINGS_ID = "root-books-workspace";
const RETURN_SLIP_CLASS = "root-books-settings-return-slip";

export function watchReturnAnchor(
	target: Pick<WatchedTarget, "kind" | "id">,
	path?: string,
): string {
	return `${target.kind}:${target.id}${path ? `:${path}` : ""}`;
}

function removeReturnSlips(app: App): void {
	for (const settingsDocument of settingsDocuments(app))
		for (const slip of Array.from(
			settingsDocument.querySelectorAll(`.${RETURN_SLIP_CLASS}`),
		))
			slip.remove();
}

function isSettingsRootModal(candidate: HTMLElement): boolean {
	return (
		candidate.classList.contains("mod-settings") ||
		candidate
			.closest<HTMLElement>(".modal-container")
			?.classList.contains("mod-settings") === true
	);
}

function closeNestedSettingsModals(app: App): void {
	for (const settingsDocument of settingsDocuments(app)) {
		const modals = Array.from(
			settingsDocument.querySelectorAll<HTMLElement>(".modal"),
		).filter(
			(candidate) =>
				!isSettingsRootModal(candidate) &&
				candidate.offsetParent !== null,
		);
		for (const modal of modals)
			modal
				.querySelector<HTMLElement>(
					".modal-close-button, .modal-header-button",
				)
				?.click();
	}
}

async function restoreToolkitReturnPoint(
	app: App,
	anchor: string,
): Promise<void> {
	const manager = settingsManager(app);
	closeNestedSettingsModals(app);
	manager?.openTabById?.(TOOLKIT_SETTINGS_ID);
	const deadline = Date.now() + 5000;
	do {
		const content = settingsContent(app);
		const target = Array.from(
			content?.querySelectorAll<HTMLElement>(
				"[data-root-books-return-anchor]",
			) ?? [],
		).find(
			(candidate) => candidate.dataset.rootBooksReturnAnchor === anchor,
		);
		if (target) {
			const details = target.closest<HTMLDetailsElement>("details");
			if (details) details.open = true;
			focusSettingRow(target);
			return;
		}
		await wait(50);
	} while (Date.now() < deadline);
}

async function installSettingsReturnSlip(
	app: App,
	destinationId: string,
	anchor: string,
): Promise<void> {
	if (!(await waitForSettingsModal(app, 3000))) return;
	const destinationDeadline = Date.now() + 3000;
	while (
		settingsManager(app)?.activeTab?.id !== destinationId &&
		Date.now() < destinationDeadline
	)
		await wait(50);
	if (settingsManager(app)?.activeTab?.id !== destinationId) return;
	removeReturnSlips(app);
	const manager = settingsManager(app);
	const settingsDocument =
		manager?.win?.document ?? settingsModal(app)?.ownerDocument;
	if (!settingsDocument) return;
	const slip = settingsDocument.body.createEl("button");
	slip.type = "button";
	slip.className = RETURN_SLIP_CLASS;
	slip.textContent = "← Return to Root Books Toolkit";
	slip.setAttribute(
		"aria-label",
		"Return to the same watched item in Root Books Toolkit",
	);
	const view = settingsDocument.defaultView;
	let intervalId: number | undefined;
	const cleanup = (): void => {
		if (intervalId !== undefined) view?.clearInterval(intervalId);
		slip.remove();
	};
	slip.addEventListener("click", () => {
		cleanup();
		void restoreToolkitReturnPoint(app, anchor);
	});
	intervalId = view?.setInterval(() => {
		if (
			!slip.isConnected ||
			settingsManager(app)?.activeTab?.id !== destinationId
		)
			cleanup();
	}, 100);
}

export function openCommunityPluginSettings(app: App): void {
	const manager = settingsManager(app);
	manager?.open?.();
	manager?.openTabById?.("community-plugins");
}

export function openTargetSettings(
	app: App,
	target: WatchedTarget,
	settingsTab?: string,
	returnAnchor = watchReturnAnchor(target),
): void {
	const manager = settingsManager(app);
	manager?.open?.();
	if (target.kind === "community-plugin" && !pluginEnabled(app, target.id)) {
		manager?.openTabById?.("community-plugins");
		window.setTimeout(
			() => clickSettingsNavigation(app, "Community plugins"),
			80,
		);
		void installSettingsReturnSlip(app, "community-plugins", returnAnchor);
		return;
	}
	if (target.kind === "core-plugin" && !corePluginEnabled(app, target.id)) {
		manager?.openTabById?.("core-plugins");
		window.setTimeout(
			() => clickSettingsNavigation(app, "Core plugins"),
			80,
		);
		void installSettingsReturnSlip(app, "core-plugins", returnAnchor);
		return;
	}
	const tab = target.kind === "obsidian" ? optionPage(settingsTab) : null;
	const destinationId = tab?.id ?? target.id;
	manager?.openTabById?.(destinationId);
	if (tab) {
		window.setTimeout(() => clickSettingsNavigation(app, tab.name), 80);
		window.setTimeout(() => clickSettingsNavigation(app, tab.name), 300);
	}
	void installSettingsReturnSlip(app, destinationId, returnAnchor);
}

function normalizedText(value: string): string {
	return value
		.toLocaleLowerCase()
		.replaceAll(/[^a-z0-9]+/g, " ")
		.trim();
}

function matchScore(text: string, candidates: readonly string[]): number {
	const normalized = normalizedText(text);
	let best = 0;
	for (const candidate of candidates) {
		const wanted = normalizedText(candidate);
		if (!wanted) continue;
		if (normalized === wanted) best = Math.max(best, 100);
		else if (normalized.includes(wanted) || wanted.includes(normalized))
			best = Math.max(best, 70);
		else {
			const words = wanted.split(" ").filter((word) => word.length > 2);
			const matches = words.filter((word) =>
				normalized.includes(word),
			).length;
			best = Math.max(
				best,
				words.length ? (matches / words.length) * 50 : 0,
			);
		}
	}
	return best;
}

function settingName(row: HTMLElement): string {
	const name = row.querySelector<HTMLElement>(".setting-item-name");
	return name?.innerText || name?.textContent || "";
}

function exactSettingRow(
	container: ParentNode | null,
	label: string,
): HTMLElement | null {
	if (!container || !label.trim()) return null;
	const wanted = normalizedText(label);
	return (
		Array.from(
			container.querySelectorAll<HTMLElement>(".setting-item"),
		).find(
			(candidate) => normalizedText(settingName(candidate)) === wanted,
		) ?? null
	);
}

function focusSettingRow(row: HTMLElement): boolean {
	row.classList.add("root-books-setting-focus");
	row.scrollIntoView({ behavior: "smooth", block: "center" });
	const control = row.querySelector<HTMLElement>(
		"input, select, textarea, button, [tabindex]:not([tabindex='-1'])",
	);
	if (control) control.focus({ preventScroll: true });
	else {
		row.tabIndex = -1;
		row.focus({ preventScroll: true });
	}
	const clearFocus = (): void => {
		row.classList.remove("root-books-setting-focus");
		if (!control) row.removeAttribute("tabindex");
	};
	const view = row.ownerDocument.defaultView;
	if (view) view.setTimeout(clearFocus, 2500);
	else window.setTimeout(clearFocus, 2500);
	return true;
}

function focusExactSetting(app: App, label: string): boolean {
	const content = settingsContent(app);
	const row = exactSettingRow(content, label);
	return row ? focusSettingRow(row) : false;
}

function focusExactSettingByTabOrder(app: App, label: string): boolean {
	const content = settingsContent(app);
	if (!content || !label.trim()) return false;
	const wanted = normalizedText(label);
	const controls = Array.from(
		content.querySelectorAll<HTMLElement>(
			"input, select, textarea, button, a[href], [tabindex]:not([tabindex='-1'])",
		),
	).filter(
		(control) =>
			control.offsetParent !== null &&
			!control.matches(":disabled, [aria-disabled='true']"),
	);
	for (const control of controls) {
		control.focus({ preventScroll: true });
		const row = control.closest<HTMLElement>(".setting-item");
		if (row && normalizedText(settingName(row)) === wanted)
			return focusSettingRow(row);
	}
	return false;
}

function focusMatchingSetting(
	app: App,
	candidates: readonly string[],
): boolean {
	const content = settingsContent(app);
	if (!content) return false;
	const rows = Array.from(
		content.querySelectorAll<HTMLElement>(".setting-item"),
	);
	let best: { row: HTMLElement; score: number } | null = null;
	for (const row of rows) {
		const score = matchScore(settingName(row), candidates);
		if (score >= 45 && (!best || score > best.score)) best = { row, score };
	}
	if (!best) return false;
	return focusSettingRow(best.row);
}

function searchSettings(app: App, label: string): boolean {
	const input = settingsModal(app)?.querySelector<HTMLInputElement>(
		"input.setting-search-input, .setting-search-input input, input[type='search']",
	);
	if (!input) return false;
	input.value = label;
	const EventConstructor = input.ownerDocument.defaultView?.Event ?? Event;
	input.dispatchEvent(new EventConstructor("input", { bubbles: true }));
	input.dispatchEvent(new EventConstructor("change", { bubbles: true }));
	return true;
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function internalSettingsTabs(app: App): HTMLElement[] {
	const content = settingsContent(app);
	if (!content) return [];
	const candidates = Array.from(
		content.querySelectorAll<HTMLElement>(
			"[role='tab'], .fn-settings-tab, button[class*='tab'], [class*='settings-tab'], [class*='setting-tab'], [class*='nav-tab']",
		),
	);
	return candidates.filter(
		(candidate, index) =>
			candidates.indexOf(candidate) === index &&
			!candidates.some(
				(other) => other !== candidate && candidate.contains(other),
			) &&
			candidate.offsetParent !== null &&
			!candidate.matches(":disabled, [aria-disabled='true']") &&
			!candidate.closest(".setting-item") &&
			normalizedText(
				candidate.innerText || candidate.textContent || "",
			) !== "",
	);
}

async function focusExactSettingAcrossInternalTabs(
	app: App,
	label: string,
): Promise<boolean> {
	const tabs = internalSettingsTabs(app).slice(0, 24);
	for (const tab of tabs) {
		tab.click();
		await wait(100);
		if (focusExactSetting(app, label)) return true;
	}
	return false;
}

async function focusMatchingSettingAcrossInternalTabs(
	app: App,
	candidates: readonly string[],
): Promise<boolean> {
	const tabs = internalSettingsTabs(app).slice(0, 24);
	for (const tab of tabs) {
		tab.click();
		await wait(100);
		if (focusMatchingSetting(app, candidates)) return true;
	}
	return false;
}

function visibleNestedModals(app: App): HTMLElement[] {
	return settingsDocuments(app).flatMap((settingsDocument) =>
		Array.from(
			settingsDocument.querySelectorAll<HTMLElement>(".modal"),
		).filter(
			(candidate) =>
				!isSettingsRootModal(candidate) &&
				candidate.offsetParent !== null,
		),
	);
}

async function focusNestedSetting(
	app: App,
	parentLabel: string,
	childLabel: string,
): Promise<boolean> {
	let parent = exactSettingRow(settingsContent(app), parentLabel);
	if (!parent) {
		const tabs = internalSettingsTabs(app).slice(0, 24);
		for (const tab of tabs) {
			tab.click();
			await wait(100);
			parent = exactSettingRow(settingsContent(app), parentLabel);
			if (parent) break;
		}
	}
	if (!parent) return false;
	const manage = Array.from(
		parent.querySelectorAll<HTMLButtonElement>("button"),
	).find((button) => normalizedText(button.innerText) === "manage");
	if (!manage) return false;
	manage.click();
	for (const delay of [100, 200, 400, 800]) {
		await wait(delay);
		for (const modal of visibleNestedModals(app)) {
			const child = exactSettingRow(modal, childLabel);
			if (child) return focusSettingRow(child);
		}
	}
	closeNestedSettingsModals(app);
	return false;
}

async function waitForSettingsModal(
	app: App,
	timeoutMilliseconds: number,
): Promise<boolean> {
	const deadline = Date.now() + timeoutMilliseconds;
	do {
		if (settingsModal(app)) return true;
		await wait(50);
	} while (Date.now() < deadline);
	return false;
}

export async function openTargetSetting(
	app: App,
	target: WatchedTarget,
	label: string,
	path: string,
	settingsLabel?: string,
	settingsTab?: string,
	settingsChildLabel?: string,
	returnAnchor = watchReturnAnchor(target, path),
): Promise<boolean> {
	openTargetSettings(app, target, settingsTab, returnAnchor);
	if (!(await waitForSettingsModal(app, 3000))) return false;
	const candidates = [settingsLabel ?? "", label, readablePath(path)];
	await wait(100);
	if (
		settingsLabel &&
		settingsChildLabel &&
		(await focusNestedSetting(app, settingsLabel, settingsChildLabel))
	)
		return true;
	if (settingsLabel && focusExactSetting(app, settingsLabel)) return true;
	if (
		settingsLabel &&
		(await focusExactSettingAcrossInternalTabs(app, settingsLabel))
	)
		return true;
	if (settingsLabel && focusExactSettingByTabOrder(app, settingsLabel))
		return true;
	if (focusMatchingSetting(app, candidates)) return true;
	if (await focusMatchingSettingAcrossInternalTabs(app, candidates))
		return true;

	searchSettings(app, settingsLabel ?? label);
	for (const delay of [100, 200, 400, 800]) {
		await wait(delay);
		if (settingsLabel && focusExactSetting(app, settingsLabel)) return true;
		if (focusMatchingSetting(app, candidates)) return true;
	}
	return false;
}
