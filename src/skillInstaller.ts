import * as path from 'path';
import * as fs from 'fs';
import { ZipReader, ZipWriter, ZipEntryRead } from './miniZip';
import { validateSkillMd, SkillMetadata } from './skillValidator';

export interface InstallResult {
    success: boolean;
    error?: string;
    skillName?: string;
    installedPath?: string;
    metadata?: SkillMetadata;
    alreadyExists?: boolean;
}

export interface InspectResult {
    valid: boolean;
    error?: string;
    skillName?: string;
    metadata?: SkillMetadata;
    /** Path prefix inside the zip that contains SKILL.md (may be '' if at root). */
    rootPrefix?: string;
    entries?: ZipEntryRead[];
    /** Total uncompressed size in bytes, for safety checks. */
    totalBytes?: number;
}

// Cap to prevent zip-bomb style abuse.
const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_ENTRIES = 10000;

/**
 * Inspect a .skill / .zip file: verify it contains a valid SKILL.md and
 * return the metadata plus decoded entries for later extraction.
 */
export function inspectSkillPackage(filePath: string): InspectResult {
    if (!fs.existsSync(filePath)) {
        return { valid: false, error: `File not found: ${filePath}` };
    }

    let entries: ZipEntryRead[];
    try {
        const buf = fs.readFileSync(filePath);
        const reader = new ZipReader(buf);
        entries = reader.getEntries();
    } catch (e) {
        return { valid: false, error: `Cannot open archive: ${(e as Error).message}` };
    }

    if (entries.length === 0) {
        return { valid: false, error: 'Archive is empty' };
    }
    if (entries.length > MAX_ENTRIES) {
        return {
            valid: false,
            error: `Archive has too many entries (${entries.length} > ${MAX_ENTRIES})`
        };
    }

    let totalBytes = 0;
    for (const entry of entries) {
        totalBytes += entry.uncompressedSize;
        if (totalBytes > MAX_TOTAL_BYTES) {
            return {
                valid: false,
                error: `Archive is too large when uncompressed (> ${MAX_TOTAL_BYTES} bytes)`
            };
        }
        const name = entry.entryName.replace(/\\/g, '/');
        if (name.startsWith('/') || name.split('/').includes('..')) {
            return { valid: false, error: `Unsafe entry path in archive: ${entry.entryName}` };
        }
    }

    // Find SKILL.md. Accept either at root (SKILL.md) or nested one level
    // under a single top-level folder (my-skill/SKILL.md), matching the
    // format produced by skill-creator's package_skill.py.
    let skillMdEntry: ZipEntryRead | null = null;
    let rootPrefix = '';

    for (const entry of entries) {
        if (entry.isDirectory) {
            continue;
        }
        const name = entry.entryName.replace(/\\/g, '/');
        if (name === 'SKILL.md') {
            skillMdEntry = entry;
            rootPrefix = '';
            break;
        }
    }

    if (!skillMdEntry) {
        for (const entry of entries) {
            if (entry.isDirectory) {
                continue;
            }
            const name = entry.entryName.replace(/\\/g, '/');
            const parts = name.split('/');
            if (parts.length === 2 && parts[1] === 'SKILL.md') {
                skillMdEntry = entry;
                rootPrefix = parts[0] + '/';
                break;
            }
        }
        if (!skillMdEntry) {
            return {
                valid: false,
                error: 'No SKILL.md found in the archive (expected at root or one level deep)'
            };
        }
    }

    const content = skillMdEntry.data.toString('utf8');
    const validation = validateSkillMd(content);
    if (!validation.valid || !validation.metadata) {
        return { valid: false, error: `SKILL.md validation failed: ${validation.error}` };
    }

    return {
        valid: true,
        entries,
        rootPrefix,
        metadata: validation.metadata,
        skillName: validation.metadata.name,
        totalBytes
    };
}

/**
 * Extract the skill into `installDir/<skill-name>/`.
 */
