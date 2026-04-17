/**
 * Manages which skills are "active" (selected for the current session/project).
 *
 * State is persisted to `<installDir>/.active-skills.json` so it:
 *   - Lives next to the skills in the repo (can be committed/shared).
 *   - Survives VSCode restarts.
 *
 * Format:
 * {
 *   "activeSkills": ["skill-a", "skill-b"],
 *   "mode": "whitelist"          // "whitelist" = only listed are active
 * }                              // "blacklist" = all except listed are active
 *
 * Default (no file): all skills are active.
 */

import * as fs from 'fs';
import * as path from 'path';

export type SelectionMode = 'whitelist' | 'blacklist';

interface StateFile {
    activeSkills: string[];
    mode: SelectionMode;
}

export class SkillSelector {
    private stateFile: string = '';
    private state: StateFile = { activeSkills: [], mode: 'blacklist' };
    private _onDidChange: (() => void) | undefined;

    constructor(private getInstallDir: () => string) {
        this.reload();
    }

    set onDidChange(cb: (() => void) | undefined) {
        this._onDidChange = cb;
    }

    /** Re-read from disk. Call after installDir changes. */
    reload(): void {
        this.stateFile = path.join(this.getInstallDir(), '.active-skills.json');
        if (fs.existsSync(this.stateFile)) {
            try {
                const raw = fs.readFileSync(this.stateFile, 'utf8');
                const parsed = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.activeSkills)) {
                    this.state = {
                        activeSkills: parsed.activeSkills,
                        mode: parsed.mode === 'whitelist' ? 'whitelist' : 'blacklist'
                    };
                    return;
                }
            } catch {
                // Corrupted file — reset to default.
            }
        }
        // Default: all active (blacklist mode with empty list = nothing excluded).
        this.state = { activeSkills: [], mode: 'blacklist' };
    }

    private save(): void {
        try {
            const dir = this.getInstallDir();
            fs.mkdirSync(dir, { recursive: true });
            this.stateFile = path.join(dir, '.active-skills.json');
            fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
        } catch {
            // Silently fail if disk is read-only, etc.
        }
        this._onDidChange?.();
    }

    /** Check whether a skill is currently active. */
    isActive(skillName: string): boolean {
        if (this.state.mode === 'whitelist') {
            return this.state.activeSkills.includes(skillName);
        }
        // blacklist: active unless explicitly excluded.
        return !this.state.activeSkills.includes(skillName);
    }

    /** Toggle a single skill's active state. Returns the new state. */
    toggle(skillName: string): boolean {
        const wasActive = this.isActive(skillName);
        if (this.state.mode === 'whitelist') {
            if (wasActive) {
                this.state.activeSkills = this.state.activeSkills.filter((n) => n !== skillName);
            } else {
                this.state.activeSkills.push(skillName);
            }
        } else {
            // blacklist
            if (wasActive) {
                // Was active → add to blacklist to disable.
                this.state.activeSkills.push(skillName);
            } else {
                // Was disabled → remove from blacklist to enable.
                this.state.activeSkills = this.state.activeSkills.filter((n) => n !== skillName);
            }
        }
        this.save();
        return !wasActive;
    }

    /** Set explicit list of active skills (switches to whitelist mode). */
    setActive(names: string[]): void {
        this.state = { activeSkills: [...names], mode: 'whitelist' };
        this.save();
    }

    /** Enable all skills (reset to default). */
    enableAll(): void {
        this.state = { activeSkills: [], mode: 'blacklist' };
        this.save();
    }

    /** Disable all skills. */
    disableAll(): void {
        this.state = { activeSkills: [], mode: 'whitelist' };
        this.save();
    }

    /** Get list of currently active skill names, given the full list of installed names. */
    getActiveNames(allNames: string[]): string[] {
        return allNames.filter((n) => this.isActive(n));
    }

    /** Get current mode. */
    getMode(): SelectionMode {
        return this.state.mode;
    }
}
