import { App, Modal, Notice, PluginSettingTab, Setting, TFile } from "obsidian";
import type { Plugin, SettingDefinitionItem } from "obsidian";
import { auditCoordinatorHealth } from "./coordinator-health";
import {
	INTEGRATIONS,
	auditIntegrations,
	availableSettingPaths,
	communityInstallManagerWatches,
	installedPlugins,
	isCoreUniqueNoteCreatorEnabled,
	openCommunityPluginSettings,
	openPluginSettings,
} from "./integrations";
import { ECOSYSTEM_VERSION } from "./types";
import type {
	CoordinatorHealthItem,
	RootBooksWorkspaceSettings,
	RuntimeCoordinatorState,
	SettingAudit,
	WatchComparison,
	WatchedPlugin,
	WatchedSetting,
} from "./types";

export interface RootBooksSettingsHost {
	settings: RootBooksWorkspaceSettings;
	saveSettings(): Promise<void>;
	refreshDecorations(): void;
	openAppearancePicker(): void;
	runtimeCoordinatorState(): RuntimeCoordinatorState;
}

function formatValue(value: unknown): string {
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
			return formatValue(check.expected);
	}
}

function mergeWatch(current: WatchedPlugin[], incoming: WatchedPlugin): number {
	let target = current.find((watch) => watch.id === incoming.id);
	if (!target) {
		target = { ...incoming, checks: [] };
		current.push(target);
	}
	target.name = incoming.name;
	target.purpose = incoming.purpose;
	target.requireEnabled ||= incoming.requireEnabled;
	const builtIn = INTEGRATIONS.find(
		(descriptor) => descriptor.id === incoming.id,
	);
	const reserved = new Set(
		builtIn?.recommendations.map((recommendation) => recommendation.path) ??
			[],
	);
	let changed = 0;
	for (const check of incoming.checks) {
		if (reserved.has(check.path)) continue;
		const existing = target.checks.find(
			(candidate) => candidate.path === check.path,
		);
		if (existing) Object.assign(existing, structuredClone(check));
		else target.checks.push(structuredClone(check));
		changed += 1;
	}
	if (builtIn && target.checks.length === 0) {
		const index = current.indexOf(target);
		if (index >= 0) current.splice(index, 1);
	}
	return changed;
}

class AddWatchModal extends Modal {
	private plugins: Array<{
		id: string;
		name: string;
		version: string | null;
	}> = [];
	private paths: Array<{ path: string; value: unknown }> = [];
	private pluginId = "";
	private path = "";
	private label = "";
	private comparison: WatchComparison = "equals";
	private expectedText = "";
	private requireEnabled = true;

	constructor(
		app: App,
		private readonly onSave: (watch: WatchedPlugin) => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		void this.load();
	}

	private async load(): Promise<void> {
		this.plugins = await installedPlugins(this.app);
		this.render();
	}

	private async selectPlugin(id: string): Promise<void> {
		this.pluginId = id;
		this.path = "";
		this.label = "";
		this.expectedText = "";
		this.paths = id ? await availableSettingPaths(this.app, id) : [];
		this.render();
	}

	private selectPath(path: string): void {
		this.path = path;
		const setting = this.paths.find((candidate) => candidate.path === path);
		this.expectedText = setting ? formatValue(setting.value) : "";
		this.label = path
			? path
					.split(".")
					.at(-1)!
					.replaceAll(/([a-z])([A-Z])/g, "$1 $2")
					.replaceAll(/[-_]+/g, " ")
			: "";
		this.render();
	}

	private expectedValue(): unknown {
		if (this.comparison === "exists" || this.comparison === "non-empty")
			return undefined;
		try {
			return JSON.parse(this.expectedText);
		} catch {
			throw new Error(
				"Expected value must be valid JSON, including quotes around text.",
			);
		}
	}

