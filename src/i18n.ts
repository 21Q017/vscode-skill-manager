/**
 * Internationalization module. Auto-detects VSCode language,
 * falls back to English. Supports 'en' and 'zh-cn'.
 */

export type LangKey = 'en' | 'zh-cn';

const messages: Record<LangKey, Record<string, string>> = {
    en: {
        // Status bar
        'status.skills': 'Skills: {0}',
        'status.active': 'Active: {0}/{1}',
        'status.tooltip': '**Skills**: {0} installed, {1} active\n\nDirectory: `{2}`\n\nClick to reveal.',

        // Tree view
        'tree.installed': 'Installed Skills',
        'tree.nameMismatch': '⚠ name mismatch',
        'tree.invalid': '(invalid SKILL.md: {0})',
        'tree.enabled': '✓ enabled',
        'tree.disabled': '○ disabled',

        // Welcome
        'welcome.empty': 'No skills installed yet.\n\nSkills install to `.github/skills/` in your workspace by default.\n\n[Upload Skill Package](command:skillManager.uploadSkill)\n[Install from Folder](command:skillManager.installFromFolder)\n[Set Install Directory](command:skillManager.setInstallDir)\n\nTip: you can also drag a `.skill` file or a skill folder onto this panel.',

        // Commands & prompts
        'cmd.uploadTitle': 'Select Skill Package(s)',
        'cmd.selectFolder': 'Select Skill Folder (must contain SKILL.md)',
        'cmd.selectInstallDir': 'Select Install Directory',
        'cmd.selectSkillToExport': 'Select a skill to export',
        'cmd.selectSkillToDelete': 'Select a skill to delete',
        'cmd.exportSaveLabel': 'Export Skill Package',
        'cmd.noSkills': 'No skills installed.',

        // Messages
        'msg.installed': 'Skill "{0}" installed successfully.',
        'msg.deleted': 'Skill "{0}" deleted.',
        'msg.exported': 'Exported skill "{0}" to {1}',
        'msg.installDirSet': 'Skill install directory set to: {0}',
        'msg.installFailed': 'Install failed: {0}',
        'msg.exportFailed': 'Export failed: {0}',
        'msg.deleteFailed': 'Failed to delete skill: {0}',
        'msg.invalidPackage': 'Invalid skill package: {0}',
        'msg.noSkillMd': 'No SKILL.md found in {0}',
        'msg.noFile': 'No file provided.',
        'msg.skillMdNotFound': 'SKILL.md not found for this entry.',
        'msg.unsupportedDrop': 'Unsupported drop: {0} (expected .skill, .zip, or a folder).',
        'msg.renameFailed': 'Export succeeded but rename failed: {0}. File is at {1}',
        'msg.exportNoSkillMd': 'Cannot export: no SKILL.md found in {0}',
        'msg.langChanged': 'Language changed. Some texts update after restart.',

        // Overwrite
        'overwrite.skip': 'Skill "{0}" already exists. Installation skipped (overwrite policy: never).',
        'overwrite.prompt': 'A skill named "{0}" is already installed at:\n{1}\n\nOverwrite?',
        'overwrite.btn': 'Overwrite',

        // Delete
        'delete.confirm': 'Delete skill "{0}"? This removes the folder from disk.',
        'delete.btn': 'Delete',

        // Progress
        'progress.installing': 'Installing skill from {0}...',
        'progress.validating': 'Validating package...',
        'progress.extracting': 'Extracting to {0}...',
        'progress.installingFolder': 'Installing skill from folder {0}...',
        'progress.validatingSkillMd': 'Validating SKILL.md...',
        'progress.copying': 'Copying files...',
        'progress.packaging': 'Packaging {0}...',

        // Actions
        'action.openSkillMd': 'Open SKILL.md',
        'action.revealInExplorer': 'Reveal in File Explorer',

        // Skill selection
        'select.title': 'Select Active Skills',
        'select.enabled': 'Skill "{0}" enabled.',
        'select.disabled': 'Skill "{0}" disabled.',
        'select.enableAll': 'All skills enabled.',
        'select.disableAll': 'All skills disabled.',

        // Presets
        'preset.section': 'PRESETS',
        'preset.skills.section': 'ALL SKILLS',
        'preset.active': '⚡ Active',
        'preset.skillCount': '{0} skills',
        'preset.create': 'Create Preset',
        'preset.createPlaceholder': 'Enter a name for the preset',
        'preset.selectSkills': 'Select skills for preset "{0}"',
        'preset.selectIcon': 'Choose an icon for "{0}"',
        'preset.created': 'Preset "{0}" created.',
        'preset.activated': 'Preset "{0}" activated ({1} skills).',
        'preset.deactivated': 'Preset deactivated. Back to manual selection.',
        'preset.deleted': 'Preset "{0}" deleted.',
        'preset.renamed': 'Preset renamed to "{0}".',
        'preset.renamePlaceholder': 'Enter new name',
        'preset.deleteConfirm': 'Delete preset "{0}"?',
        'preset.editSkills': 'Edit skills in "{0}"',
        'preset.updated': 'Preset "{0}" updated.',
        'preset.nameExists': 'A preset named "{0}" already exists.',
        'preset.noPresets': 'No presets yet. Create one first.',
        'preset.selectToApply': 'Select a preset to activate',
        'preset.none': 'No active preset',
    },
    'zh-cn': {
        'status.skills': '技能: {0}',
        'status.active': '已激活: {0}/{1}',
        'status.tooltip': '**技能管理**: 已安装 {0} 个，已激活 {1} 个\n\n目录: `{2}`\n\n点击打开目录。',

        'tree.installed': '已安装技能',
        'tree.nameMismatch': '⚠ 名称不匹配',
        'tree.invalid': '(无效的 SKILL.md: {0})',
        'tree.enabled': '✓ 已启用',
        'tree.disabled': '○ 未启用',

        'welcome.empty': '还没有安装任何技能。\n\n默认安装到工作区的 `.github/skills/` 目录。\n\n[上传技能包](command:skillManager.uploadSkill)\n[从文件夹安装](command:skillManager.installFromFolder)\n[设置安装目录](command:skillManager.setInstallDir)\n\n提示：也可以直接将 `.skill` 文件或文件夹拖到此面板。',

        'cmd.uploadTitle': '选择技能包',
        'cmd.selectFolder': '选择技能文件夹（须包含 SKILL.md）',
        'cmd.selectInstallDir': '选择安装目录',
        'cmd.selectSkillToExport': '选择要导出的技能',
        'cmd.selectSkillToDelete': '选择要删除的技能',
        'cmd.exportSaveLabel': '导出技能包',
        'cmd.noSkills': '还没有安装任何技能。',

        'msg.installed': '技能 "{0}" 安装成功。',
        'msg.deleted': '技能 "{0}" 已删除。',
        'msg.exported': '已将技能 "{0}" 导出到 {1}',
        'msg.installDirSet': '技能安装目录已设为: {0}',
        'msg.installFailed': '安装失败: {0}',
        'msg.exportFailed': '导出失败: {0}',
        'msg.deleteFailed': '删除技能失败: {0}',
        'msg.invalidPackage': '无效的技能包: {0}',
        'msg.noSkillMd': '在 {0} 中未找到 SKILL.md',
        'msg.noFile': '未提供文件。',
        'msg.skillMdNotFound': '找不到此项的 SKILL.md。',
        'msg.unsupportedDrop': '不支持的文件: {0}（需要 .skill、.zip 或文件夹）。',
        'msg.renameFailed': '导出成功但重命名失败: {0}。文件位于 {1}',
        'msg.exportNoSkillMd': '无法导出: {0} 中没有 SKILL.md',
        'msg.langChanged': '语言已切换。部分文本在重启后生效。',

        'overwrite.skip': '技能 "{0}" 已存在，已跳过安装（覆盖策略: 从不）。',
        'overwrite.prompt': '名为 "{0}" 的技能已安装在:\n{1}\n\n是否覆盖？',
        'overwrite.btn': '覆盖',

        'delete.confirm': '删除技能 "{0}"？这将从磁盘上移除该文件夹。',
        'delete.btn': '删除',

        'progress.installing': '正在从 {0} 安装技能…',
        'progress.validating': '正在验证包…',
        'progress.extracting': '正在解压到 {0}…',
        'progress.installingFolder': '正在从文件夹 {0} 安装技能…',
        'progress.validatingSkillMd': '正在验证 SKILL.md…',
        'progress.copying': '正在复制文件…',
        'progress.packaging': '正在打包 {0}…',

        'action.openSkillMd': '打开 SKILL.md',
        'action.revealInExplorer': '在文件管理器中显示',

        'select.title': '选择要激活的技能',
        'select.enabled': '技能 "{0}" 已启用。',
        'select.disabled': '技能 "{0}" 已禁用。',
        'select.enableAll': '已启用所有技能。',
        'select.disableAll': '已禁用所有技能。',

        'preset.section': '技能组合',
        'preset.skills.section': '全部技能',
        'preset.active': '⚡ 使用中',
        'preset.skillCount': '{0} 个技能',
        'preset.create': '创建组合',
        'preset.createPlaceholder': '输入组合名称',
        'preset.selectSkills': '选择组合 "{0}" 中的技能',
        'preset.selectIcon': '为 "{0}" 选择图标',
        'preset.created': '组合 "{0}" 已创建。',
        'preset.activated': '已激活组合 "{0}"（{1} 个技能）。',
        'preset.deactivated': '已取消组合。回到手动选择模式。',
        'preset.deleted': '组合 "{0}" 已删除。',
        'preset.renamed': '组合已重命名为 "{0}"。',
        'preset.renamePlaceholder': '输入新名称',
        'preset.deleteConfirm': '删除组合 "{0}"？',
        'preset.editSkills': '编辑 "{0}" 中的技能',
        'preset.updated': '组合 "{0}" 已更新。',
        'preset.nameExists': '名为 "{0}" 的组合已存在。',
        'preset.noPresets': '还没有组合，请先创建一个。',
        'preset.selectToApply': '选择要激活的组合',
        'preset.none': '无激活组合',
    }
};

let currentLang: LangKey = 'en';

/**
 * Initialize language from VSCode environment or user config.
 */
export function initLang(configLang?: string): void {
    if (configLang === 'zh-cn' || configLang === 'en') {
        currentLang = configLang;
        return;
    }
    // Auto-detect from VSCode's UI language
    try {
        // vscode.env.language returns e.g. 'zh-cn', 'en', 'ja'
        const envLang = (typeof process !== 'undefined' && process.env?.VSCODE_NLS_CONFIG)
            ? JSON.parse(process.env.VSCODE_NLS_CONFIG).locale
            : undefined;
        if (envLang && envLang.toLowerCase().startsWith('zh')) {
            currentLang = 'zh-cn';
        } else {
            currentLang = 'en';
        }
    } catch {
        currentLang = 'en';
    }
}

export function getLang(): LangKey {
    return currentLang;
}

/**
 * Get a localized string. `{0}`, `{1}`, etc. are replaced by args.
 */
export function t(key: string, ...args: (string | number)[]): string {
    const table = messages[currentLang] ?? messages.en;
    let s = table[key] ?? messages.en[key] ?? key;
    for (let i = 0; i < args.length; i++) {
        s = s.replace(`{${i}}`, String(args[i]));
    }
    return s;
}
