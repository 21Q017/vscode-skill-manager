import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import {
    inspectSkillPackage, installSkill, deleteSkill,
    packageSkillFolder, installSkillFromFolder,
    listInstalledSkills, InstalledSkill
} from './skillInstaller';
import { SkillTreeProvider, SkillTreeItem, PresetItem } from './skillTreeProvider';
import { SkillSelector } from './skillSelector';
import { PresetManager, PRESET_ICONS } from './skillPresets';
import { initLang, t } from './i18n';

const CFG = 'skillManager';

// ── Helpers ──────────────────────────────────────────────────────────

function getInstallDir(): string {
    const cfg = vscode.workspace.getConfiguration(CFG);
    const custom = (cfg.get<string>('installDir') ?? '').trim();
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (custom) {
        if (custom.startsWith('~')) return path.join(os.homedir(), custom.slice(1));
        if (path.isAbsolute(custom)) return path.resolve(custom);
        return path.resolve(ws ?? process.cwd(), custom);
    }
    return ws ? path.join(ws, '.github', 'skills') : path.join(os.homedir(), '.github', 'skills');
}

function getOverwritePolicy(): 'ask' | 'always' | 'never' {
    const v = vscode.workspace.getConfiguration(CFG).get<string>('overwriteExisting') ?? 'ask';
    return v === 'always' || v === 'never' ? v : 'ask';
}

async function resolveOverwrite(name: string, dir: string): Promise<boolean | 'skip'> {
    const p = getOverwritePolicy();
    if (p === 'never') { vscode.window.showWarningMessage(t('overwrite.skip', name)); return 'skip'; }
    if (p === 'always') return true;
    const c = await vscode.window.showWarningMessage(t('overwrite.prompt', name, dir), { modal: true }, t('overwrite.btn'), 'Cancel');
    return c === t('overwrite.btn');
}

// ── Activation ───────────────────────────────────────────────────────

