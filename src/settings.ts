import { App, PluginSettingTab } from "obsidian";
import type { Plugin, Setting, SettingDefinitionItem } from "obsidian";
import {
	auditIntegrations,
	isCoreUniqueNoteCreatorEnabled,
	openCommunityPluginSettings,
} from "./integrations";
import { ECOSYSTEM_VERSION } from "./types";
import type { RootBooksWorkspaceSettings } from "./types";

export interface RootBooksSettingsHost {
	settings: RootBooksWorkspaceSettings;
	saveSettings(): Promise<void>;
	refreshDecorations(): void;
	openAppearancePicker(): void;
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
				desc: `Ecosystem version ${ECOSYSTEM_VERSION}. Companion plugins remain independent; Toolkit only audits their state and never installs, enables, disables, or configures them.`,
				searchable: false,
			},
			{
				type: "group",
				heading: "Integrations",
				items: [
					{
						name: "Companion plugin status",
						desc: "Review installation, enablement, and recommended settings for each companion.",
						render: (setting) => {
							void this.renderIntegrationAudit(setting);
						},
					},
					{
						name: "Manage companion plugins",
						desc: "Use Community Install Manager or configure companions manually. Toolkit only reports differences from its recommended profile.",
						render: (setting) =>
							this.renderIntegrationActions(setting),
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

	private async renderIntegrationAudit(setting: Setting): Promise<void> {
		const list = setting.descEl.createDiv({
			cls: "root-books-integration-list",
		});
		list.setText("Checking companion plugins…");
		const audits = await auditIntegrations(this.app);
		if (!list.isConnected) return;
		list.empty();
		for (const audit of audits) {
			const card = list.createDiv({
				cls: "root-books-integration-card",
			});
			card.createEl("strong", { text: audit.name });
			card.createEl("p", { text: audit.purpose });
			card.createSpan({
				text: !audit.installed
					? "Missing"
					: !audit.enabled
						? "Installed but disabled"
						: audit.configured
							? "Ready"
							: `${audit.issues.length} recommended setting${audit.issues.length === 1 ? "" : "s"} differ`,
			});
			if (audit.issues.length > 0) {
				const issues = card.createEl("ul");
				for (const issue of audit.issues)
					issues.createEl("li", { text: issue });
			}
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
	}

	private renderIntegrationActions(setting: Setting): void {
		setting
			.addButton((button) =>
				button
					.setButtonText("Refresh status")
					.setCta()
					.onClick(() => this.update()),
			)
			.addButton((button) =>
				button
					.setButtonText("Community plugins")
					.onClick(() => openCommunityPluginSettings(this.app)),
			);
	}
}
