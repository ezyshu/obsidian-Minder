import {
	App,
	Component,
	MarkdownRenderer,
	Menu,
	MenuItem,
	Modal,
	Notice,
	setIcon,
} from "obsidian";
import { MemoItem as MemoItemInterface } from "../types";
import { MemoService } from "../services/memoService";
import { formatDate, getRelativeTimeString } from "../utils/date";
import { InlineMemoEditor } from "./InlineMemoEditor";

export interface MemoItemComponentOptions {
	app: App;
	memo: MemoItemInterface;
	memoService: MemoService;
	dateFormat: string;
	showTimestamp: boolean;
	onEdit?: (memo: MemoItemInterface) => void;
	onDelete?: (memo: MemoItemInterface) => void;
	onClick?: (memo: MemoItemInterface) => void;
	onUpdate?: (memo: MemoItemInterface) => void; // 新增：当笔记更新时的回调
	component?: Component; // 用于Markdown渲染的组件引用
}

export class MemoItemComponent {
	private app: App;
	private memo: MemoItemInterface;
	private memoService: MemoService;
	private containerEl: HTMLElement;
	private contentEl: HTMLElement;
	private dateFormat: string;
	private showTimestamp: boolean;
	private onEditCallback: (memo: MemoItemInterface) => void;
	private onDeleteCallback: (memo: MemoItemInterface) => void;
	private onClickCallback: (memo: MemoItemInterface) => void;
	private onUpdateCallback: (memo: MemoItemInterface) => void; // 新增：当笔记更新时的回调
	private component: Component | null;
	private isEditing: boolean;
	private inlineEditor: InlineMemoEditor | null = null;

	constructor(options: MemoItemComponentOptions) {
		this.app = options.app;
		this.memo = options.memo;
		this.memoService = options.memoService;
		this.dateFormat = options.dateFormat;
		this.showTimestamp = options.showTimestamp;
		this.onEditCallback = options.onEdit || (() => {});
		this.onDeleteCallback = options.onDelete || (() => {});
		this.onClickCallback = options.onClick || (() => {});
		this.onUpdateCallback = options.onUpdate || (() => {}); // 新增：当笔记更新时的回调
		this.component = options.component || null;
		this.isEditing = false;

		this.containerEl = document.createElement("div");
		this.containerEl.className = "minder-memo-item";
		this.containerEl.dataset.id = this.memo.id;
	}

	/**
	 * 渲染笔记项
	 * @param parentEl 父元素
	 * @returns 笔记项元素
	 */
	render(parentEl: HTMLElement): HTMLElement {
		this.containerEl.empty();
		parentEl.appendChild(this.containerEl);

		// 添加编辑中的样式
		if (this.isEditing) {
			this.containerEl.classList.add("minder-memo-editing");
		} else {
			this.containerEl.classList.remove("minder-memo-editing");
		}

		// 笔记头部（时间和操作）
		const headerEl = this.containerEl.createDiv({
			cls: "minder-memo-header",
		});

		// 时间显示
		if (this.showTimestamp) {
			const timeEl = headerEl.createDiv({ cls: "minder-memo-time" });
			timeEl.setText(
				getRelativeTimeString(this.memo.createdAt, this.dateFormat)
			);
			timeEl.setAttribute(
				"title",
				formatDate(this.memo.createdAt, this.dateFormat)
			);
		}

		// 操作按钮
		const actionsEl = headerEl.createDiv({ cls: "minder-memo-actions" });

		// 编辑标记
		if (this.isEditing) {
			const editingBadgeEl = actionsEl.createDiv({
				cls: "minder-memo-editing-badge",
			});
			editingBadgeEl.setText("编辑中");
		}

		// 更多按钮
		const moreButtonEl = actionsEl.createDiv({
			cls: "minder-memo-action-button",
		});
		setIcon(moreButtonEl, "more-horizontal");
		moreButtonEl.addEventListener("click", (event) => {
			this.showActionsMenu(moreButtonEl, event);
			event.stopPropagation();
		});

		// 内容区域
		this.contentEl = this.containerEl.createDiv({
			cls: "minder-memo-content",
		});
		
		// 如果处于编辑状态，渲染内联编辑器
		if (this.isEditing) {
			this.renderInlineEditor();
		} else {
			this.renderContent(this.contentEl);
		}

		// 标签区域
		if (this.memo.tags.length > 0) {
			const tagsEl = this.containerEl.createDiv({
				cls: "minder-memo-tags",
			});

			this.memo.tags.forEach((tag) => {
				const tagEl = tagsEl.createSpan({ cls: "minder-memo-tag" });
				tagEl.setText("#" + tag);
				tagEl.addEventListener("click", (event) => {
					// 可以在这里添加标签点击回调
					event.stopPropagation();
				});
			});
		}

		// 点击整个笔记项 (仅在非编辑状态下)
		if (!this.isEditing) {
		this.containerEl.addEventListener("click", () => {
			this.onClickCallback(this.memo);
		});

		// 添加双击事件监听器，触发编辑功能
		this.containerEl.addEventListener("dblclick", (event) => {
				this.startInlineEditing();
			event.stopPropagation();
		});
		}

		return this.containerEl;
	}

