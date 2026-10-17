import {
	App,
	FuzzySuggestModal,
	getIconIds,
	Modal,
	Notice,
	Setting,
	TFile,
	TFolder,
	setIcon,
} from "obsidian";
import type { FuzzyMatch, TextComponent } from "obsidian";
import { cachedFrontmatter, frontmatterRecord } from "./frontmatter";
import type { BookPanelMetadata, BookRecord } from "./types";

export const DEFAULT_PANEL: BookPanelMetadata = {
	icon: "lucide:book-open",
	accent: "#0ea5e9",
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const LUCIDE_ICON = /^lucide:[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeAccent(value: unknown): string | null {
	return typeof value === "string" && HEX_COLOR.test(value.trim())
		? value.trim().toLowerCase()
		: null;
}

export function normalizeIcon(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim();
	return LUCIDE_ICON.test(normalized) ? normalized : null;
}

function ownRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

export function panelFromFrontmatter(frontmatter: unknown): BookPanelMetadata {
	const record = ownRecord(frontmatter);
	const panel = ownRecord(record?.panel);
	return {
		icon: normalizeIcon(panel?.icon) ?? DEFAULT_PANEL.icon,
		accent: normalizeAccent(panel?.accent) ?? DEFAULT_PANEL.accent,
	};
}

export function bookIdForPath(path: string): string | null {
	const [first, second] = path.split("/");
	return first && second ? first : null;
}

function displayTitle(app: App, index: TFile, fallback: string): string {
	const title = cachedFrontmatter(app, index).title;
	return typeof title === "string" && title.trim() ? title.trim() : fallback;
}

export function collectBooks(app: App): BookRecord[] {
	return app.vault
		.getRoot()
		.children.filter(
			(child): child is TFolder =>
				child instanceof TFolder && child.name !== "templates",
		)
		.map((folder) => {
			const index = app.vault.getAbstractFileByPath(
				`${folder.path}/index.md`,
			);
			if (!(index instanceof TFile)) return null;
			return {
				id: folder.path,
				name: displayTitle(app, index, folder.name),
				folderPath: folder.path,
				indexPath: index.path,
				panel: panelFromFrontmatter(cachedFrontmatter(app, index)),
			};
		})
		.filter((book): book is BookRecord => book !== null)
		.sort((left, right) => left.name.localeCompare(right.name));
}

export async function saveBookPanel(
	app: App,
	book: BookRecord,
	panel: BookPanelMetadata,
): Promise<void> {
	const accent = normalizeAccent(panel.accent);
	const icon = normalizeIcon(panel.icon);
	if (!accent || !icon)
		throw new Error("Use a six-digit hex accent and lucide:<name> icon");
	const file = app.vault.getAbstractFileByPath(book.indexPath);
	if (!(file instanceof TFile))
		throw new Error(`Missing book index: ${book.indexPath}`);
	await app.fileManager.processFrontMatter(file, (value: unknown) => {
		const frontmatter = frontmatterRecord(value);
		frontmatter.panel = { icon, accent };
	});
}

export class BookAppearanceModal extends Modal {
	constructor(
		app: App,
		private readonly book: BookRecord,
		private readonly onSaved: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(`Book appearance — ${this.book.name}`);
		let accent = this.book.panel.accent;
		let icon = this.book.panel.icon;
		let accentInput: TextComponent | null = null;
		let iconInput: TextComponent | null = null;
		let preview: HTMLElement | null = null;
		let previewIcon: HTMLElement | null = null;
		const refreshPreview = (): void => {
			if (!preview || !previewIcon) return;
			previewIcon.empty();
			setIcon(previewIcon, icon.replace(/^lucide:/, ""));
			preview.style.setProperty("--root-books-accent", accent);
		};

		new Setting(this.contentEl)
			.setName("Accent color")
			.setDesc("Stored as a direct hexadecimal value in panel.accent.")
			.addColorPicker((picker) =>
				picker.setValue(accent).onChange((value) => {
					accent = value;
					accentInput?.setValue(value);
					refreshPreview();
				}),
			)
			.addText((text) => {
				accentInput = text;
				text.setValue(accent).onChange((value) => {
					accent = value.trim();
					refreshPreview();
				});
			});

		new Setting(this.contentEl)
			.setName("Lucide icon")
			.setDesc(
				"Choose from Obsidian's bundled icons or enter the shared form lucide:book-open.",
			)
			.addText((text) => {
				iconInput = text;
				text.setValue(icon).onChange((value) => {
					icon = value.trim();
					refreshPreview();
				});
			})
			.addButton((button) =>
				button.setButtonText("Browse icons").onClick(() => {
					new LucideIconPickerModal(this.app, (selected) => {
						icon = selected;
						iconInput?.setValue(selected);
						refreshPreview();
					}).open();
				}),
			);

		preview = this.contentEl.createDiv({
			cls: "root-books-panel-preview",
		});
		previewIcon = preview.createSpan();
		preview.createSpan({ text: this.book.name });
		refreshPreview();

		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText("Save appearance")
				.setCta()
				.onClick(async () => {
					try {
						await saveBookPanel(this.app, this.book, {
							accent,
							icon,
						});
						this.onSaved();
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

function bundledLucideIcons(): string[] {
	return [
		...new Set(
			getIconIds()
				.map(String)
				.map((id) => id.replace(/^lucide[:-]/, ""))
				.filter((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
				.map((id) => `lucide:${id}`),
		),
	].sort((left, right) => left.localeCompare(right));
}

class LucideIconPickerModal extends FuzzySuggestModal<string> {
	private readonly icons = bundledLucideIcons();

	constructor(
		app: App,
		private readonly onChoose: (icon: string) => void,
	) {
		super(app);
		this.setPlaceholder("Search Obsidian's bundled Lucide icons");
	}

	getItems(): string[] {
		return this.icons;
	}

	getItemText(icon: string): string {
		return icon.replace(/^lucide:/, "");
	}

	renderSuggestion(match: FuzzyMatch<string>, element: HTMLElement): void {
		const row = element.createDiv({ cls: "root-books-icon-suggestion" });
		const icon = row.createSpan({
			cls: "root-books-icon-suggestion-glyph",
		});
		setIcon(icon, this.getItemText(match.item));
		row.createSpan({ text: match.item });
	}

	onChooseItem(icon: string): void {
		this.onChoose(icon);
	}
}

export class BookPickerModal extends FuzzySuggestModal<BookRecord> {
	constructor(
		app: App,
		private readonly books: BookRecord[],
		private readonly onChoose: (book: BookRecord) => void,
	) {
		super(app);
		this.setPlaceholder("Choose a book");
	}

	getItems(): BookRecord[] {
		return this.books;
	}

	getItemText(book: BookRecord): string {
		return book.name;
	}

	onChooseItem(book: BookRecord): void {
		this.onChoose(book);
	}
}