export function installSkill(
    inspect: InspectResult,
    installDir: string,
    overwrite: boolean
): InstallResult {
    if (!inspect.valid || !inspect.entries || !inspect.metadata) {
        return { success: false, error: inspect.error ?? 'Invalid package' };
    }

    const skillName = inspect.metadata.name;
    const targetDir = path.resolve(installDir, skillName);
    const rootAbs = path.resolve(installDir);

    if (!targetDir.startsWith(rootAbs + path.sep) && targetDir !== rootAbs) {
        return { success: false, error: `Refusing to install outside install directory` };
    }

    const exists = fs.existsSync(targetDir);
    if (exists && !overwrite) {
        return {
            success: false,
            alreadyExists: true,
            skillName,
            installedPath: targetDir,
            error: `A skill named "${skillName}" is already installed`
        };
    }

    try {
        fs.mkdirSync(installDir, { recursive: true });
        if (exists) {
            fs.rmSync(targetDir, { recursive: true, force: true });
        }
        fs.mkdirSync(targetDir, { recursive: true });

        const prefix = inspect.rootPrefix ?? '';

        for (const entry of inspect.entries) {
            const rawName = entry.entryName.replace(/\\/g, '/');
            let relative = rawName;

            if (prefix) {
                if (!rawName.startsWith(prefix)) {
                    continue;
                }
                relative = rawName.substring(prefix.length);
            }
            if (!relative) {
                continue;
            }

            const destPath = path.resolve(targetDir, relative);
            if (!destPath.startsWith(targetDir + path.sep) && destPath !== targetDir) {
                return { success: false, error: `Unsafe path in archive: ${rawName}` };
            }

            if (entry.isDirectory) {
                fs.mkdirSync(destPath, { recursive: true });
            } else {
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.writeFileSync(destPath, entry.data);
            }
        }

        return {
            success: true,
            skillName,
            installedPath: targetDir,
            metadata: inspect.metadata
        };
    } catch (e) {
        return { success: false, error: `Install failed: ${(e as Error).message}` };
    }
}

/**
 * List installed skills by scanning installDir for subfolders that contain a valid SKILL.md.
 */
export interface InstalledSkill {
    name: string;
    description: string;
    folderPath: string;
    skillMdPath: string;
    /** True if SKILL.md frontmatter name matches the folder name. */
    nameMatchesFolder: boolean;
}

export function listInstalledSkills(installDir: string): InstalledSkill[] {
    if (!fs.existsSync(installDir)) {
        return [];
    }
    const entries = fs.readdirSync(installDir, { withFileTypes: true });
    const result: InstalledSkill[] = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const folderPath = path.join(installDir, entry.name);
        const skillMdPath = path.join(folderPath, 'SKILL.md');
        if (!fs.existsSync(skillMdPath)) {
            continue;
        }
        try {
            const content = fs.readFileSync(skillMdPath, 'utf8');
            const v = validateSkillMd(content);
            if (v.valid && v.metadata) {
                result.push({
                    name: v.metadata.name,
                    description: v.metadata.description,
                    folderPath,
                    skillMdPath,
                    nameMatchesFolder: v.metadata.name === entry.name
                });
            } else {
                result.push({
                    name: entry.name,
                    description: `(invalid SKILL.md: ${v.error ?? 'unknown error'})`,
                    folderPath,
                    skillMdPath,
                    nameMatchesFolder: false
                });
            }
        } catch {
            // Unreadable — skip silently.
        }
    }

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
}

