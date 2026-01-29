import { App, PluginSettingTab, Setting } from 'obsidian';
import { MinderSettings } from './types';

export const DEFAULT_SETTINGS: MinderSettings = {
    notesFolder: 'minder',
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
    displayCount: 50,
    defaultSort: 'createTime',
    openOnStartup: false,
};

export class MinderSettingTab extends PluginSettingTab {
    plugin: any;

    constructor(app: App, plugin: any) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Minder 设置' });

        new Setting(containerEl)
            .setName('笔记存储路径')
            .setDesc('指定保存笔记的文件夹路径')
            .addText(text => text
                .setPlaceholder('例如: minder')
                .setValue(this.plugin.settings.notesFolder)
                .onChange(async (value) => {
                    this.plugin.settings.notesFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('日期格式')
            .setDesc('笔记的日期显示格式')
            .addText(text => text
                .setPlaceholder('YYYY-MM-DD HH:mm:ss')
                .setValue(this.plugin.settings.dateFormat)
                .onChange(async (value) => {
                    this.plugin.settings.dateFormat = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('显示数量')
            .setDesc('每页显示笔记数量（做分页用）')
            .addText(text => text
                .setPlaceholder('50')
                .setValue(String(this.plugin.settings.displayCount))
                .onChange(async (value) => {
                    const numValue = Number(value);
                    if (!isNaN(numValue) && numValue > 0) {
                        this.plugin.settings.displayCount = numValue;
                        await this.plugin.saveSettings();
                    }
                }));
        
        new Setting(containerEl)
            .setName('默认排序')
            .setDesc('笔记的默认排序方式')
            .addDropdown(dropdown => dropdown
                .addOption('createTime', '按创建时间排序')
                .addOption('updateTime', '按编辑时间排序')
                .setValue(this.plugin.settings.defaultSort)
                .onChange(async (value: 'createTime' | 'updateTime') => {
                    this.plugin.settings.defaultSort = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('软件启动时打开插件')
            .setDesc('Obsidian启动时自动打开Minder插件')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.openOnStartup)
                .onChange(async (value) => {
                    this.plugin.settings.openOnStartup = value;
                    await this.plugin.saveSettings();
                }));
    }
} 