export function activate(ctx: vscode.ExtensionContext) {
    initLang(vscode.workspace.getConfiguration(CFG).get<string>('language'));

    const selector = new SkillSelector(getInstallDir);
    const presets = new PresetManager(getInstallDir);

    // ── Status bar ───────────────────────────────────────────────────
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'skillManager.quickPreset';
    ctx.subscriptions.push(statusBar);

    const updateUI = () => {
        const dir = getInstallDir();
        const all = listInstalledSkills(dir);
        const activeCount = all.filter((s) => selector.isActive(s.name)).length;
        const activePreset = presets.getActivePresetName();
        if (activePreset) {
            statusBar.text = `$(layers) ${activePreset}  $(circle-filled) ${activeCount}/${all.length}`;
        } else {
            statusBar.text = `$(library) ${t('status.active', activeCount, all.length)}`;
        }
        statusBar.tooltip = new vscode.MarkdownString(
            t('status.tooltip', all.length, activeCount, dir) +
            (activePreset ? `\n\n**Preset**: ${activePreset}` : '')
        );
        statusBar.show();
    };

    // ── Tree ─────────────────────────────────────────────────────────
    const tree = new SkillTreeProvider(getInstallDir, selector, presets, async (paths) => {
        for (const p of paths) {
            if (!fs.existsSync(p)) continue;
            const st = fs.statSync(p);
            if (st.isDirectory()) await doInstallFolder(p);
            else if (p.endsWith('.skill') || p.endsWith('.zip')) await doInstallFile(p);
            else vscode.window.showWarningMessage(t('msg.unsupportedDrop', path.basename(p)));
        }
    });

    const refreshAll = () => { tree.refresh(); updateUI(); };
    selector.onDidChange = refreshAll;
    presets.onDidChange = refreshAll;

    const tv = vscode.window.createTreeView('skillManager.skillsView', {
        treeDataProvider: tree,
        dragAndDropController: tree,
        showCollapseAll: true
    });
    ctx.subscriptions.push(tv);
    updateUI();

    // ── Config watchers ──────────────────────────────────────────────
    ctx.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(`${CFG}.installDir`) || e.affectsConfiguration(`${CFG}.overwriteExisting`)) {
                selector.reload(); presets.reload(); refreshAll();
            }
            if (e.affectsConfiguration(`${CFG}.language`)) {
                initLang(vscode.workspace.getConfiguration(CFG).get<string>('language'));
                refreshAll();
            }
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => { selector.reload(); presets.reload(); refreshAll(); })
    );

    // ── Skill Install Commands ───────────────────────────────────────

    const reg = (cmd: string, fn: (...a: any[]) => any) => ctx.subscriptions.push(vscode.commands.registerCommand(cmd, fn));

    reg('skillManager.uploadSkill', async () => {
        const p = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: true, openLabel: t('cmd.uploadTitle'), filters: { 'Skill Packages': ['skill', 'zip'], 'All Files': ['*'] } });
        if (!p) return;
        for (const u of p) await doInstallFile(u.fsPath);
    });
    reg('skillManager.installFromExplorer', async (uri: vscode.Uri) => { if (uri) await doInstallFile(uri.fsPath); });
    reg('skillManager.installFromFolder', async () => {
        const p = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: t('cmd.selectFolder') });
        if (p?.[0]) await doInstallFolder(p[0].fsPath);
    });
    reg('skillManager.exportSkill', async (item: any) => {
        let fp: string | undefined;
        if (item?.skill) fp = item.skill.folderPath;
        else {
            const skills = listInstalledSkills(getInstallDir());
            if (!skills.length) { vscode.window.showInformationMessage(t('cmd.noSkills')); return; }
            const pick = await vscode.window.showQuickPick(skills.map((s) => ({ label: s.name, description: s.description, skill: s })), { placeHolder: t('cmd.selectSkillToExport') });
            if (!pick) return;
            fp = pick.skill.folderPath;
        }
        await doExport(fp!);
    });
    reg('skillManager.exportFolderFromExplorer', async (uri: vscode.Uri) => { if (uri) await doExport(uri.fsPath); });
    reg('skillManager.refresh', () => { selector.reload(); presets.reload(); refreshAll(); });
    reg('skillManager.openInstallDir', async () => { const d = getInstallDir(); fs.mkdirSync(d, { recursive: true }); await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(d)); });
    reg('skillManager.setInstallDir', async () => {
        const p = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: t('cmd.selectInstallDir'), defaultUri: vscode.Uri.file(getInstallDir()) });
        if (!p?.[0]) return;
        await vscode.workspace.getConfiguration(CFG).update('installDir', p[0].fsPath, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(t('msg.installDirSet', p[0].fsPath));
        selector.reload(); presets.reload(); refreshAll();
    });
    reg('skillManager.openSkill', async (item: any) => {
        const mdPath = item?.skill?.skillMdPath ?? item?.skillMdPath;
        if (!mdPath || !fs.existsSync(mdPath)) { vscode.window.showWarningMessage(t('msg.skillMdNotFound')); return; }
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(mdPath), { preview: true });
    });
    reg('skillManager.deleteSkill', async (item: any) => {
        let fp: string | undefined, name: string | undefined;
        if (item?.skill) { fp = item.skill.folderPath; name = item.skill.name; }
        else {
            const skills = listInstalledSkills(getInstallDir());
            if (!skills.length) { vscode.window.showInformationMessage(t('cmd.noSkills')); return; }
            const pick = await vscode.window.showQuickPick(skills.map((s) => ({ label: s.name, description: s.description, skill: s })), { placeHolder: t('cmd.selectSkillToDelete') });
            if (!pick) return;
            fp = pick.skill.folderPath; name = pick.skill.name;
        }
        const c = await vscode.window.showWarningMessage(t('delete.confirm', name!), { modal: true }, t('delete.btn'));
        if (c !== t('delete.btn')) return;
        const r = deleteSkill(fp!);
        if (r.success) { vscode.window.showInformationMessage(t('msg.deleted', name!)); refreshAll(); }
        else vscode.window.showErrorMessage(t('msg.deleteFailed', r.error ?? ''));
    });

    // ── Skill Selection Commands ─────────────────────────────────────

    reg('skillManager.toggleSkill', (item: SkillTreeItem) => {
        if (!item?.skill) return;
        presets.deactivate(); // Switch to manual mode when manually toggling
        const now = selector.toggle(item.skill.name);
        vscode.window.showInformationMessage(now ? t('select.enabled', item.skill.name) : t('select.disabled', item.skill.name));
    });
    reg('skillManager.selectSkills', async () => {
        const skills = listInstalledSkills(getInstallDir());
        if (!skills.length) { vscode.window.showInformationMessage(t('cmd.noSkills')); return; }
        const items = skills.map((s) => ({ label: s.name, description: s.description, picked: selector.isActive(s.name), skill: s }));
        const sel = await vscode.window.showQuickPick(items, { canPickMany: true, placeHolder: t('select.title') });
        if (!sel) return;
        presets.deactivate();
        selector.setActive(sel.map((i) => i.skill.name));
    });
    reg('skillManager.enableAllSkills', () => { presets.deactivate(); selector.enableAll(); vscode.window.showInformationMessage(t('select.enableAll')); });
    reg('skillManager.disableAllSkills', () => { presets.deactivate(); selector.disableAll(); vscode.window.showInformationMessage(t('select.disableAll')); });

    // ── Preset Commands ──────────────────────────────────────────────

    reg('skillManager.createPreset', async () => {
        const name = await vscode.window.showInputBox({ prompt: t('preset.createPlaceholder'), placeHolder: 'My Preset' });
        if (!name?.trim()) return;
        if (presets.exists(name.trim())) { vscode.window.showWarningMessage(t('preset.nameExists', name.trim())); return; }

        // Pick icon
        const iconItems = PRESET_ICONS.map((id) => ({ label: `$(${id})  ${id}`, iconId: id }));
        const iconPick = await vscode.window.showQuickPick(iconItems, { placeHolder: t('preset.selectIcon', name.trim()) });
        const icon = iconPick?.iconId ?? 'package';

        // Pick skills
        const skills = listInstalledSkills(getInstallDir());
        const skillItems = skills.map((s) => ({ label: s.name, description: s.description, picked: selector.isActive(s.name), skill: s }));
        const sel = await vscode.window.showQuickPick(skillItems, { canPickMany: true, placeHolder: t('preset.selectSkills', name.trim()) });
        if (!sel) return;

        presets.save_preset({ name: name.trim(), icon, skills: sel.map((i) => i.skill.name) });
        vscode.window.showInformationMessage(t('preset.created', name.trim()));
    });

    reg('skillManager.applyPreset', (item: PresetItem) => {
        if (!item) return;
        if (item.isActive) {
            // Clicking the active preset deactivates it
            presets.deactivate();
            selector.enableAll();
            vscode.window.showInformationMessage(t('preset.deactivated'));
            return;
        }
        const preset = presets.activate(item.presetName);
        if (!preset) return;
        selector.setActive(preset.skills);
        vscode.window.showInformationMessage(t('preset.activated', preset.name, preset.skills.length));
    });

    reg('skillManager.editPreset', async (item: PresetItem) => {
        let presetName: string;
        if (item?.presetName) {
            presetName = item.presetName;
        } else {
            const all = presets.getAll();
            if (!all.length) { vscode.window.showInformationMessage(t('preset.noPresets')); return; }
            const pick = await vscode.window.showQuickPick(all.map((p) => ({ label: p.name, description: t('preset.skillCount', p.skills.length), preset: p })), { placeHolder: t('preset.selectToApply') });
            if (!pick) return;
            presetName = pick.preset.name;
        }
        const preset = presets.getAll().find((p) => p.name === presetName);
        if (!preset) return;

        const skills = listInstalledSkills(getInstallDir());
        const presetSkillSet = new Set(preset.skills);
        const items = skills.map((s) => ({ label: s.name, description: s.description, picked: presetSkillSet.has(s.name), skill: s }));
        const sel = await vscode.window.showQuickPick(items, { canPickMany: true, placeHolder: t('preset.editSkills', presetName) });
        if (!sel) return;

        preset.skills = sel.map((i) => i.skill.name);
        presets.save_preset(preset);
        // If this is the active preset, update the selector too
        if (presets.getActivePresetName() === presetName) {
            selector.setActive(preset.skills);
        }
        vscode.window.showInformationMessage(t('preset.updated', presetName));
    });

    reg('skillManager.renamePreset', async (item: PresetItem) => {
        if (!item?.presetName) return;
        const newName = await vscode.window.showInputBox({ prompt: t('preset.renamePlaceholder'), value: item.presetName });
        if (!newName?.trim() || newName.trim() === item.presetName) return;
        if (presets.exists(newName.trim())) { vscode.window.showWarningMessage(t('preset.nameExists', newName.trim())); return; }
        presets.rename(item.presetName, newName.trim());
        vscode.window.showInformationMessage(t('preset.renamed', newName.trim()));
    });

    reg('skillManager.deletePreset', async (item: PresetItem) => {
        if (!item?.presetName) return;
        const c = await vscode.window.showWarningMessage(t('preset.deleteConfirm', item.presetName), { modal: true }, t('delete.btn'));
        if (c !== t('delete.btn')) return;
        presets.delete(item.presetName);
        vscode.window.showInformationMessage(t('preset.deleted', item.presetName));
    });

    // Quick preset switcher from status bar
    reg('skillManager.quickPreset', async () => {
        const all = presets.getAll();
        const activeP = presets.getActivePresetName();
        const items: (vscode.QuickPickItem & { action: string; presetName?: string })[] = [];

        // List presets
        for (const p of all) {
            items.push({
                label: `$(${p.icon})  ${p.name}`,
                description: p.name === activeP ? t('preset.active') : t('preset.skillCount', p.skills.length),
                action: 'apply',
                presetName: p.name
            });
        }
        // Divider + actions
        if (all.length > 0) {
            items.push({ label: '', description: '', kind: vscode.QuickPickItemKind.Separator, action: '' } as any);
        }
        if (activeP) {
            items.push({ label: `$(close)  ${t('preset.deactivated').split('.')[0]}`, description: '', action: 'deactivate' });
        }
        items.push({ label: `$(add)  ${t('preset.create')}`, description: '', action: 'create' });

        const pick = await vscode.window.showQuickPick(items, { placeHolder: t('preset.selectToApply') });
        if (!pick) return;
        if (pick.action === 'apply' && pick.presetName) {
            if (pick.presetName === activeP) {
                presets.deactivate(); selector.enableAll();
                vscode.window.showInformationMessage(t('preset.deactivated'));
            } else {
                const preset = presets.activate(pick.presetName);
                if (preset) { selector.setActive(preset.skills); vscode.window.showInformationMessage(t('preset.activated', preset.name, preset.skills.length)); }
            }
        } else if (pick.action === 'deactivate') {
            presets.deactivate(); selector.enableAll();
            vscode.window.showInformationMessage(t('preset.deactivated'));
        } else if (pick.action === 'create') {
            await vscode.commands.executeCommand('skillManager.createPreset');
        }
    });

    reg('skillManager.switchLanguage', async () => {
        const pick = await vscode.window.showQuickPick(
            [{ label: 'English', description: 'en', lang: 'en' }, { label: '中文', description: 'zh-cn', lang: 'zh-cn' }],
            { placeHolder: 'Select Language / 选择语言' }
        );
        if (!pick) return;
        await vscode.workspace.getConfiguration(CFG).update('language', pick.lang, vscode.ConfigurationTarget.Global);
    });

    // ── Install / Export ─────────────────────────────────────────────

    async function doInstallFile(filePath: string) {
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t('progress.installing', path.basename(filePath)), cancellable: false }, async (progress) => {
            progress.report({ message: t('progress.validating') });
            const inspect = inspectSkillPackage(filePath);
            if (!inspect.valid || !inspect.metadata) { vscode.window.showErrorMessage(t('msg.invalidPackage', inspect.error ?? '')); return; }
            const dir = getInstallDir(), name = inspect.metadata.name, target = path.join(dir, name);
            let ow = false;
            if (fs.existsSync(target)) { const d = await resolveOverwrite(name, target); if (d === 'skip' || !d) return; ow = true; }
            progress.report({ message: t('progress.extracting', target) });
            const r = installSkill(inspect, dir, ow);
            if (r.success) {
                refreshAll();
                const a = await vscode.window.showInformationMessage(t('msg.installed', r.skillName!), t('action.openSkillMd'), t('action.revealInExplorer'));
                if (a === t('action.openSkillMd')) await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(path.join(r.installedPath!, 'SKILL.md')));
                else if (a === t('action.revealInExplorer')) await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(r.installedPath!));
            } else vscode.window.showErrorMessage(t('msg.installFailed', r.error ?? ''));
        });
    }

    async function doInstallFolder(fp: string) {
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t('progress.installingFolder', path.basename(fp)), cancellable: false }, async (progress) => {
            progress.report({ message: t('progress.validatingSkillMd') });
            const dir = getInstallDir();
            if (!fs.existsSync(path.join(fp, 'SKILL.md'))) { vscode.window.showErrorMessage(t('msg.noSkillMd', fp)); return; }
            const probe = installSkillFromFolder(fp, dir, false);
            if (!probe.success && !probe.alreadyExists) { vscode.window.showErrorMessage(t('msg.installFailed', probe.error ?? '')); return; }
            let ow = false;
            if (probe.alreadyExists && probe.skillName && probe.installedPath) { const d = await resolveOverwrite(probe.skillName, probe.installedPath); if (d === 'skip' || !d) return; ow = true; }
            else if (probe.success) { refreshAll(); vscode.window.showInformationMessage(t('msg.installed', probe.skillName!)); return; }
            progress.report({ message: t('progress.copying') });
            const r = installSkillFromFolder(fp, dir, ow);
            if (r.success) { refreshAll(); vscode.window.showInformationMessage(t('msg.installed', r.skillName!)); }
            else vscode.window.showErrorMessage(t('msg.installFailed', r.error ?? ''));
        });
    }

    async function doExport(fp: string) {
        if (!fs.existsSync(path.join(fp, 'SKILL.md'))) { vscode.window.showErrorMessage(t('msg.exportNoSkillMd', path.basename(fp))); return; }
        const fn = path.basename(fp);
        const saveTo = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(path.join(fp, '..', `${fn}.skill`)), saveLabel: t('cmd.exportSaveLabel'), filters: { 'Skill Package': ['skill'] } });
        if (!saveTo) return;
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t('progress.packaging', fn), cancellable: false }, async () => {
            const r = packageSkillFolder(fp, path.dirname(saveTo.fsPath));
            if (!r.success || !r.outputPath) { vscode.window.showErrorMessage(t('msg.exportFailed', r.error ?? '')); return; }
            if (r.outputPath !== saveTo.fsPath) { try { fs.renameSync(r.outputPath, saveTo.fsPath); } catch (e) { vscode.window.showErrorMessage(t('msg.renameFailed', (e as Error).message, r.outputPath)); return; } }
            const a = await vscode.window.showInformationMessage(t('msg.exported', r.skillName!, saveTo.fsPath), t('action.revealInExplorer'));
            if (a === t('action.revealInExplorer')) await vscode.commands.executeCommand('revealFileInOS', saveTo);
        });
    }
}

export function deactivate() {}
