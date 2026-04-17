/**
 * Skill Presets — named collections of skills that can be activated in one click.
 *
 * Persisted to `<installDir>/.skill-presets.json`:
 * {
 *   "presets": [
 *     { "name": "Writing", "icon": "edit", "skills": ["docx", "pdf", "frontend-design"] },
 *     { "name": "Coding", "icon": "code",  "skills": ["xlsx", "frontend-design"] }
 *   ],
 *   "activePreset": "Writing"
 * }
 */

import * as fs from 'fs';
import * as path from 'path';

export interface Preset {
    name: string;
    icon: string;       // codicon id, e.g. 'edit', 'code', 'beaker'
    skills: string[];
}

interface PresetsFile {
    presets: Preset[];
    activePreset: string | null;
}

const PRESET_ICONS = [
    'edit', 'code', 'beaker', 'book', 'briefcase', 'rocket',
    'tools', 'lightbulb', 'globe', 'heart', 'star-full', 'shield',
    'megaphone', 'mortar-board', 'law', 'database', 'server', 'terminal'
];

export { PRESET_ICONS };

export class PresetManager {
    private stateFile: string = '';
    private data: PresetsFile = { presets: [], activePreset: null };
    private _onDidChange: (() => void) | undefined;

    constructor(private getInstallDir: () => string) {
        this.reload();
    }

    set onDidChange(cb: (() => void) | undefined) {
        this._onDidChange = cb;
    }

    reload(): void {
        this.stateFile = path.join(this.getInstallDir(), '.skill-presets.json');
        if (fs.existsSync(this.stateFile)) {
            try {
                const raw = fs.readFileSync(this.stateFile, 'utf8');
                const parsed = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.presets)) {
                    this.data = {
                        presets: parsed.presets.filter(
                            (p: any) => p && typeof p.name === 'string' && Array.isArray(p.skills)
                        ).map((p: any) => ({
                            name: String(p.name),
                            icon: typeof p.icon === 'string' ? p.icon : 'package',
                            skills: p.skills.map(String)
                        })),
                        activePreset: typeof parsed.activePreset === 'string' ? parsed.activePreset : null
                    };
                    return;
                }
            } catch { /* corrupted — reset */ }
        }
        this.data = { presets: [], activePreset: null };
    }

    private save(): void {
        try {
            const dir = this.getInstallDir();
            fs.mkdirSync(dir, { recursive: true });
            this.stateFile = path.join(dir, '.skill-presets.json');
            fs.writeFileSync(this.stateFile, JSON.stringify(this.data, null, 2));
        } catch { /* silent */ }
        this._onDidChange?.();
    }

    getAll(): Preset[] {
        return [...this.data.presets];
    }

    getActivePresetName(): string | null {
        return this.data.activePreset;
    }

    getActivePreset(): Preset | null {
        if (!this.data.activePreset) return null;
        return this.data.presets.find((p) => p.name === this.data.activePreset) ?? null;
    }

    /** Create or update a preset. */
    save_preset(preset: Preset): void {
        const idx = this.data.presets.findIndex((p) => p.name === preset.name);
        if (idx >= 0) {
            this.data.presets[idx] = preset;
        } else {
            this.data.presets.push(preset);
        }
        this.save();
    }

    /** Activate a preset (also updates the skill selector). Returns the preset. */
    activate(name: string): Preset | null {
        const preset = this.data.presets.find((p) => p.name === name);
        if (!preset) return null;
        this.data.activePreset = name;
        this.save();
        return preset;
    }

    /** Deactivate (go back to manual selection). */
    deactivate(): void {
        this.data.activePreset = null;
        this.save();
    }

    /** Delete a preset. */
    delete(name: string): boolean {
        const idx = this.data.presets.findIndex((p) => p.name === name);
        if (idx < 0) return false;
        this.data.presets.splice(idx, 1);
        if (this.data.activePreset === name) {
            this.data.activePreset = null;
        }
        this.save();
        return true;
    }

    /** Rename a preset. */
    rename(oldName: string, newName: string): boolean {
        const preset = this.data.presets.find((p) => p.name === oldName);
        if (!preset) return false;
        if (this.data.presets.some((p) => p.name === newName)) return false;
        preset.name = newName;
        if (this.data.activePreset === oldName) {
            this.data.activePreset = newName;
        }
        this.save();
        return true;
    }

    /** Check if a preset name already exists. */
    exists(name: string): boolean {
        return this.data.presets.some((p) => p.name === name);
    }
}
