import * as vscode from 'vscode';
import { InstalledSkill, listInstalledSkills } from './skillInstaller';
import { SkillSelector } from './skillSelector';
import { PresetManager } from './skillPresets';
import { t } from './i18n';

// ── Tree Item Types ──────────────────────────────────────────────────

/** Section header ("PRESETS" / "ALL SKILLS") */
export class SectionItem extends vscode.TreeItem {
    readonly type = 'section' as const;
    constructor(
        public readonly sectionId: 'presets' | 'skills',
        label: string,
        count: number
    ) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.description = `(${count})`;
        this.contextValue = `section-${sectionId}`;
        this.iconPath = new vscode.ThemeIcon(
            sectionId === 'presets' ? 'layers' : 'library'
        );
    }
}

/** A preset in the "PRESETS" section */
export class PresetItem extends vscode.TreeItem {
    readonly type = 'preset' as const;
    constructor(
        public readonly presetName: string,
        public readonly skills: string[],
        public readonly icon: string,
        public readonly isActive: boolean
    ) {
        super(presetName, vscode.TreeItemCollapsibleState.Collapsed);
        const countLabel = t('preset.skillCount', skills.length);
        this.description = isActive ? `${t('preset.active')}  ·  ${countLabel}` : countLabel;
        this.contextValue = isActive ? 'preset-active' : 'preset';
        this.iconPath = new vscode.ThemeIcon(
            icon,
            isActive
                ? new vscode.ThemeColor('charts.green')
                : undefined
        );
        this.tooltip = new vscode.MarkdownString(
            `**${presetName}** ${isActive ? '⚡' : ''}\n\n` +
            skills.map((s) => `- ${s}`).join('\n') +
            (skills.length === 0 ? '_empty_' : '')
        );
        // Click to activate
        this.command = {
            command: 'skillManager.applyPreset',
            title: 'Apply Preset',
            arguments: [this]
        };
    }
}

/** A skill listed inside a preset (read-only display) */
export class PresetSkillItem extends vscode.TreeItem {
    readonly type = 'preset-skill' as const;
    constructor(
        public readonly skillName: string,
        public readonly parentPreset: string,
        installed: boolean
    ) {
        super(skillName, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(
            installed ? 'circle-filled' : 'circle-outline'
        );
        this.description = installed ? '' : '(not installed)';
        this.contextValue = 'preset-skill';
    }
}

/** A skill in the "ALL SKILLS" section */
export class SkillTreeItem extends vscode.TreeItem {
    readonly type = 'skill' as const;
    constructor(
        public readonly skill: InstalledSkill,
        public readonly active: boolean
    ) {
        super(skill.name, vscode.TreeItemCollapsibleState.None);

        const statusLabel = active ? t('tree.enabled') : t('tree.disabled');
        const mismatchLabel = skill.nameMatchesFolder ? '' : ` ${t('tree.nameMismatch')}`;
        this.description = `${statusLabel}${mismatchLabel}`;

        this.tooltip = new vscode.MarkdownString(
            `**${skill.name}** — ${statusLabel}\n\n${skill.description}\n\n\`${skill.folderPath}\``
        );
        this.contextValue = active ? 'skill-active' : 'skill-inactive';
        this.iconPath = new vscode.ThemeIcon(
            active ? 'check' : 'circle-slash',
            active
                ? new vscode.ThemeColor('charts.green')
                : new vscode.ThemeColor('disabledForeground')
        );
        // Click = toggle
        this.command = {
            command: 'skillManager.toggleSkill',
            title: 'Toggle',
            arguments: [this]
        };
        this.resourceUri = vscode.Uri.file(skill.folderPath);
    }
}

export type TreeNode = SectionItem | PresetItem | PresetSkillItem | SkillTreeItem;

// ── Provider ─────────────────────────────────────────────────────────

export class SkillTreeProvider
    implements vscode.TreeDataProvider<TreeNode>, vscode.TreeDragAndDropController<TreeNode>
{
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    readonly dropMimeTypes = ['text/uri-list'];
    readonly dragMimeTypes: string[] = [];

    private installedNames: Set<string> = new Set();

    constructor(
        private getInstallDir: () => string,
        private selector: SkillSelector,
        private presetManager: PresetManager,
        private onDropFiles: (filePaths: string[]) => Promise<void> | void
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeNode): Thenable<TreeNode[]> {
        if (!element) {
            // Root level: two sections.
            const presets = this.presetManager.getAll();
            const skills = listInstalledSkills(this.getInstallDir());
            this.installedNames = new Set(skills.map((s) => s.name));

            const nodes: TreeNode[] = [];

            // Always show presets section (even if empty — shows "create" hint).
            nodes.push(new SectionItem('presets', t('preset.section'), presets.length));
            nodes.push(new SectionItem('skills', t('preset.skills.section'), skills.length));

            return Promise.resolve(nodes);
        }

        if (element instanceof SectionItem) {
            if (element.sectionId === 'presets') {
                const activePreset = this.presetManager.getActivePresetName();
                return Promise.resolve(
                    this.presetManager.getAll().map((p) =>
                        new PresetItem(p.name, p.skills, p.icon, p.name === activePreset)
                    )
                );
            }
            // skills section
            const skills = listInstalledSkills(this.getInstallDir());
            return Promise.resolve(
                skills.map((s) => new SkillTreeItem(s, this.selector.isActive(s.name)))
            );
        }

        if (element instanceof PresetItem) {
            return Promise.resolve(
                element.skills.map((s) =>
                    new PresetSkillItem(s, element.presetName, this.installedNames.has(s))
                )
            );
        }

        return Promise.resolve([]);
    }

    // ── Drag & Drop ──────────────────────────────────────────────────

    async handleDrop(
        _target: TreeNode | undefined,
        sources: vscode.DataTransfer,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const item = sources.get('text/uri-list');
        if (!item) return;
        const raw = await item.asString();
        const uris = raw
            .split(/\r?\n/)
            .map((l: string) => l.trim())
            .filter((l: string) => l && !l.startsWith('#'));

        const paths: string[] = [];
        for (const u of uris) {
            try {
                const uri = vscode.Uri.parse(u);
                if (uri.scheme === 'file') paths.push(uri.fsPath);
            } catch { /* skip */ }
        }
        if (paths.length > 0) await this.onDropFiles(paths);
    }

    handleDrag(): void {}
}