export function deleteSkill(folderPath: string): { success: boolean; error?: string } {
    try {
        if (!fs.existsSync(folderPath)) {
            return { success: false, error: 'Skill folder does not exist' };
        }
        fs.rmSync(folderPath, { recursive: true, force: true });
        return { success: true };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

// Patterns excluded when packaging a skill folder into a .skill archive.
// Mirrors skill-creator/scripts/package_skill.py.
const EXCLUDE_DIRS = new Set(['__pycache__', 'node_modules', '.git']);
const EXCLUDE_FILES = new Set(['.DS_Store']);
const EXCLUDE_EXT = new Set(['.pyc']);
const ROOT_EXCLUDE_DIRS = new Set(['evals']);

function shouldExcludeForPackage(relPath: string): boolean {
    const parts = relPath.split(/[/\\]/);
    if (parts.some((p) => EXCLUDE_DIRS.has(p))) {
        return true;
    }
    if (parts.length > 1 && ROOT_EXCLUDE_DIRS.has(parts[1])) {
        return true;
    }
    const basename = parts[parts.length - 1];
    if (EXCLUDE_FILES.has(basename)) {
        return true;
    }
    const dotIdx = basename.lastIndexOf('.');
    if (dotIdx !== -1 && EXCLUDE_EXT.has(basename.substring(dotIdx))) {
        return true;
    }
    return false;
}

export interface PackageResult {
    success: boolean;
    error?: string;
    outputPath?: string;
    skillName?: string;
}

/**
 * Package a skill folder into a `.skill` archive.
 * The archive layout matches `skill-creator/scripts/package_skill.py`:
 *   <skill-name>/SKILL.md
 *   <skill-name>/...
 */
export function packageSkillFolder(skillFolder: string, outputDir: string): PackageResult {
    const abs = path.resolve(skillFolder);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
        return { success: false, error: `Not a directory: ${abs}` };
    }

    const skillMdPath = path.join(abs, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
        return { success: false, error: `SKILL.md not found in ${abs}` };
    }

    const content = fs.readFileSync(skillMdPath, 'utf8');
    const v = validateSkillMd(content);
    if (!v.valid || !v.metadata) {
        return { success: false, error: `SKILL.md validation failed: ${v.error}` };
    }

    const skillFolderName = path.basename(abs);
    const outputFile = path.resolve(outputDir, `${skillFolderName}.skill`);

    try {
        fs.mkdirSync(outputDir, { recursive: true });
        const writer = new ZipWriter();
        const parent = path.dirname(abs);

        const walk = (dir: string) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
                const full = path.join(dir, e.name);
                const rel = path.relative(parent, full);
                if (shouldExcludeForPackage(rel)) {
                    continue;
                }
                if (e.isDirectory()) {
                    walk(full);
                } else if (e.isFile()) {
                    const archiveName = rel.split(path.sep).join('/');
                    const fileData = fs.readFileSync(full);
                    writer.addFile(archiveName, fileData);
                }
            }
        };
        walk(abs);
        fs.writeFileSync(outputFile, writer.toBuffer());

        return {
            success: true,
            outputPath: outputFile,
            skillName: v.metadata.name
        };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}

/**
 * Install a skill by copying an existing folder (not a zip) into the install dir.
 */
export function installSkillFromFolder(
    sourceFolder: string,
    installDir: string,
    overwrite: boolean
): InstallResult {
    const abs = path.resolve(sourceFolder);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
        return { success: false, error: `Not a directory: ${abs}` };
    }
    const skillMdPath = path.join(abs, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
        return { success: false, error: `SKILL.md not found in ${abs}` };
    }
    const content = fs.readFileSync(skillMdPath, 'utf8');
    const v = validateSkillMd(content);
    if (!v.valid || !v.metadata) {
        return { success: false, error: `SKILL.md validation failed: ${v.error}` };
    }

    const targetDir = path.resolve(installDir, v.metadata.name);
    const rootAbs = path.resolve(installDir);
    if (!targetDir.startsWith(rootAbs + path.sep) && targetDir !== rootAbs) {
        return { success: false, error: 'Refusing to install outside install directory' };
    }

    const exists = fs.existsSync(targetDir);
    if (exists && !overwrite) {
        return {
            success: false,
            alreadyExists: true,
            skillName: v.metadata.name,
            installedPath: targetDir,
            error: `A skill named "${v.metadata.name}" is already installed`
        };
    }

    try {
        fs.mkdirSync(installDir, { recursive: true });
        if (exists) {
            fs.rmSync(targetDir, { recursive: true, force: true });
        }

        const copyDir = (src: string, dst: string, relRoot: string) => {
            fs.mkdirSync(dst, { recursive: true });
            for (const e of fs.readdirSync(src, { withFileTypes: true })) {
                const s = path.join(src, e.name);
                const d = path.join(dst, e.name);
                const rel = path.join(relRoot, e.name);
                if (shouldExcludeForPackage(rel)) {
                    continue;
                }
                if (e.isDirectory()) {
                    copyDir(s, d, rel);
                } else if (e.isFile()) {
                    fs.copyFileSync(s, d);
                }
            }
        };
        copyDir(abs, targetDir, v.metadata.name);

        return {
            success: true,
            skillName: v.metadata.name,
            installedPath: targetDir,
            metadata: v.metadata
        };
    } catch (e) {
        return { success: false, error: (e as Error).message };
    }
}
