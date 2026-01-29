import { App, ButtonComponent, TextAreaComponent } from "obsidian";
import { MemoItem } from "../types";
import { MemoService } from "../services/memoService";
import { extractTagsFromContent } from "../utils/file";

export interface InlineMemoEditorOptions {
    app: App;
    memoService: MemoService;
    memo: MemoItem;
    onSubmit: (memo: MemoItem) => void;
    onCancel: () => void;
}

export class InlineMemoEditor {
    private app: App;
    private memoService: MemoService;
    private memo: MemoItem;
    private containerEl: HTMLElement;
    private textArea: TextAreaComponent;
    private onSubmitCallback: (memo: MemoItem) => void;
    private onCancelCallback: () => void;
    private tagPreviewEl: HTMLElement;
    
    constructor(options: InlineMemoEditorOptions) {
        this.app = options.app;
        this.memoService = options.memoService;
        this.memo = options.memo;
        this.onSubmitCallback = options.onSubmit;
        this.onCancelCallback = options.onCancel;
        
        this.containerEl = document.createElement('div');
        this.containerEl.className = 'minder-inline-editor';
    }
    
    /**
     * 渲染内联编辑器
     * @param parentEl 父元素
     * @returns 编辑器元素
     */
    render(parentEl: HTMLElement): HTMLElement {
        this.containerEl.empty();
        parentEl.appendChild(this.containerEl);
        
        // 编辑区域
        const editorContainer = this.containerEl.createDiv({ cls: 'minder-inline-editor-container' });
        
        // 文本输入区
        this.textArea = new TextAreaComponent(editorContainer);
        this.textArea
            .setPlaceholder('开始你的想法...')
            .setValue(this.memo.content)
            .onChange(() => {
                this.previewTags();
                this.adjustTextareaHeight();
            });
        
        this.textArea.inputEl.className = 'minder-inline-editor-textarea';
        this.textArea.inputEl.focus();
        
        // 设置自动调整高度的事件
        this.setupAutoResize();
        
        // 底部工具栏区域（包含标签预览和按钮）
        const bottomBarEl = this.containerEl.createDiv({ cls: 'minder-inline-editor-bottom-bar' });
        
        // 标签预览区域
        this.tagPreviewEl = bottomBarEl.createDiv({ cls: 'minder-tag-preview' });
        
        // 操作按钮区域
        const buttonContainer = bottomBarEl.createDiv({ cls: 'minder-inline-editor-buttons' });
        
        // 取消按钮
        const cancelButton = new ButtonComponent(buttonContainer);
        cancelButton
            .setButtonText('取消')
            .onClick(() => {
                // 取消编辑，不保存任何更改
                this.onCancelCallback();
            });
        
        // 提交按钮
        const submitButton = new ButtonComponent(buttonContainer);
        submitButton
            .setButtonText('保存')
            .setCta()
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
        
        try {
            // 更新现有笔记
            const updated = await this.memoService.updateMemo(this.memo.id, content);
            if (updated) {
                // 触发回调
                this.onSubmitCallback(updated);
            } else {
                throw new Error('更新笔记失败');
            }
        } catch (error) {
            console.error('保存笔记时出错:', error);
            // 可以在这里添加错误通知
        }
    }
    
    /**
     * 获取内容
     */
    getContent(): string {
        return this.textArea ? this.textArea.getValue() : '';
    }
    
    /**
     * 聚焦到编辑器
     */
    focus(): void {
        if (this.textArea && this.textArea.inputEl) {
            this.textArea.inputEl.focus();
        }
    }
} 