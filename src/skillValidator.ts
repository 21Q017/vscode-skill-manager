import { parseFrontmatter } from './miniYaml';

/**
 * Parsed skill metadata from SKILL.md frontmatter.
 */
export interface SkillMetadata {
    name: string;
    description: string;
    license?: string;
    compatibility?: string;
    [key: string]: unknown;
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
    metadata?: SkillMetadata;
}

const ALLOWED_PROPERTIES = new Set([
    'name',
    'description',
    'license',
    'allowed-tools',
    'metadata',
    'compatibility'
]);

const NAME_PATTERN = /^[a-z0-9-]+$/;

/**
 * Parse and validate a SKILL.md file's content.
 * Mirrors the rules in skill-creator/scripts/quick_validate.py.
 */
export function validateSkillMd(content: string): ValidationResult {
    if (!content.startsWith('---')) {
        return { valid: false, error: 'SKILL.md must start with YAML frontmatter (---)' };
    }

    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
        return { valid: false, error: 'Invalid frontmatter format: missing closing ---' };
    }

    let frontmatter: Record<string, unknown>;
    const parsed = parseFrontmatter(match[1]);
    if (!parsed.ok) {
        return { valid: false, error: `Invalid YAML in frontmatter: ${parsed.error}` };
    }
    frontmatter = parsed.data as Record<string, unknown>;

    const unexpected = Object.keys(frontmatter).filter((k) => !ALLOWED_PROPERTIES.has(k));
    if (unexpected.length > 0) {
        return {
            valid: false,
            error: `Unexpected frontmatter key(s): ${unexpected.sort().join(', ')}. Allowed: ${[...ALLOWED_PROPERTIES].sort().join(', ')}`
        };
    }

    if (!('name' in frontmatter)) {
        return { valid: false, error: "Missing 'name' in frontmatter" };
    }
    if (!('description' in frontmatter)) {
        return { valid: false, error: "Missing 'description' in frontmatter" };
    }

    const name = frontmatter.name;
    if (typeof name !== 'string') {
        return { valid: false, error: `Name must be a string, got ${typeof name}` };
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
        return { valid: false, error: "'name' cannot be empty" };
    }
    if (!NAME_PATTERN.test(trimmedName)) {
        return {
            valid: false,
            error: `Name "${trimmedName}" must be kebab-case (lowercase letters, digits, hyphens only)`
        };
    }
    if (trimmedName.startsWith('-') || trimmedName.endsWith('-') || trimmedName.includes('--')) {
        return {
            valid: false,
            error: `Name "${trimmedName}" cannot start/end with hyphen or contain consecutive hyphens`
        };
    }
    if (trimmedName.length > 64) {
        return { valid: false, error: `Name is too long (${trimmedName.length} chars). Max 64.` };
    }

    const description = frontmatter.description;
    if (typeof description !== 'string') {
        return { valid: false, error: `Description must be a string, got ${typeof description}` };
    }
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
        return { valid: false, error: "'description' cannot be empty" };
    }
    if (trimmedDesc.includes('<') || trimmedDesc.includes('>')) {
        return { valid: false, error: 'Description cannot contain angle brackets (< or >)' };
    }
    if (trimmedDesc.length > 1024) {
        return {
            valid: false,
            error: `Description is too long (${trimmedDesc.length} chars). Max 1024.`
        };
    }

    const compatibility = frontmatter.compatibility;
    if (compatibility !== undefined) {
        if (typeof compatibility !== 'string') {
            return {
                valid: false,
                error: `Compatibility must be a string, got ${typeof compatibility}`
            };
        }
        if (compatibility.length > 500) {
            return {
                valid: false,
                error: `Compatibility is too long (${compatibility.length} chars). Max 500.`
            };
        }
    }

    return {
        valid: true,
        metadata: {
            ...frontmatter,
            name: trimmedName,
            description: trimmedDesc
        } as SkillMetadata
    };
}
