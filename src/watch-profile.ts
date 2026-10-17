import defaultProfileJson from "../default-watch-profile.json";
import {
	normalizeWatchProfile,
	type WatchedSetting,
	type WatchedTarget,
	type WatchProfileFile,
} from "./types";

export const WATCH_PROFILE_FILENAME = "root-books-watch-profile.json";

const DEFAULT_PROFILE = normalizeWatchProfile(defaultProfileJson);

export function builtInWatchProfile(): WatchProfileFile {
	return structuredClone(DEFAULT_PROFILE);
}

export function watchTargetKey(
	target: Pick<WatchedTarget, "kind" | "id">,
): string {
	return `${target.kind}:${target.id}`;
}

export function replaceWatchTarget(
	current: readonly WatchedTarget[],
	target: WatchedTarget,
	originalKey = watchTargetKey(target),
): WatchedTarget[] {
	const next = current
		.filter((candidate) => watchTargetKey(candidate) !== originalKey)
		.map((candidate) => structuredClone(candidate));
	const existingIndex = next.findIndex(
		(candidate) => watchTargetKey(candidate) === watchTargetKey(target),
	);
	if (existingIndex >= 0) next.splice(existingIndex, 1);
	next.push(structuredClone(target));
	return next;
}

export function mergeWatchTarget(
	current: WatchedTarget[],
	incoming: WatchedTarget,
): number {
	let target = current.find(
		(candidate) => watchTargetKey(candidate) === watchTargetKey(incoming),
	);
	if (!target) {
		target = { ...structuredClone(incoming), checks: [] };
		current.push(target);
	}
	target.name = incoming.name;
	target.purpose = incoming.purpose;
	target.requireEnabled ||= incoming.requireEnabled;
	let changed = 0;
	for (const check of incoming.checks) {
		const index = target.checks.findIndex(
			(candidate) => candidate.path === check.path,
		);
		if (index >= 0) target.checks[index] = structuredClone(check);
		else target.checks.push(structuredClone(check));
		changed += 1;
	}
	return changed;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as JsonRecord)
		: null;
}

function safePathParts(path: string): string[] {
	const blocked = new Set(["__proto__", "constructor", "prototype"]);
	return path
		.split(".")
		.map((part) => part.trim())
		.filter((part) => part && !blocked.has(part));
}

function setPath(target: JsonRecord, path: string, value: unknown): boolean {
	const parts = safePathParts(path);
	if (parts.length === 0 || parts.join(".") !== path) return false;
	let current = target;
	for (const part of parts.slice(0, -1)) {
		const child = record(current[part]);
		if (child) current = child;
		else {
			const created: JsonRecord = {};
			current[part] = created;
			current = created;
		}
	}
	const finalPart = parts.at(-1);
	if (!finalPart) return false;
	current[finalPart] = structuredClone(value);
	return true;
}

export interface CommunityManagerExport {
	pluginList: unknown[];
	settings: JsonRecord;
	addedPlugins: number;
	exportedSettings: number;
	skippedChecks: number;
}

function listedPluginId(value: unknown): string | null {
	if (typeof value === "string") return value;
	const item = record(value);
	return typeof item?.id === "string" ? item.id : null;
}

export function buildCommunityManagerExport(
	targets: readonly WatchedTarget[],
	existingPluginList: unknown,
	existingSettings: unknown,
): CommunityManagerExport {
	const pluginList = Array.isArray(existingPluginList)
		? structuredClone(existingPluginList)
		: [];
	const settings = structuredClone(record(existingSettings) ?? {});
	const listedIds = new Set(
		pluginList
			.map(listedPluginId)
			.filter((id): id is string => id !== null),
	);
	let addedPlugins = 0;
	let exportedSettings = 0;
	let skippedChecks = 0;
	for (const target of targets) {
		if (target.kind !== "community-plugin") continue;
		if (!listedIds.has(target.id)) {
			pluginList.push(target.id);
			listedIds.add(target.id);
			addedPlugins += 1;
		}
		const current = record(settings[target.id]) ?? {};
		settings[target.id] = current;
		for (const check of target.checks) {
			if (check.comparison !== "equals") {
				skippedChecks += 1;
				continue;
			}
			if (setPath(current, check.path, check.expected))
				exportedSettings += 1;
			else skippedChecks += 1;
		}
	}
	return {
		pluginList,
		settings,
		addedPlugins,
		exportedSettings,
		skippedChecks,
	};
}

export function settingExpectedText(setting: WatchedSetting): string {
	if (setting.comparison === "exists" || setting.comparison === "non-empty")
		return "";
	return JSON.stringify(setting.expected) ?? "";
}
