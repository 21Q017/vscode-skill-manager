/**
 * Minimal YAML parser for SKILL.md frontmatter.
 *
 * Supports exactly what skill files need:
 *   - Flat key-value pairs: `key: value`
 *   - Double-quoted, single-quoted, or unquoted string values
 *   - Block scalars for long descriptions:
 *       description: |
 *         multi-line
 *         text
 *       description: >
 *         folded
 *         text
 *   - Comments (lines starting with #) and blank lines.
 *
 * Does NOT support nested mappings, sequences, or anchors — SKILL.md doesn't
 * need them. The `metadata:` field (which may be nested) is parsed as an
 * opaque string; we don't introspect it.
 */
export type YamlValue = string | number | boolean | null;

export interface ParseResult {
    ok: true;
    data: Record<string, YamlValue>;
}
export interface ParseError {
    ok: false;
    error: string;
}

export function parseFrontmatter(text: string): ParseResult | ParseError {
    const lines = text.split(/\r?\n/);
    const data: Record<string, YamlValue> = {};

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        // Skip blank lines and full-line comments.
        if (/^\s*$/.test(line) || /^\s*#/.test(line)) {
            i++;
            continue;
        }

        // Indented lines at top level = error (we don't support nested).
        if (/^\s+\S/.test(line) && !line.startsWith(' ')) {
            // (first branch never true; kept explicit)
        }

        const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*$/);
        if (!m) {
            return { ok: false, error: `Line ${i + 1}: could not parse "${line}"` };
        }
        const key = m[1];
        let rest = m[2];

        // Strip an inline comment (but not if inside quotes).
        rest = stripInlineComment(rest);

        if (rest === '' || rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
            // Block scalar. Collect indented continuation lines.
            const folded = rest.startsWith('>');
            const stripTrailing = rest.endsWith('-');
            i++;
            const collected: string[] = [];
            let baseIndent = -1;
            while (i < lines.length) {
                const l = lines[i];
                if (/^\s*$/.test(l)) {
                    collected.push('');
                    i++;
                    continue;
                }
                const indentMatch = l.match(/^(\s+)/);
                if (!indentMatch) {
                    break; // Dedented to column 0 → end of block scalar.
                }
                const indent = indentMatch[1].length;
                if (baseIndent === -1) {
                    baseIndent = indent;
                }
                if (indent < baseIndent) {
                    break;
                }
                collected.push(l.substring(baseIndent));
                i++;
            }
            let value = folded
                ? foldLines(collected)
                : collected.join('\n');
            if (stripTrailing) {
                value = value.replace(/\n+$/, '');
            } else if (rest === '|' || rest === '>') {
                // Keep exactly one trailing newline if absent.
                if (!value.endsWith('\n')) {
                    value += '\n';
                }
            }
            if (rest === '') {
                // `key:` with nothing — treat as empty string, not block.
                data[key] = '';
            } else {
                data[key] = value;
            }
            continue;
        }

        // Inline scalar value.
        data[key] = parseScalar(rest);
        i++;
    }

    return { ok: true, data };
}

function stripInlineComment(s: string): string {
    // Honor quoted strings: don't cut a '#' inside quotes.
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '"' && !inSingle) {
            inDouble = !inDouble;
        } else if (c === "'" && !inDouble) {
            inSingle = !inSingle;
        } else if (c === '#' && !inSingle && !inDouble) {
            // Require whitespace before #, else it's part of the value.
            if (i === 0 || /\s/.test(s[i - 1])) {
                return s.substring(0, i).replace(/\s+$/, '');
            }
        }
    }
    return s;
}

function parseScalar(raw: string): YamlValue {
    const s = raw.trim();
    if (s === '') {
        return '';
    }
    // Quoted strings.
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
        return unescapeDouble(s.substring(1, s.length - 1));
    }
    if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) {
        return s.substring(1, s.length - 1).replace(/''/g, "'");
    }
    // Booleans.
    if (s === 'true' || s === 'True' || s === 'TRUE') return true;
    if (s === 'false' || s === 'False' || s === 'FALSE') return false;
    if (s === 'null' || s === 'Null' || s === 'NULL' || s === '~') return null;
    // Numbers.
    if (/^-?\d+$/.test(s)) {
        const n = parseInt(s, 10);
        if (Number.isSafeInteger(n)) return n;
    }
    if (/^-?\d+\.\d+$/.test(s)) {
        return parseFloat(s);
    }
    // Fallback: unquoted string.
    return s;
}

function unescapeDouble(s: string): string {
    return s.replace(/\\(["\\nrt])/g, (_m, ch) => {
        switch (ch) {
            case 'n':
                return '\n';
            case 'r':
                return '\r';
            case 't':
                return '\t';
            default:
                return ch;
        }
    });
}

function foldLines(lines: string[]): string {
    // YAML folded style: newlines between non-empty lines become spaces;
    // blank lines become single newlines.
    const out: string[] = [];
    let prevBlank = false;
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (l === '') {
            out.push('\n');
            prevBlank = true;
            continue;
        }
        if (out.length > 0 && !prevBlank) {
            out.push(' ');
        }
        out.push(l);
        prevBlank = false;
    }
    return out.join('');
}
