import { Notice, Plugin } from "obsidian";
import { CreatedFromFilenameSync } from "./created-from-filename";
import { BookDecorations } from "./decorations";
import { FolderNoteTitleSync } from "./folder-note-titles";
import {
	auditWatchTargets,
	exportCommunityInstallManagerProfile,
	loadWatchProfile,
	resetWatchProfile,
	saveWatchProfile,
} from "./integrations";
import { watchAuditIssueKeys } from "./integration-audit";
import { NewNotePipeline } from "./new-note-pipeline";
import { RootBooksWorkspaceSettingTab } from "./settings";
import { SortingCoordinator } from "./sorting";
import { DEFAULT_SETTINGS } from "./types";
import type {
	RootBooksWorkspaceSettings,
	RuntimeCoordinatorState,
	WatchedTarget,
} from "./types";
import { registerUniqueNoteAction } from "./unique-note";

const WATCH_AUDIT_INTERVAL_MS = 3000;

export default class RootBooksWorkspacePlugin extends Plugin {
	settings: RootBooksWorkspaceSettings = { ...DEFAULT_SETTINGS };
	watchTargets: WatchedTarget[] = [];
	watchProfileHasOverride = false;
	private initialized = false;
	private sorting: SortingCoordinator | null = null;
	private pipeline: NewNotePipeline | null = null;
	private folderTitles: FolderNoteTitleSync | null = null;
	private decorations: BookDecorations | null = null;
	private filenameDateSyncActive = false;
	private watchProfileLoadError: string | null = null;
	private previousWatchIssueKeys = new Set<string>();
	private watchAuditRunning = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new RootBooksWorkspaceSettingTab(this.app, this));
		this.app.workspace.onLayoutReady(() => void this.initialize());
	}

	private async initialize(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;

		this.sorting = new SortingCoordinator(this);
		this.pipeline = new NewNotePipeline(this, this.sorting);
		this.folderTitles = new FolderNoteTitleSync(this);
		this.decorations = new BookDecorations(this, this.settings);
		registerUniqueNoteAction(this, this.settings, this.pipeline);

		await this.pipeline.start();
		await new CreatedFromFilenameSync(
			this,
			this.settings,
			() => this.saveSettings(),
			this.sorting,
		).start();
		this.filenameDateSyncActive = true;
		this.folderTitles.start();
		this.decorations.start();

		if (this.watchProfileLoadError)
			new Notice(this.watchProfileLoadError, 10000);
		if (this.settings.exportWatchProfileOnStartup) {
			try {
				await exportCommunityInstallManagerProfile(
					this.app,
					this.watchTargets,
				);
			} catch (error) {
				new Notice(
					`Could not export the Community Install Manager profile: ${error instanceof Error ? error.message : String(error)}`,
					10000,
				);
			}
		}
		await this.startWatchAuditMonitoring();
	}

	refreshDecorations(): void {
		this.decorations?.refresh();
	}

	openAppearancePicker(): void {
		this.decorations?.openAppearancePicker();
	}

	runtimeCoordinatorState(): RuntimeCoordinatorState {
		return {
			initialized: this.initialized,
			newNotePipeline: this.pipeline !== null,
			filenameDateSync: this.filenameDateSyncActive,
			folderTitleSync: this.folderTitles !== null,
			sorting: this.sorting !== null,
			bookDecorations: this.decorations !== null,
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async saveWatchTargets(targets: readonly WatchedTarget[]): Promise<void> {
		await saveWatchProfile(this.app, targets);
		this.watchTargets = targets.map((target) => structuredClone(target));
		this.watchProfileHasOverride = true;
	}

	async resetWatchTargets(): Promise<void> {
		const profile = await resetWatchProfile(this.app);
		this.watchTargets = profile.targets;
		this.watchProfileHasOverride = false;
	}

	private notifyAboutWatchIssues(
		audits: Awaited<ReturnType<typeof auditWatchTargets>>,
		live = false,
	): void {
		const problems = audits.filter((audit) => !audit.configured);
		if (problems.length === 0) return;
		const names = problems
			.slice(0, 3)
			.map((audit) => audit.name)
			.join(", ");
		const remainder = problems.length - 3;
		new Notice(
			live
				? `Root Books Toolkit detected a watched-state change: ${names}${remainder > 0 ? ` and ${remainder} more` : ""} ${problems.length === 1 ? "needs" : "need"} attention. Open Toolkit settings for details.`
				: `Root Books Toolkit found ${problems.length} watched target${problems.length === 1 ? "" : "s"} needing attention: ${names}${remainder > 0 ? ` and ${remainder} more` : ""}. Open Toolkit settings for details.`,
			10000,
		);
	}

	private issueKeys(
		audits: Awaited<ReturnType<typeof auditWatchTargets>>,
	): Set<string> {
		return new Set(audits.flatMap((audit) => watchAuditIssueKeys(audit)));
	}

	private async startWatchAuditMonitoring(): Promise<void> {
		const audits = await auditWatchTargets(this.app, this.watchTargets);
		this.previousWatchIssueKeys = this.issueKeys(audits);
		if (this.settings.notifyOnAuditIssues)
			this.notifyAboutWatchIssues(audits);
		this.registerInterval(
			window.setInterval(
				() => void this.pollWatchAudit(),
				WATCH_AUDIT_INTERVAL_MS,
			),
		);
	}

	private async pollWatchAudit(): Promise<void> {
		if (this.watchAuditRunning) return;
		this.watchAuditRunning = true;
		try {
			const audits = await auditWatchTargets(this.app, this.watchTargets);
			const currentIssueKeys = this.issueKeys(audits);
			const newlyProblematic = audits.filter((audit) =>
				watchAuditIssueKeys(audit).some(
					(key) => !this.previousWatchIssueKeys.has(key),
				),
			);
			this.previousWatchIssueKeys = currentIssueKeys;
			if (
				this.settings.notifyOnAuditIssues &&
				newlyProblematic.length > 0
			)
				this.notifyAboutWatchIssues(newlyProblematic, true);
		} catch {
			// A transient read failure is retried on the next interval.
		} finally {
			this.watchAuditRunning = false;
		}
	}

	private async loadSettings(): Promise<void> {
		const stored =
			(await this.loadData()) as Partial<RootBooksWorkspaceSettings> | null;
		this.settings = {
			schemaVersion: 3,
			lastValidDateFormat:
				stored?.lastValidDateFormat ??
				DEFAULT_SETTINGS.lastValidDateFormat,
			optionalFilenameTimeFormat:
				stored?.optionalFilenameTimeFormat ??
				DEFAULT_SETTINGS.optionalFilenameTimeFormat,
			colorTabs: stored?.colorTabs ?? DEFAULT_SETTINGS.colorTabs,
			showBookLabel:
				stored?.showBookLabel ?? DEFAULT_SETTINGS.showBookLabel,
			notifyOnAuditIssues:
				stored?.notifyOnAuditIssues ??
				DEFAULT_SETTINGS.notifyOnAuditIssues,
			exportWatchProfileOnStartup:
				stored?.exportWatchProfileOnStartup ??
				DEFAULT_SETTINGS.exportWatchProfileOnStartup,
		};
		const profile = await loadWatchProfile(this.app);
		this.watchTargets = profile.profile.targets;
		this.watchProfileHasOverride = profile.hasOverride;
		this.watchProfileLoadError = profile.error ?? null;
	}

	onunload(): void {
		this.pipeline?.dispose();
		this.folderTitles?.dispose();
		this.sorting?.dispose();
		this.decorations?.dispose();
	}
}
