import { App, Notice, PluginSettingTab } from "obsidian";
import type { Plugin, Setting, SettingDefinitionItem } from "obsidian";
import {
	auditIntegrations,
	applyRecommendedIntegrations,
	openCommunityPluginSettings,
} from "./integrations";
import { ECOSYSTEM_VERSION } from "./types";
import type { RootBooksWorkspaceSettings } from "./types";

export interface RootBooksSettingsHost {
	settings: RootBooksWorkspaceSettings;
	saveSettings(): Promise<void>;
	reopenSetup(): void;
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
				name: "Root Books Workspace",
				desc: `Ecosystem version ${ECOSYSTEM_VERSION}. Companion plugins remain independent and are never installed automatically.`,
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
						name: "Recommended integration setup",
						desc: "Enables installed companions, applies the listed recommendations, and disables core Unique Note Creator.",
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
	}

	private renderIntegrationActions(setting: Setting): void {
		setting
			.addButton((button) =>
				button
					.setButtonText("Review setup")
					.setCta()
					.onClick(() => this.host.reopenSetup()),
			)
			.addButton((button) =>
				button.setButtonText("Apply now").onClick(async () => {
					const missing = await applyRecommendedIntegrations(
						this.app,
					);
					new Notice(
						missing.length > 0
							? `Applied installed integrations. Still missing: ${missing.join(", ")}`
							: "Recommended integration settings applied.",
						8_000,
					);
					this.update();
				}),
			)
			.addButton((button) =>
				button
					.setButtonText("Community plugins")
					.onClick(() => openCommunityPluginSettings(this.app)),
			);
	}
}