	/**
	 * 渲染笔记内容
	 * @param containerEl 容器元素
	 */
	private renderContent(containerEl: HTMLElement): void {
		containerEl.empty();

		try {
			// 使用Obsidian的Markdown渲染器渲染内容，传递组件参数以避免内存泄漏
			if (this.component) {
				// 获取源文件路径，用于正确解析内部链接
				const sourcePath = this.memo.linkedFile?.path || "";

				MarkdownRenderer.renderMarkdown(
					this.memo.content,
					containerEl,
					sourcePath,
					this.component
				);

				// 为内部链接添加点击事件处理
				this.setupInternalLinkHandler(containerEl);
			} else {
				// 如果没有有效的组件引用，使用简单的文本渲染
				const contentP = containerEl.createEl("p");
				contentP.textContent = this.memo.content;
			}
		} catch (error) {
			console.error("渲染Markdown内容失败:", error);
			const errorP = containerEl.createEl("p");
			errorP.textContent = this.memo.content;
		}
	}

	/**
	 * 为内部链接设置点击事件处理
	 * @param containerEl 容器元素
	 */
	private setupInternalLinkHandler(containerEl: HTMLElement): void {
		const internalLinks = containerEl.querySelectorAll("a.internal-link");

		internalLinks.forEach((link) => {
			link.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();

				const linkEl = event.currentTarget as HTMLAnchorElement;
				const linkText = linkEl.getAttribute("data-href") || linkEl.getAttribute("href") || linkEl.textContent || "";

				// 使用 Obsidian 的 API 打开链接
				this.app.workspace.openLinkText(linkText, this.memo.linkedFile?.path || "", false);
			});
		});
	}
	
	/**
	 * 渲染内联编辑器
	 */
	private renderInlineEditor(): void {
		if (!this.contentEl) return;
		
		this.contentEl.empty();
		
		this.inlineEditor = new InlineMemoEditor({
			app: this.app,
			memoService: this.memoService,
			memo: this.memo,
			onSubmit: (updatedMemo) => {
				// 先更新数据
				this.memo = updatedMemo;
				// 然后设置状态
				this.setEditingState(false);
				
				// 只重新渲染内容和标签，不移动整个笔记的位置
				this.renderContent(this.contentEl);
				this.updateTagsSection();
				
				// 调用更新回调
				this.onUpdateCallback(updatedMemo);
			},
			onCancel: () => {
				// 直接设置状态为非编辑，不保存任何更改
				this.setEditingState(false);
				
				// 只重新渲染内容和标签，不移动整个笔记的位置
				this.renderContent(this.contentEl);
				this.updateTagsSection();
			}
		});
		
		this.inlineEditor.render(this.contentEl);
		
		// 确保编辑器获得焦点
		if (this.inlineEditor) {
			setTimeout(() => {
				this.inlineEditor?.focus();
			}, 10);
		}
	}
	
	/**
	 * 更新标签区域
	 */
	private updateTagsSection(): void {
		// 找到现有的标签区域
		const existingTagsEl = this.containerEl.querySelector('.minder-memo-tags');
		
		// 如果有标签且没有标签区域，添加标签区域
		if (this.memo.tags.length > 0) {
			// 如果已有标签区域，清空并重新填充
			if (existingTagsEl) {
				existingTagsEl.empty();
				
				// 添加新标签
				this.memo.tags.forEach((tag) => {
					const tagEl = existingTagsEl.createSpan({ cls: "minder-memo-tag" });
					tagEl.setText("#" + tag);
					tagEl.addEventListener("click", (event) => {
						event.stopPropagation();
					});
				});
			} 
			// 如果没有标签区域但有标签，创建新的标签区域
			else {
				const tagsEl = this.containerEl.createDiv({
					cls: "minder-memo-tags",
				});
	
				this.memo.tags.forEach((tag) => {
					const tagEl = tagsEl.createSpan({ cls: "minder-memo-tag" });
					tagEl.setText("#" + tag);
					tagEl.addEventListener("click", (event) => {
						event.stopPropagation();
					});
				});
			}
		} 
		// 如果没有标签但有标签区域，移除标签区域
		else if (existingTagsEl) {
			existingTagsEl.remove();
		}
	}
	
	/**
	 * 开始内联编辑
	 */
	private startInlineEditing(): void {
		// 首先通知父组件，这将触发保存其他正在编辑的笔记
		this.onEditCallback(this.memo);
		
		// 设置编辑状态
		this.setEditingState(true);
		
		// 直接渲染内联编辑器，而不是重新渲染整个组件
		this.renderInlineEditor();
	}

	/**
	 * 显示操作菜单
	 * @param targetEl 触发菜单的元素
	 * @param event 事件对象
	 */
	private showActionsMenu(targetEl: HTMLElement, event: MouseEvent): void {
		const menu = new Menu();

		// 编辑菜单项
		menu.addItem((item) => {
			item.setTitle("编辑")
				.setIcon("pencil")
				.onClick(() => {
					this.startInlineEditing();
				});
		});

		// 删除菜单项
		menu.addItem((item) => {
			const itemDom = item.setTitle("删除")
				.setIcon("trash")
				.onClick(() => {
					// 显示删除确认对话框
					this.showDeleteConfirmation();
				});
			
			// 设置删除文字为红色
			const titleEl = (itemDom as any).titleEl;
			if (titleEl) {
				titleEl.style.color = "var(--text-error)";
			}
			
			// 设置删除图标为红色
			const iconEl = (itemDom as any).iconEl;
			if (iconEl) {
				iconEl.style.color = "var(--text-error)";
			}
		});

		// 进入源文件菜单项
		if (this.memo.linkedFile) {
			menu.addItem((item) => {
				item.setTitle("进入源文件")
					.setIcon("file-text")
					.onClick(() => {
						this.app.workspace
							.getLeaf()
							.openFile(this.memo.linkedFile!);
					});
			});
		}

		menu.showAtMouseEvent(event);
	}

	/**
	 * 更新笔记数据
	 * @param memo 新的笔记数据
	 */
	update(memo: MemoItemInterface): void {
		this.memo = memo;

		const parentEl = this.containerEl.parentElement;
		if (parentEl) {
			this.render(parentEl);
		}
	}

	/**
	 * 设置编辑状态
	 * @param isEditing 是否正在编辑
	 */
	setEditingState(isEditing: boolean): void {
		this.isEditing = isEditing;

		if (this.containerEl) {
			if (isEditing) {
				this.containerEl.classList.add("minder-memo-editing");
			} else {
				this.containerEl.classList.remove("minder-memo-editing");
				this.inlineEditor = null;
			}
		}
	}
	
	/**
	 * 保存当前编辑内容
	 * 如果当前处于编辑状态，则保存更改
	 */
	async saveCurrentEdit(): Promise<void> {
		// 如果不在编辑状态或没有内联编辑器，则不执行任何操作
		if (!this.isEditing || !this.inlineEditor) {
			return;
		}
		
		try {
			// 获取当前编辑器的内容
			const content = this.inlineEditor.getContent();
			
			// 如果内容为空或未更改，则不保存
			if (!content.trim() || content === this.memo.content) {
				this.setEditingState(false);
				// 只重新渲染内容和标签，不移动整个笔记的位置
				this.renderContent(this.contentEl);
				this.updateTagsSection();
				return;
			}
			
			// 调用服务更新笔记
			const updatedMemo = await this.memoService.updateMemo(this.memo.id, content);
			if (updatedMemo) {
				// 更新本地数据
				this.memo = updatedMemo;
				// 设置为非编辑状态
				this.setEditingState(false);
				
				// 只重新渲染内容和标签，不移动整个笔记的位置
				this.renderContent(this.contentEl);
				this.updateTagsSection();
				
				// 调用更新回调
				this.onUpdateCallback(updatedMemo);
			}
		} catch (error) {
			console.error("保存笔记时出错:", error);
			// 出错时，仍然退出编辑模式，但保留原内容
			this.setEditingState(false);
			
			// 只重新渲染内容，不移动整个笔记的位置
			this.renderContent(this.contentEl);
		}
	}
	
	/**
	 * 显示删除确认对话框
	 */
	private showDeleteConfirmation(): void {
		// 创建确认对话框
		const confirmModal = new Modal(this.app);
		confirmModal.titleEl.setText("确认删除");
		
		// 设置对话框内容
		const contentEl = confirmModal.contentEl;
		contentEl.empty();
		
		const messageEl = contentEl.createDiv();
		messageEl.setText("确定要删除这条笔记吗？此操作不可撤销。");
		messageEl.style.marginBottom = "20px";
		
		// 添加预览内容
		const previewEl = contentEl.createDiv({ cls: "minder-delete-preview" });
		previewEl.style.padding = "10px";
		previewEl.style.background = "var(--background-secondary)";
		previewEl.style.borderRadius = "5px";
		previewEl.style.marginBottom = "20px";
		previewEl.style.maxHeight = "100px";
		previewEl.style.overflow = "auto";
		
		// 截取内容的前50个字符作为预览
		const previewContent = this.memo.content.length > 50 
			? this.memo.content.substring(0, 50) + "..." 
			: this.memo.content;
		
		previewEl.setText(previewContent);
		
		// 按钮容器
		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.gap = "10px";
		
		// 取消按钮
		const cancelButton = buttonContainer.createEl("button");
		cancelButton.setText("取消");
		cancelButton.addEventListener("click", () => {
			confirmModal.close();
		});
		
		// 确认删除按钮
		const confirmButton = buttonContainer.createEl("button");
		confirmButton.setText("删除");
		confirmButton.classList.add("mod-warning");
		confirmButton.addEventListener("click", () => {
			this.onDeleteCallback(this.memo);
			confirmModal.close();
		});
		
		// 打开对话框
		confirmModal.open();
	}

	/**
	 * 获取容器元素
	 * @returns 容器元素
	 */
	getContainerEl(): HTMLElement {
		return this.containerEl;
	}
}