	private render(): void {
		this.contentEl.empty();
		this.setTitle("Add watched plugin setting");
		if (this.plugins.length === 0) {
			this.contentEl.createEl("p", {
				text: "No installed community plugins were found.",
			});
			return;
		}

		new Setting(this.contentEl)
			.setName("Plugin")
			.setDesc("Choose an installed plugin. Toolkit will not modify it.")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "Choose a plugin");
				for (const plugin of this.plugins)
					dropdown.addOption(
						plugin.id,
						`${plugin.name}${plugin.version ? ` ${plugin.version}` : ""}`,
					);
				dropdown.setValue(this.pluginId).onChange((value) => {
					void this.selectPlugin(value);
				});
			});

		if (!this.pluginId) return;
		new Setting(this.contentEl)
			.setName("Require enabled")
			.setDesc(
				"Report a problem when the plugin is installed but disabled.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.requireEnabled)
					.onChange((value) => (this.requireEnabled = value)),
			);

		new Setting(this.contentEl)
			.setName("Setting path")
			.setDesc(
				"Leave this at plugin state to watch only installation and enablement.",
			)
			.addDropdown((dropdown) => {
				dropdown.addOption("", "Plugin state only");
				for (const option of this.paths)
					dropdown.addOption(option.path, option.path);
				dropdown
					.setValue(this.path)
					.onChange((value) => this.selectPath(value));
			});

		if (this.path) {
			new Setting(this.contentEl)
				.setName("Label")
				.setDesc("Human-readable description shown in the dashboard.")
				.addText((text) =>
					text
						.setValue(this.label)
						.onChange((value) => (this.label = value)),
				);
			new Setting(this.contentEl)
				.setName("Comparison")
				.addDropdown((dropdown) =>
					dropdown
						.addOptions({
							equals: "Equals",
							exists: "Exists",
							"non-empty": "Non-empty",
							"one-of": "One of",
						})
						.setValue(this.comparison)
						.onChange((value) => {
							this.comparison = value as WatchComparison;
							this.render();
						}),
				);
			if (this.comparison === "equals" || this.comparison === "one-of") {
				new Setting(this.contentEl)
					.setName("Expected value")
					.setDesc(
						this.comparison === "one-of"
							? "Enter a JSON array of accepted values."
							: "Captured from the current setting. Edit as JSON if needed.",
					)
					.addText((text) =>
						text
							.setValue(this.expectedText)
							.onChange((value) => (this.expectedText = value)),
					);
			}
		}

		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText("Add watch")
				.setCta()
				.onClick(async () => {
					const plugin = this.plugins.find(
						(candidate) => candidate.id === this.pluginId,
					);
					if (!plugin) return;
					try {
						const checks: WatchedSetting[] = this.path
							? [
									{
										path: this.path,
										label: this.label.trim() || this.path,
										comparison: this.comparison,
										expected: this.expectedValue(),
									},
								]
							: [];
						await this.onSave({
							id: plugin.id,
							name: plugin.name,
							purpose: "Custom state watch.",
							requireEnabled: this.requireEnabled,
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
				desc: `Ecosystem version ${ECOSYSTEM_VERSION}. Toolkit audits companion state without installing, enabling, disabling, or configuring other plugins.`,
				searchable: false,
			},
			{
				type: "group",
				heading: "Coordinator overview",
				items: [
					{
						name: "Companion plugin dashboard",
						desc: "Installation, enablement, versions, current values, and expected values.",
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
				heading: "Watched plugins",
				items: [
					{
						name: "Custom watch profile",
						desc: "Add installation, enablement, and selected-setting checks without changing plugin code.",
						render: (setting) => this.renderWatchProfile(setting),
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
						name: "Show book label on tabs",
						desc: "Adds a small icon and book name to file-backed tab headers.",
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
		}
	}

	private renderCheck(card: HTMLElement, check: SettingAudit): void {
		const row = card.createDiv({
			cls: `root-books-check root-books-check-${check.ok ? "ok" : "error"}`,
		});
		row.createSpan({
			cls: "root-books-check-state",
			text: check.ok ? "✓ Matches" : "✕ Mismatch",
		});
		const values = row.createDiv({ cls: "root-books-check-values" });
		values.createEl("strong", { text: check.label });
		values.createEl("code", { text: check.path });
		values.createDiv({ text: `Current: ${formatValue(check.actual)}` });
		values.createDiv({ text: `Expected: ${comparisonText(check)}` });
	}

	private async renderIntegrationAudit(setting: Setting): Promise<void> {
		const list = setting.descEl.createDiv({
			cls: "root-books-integration-list",
		});
		list.setText("Checking companion plugins…");
		const audits = await auditIntegrations(
			this.app,
			this.host.settings.watchedPlugins,
		);
		if (!list.isConnected) return;
		list.empty();
		const ready = audits.filter((audit) => audit.configured).length;
		list.createDiv({
			cls: `root-books-summary ${ready === audits.length ? "root-books-status-ok" : "root-books-status-error"}`,
			text: `${ready} of ${audits.length} watched plugins ready`,
		});
		for (const audit of audits) {
			const card = list.createDiv({
				cls: `root-books-integration-card ${audit.configured ? "root-books-card-ok" : "root-books-card-error"}`,
			});
			const heading = card.createDiv({ cls: "root-books-card-heading" });
			heading.createEl("strong", { text: audit.name });
			heading.createSpan({
				cls: audit.configured
					? "root-books-status-ok"
					: "root-books-status-error",
				text: audit.configured ? "✓ Ready" : "✕ Needs attention",
			});
			card.createEl("p", { text: audit.purpose });
			card.createDiv({
				cls: "root-books-plugin-meta",
				text: !audit.installed
					? `Missing · ${audit.id}`
					: `${audit.enabled ? "Enabled" : "Disabled"} · ${audit.version ?? "Unknown version"} · ${audit.id}`,
			});

			const details = card.createEl("details");
			if (!audit.configured) details.open = true;
			details.createEl("summary", {
				text: `${audit.checks.filter((check) => check.ok).length} of ${audit.checks.length} setting checks match`,
			});
			for (const check of audit.checks) this.renderCheck(details, check);
			new Setting(card).addButton((button) =>
				button
					.setButtonText(
						audit.installed && audit.enabled
							? "Open plugin settings"
							: "Open Community plugins",
					)
					.onClick(() => openPluginSettings(this.app, audit.id)),
			);
		}

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

	private async saveWatch(watch: WatchedPlugin): Promise<void> {
		const changed = mergeWatch(this.host.settings.watchedPlugins, watch);
		await this.host.saveSettings();
		new Notice(
			changed > 0
				? `Added ${changed} watched setting${changed === 1 ? "" : "s"}.`
				: "Plugin-state watch added; built-in setting checks were not duplicated.",
		);
		this.update();
	}

	private async importCommunityProfile(): Promise<void> {
		const watches = await communityInstallManagerWatches(this.app);
		let changed = 0;
		for (const watch of watches)
			changed += mergeWatch(this.host.settings.watchedPlugins, watch);
		await this.host.saveSettings();
		new Notice(
			watches.length === 0
				? "No Community Install Manager settings profile was found."
				: changed === 0
					? "The Community Install Manager profile is already covered by built-in or custom watches."
					: `Imported ${changed} selected setting${changed === 1 ? "" : "s"}.`,
		);
		this.update();
	}

	private renderWatchProfile(setting: Setting): void {
		const container = setting.descEl.createDiv({
			cls: "root-books-watch-profile",
		});
		if (this.host.settings.watchedPlugins.length === 0) {
			container.createEl("p", {
				text: "No custom watches. The four built-in workflow companions are still audited above.",
			});
		}
		for (const watch of this.host.settings.watchedPlugins) {
			const card = container.createDiv({ cls: "root-books-watch-card" });
			card.createEl("strong", { text: watch.name });
			card.createDiv({
				text: `${watch.id} · ${watch.requireEnabled ? "must be enabled" : "installation only"}`,
			});
			for (const check of watch.checks)
				card.createEl("code", {
					text: `${check.path} → ${check.comparison}${check.expected === undefined ? "" : ` ${formatValue(check.expected)}`}`,
				});
			new Setting(card).addButton((button) =>
				button
					.setButtonText("Remove custom watch")
					.onClick(async () => {
						this.host.settings.watchedPlugins =
							this.host.settings.watchedPlugins.filter(
								(candidate) => candidate !== watch,
							);
						await this.host.saveSettings();
						this.update();
					}),
			);
		}
		new Setting(container)
			.addButton((button) =>
				button
					.setButtonText("Add watched setting")
					.setCta()
					.onClick(() =>
						new AddWatchModal(this.app, (watch) =>
							this.saveWatch(watch),
						).open(),
					),
			)
			.addButton((button) =>
				button
					.setButtonText("Import Community Install Manager profile")
					.onClick(() => this.importCommunityProfile()),
			);
	}
}
