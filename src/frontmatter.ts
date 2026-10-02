import type { App, TFile } from "obsidian";

export type FrontmatterRecord = Record<string, unknown>;

export function frontmatterRecord(value: unknown): FrontmatterRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as FrontmatterRecord)
		: {};
}

export function cachedFrontmatter(app: App, file: TFile): FrontmatterRecord {
	const value: unknown = app.metadataCache.getFileCache(file)?.frontmatter;
	return frontmatterRecord(value);
}
