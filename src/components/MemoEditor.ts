import { App, ButtonComponent, TextAreaComponent, setIcon } from "obsidian";
import { MemoItem } from "../types";
import { MemoService } from "../services/memoService";
import { extractTagsFromContent } from "../utils/file";

export interface MemoEditorOptions {
    app: App;
    memoService: MemoService;
    placeholder?: string;
    onSubmit?: (memo: MemoItem) => void;
    onCancel?: () => void;
    initialContent?: string;
    editingMemo?: MemoItem;
}

export class MemoEditor {
    private app: App;
    private memoService: MemoService;
    private containerEl: HTMLElement;
    private textArea: TextAreaComponent;
    private onSubmitCallback: (memo: MemoItem) => void;
    private onCancelCallback: () => void;
    private initialContent: string;
    private editingMemo: MemoItem | undefined;
    private tagPreviewEl: HTMLElement;
    private cancelButton: ButtonComponent;
    
    constructor(options: MemoEditorOptions) {
        this.app = options.app;
        this.memoService = options.memoService;
        this.onSubmitCallback = options.onSubmit || (() => {});
        this.onCancelCallback = options.onCancel || (() => {});
        this.initialContent = options.initialContent || "";
        this.editingMemo = options.editingMemo;
        
        this.containerEl = document.createElement('div');
        this.containerEl.className = 'minder-editor';
    }
    
    /**
     * 渲染编辑器
     * @param parentEl 父元素
     * @returns 编辑器元素
     */
    render(parentEl: HTMLElement): HTMLElement {
        this.containerEl.empty();
        parentEl.appendChild(this.containerEl);
        
        // 编辑区域
        const editorContainer = this.containerEl.createDiv({ cls: 'minder-editor-container' });
        
        // 文本输入区
        this.textArea = new TextAreaComponent(editorContainer);
        this.textArea
            .setPlaceholder('开始你的想法...')
            .setValue(this.initialContent)
            .onChange(() => {
                this.previewTags();
                this.adjustTextareaHeight();
            });
        
        this.textArea.inputEl.className = 'minder-editor-textarea';
        this.textArea.inputEl.focus();
        
        // 设置自动调整高度的事件
        this.setupAutoResize();
        
        // 底部工具栏区域（包含标签预览和按钮）
        const bottomBarEl = this.containerEl.createDiv({ cls: 'minder-editor-bottom-bar' });
        
        // 标签预览区域
        this.tagPreviewEl = bottomBarEl.createDiv({ cls: 'minder-tag-preview' });
        
        // 操作按钮区域
        const buttonContainer = bottomBarEl.createDiv({ cls: 'minder-editor-buttons' });
        
        // 取消按钮
        this.cancelButton = new ButtonComponent(buttonContainer);
        this.cancelButton
            .setButtonText('取消')
            .onClick(() => {
                this.clear(); // 点击取消时清空内容
                this.onCancelCallback();
            });
        
        // 默认情况下，只有编辑时才显示取消按钮
        const cancelButtonEl = this.cancelButton.buttonEl;
        cancelButtonEl.style.display = this.editingMemo ? 'flex' : 'none';
        
        // 提交按钮
        const submitButton = new ButtonComponent(buttonContainer);
        submitButton
            .setIcon('lucide-send-horizontal')
            .setCta()
            .setTooltip('发送')
            .onClick(() => this.submitMemo());
        
        // 初始化标签预览
        this.previewTags();
        
        // 初始化时调整高度
        this.adjustTextareaHeight();
        
        return this.containerEl;
    }
    
    /**
     * 设置自动调整高度的事件监听
     */
    private setupAutoResize(): void {
        if (!this.textArea || !this.textArea.inputEl) return;
        
        // 输入事件监听
        this.textArea.inputEl.addEventListener('input', () => {
            this.adjustTextareaHeight();
        });
        
        // 窗口大小改变时也调整
        window.addEventListener('resize', () => {
            this.adjustTextareaHeight();
        });
    }
    
    /**
     * 调整文本区域高度
     */
    private adjustTextareaHeight(): void {
        if (!this.textArea || !this.textArea.inputEl) return;
        
        const textareaEl = this.textArea.inputEl;
        
        // 重置高度以获取正确的滚动高度
        textareaEl.style.height = 'auto';
        
        // 设置新高度
        textareaEl.style.height = textareaEl.scrollHeight + 'px';
    }
    
    /**
     * 预览标签
     */
    private previewTags(): void {
        if (!this.tagPreviewEl) return;
        
        this.tagPreviewEl.empty();
        const content = this.textArea.getValue();
        const tags = extractTagsFromContent(content);
        
        if (tags.length > 0) {
            this.tagPreviewEl.createSpan({ text: '标签: ' });
            
            tags.forEach(tag => {
                const tagEl = this.tagPreviewEl.createSpan({ cls: 'minder-tag-preview-item' });
                tagEl.setText(tag);
            });
        }
    }
    
    /**
     * 提交笔记
     */
    private async submitMemo(): Promise<void> {
        const content = this.textArea.getValue();
        if (!content.trim()) return;
        
        let memo: MemoItem;
        
        try {
            if (this.editingMemo) {
                // 更新现有笔记
                const updated = await this.memoService.updateMemo(this.editingMemo.id, content);
                if (updated) {
                    memo = updated;
                } else {
                    throw new Error('更新笔记失败');
                }
            } else {
                // 创建新笔记
                memo = await this.memoService.createMemo(content);
            }
            
            // 完全清空编辑器，包括标签预览
            this.clear();
            
            // 触发回调
            this.onSubmitCallback(memo);
        } catch (error) {
            console.error('保存笔记时出错:', error);
            // 可以在这里添加错误通知
        }
    }
    
    /**
     * 清空编辑器内容
     */
    clear(): void {
        if (this.textArea) {
            this.textArea.setValue('');
            
            // 确保标签预览区域也被清空
            if (this.tagPreviewEl) {
                this.tagPreviewEl.empty();
            }
            
            // 重置编辑状态
            this.editingMemo = undefined;
            
            // 隐藏取消按钮
            if (this.cancelButton) {
                this.cancelButton.buttonEl.style.display = 'none';
            }
            
            // 重置文本区域高度
            this.adjustTextareaHeight();
        }
    }
    
    /**
     * 获取内容
     */
    getContent(): string {
        return this.textArea ? this.textArea.getValue() : '';
    }
    
    /**
     * 设置内容
     * @param content 内容
     */
    setContent(content: string): void {
        if (this.textArea) {
            this.textArea.setValue(content);
            this.previewTags();
            this.adjustTextareaHeight();
        }
    }
    
    /**
     * 进入编辑模式
     * @param memo 要编辑的笔记
     */
    setEditMode(memo: MemoItem): void {
        this.editingMemo = memo;
        this.setContent(memo.content);
        
        // 显示取消按钮
        if (this.cancelButton) {
            this.cancelButton.buttonEl.style.display = 'flex';
        }
    }
} 