import { App, ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { MinderSettings } from "../types";
import { MemoService } from "../services/memoService";
import { TagService } from "../services/tagService";
import { MemoEditor } from "./MemoEditor";
import { MemoItemComponent } from "./MemoItem";
import { TagsBar } from "./TagsBar";
import { MemoItem, ViewType } from "../types";

export const MEMO_VIEW_TYPE = "minder-memo-view";

export class MemoView extends ItemView {
	private settings: MinderSettings;
	private memoService: MemoService;
	private tagService: TagService;
	private memos: MemoItem[] = [];
	private editor: MemoEditor;
	private tagsBar: TagsBar;
	private memoContentEl: HTMLElement;
	private memosContainer: HTMLElement;
	private currentViewType: ViewType = ViewType.ALL;
	private currentTag: string = "";
	private searchText: string = "";
	private currentEditingMemoId: string | null = null;
	private memoComponents: Map<string, MemoItemComponent> = new Map();
	private searchEl: HTMLElement;
	private searchButton: HTMLElement;
	private isSearchVisible: boolean = false;
	private currentPage: number = 1;
	private paginationEl: HTMLElement;

	constructor(leaf: WorkspaceLeaf, settings: MinderSettings) {
		super(leaf);

		this.settings = settings;
		this.memoService = new MemoService(this.app, this.settings.notesFolder);
		this.tagService = new TagService(this.app, this.memoService);
	}

	getViewType(): string {
		return MEMO_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Minder";
	}

	getIcon(): string {
		return "lightbulb";
	}

	async onOpen(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		// 初始化服务
		await this.memoService.initialize();

		// 容器布局
		containerEl.addClass("minder-container");

		// 编辑器区域
		const editorEl = containerEl.createDiv({ cls: "minder-editor-area" });
		this.editor = new MemoEditor({
			app: this.app,
			memoService: this.memoService,
			placeholder: "开始你的想法...",
			onSubmit: async (memo) => {
				// 如果是编辑状态，需要清除编辑标记
				if (this.currentEditingMemoId) {
					// 重置编辑状态
					this.clearEditingState();
				}
				this.currentPage = 1;
				await this.refreshMemos();
				await this.tagsBar?.refresh();
			},
			onCancel: () => {
				// 取消编辑
				this.clearEditingState();
			},
		});
		this.editor.render(editorEl);

		// 顶部操作栏 - 只用于搜索框，默认隐藏
		const topBarEl = containerEl.createDiv({ cls: "minder-top-bar" });

		// 搜索框
		this.searchEl = topBarEl.createDiv({ cls: "minder-search" });
		this.searchEl.style.display = "none"; // 默认隐藏搜索框
		
		const searchInput = this.searchEl.createEl("input", {
			type: "text",
			placeholder: "搜索笔记...",
			cls: "minder-search-input",
		});
		searchInput.addEventListener("input", (e) => {
			this.searchText = (e.target as HTMLInputElement).value;
			this.currentPage = 1;
			this.refreshMemos();
		});
		
		// 监听ESC键关闭搜索框
		searchInput.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				this.hideSearch();
				e.preventDefault();
				e.stopPropagation();
			}
		});

		// 标签栏
		const tagsBarEl = containerEl.createDiv({ cls: "minder-tags-area" });
		
		// 按钮容器
		const buttonsContainer = tagsBarEl.createDiv({ cls: "minder-buttons-container" });
		
		// 刷新按钮
		const refreshButton = buttonsContainer.createDiv({ cls: "minder-refresh-button" });
		setIcon(refreshButton, "refresh-cw");
		refreshButton.setAttribute("aria-label", "刷新笔记");
		refreshButton.addEventListener("click", async () => {
			await this.refreshMemos();
			await this.tagsBar?.refresh();
			new Notice("笔记已刷新");
		});
		
		// 搜索按钮
		this.searchButton = buttonsContainer.createDiv({ cls: "minder-search-button" });
		setIcon(this.searchButton, "search");
		this.searchButton.setAttribute("aria-label", "搜索笔记");
		this.searchButton.addEventListener("click", () => {
			this.toggleSearchVisibility();
		});

		const settingsButton = buttonsContainer.createDiv({ cls: "minder-settings-button" });
		setIcon(settingsButton, "settings");
		settingsButton.setAttribute("aria-label", "打开 Minder 设置");
		settingsButton.addEventListener("click", () => {
			this.openSettings();
		});
		
		this.tagsBar = new TagsBar({
			app: this.app,
			tagService: this.tagService,
			onTagClick: (tagName) => {
				this.currentTag = tagName;
				// 如果点击标签，设置当前视图类型为标签视图
				this.currentViewType = tagName ? ViewType.TAG : ViewType.ALL;
				this.currentPage = 1;
				this.refreshMemos();
			},
		});
		await this.tagsBar.render(tagsBarEl);

		// 内容区域
		this.memoContentEl = containerEl.createDiv({
			cls: "minder-content-area",
		});

		// 笔记容器
		this.memosContainer = this.memoContentEl.createDiv({
			cls: "minder-memos-container",
		});

		this.paginationEl = this.memoContentEl.createDiv({
			cls: "minder-pagination",
		});

		// 初始化加载笔记
		this.refreshMemos();
	}
	
	/**
	 * 显示搜索框
	 */
	private showSearch(): void {
		this.isSearchVisible = true;
		this.searchEl.style.display = "block";
		this.searchButton.classList.add("active");
		
		// 聚焦搜索框
		const searchInput = this.searchEl.querySelector(".minder-search-input") as HTMLInputElement;
		if (searchInput) {
			setTimeout(() => searchInput.focus(), 10);
		}
	}
	
	/**
	 * 隐藏搜索框
	 */
	private hideSearch(): void {
		this.isSearchVisible = false;
		this.searchEl.style.display = "none";
		this.searchButton.classList.remove("active");
		
		// 清空搜索内容
		const searchInput = this.searchEl.querySelector(".minder-search-input") as HTMLInputElement;
		if (searchInput) {
			searchInput.value = "";
			this.searchText = "";
			this.currentPage = 1;
			this.refreshMemos();
		}
	}
	
	/**
	 * 切换搜索框的可见性
	 */
	private toggleSearchVisibility(): void {
		if (this.isSearchVisible) {
			this.hideSearch();
		} else {
			this.showSearch();
		}
	}

	private openSettings(): void {
		const app: any = this.app;
		if (app && app.setting) {
			app.setting.open();
			app.setting.openTabById("obsidian-Minder");
		}
	}

	async onClose(): Promise<void> {
		// 清理工作
	}

	/**
	 * 刷新笔记列表
	 */
	async refreshMemos(): Promise<void> {
		this.memosContainer.empty();
		this.memoComponents.clear();

		try {
			// 根据当前视图类型获取笔记
			switch (this.currentViewType) {
				case ViewType.TAG:
					if (this.currentTag) {
						this.memos = await this.memoService.searchMemos({
							tags: [this.currentTag],
							text: this.searchText,
						});
					} else {
						this.memos = await this.memoService.getAllMemos(
							undefined,
							this.settings.defaultSort
						);
					}
					break;

				case ViewType.ALL:
				default:
					if (this.searchText) {
						this.memos = await this.memoService.searchMemos({
							text: this.searchText,
						});
					} else {
						this.memos = await this.memoService.getAllMemos(
							undefined,
							this.settings.defaultSort
						);
					}
					break;
			}

			const pageSize = this.settings.displayCount;
			let pagedMemos = this.memos;
			let totalPages = 1;

			if (pageSize && pageSize > 0 && this.memos.length > pageSize) {
				totalPages = Math.max(1, Math.ceil(this.memos.length / pageSize));
				if (this.currentPage > totalPages) {
					this.currentPage = totalPages;
				}
				const startIndex = (this.currentPage - 1) * pageSize;
				const endIndex = startIndex + pageSize;
				pagedMemos = this.memos.slice(startIndex, endIndex);
			} else {
				this.currentPage = 1;
				totalPages = 1;
			}

			// 渲染笔记
			for (const memo of pagedMemos) {
				const memoItemComponent = new MemoItemComponent({
					app: this.app,
					memo,
					memoService: this.memoService,
					dateFormat: this.settings.dateFormat,
					showTimestamp: true, // 总是显示时间戳
					onEdit: (memo) => this.editMemo(memo),
					onDelete: (memo) => this.deleteMemo(memo),
					onUpdate: async (memo) => {
						// 当笔记内容更新后，刷新标签栏
						await this.tagsBar?.refresh();
						
						// 如果当前是标签视图，且笔记的标签发生了变化，可能需要重新加载笔记列表
						if (this.currentViewType === ViewType.TAG && this.currentTag) {
							// 检查更新后的笔记是否包含当前标签
							const hasCurrentTag = memo.tags.includes(this.currentTag);
							
							// 如果不包含当前标签，则需要重新加载笔记列表
							if (!hasCurrentTag) {
								await this.refreshMemos();
							}
						}
					},
					component: this, // 传递当前View组件给MemoItemComponent
				});

				memoItemComponent.render(this.memosContainer);

				// 存储组件引用
				this.memoComponents.set(memo.id, memoItemComponent);

				// 如果是正在编辑的笔记，标记状态
				if (this.currentEditingMemoId === memo.id) {
					memoItemComponent.setEditingState(true);
				}
			}

			this.renderPagination(this.memos.length, totalPages);

			// 显示无结果提示
			if (this.memos.length === 0) {
				const emptyEl = this.memosContainer.createDiv({
					cls: "minder-empty-state",
				});
				emptyEl.setText("暂无笔记");
			}
		} catch (error) {
			console.error("加载笔记失败", error);
			new Notice("加载笔记失败");
		}
	}

	private renderPagination(totalMemos: number, totalPages: number): void {
		if (!this.paginationEl) {
			return;
		}

		this.paginationEl.empty();

		const pageSize = this.settings.displayCount;

		if (!pageSize || pageSize <= 0 || totalMemos <= pageSize) {
			this.paginationEl.style.display = "none";
			return;
		}

		this.paginationEl.style.display = "flex";

		const infoEl = this.paginationEl.createDiv({
			cls: "minder-pagination-info",
		});
		infoEl.setText(
			`第 ${this.currentPage} / ${totalPages} 页 · 共 ${totalMemos} 条笔记`
		);

		const controlsEl = this.paginationEl.createDiv({
			cls: "minder-pagination-controls",
		});

		const prevButton = controlsEl.createDiv({
			cls: "minder-pagination-button",
		});
		prevButton.setText("上一页");
		if (this.currentPage <= 1) {
			prevButton.addClass("disabled");
		} else {
			prevButton.addEventListener("click", () => {
				if (this.currentPage > 1) {
					this.currentPage -= 1;
					this.refreshMemos();
				}
			});
		}

		const nextButton = controlsEl.createDiv({
			cls: "minder-pagination-button",
		});
		nextButton.setText("下一页");
		if (this.currentPage >= totalPages) {
			nextButton.addClass("disabled");
		} else {
			nextButton.addEventListener("click", () => {
				if (this.currentPage < totalPages) {
					this.currentPage += 1;
					this.refreshMemos();
				}
			});
		}
	}

	/**
	 * 编辑笔记
	 * @param memo 笔记
	 */
	editMemo(memo: MemoItem): void {
		// 如果当前正在编辑其他笔记，先保存其更改
		if (this.currentEditingMemoId && this.currentEditingMemoId !== memo.id) {
			// 获取当前正在编辑的笔记组件
			const currentEditingMemoComponent = this.memoComponents.get(this.currentEditingMemoId);
			if (currentEditingMemoComponent) {
				// 获取内联编辑器实例并触发保存操作
				currentEditingMemoComponent.saveCurrentEdit();
			}
		}

		// 清除之前的编辑状态标记
		this.clearEditingState();

		// 设置新的编辑状态
		this.currentEditingMemoId = memo.id;

		// 标记当前笔记为编辑状态
		const memoComponent = this.memoComponents.get(memo.id);
		if (memoComponent) {
			memoComponent.setEditingState(true);
			
			// 确保笔记在视野中
			const memoEl = memoComponent.getContainerEl();
			if (memoEl) {
				// 使用更平滑的滚动，不改变位置
				memoEl.scrollIntoView({
			behavior: "smooth",
					block: "nearest" // 只在需要时滚动
		});
			}
		}
	}

	/**
	 * 删除笔记
	 * @param memo 笔记
	 */
	async deleteMemo(memo: MemoItem): Promise<void> {
		try {
			// 如果正在编辑，先清除编辑状态
			if (this.currentEditingMemoId === memo.id) {
				this.clearEditingState();
			}

			await this.memoService.deleteMemo(memo.id);
			await this.refreshMemos();
			await this.tagsBar.refresh();
			new Notice("笔记已删除");
		} catch (error) {
			console.error("删除笔记失败", error);
			new Notice("删除笔记失败");
		}
	}

	/**
	 * 清除编辑状态
	 */
	clearEditingState(): void {
		if (this.currentEditingMemoId) {
			// 移除之前笔记的编辑状态
			const prevMemoComponent = this.memoComponents.get(
				this.currentEditingMemoId
			);
			if (prevMemoComponent) {
				prevMemoComponent.setEditingState(false);
			}

			// 重置编辑ID
			this.currentEditingMemoId = null;
		}
	}

	/**
	 * 聚焦到编辑器
	 */
	focusEditor(): void {
		if (this.editor) {
			// 滚动到编辑器
			this.containerEl
				.querySelector(".minder-editor-area")
				?.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});

			// 尝试聚焦到文本区域
			const textAreaEl = this.containerEl.querySelector(
				".minder-editor-textarea"
			) as HTMLTextAreaElement;
			if (textAreaEl) {
				textAreaEl.focus();
			}
		}
	}
}
