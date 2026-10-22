import {
	App,
	ButtonComponent,
	Modal,
	Notice,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import type { Plugin, SettingDefinitionItem } from "obsidian";
import { auditCoordinatorHealth } from "./coordinator-health";
import {
	auditWatchTargets,
	availableTargetSettingPaths,
	communityInstallManagerWatches,
	exportCommunityInstallManagerProfile,
	installedCommunityPlugins,
	installedCorePlugins,
	isCoreUniqueNoteCreatorEnabled,
	openCommunityPluginSettings,
	openTargetSetting,
	openTargetSettings,
	watchReturnAnchor,
	watchProfileDisplayPath,
} from "./integrations";
import {
	OBSIDIAN_OPTION_PAGES,
	type BooleanValueLabels,
	type CoordinatorHealthItem,
	type RootBooksWorkspaceSettings,
	type RuntimeCoordinatorState,
	type SettingAudit,
	type WatchComparison,
	type WatchedSetting,
	type WatchedTarget,
	type WatchTargetKind,
} from "./types";
import {
	mergeWatchTarget,
	replaceWatchTarget,
	settingExpectedText,
	watchTargetKey,
} from "./watch-profile";

export interface RootBooksSettingsHost {
	settings: RootBooksWorkspaceSettings;
	watchTargets: WatchedTarget[];
	watchProfileHasOverride: boolean;
	saveSettings(): Promise<void>;
	saveWatchTargets(targets: readonly WatchedTarget[]): Promise<void>;
	resetWatchTargets(): Promise<void>;
	refreshDecorations(): void;
	openAppearancePicker(): void;
	runtimeCoordinatorState(): RuntimeCoordinatorState;
}

function formatValue(
	value: unknown,
	booleanLabels?: BooleanValueLabels,
): string {
	if (typeof value === "boolean" && booleanLabels)
		return value ? booleanLabels.true : booleanLabels.false;
	if (value === undefined) return "Missing";
	if (typeof value === "string") return value ? JSON.stringify(value) : '""';
	try {
		return JSON.stringify(value) ?? "Unsupported value";
	} catch {
		return "Unserializable value";
	}
}

function comparisonText(check: SettingAudit): string {
	switch (check.comparison) {
		case "exists":
			return "Present";
		case "non-empty":
			return "Non-empty";
		case "one-of":
			return `One of ${formatValue(check.expected)}`;
		case "equals":
			return formatValue(check.expected, check.booleanLabels);
	}
}

function readablePath(path: string): string {
	const lastPart = path.split(".").at(-1) ?? path;
	return lastPart
		.replaceAll(/([a-z])([A-Z])/g, "$1 $2")
		.replaceAll(/[-_]+/g, " ")
		.replace(/^./, (character) => character.toUpperCase());
}

interface EditableCheck {
	path: string;
	label: string;
	description: string;
	comparison: WatchComparison;
	expectedText: string;
	settingsLabel: string;
	settingsChildLabel: string;
	settingsTab: string;
	booleanLabels?: BooleanValueLabels;
	locatable: boolean;
}

function editableCheck(setting?: WatchedSetting): EditableCheck {
	return {
		path: setting?.path ?? "",
		label: setting?.label ?? "",
		description: setting?.description ?? "",
		comparison: setting?.comparison ?? "equals",
		expectedText: setting ? settingExpectedText(setting) : "",
		settingsLabel: setting?.settingsLabel ?? "",
		settingsChildLabel: setting?.settingsChildLabel ?? "",
		settingsTab: setting?.settingsTab ?? "editor",
		booleanLabels: setting?.booleanLabels,
		locatable: setting?.locatable !== false,
	};
}

class WatchEditorModal extends Modal {
	private choices: Array<{
		id: string;
		name: string;
		version: string | null;
	}> = [];
	private paths: Array<{ path: string; value: unknown }> = [];
	private targetId: string;
	private targetName: string;
	private purpose: string;
	private requireEnabled: boolean;
	private checks: EditableCheck[];

	constructor(
		app: App,
		private readonly kind: WatchTargetKind,
		private readonly existing: WatchedTarget | undefined,
		private readonly onSave: (target: WatchedTarget) => Promise<void>,
	) {
		super(app);
		this.targetId = existing?.id ?? (kind === "obsidian" ? "app" : "");
		this.targetName =
			existing?.name ?? (kind === "obsidian" ? "Obsidian options" : "");
		this.purpose = existing?.purpose ?? "";
		this.requireEnabled = existing?.requireEnabled ?? kind !== "obsidian";
		this.checks = existing?.checks.map(editableCheck) ?? [];
	}

	onOpen(): void {
		void this.load();
	}

	private async load(): Promise<void> {
		this.choices =
			this.kind === "community-plugin"
				? await installedCommunityPlugins(this.app)
				: this.kind === "core-plugin"
					? installedCorePlugins(this.app)
					: [
							{
								id: "app",
								name: "Obsidian options",
								version: null,
							},
						];
		if (
			this.existing &&
			!this.choices.some((choice) => choice.id === this.existing?.id)
		) {
			this.choices.push({
				id: this.existing.id,
				name: this.existing.name,
				version: null,
			});
		}
		if (this.targetId) await this.loadPaths();
		this.render();
	}

	private async loadPaths(): Promise<void> {
		this.paths = await availableTargetSettingPaths(
			this.app,
			this.kind,
			this.targetId,
		);
	}

	private async selectTarget(id: string): Promise<void> {
		this.targetId = id;
		const selected = this.choices.find((choice) => choice.id === id);
		this.targetName = selected?.name ?? id;
		this.checks = [];
		await this.loadPaths();
		this.render();
	}

	private selectPath(index: number, path: string): void {
		const check = this.checks[index];
		if (!check) return;
		const selected = this.paths.find(
			(candidate) => candidate.path === path,
		);
		check.path = path;
		check.label = readablePath(path);
		check.description = "";
		check.expectedText = selected
			? (JSON.stringify(selected.value) ?? "")
			: "";
		check.settingsLabel = readablePath(path);
		check.settingsChildLabel = "";
		check.booleanLabels = undefined;
		check.locatable = true;
		this.render();
	}

	private parsedCheck(check: EditableCheck): WatchedSetting {
		if (!check.path.trim())
			throw new Error("Choose an available setting for every check.");
		if (!this.paths.some((candidate) => candidate.path === check.path))
			throw new Error(
				`${check.path} is not exposed by the selected target. Choose a detected setting or remove this check.`,
			);
		let expected: unknown;
		if (check.comparison === "equals" || check.comparison === "one-of") {
			try {
				expected = JSON.parse(check.expectedText) as unknown;
			} catch {
				throw new Error(
					"Expected values must be valid JSON, including quotes around text.",
				);
			}
			if (check.comparison === "one-of" && !Array.isArray(expected))
				throw new Error("A one-of value must be a JSON array.");
		}
		return {
			path: check.path.trim(),
			label: check.label.trim() || check.path.trim(),
			description: check.description.trim() || undefined,
			comparison: check.comparison,
			expected,
			settingsLabel: check.locatable
				? check.settingsLabel.trim() || readablePath(check.path)
				: undefined,
			settingsChildLabel: check.settingsChildLabel.trim() || undefined,
			settingsTab:
				this.kind === "obsidian" ? check.settingsTab : undefined,
			booleanLabels: check.booleanLabels,
			locatable: check.locatable,
		};
	}

	private renderCheck(check: EditableCheck, index: number): void {
		const card = this.contentEl.createDiv({
			cls: "root-books-watch-editor",
		});
		const heading = card.createDiv({ cls: "root-books-card-heading" });
		heading.createEl("strong", { text: `Setting ${index + 1}` });
		new ButtonComponent(heading)
			.setButtonText("Remove")
			.onClick(() => {
				this.checks.splice(index, 1);
				this.render();
			})
			.buttonEl.addClass("root-books-remove-button");

		new Setting(card)
			.setName("Available setting")
			.setDesc(
				"Choose a value detected from this target. Toolkit keeps its internal key synchronized automatically.",
			)
			.addDropdown((dropdown) => {
				dropdown.addOption(
					"",
					this.paths.length
						? "Choose a detected setting"
						: "No stored settings detected",
				);
				for (const option of this.paths)
					dropdown.addOption(option.path, readablePath(option.path));
				if (
					check.path &&
					!this.paths.some((option) => option.path === check.path)
				)
					dropdown.addOption(
						check.path,
						`Unavailable: ${readablePath(check.path)}`,
					);
				dropdown
					.setValue(check.path)
					.setDisabled(this.paths.length === 0)
					.onChange((value) => this.selectPath(index, value));
			});
		new Setting(card)
			.setName("Dashboard label")
			.addText((text) =>
				text
					.setValue(check.label)
					.onChange((value) => (check.label = value)),
			);
		new Setting(card)
			.setName("Explanation (optional)")
			.setDesc(
				"Explain why this value matters. The text appears with this check in the dashboard.",
			)
			.addTextArea((text) =>
				text
					.setValue(check.description)
					.onChange((value) => (check.description = value)),
			);
		if (this.kind === "obsidian") {
			new Setting(card)
				.setName("Options page")
				.setDesc(
					"Choose the Obsidian settings page that contains the visible control.",
				)
				.addDropdown((dropdown) => {
					for (const page of OBSIDIAN_OPTION_PAGES)
						dropdown.addOption(page.id, page.name);
					dropdown
						.setValue(check.settingsTab)
						.onChange((value) => (check.settingsTab = value));
				});
		}
		if (check.locatable && check.path)
			new Setting(card)
				.setName("Settings shortcut")
				.setDesc(
					check.settingsChildLabel
						? `Automatically opens “${check.settingsLabel}”, then “${check.settingsChildLabel}”.`
						: `Automatically matches the rendered setting name “${check.settingsLabel || readablePath(check.path)}”.`,
				);
		new Setting(card)
			.setName("Locate in settings")
			.setDesc(
				"Show a direct shortcut for values exposed in a settings screen.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(check.locatable)
					.onChange((value) => (check.locatable = value)),
			);
		new Setting(card).setName("Comparison").addDropdown((dropdown) =>
			dropdown
				.addOptions({
					equals: "Equals",
					exists: "Exists",
					"non-empty": "Non-empty",
					"one-of": "One of",
				})
				.setValue(check.comparison)
				.onChange((value) => {
					check.comparison = value as WatchComparison;
					this.render();
				}),
		);
		if (check.comparison === "equals" || check.comparison === "one-of") {
			new Setting(card)
				.setName("Expected value")
				.setDesc(
					check.comparison === "one-of"
						? "Enter a JSON array of accepted values."
						: "Enter a JSON value, including quotes around text.",
				)
				.addText((text) =>
					text
						.setValue(check.expectedText)
						.onChange((value) => (check.expectedText = value)),
				);
		}
	}

	private render(): void {
		this.contentEl.empty();
		this.setTitle(
			this.existing ? "Edit watched target" : "Add watched target",
		);

		if (!this.existing && this.kind !== "obsidian") {
			new Setting(this.contentEl)
				.setName(
					this.kind === "community-plugin"
						? "Community plugin"
						: "Core plugin",
				)
				.addDropdown((dropdown) => {
					dropdown.addOption("", "Choose a plugin");
					for (const choice of this.choices)
						dropdown.addOption(
							choice.id,
							`${choice.name}${choice.version ? ` ${choice.version}` : ""}`,
						);
					dropdown.setValue(this.targetId).onChange((value) => {
						void this.selectTarget(value);
					});
				});
		} else if (this.targetId) {
			this.contentEl.createEl("p", {
				text: `${this.targetName} · ${this.targetId}`,
			});
		}

		if (!this.targetId) {
			if (this.choices.length === 0)
				this.contentEl.createEl("p", {
					text: "No available targets were detected.",
				});
			return;
		}

		new Setting(this.contentEl)
			.setName("Description (optional)")
			.setDesc(
				"Explain why this target belongs in the vault. This appears beside the button that opens its settings.",
			)
			.addTextArea((text) =>
				text
					.setValue(this.purpose)
					.onChange((value) => (this.purpose = value)),
			);

		if (this.kind === "obsidian")
			this.contentEl.createEl("p", {
				cls: "root-books-plugin-meta",
				text: "Detected safe values come from app.json, appearance.json, hotkeys.json, and types.json. Keychain secrets are never read.",
			});

		if (this.kind !== "obsidian") {
			new Setting(this.contentEl)
				.setName("Require enabled")
				.setDesc("Report a problem when this plugin is disabled.")
				.addToggle((toggle) =>
					toggle
						.setValue(this.requireEnabled)
						.onChange((value) => (this.requireEnabled = value)),
				);
		}

		for (const [index, check] of this.checks.entries())
			this.renderCheck(check, index);

		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText("Add setting").onClick(() => {
					this.checks.push(editableCheck());
					this.render();
				}),
			)
			.addButton((button) =>
				button
					.setButtonText("Save")
					.setCta()
					.onClick(async () => {
						try {
							const checks = this.checks.map((check) =>
								this.parsedCheck(check),
							);
							if (
								new Set(checks.map((check) => check.path))
									.size !== checks.length
							)
								throw new Error(
									"A setting path can only be watched once.",
								);
							await this.onSave({
								kind: this.kind,
								id: this.targetId,
								name: this.targetName || this.targetId,
								purpose: this.purpose,
								requireEnabled:
									this.kind === "obsidian"
										? false
										: this.requireEnabled,
								checks,
							});
							this.close();
						} catch (error) {
							new Notice(
								error instanceof Error
									? error.message
									: String(error),
							);
						}
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class RootBooksWorkspaceSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly host: RootBooksSettingsHost & Plugin,
	) {
		super(app, host);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Root Books Toolkit",
				desc: "Toolkit audits watched state without changing Obsidian or plugin settings.",
				searchable: false,
			},
			{
				type: "group",
				heading: "Coordinator overview",
				items: [
					{
						name: "Watched state dashboard",
						desc: "Community plugins, core plugins, and Obsidian options are reported and managed separately.",
						render: (setting) => {
							void this.renderIntegrationAudit(setting);
						},
					},
					{
						name: "Vault and runtime health",
						desc: "Checks the root workflow, first-level books, and active coordinator services.",
						render: (setting) =>
							this.renderCoordinatorHealth(setting),
					},
				],
			},
			{
				type: "group",
				heading: "Portable watch profile",
				items: [
					{
						name: "Import, export, or reset",
						desc: "The vault override can be tracked in Git and exchanged with Community Install Manager.",
						render: (setting) =>
							this.renderPortableProfile(setting),
					},
				],
			},
			{
				type: "group",
				heading: "Audit notifications and sync",
				items: [
					{
						name: "Notify when watched state needs attention",
						desc: "Check every three seconds and notify when a watched target becomes missing, disabled, or misconfigured. Existing problems are also summarized at startup.",
						control: { type: "toggle", key: "notifyOnAuditIssues" },
					},
					{
						name: "Export to Community Install Manager on startup",
						desc: "Merge community-plugin IDs and exact expected values into its two JSON profiles. Other entries are preserved.",
						control: {
							type: "toggle",
							key: "exportWatchProfileOnStartup",
						},
					},
				],
			},
			{
				type: "group",
				heading: "Book appearance",
				items: [
					{
						name: "Color file tabs",
						desc: "Use each book's panel.accent as a passive tab marker.",
						control: { type: "toggle", key: "colorTabs" },
					},
					{
						name: "Show book icon on tabs",
						desc: "Adds the book's Lucide icon to ordinary file-backed tabs. The native tab title keeps its text and receives the book accent color.",
						control: { type: "toggle", key: "showBookLabel" },
					},
					{
						name: "Edit book appearance",
						desc: "Choose a first-level folder note, then edit its portable panel metadata.",
						render: (setting) => {
							setting.addButton((button) =>
								button
									.setButtonText("Choose book")
									.onClick(() =>
										this.host.openAppearancePicker(),
									),
							);
						},
					},
				],
			},
			{
				type: "group",
				heading: "Unique notes",
				items: [
					{
						name: "Optional filename time format",
						desc: "Appended to the root template-date-format for unique notes. Leave blank for date-only names with collision suffixes.",
						control: {
							type: "text",
							key: "optionalFilenameTimeFormat",
							placeholder: "HH.mm.ss",
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		switch (key) {
			case "colorTabs":
				return this.host.settings.colorTabs;
			case "showBookLabel":
				return this.host.settings.showBookLabel;
			case "optionalFilenameTimeFormat":
				return this.host.settings.optionalFilenameTimeFormat;
			case "notifyOnAuditIssues":
				return this.host.settings.notifyOnAuditIssues;
			case "exportWatchProfileOnStartup":
				return this.host.settings.exportWatchProfileOnStartup;
			default:
				return undefined;
		}
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		switch (key) {
			case "colorTabs":
				if (typeof value !== "boolean") return;
				this.host.settings.colorTabs = value;
				await this.host.saveSettings();
				this.host.refreshDecorations();
				return;
			case "showBookLabel":
				if (typeof value !== "boolean") return;
				this.host.settings.showBookLabel = value;
				await this.host.saveSettings();
				this.host.refreshDecorations();
				return;
			case "optionalFilenameTimeFormat":
				if (typeof value !== "string") return;
				this.host.settings.optionalFilenameTimeFormat = value.trim();
				await this.host.saveSettings();
				return;
			case "notifyOnAuditIssues":
				if (typeof value !== "boolean") return;
				this.host.settings.notifyOnAuditIssues = value;
				await this.host.saveSettings();
				return;
			case "exportWatchProfileOnStartup":
				if (typeof value !== "boolean") return;
				this.host.settings.exportWatchProfileOnStartup = value;
				await this.host.saveSettings();
		}
	}

	private renderCheck(
		card: HTMLElement,
		check: SettingAudit,
		target: WatchedTarget,
		canOpen: boolean,
	): void {
		const row = card.createDiv({
			cls: `root-books-check root-books-check-${check.ok ? "ok" : "error"}`,
		});
		row.dataset.rootBooksReturnAnchor = watchReturnAnchor(
			target,
			check.path,
		);
		row.createSpan({
			cls: "root-books-check-state",
			text: check.ok ? "✓ Matches" : "✕ Mismatch",
		});
		const values = row.createDiv({ cls: "root-books-check-values" });
		values.createEl("strong", { text: check.label });
		if (check.description)
			values.createDiv({
				cls: "root-books-check-description",
				text: check.description,
			});
		values.createDiv({
			text: `Current: ${formatValue(check.actual, check.booleanLabels)}`,
		});
		values.createDiv({ text: `Expected: ${comparisonText(check)}` });
		if (canOpen && check.locatable !== false) {
			new ButtonComponent(values)
				.setButtonText("Open this setting")
				.onClick(async () => {
					const found = await openTargetSetting(
						this.app,
						target,
						check.label,
						check.path,
						check.settingsLabel,
						check.settingsTab,
						check.settingsChildLabel,
						watchReturnAnchor(target, check.path),
					);
					if (!found)
						new Notice(
							"Opened the correct settings page, but this plugin does not expose a matching setting row that Toolkit can focus.",
						);
				});
		}
	}

	private renderAuditSection(
		container: HTMLElement,
		title: string,
		kind: WatchTargetKind,
		audits: Awaited<ReturnType<typeof auditWatchTargets>>,
	): void {
		new Setting(container)
			.setName(title)
			.setHeading()
			.addButton((button) =>
				button
					.setButtonText(
						kind === "community-plugin"
							? "Add community plugin"
							: kind === "core-plugin"
								? "Add core plugin"
								: "Add option",
					)
					.setCta()
					.onClick(() =>
						this.openEditor(
							kind,
							kind === "obsidian"
								? this.host.watchTargets.find(
										(target) => target.kind === "obsidian",
									)
								: undefined,
						),
					),
			);
		if (audits.length === 0)
			container.createEl("p", {
				cls: "root-books-empty-state",
				text: `No watched ${title.toLocaleLowerCase()} yet.`,
			});
		for (const audit of audits) {
			const target = this.host.watchTargets.find(
				(candidate) =>
					candidate.kind === audit.kind && candidate.id === audit.id,
			);
			if (!target) continue;
			const card = container.createDiv({
				cls: `root-books-integration-card ${audit.configured ? "root-books-card-ok" : "root-books-card-error"}`,
			});
			card.dataset.rootBooksReturnAnchor = watchReturnAnchor(target);
			const heading = card.createDiv({ cls: "root-books-card-heading" });
			const titleBlock = heading.createDiv();
			titleBlock.createEl("strong", { text: audit.name });
			const actions = heading.createDiv({
				cls: "root-books-watch-actions",
			});
			actions.createSpan({
				cls: audit.configured
					? "root-books-status-ok"
					: "root-books-status-error",
				text: audit.configured ? "✓ Ready" : "✕ Needs attention",
			});
			new ButtonComponent(actions)
				.setButtonText("Edit")
				.onClick(() => this.openEditor(target.kind, target));
			new ButtonComponent(actions)
				.setButtonText("Remove")
				.onClick(async () => {
					await this.host.saveWatchTargets(
						this.host.watchTargets.filter(
							(candidate) =>
								watchTargetKey(candidate) !==
								watchTargetKey(target),
						),
					);
					new Notice(
						`Removed ${target.name} from the watch profile.`,
					);
					this.update();
				})
				.buttonEl.addClass("root-books-remove-button");
			card.createDiv({
				cls: "root-books-plugin-meta",
				text:
					audit.kind === "obsidian"
						? "Obsidian options · safe vault configuration"
						: !audit.installed
							? `Unavailable · ${audit.id}`
							: `${audit.enabled ? "Enabled" : "Disabled"}${audit.version ? ` · ${audit.version}` : ""} · ${audit.id}`,
			});

			if (audit.checks.length > 0) {
				const details = card.createEl("details");
				if (!audit.configured) details.open = true;
				details.createEl("summary", {
					text: `${audit.checks.filter((check) => check.ok).length} of ${audit.checks.length} setting checks match`,
				});
				for (const check of audit.checks)
					this.renderCheck(
						details,
						check,
						target,
						audit.installed &&
							(audit.kind === "obsidian" || audit.enabled),
					);
			}
			const footer = card.createDiv({ cls: "root-books-card-footer" });
			if (audit.purpose)
				footer.createDiv({
					cls: "root-books-target-description",
					text: audit.purpose,
				});
			new ButtonComponent(footer)
				.setButtonText(
					audit.kind === "community-plugin" &&
						(!audit.installed || !audit.enabled)
						? "Open Community plugins"
						: audit.kind === "core-plugin"
							? "Open core plugin settings"
							: audit.kind === "obsidian"
								? "Open options"
								: "Open plugin settings",
				)
				.onClick(() =>
					openTargetSettings(
						this.app,
						target,
						target.checks[0]?.settingsTab,
						watchReturnAnchor(target),
					),
				);
		}
	}

	private async renderIntegrationAudit(setting: Setting): Promise<void> {
		const list = setting.descEl.createDiv({
			cls: "root-books-integration-list",
		});
		list.setText("Checking watched state…");
		const audits = await auditWatchTargets(
			this.app,
			this.host.watchTargets,
		);
		if (!list.isConnected) return;
		list.empty();
		const ready = audits.filter((audit) => audit.configured).length;
		list.createDiv({
			cls: `root-books-summary ${ready === audits.length ? "root-books-status-ok" : "root-books-status-error"}`,
			text: `${ready} of ${audits.length} watched targets ready`,
		});
		this.renderAuditSection(
			list,
			"Community plugins",
			"community-plugin",
			audits.filter((audit) => audit.kind === "community-plugin"),
		);
		this.renderAuditSection(
			list,
			"Core plugins",
			"core-plugin",
			audits.filter((audit) => audit.kind === "core-plugin"),
		);
		this.renderAuditSection(
			list,
			"Options",
			"obsidian",
			audits.filter((audit) => audit.kind === "obsidian"),
		);

		if (isCoreUniqueNoteCreatorEnabled(this.app)) {
			const conflict = list.createDiv({
				cls: "root-books-integration-card root-books-core-conflict",
			});
			conflict.createEl("strong", {
				text: "Core Unique Note Creator is enabled",
			});
			conflict.createEl("p", {
				text: "Toolkit also provides a unique-note command. Disable the core plugin manually if you want a single command owner.",
			});
		}

		new Setting(list)
			.addButton((button) =>
				button
					.setButtonText("Recheck")
					.setCta()
					.onClick(() => this.update()),
			)
			.addButton((button) =>
				button
					.setButtonText("Community plugins")
					.onClick(() => openCommunityPluginSettings(this.app)),
			);
	}

	private renderHealthRows(
		container: HTMLElement,
		title: string,
		items: CoordinatorHealthItem[],
	): void {
		const section = container.createDiv({
			cls: "root-books-health-section",
		});
		section.createEl("strong", { text: title });
		for (const item of items) {
			const row = section.createDiv({
				cls: `root-books-health-row root-books-health-${item.status}`,
			});
			row.createSpan({
				cls: "root-books-check-state",
				text:
					item.status === "ok"
						? "✓ OK"
						: item.status === "warning"
							? "! Review"
							: "✕ Problem",
			});
			const text = row.createDiv();
			text.createEl("strong", { text: item.label });
			text.createDiv({ text: item.detail });
		}
	}

	private renderCoordinatorHealth(setting: Setting): void {
		const health = auditCoordinatorHealth(
			this.app,
			this.host.runtimeCoordinatorState(),
		);
		const container = setting.descEl.createDiv({
			cls: "root-books-health",
		});
		this.renderHealthRows(container, "Vault workflow", health.workflow);
		this.renderHealthRows(container, "Books", health.books);
		this.renderHealthRows(
			container,
			"Runtime coordination",
			health.runtime,
		);
		new Setting(container)
			.addButton((button) =>
				button.setButtonText("Open root index").onClick(async () => {
					const file =
						this.app.vault.getAbstractFileByPath("index.md");
					if (file instanceof TFile)
						await this.app.workspace.getLeaf(false).openFile(file);
					else
						new Notice("The vault root does not contain index.md.");
				}),
			)
			.addButton((button) =>
				button.setButtonText("Recheck").onClick(() => this.update()),
			);
	}

	private openEditor(kind: WatchTargetKind, existing?: WatchedTarget): void {
		const originalKey = existing ? watchTargetKey(existing) : undefined;
		new WatchEditorModal(this.app, kind, existing, async (target) => {
			await this.host.saveWatchTargets(
				replaceWatchTarget(this.host.watchTargets, target, originalKey),
			);
			new Notice(
				existing ? "Updated watched target." : "Added watched target.",
			);
			this.update();
		}).open();
	}

	private async importCommunityProfile(): Promise<void> {
		const watches = await communityInstallManagerWatches(this.app);
		const targets = structuredClone(this.host.watchTargets);
		let changed = 0;
		for (const watch of watches)
			changed += mergeWatchTarget(targets, watch);
		if (watches.length > 0) await this.host.saveWatchTargets(targets);
		new Notice(
			watches.length === 0
				? "No Community Install Manager profile was found."
				: changed === 0
					? "The Community Install Manager profile is already represented."
					: `Imported ${watches.length} plugin entr${watches.length === 1 ? "y" : "ies"} and ${changed} exact setting${changed === 1 ? "" : "s"}.`,
		);
		this.update();
	}

	private async exportCommunityProfile(): Promise<void> {
		const result = await exportCommunityInstallManagerProfile(
			this.app,
			this.host.watchTargets,
		);
		new Notice(
			`Exported ${result.exportedSettings} exact setting${result.exportedSettings === 1 ? "" : "s"}; added ${result.addedPlugins} plugin${result.addedPlugins === 1 ? "" : "s"} to the install list${result.skippedChecks ? `; skipped ${result.skippedChecks} non-exact check${result.skippedChecks === 1 ? "" : "s"}` : ""}.`,
		);
	}

	private renderPortableProfile(setting: Setting): void {
		const container = setting.descEl.createDiv({
			cls: "root-books-watch-profile",
		});
		container.createEl("p", {
			text: this.host.watchProfileHasOverride
				? `Using vault override: ${watchProfileDisplayPath(this.app)}`
				: `Using the bundled defaults. The first edit creates ${watchProfileDisplayPath(this.app)}.`,
		});
		new Setting(container)
			.addButton((button) =>
				button
					.setButtonText("Import from Community Install Manager")
					.onClick(() => this.importCommunityProfile()),
			)
			.addButton((button) =>
				button
					.setButtonText("Export for Community Install Manager")
					.onClick(() => this.exportCommunityProfile()),
			);
		if (this.host.watchProfileHasOverride) {
			new Setting(container).addButton((button) =>
				button
					.setButtonText("Restore bundled defaults")
					.onClick(async () => {
						await this.host.resetWatchTargets();
						new Notice("Restored the bundled watch profile.");
						this.update();
					})
					.setDestructive(),
			);
		}
	}
}
