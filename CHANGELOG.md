# Changelog

All notable changes to **Skill Manager** will be documented in this file.

## [0.3.0] - 2025-04-17

### Added
- **Skill Presets** — create named skill combos, one-click to activate
  - Create / edit / rename / delete presets
  - Pick from 18 codicon icons for each preset
  - Quick-switch dropdown from the status bar
  - Persistent storage in `.skill-presets.json`
- **Two-section sidebar** — "PRESETS" section on top, "ALL SKILLS" below
- **Color-coded icons** — green for active, gray for disabled
- **Status bar preset indicator** — shows active preset name + skill count

### Changed
- Sidebar tree layout redesigned with section headers and colored icons
- Status bar now shows preset name when one is active

## [0.2.0] - 2025-04-17

### Added
- **Bilingual UI** (English / 中文) — auto-detects or manually switchable
- **Per-skill toggle** — click to enable/disable individual skills
- **Bulk select** — multi-pick dialog via the checklist button
- **Enable All / Disable All** commands
- **Language switch** command in sidebar menu
- Persistent skill selection state in `.active-skills.json`
- `skillManager.language` setting (`auto` / `en` / `zh-cn`)

### Changed
- Publisher changed to `Q1anfang2`
- Default install directory changed to `<workspace>/.github/skills`

## [0.1.0] - 2025-04-16

### Added
- Initial release
- Upload & install `.skill` / `.zip` packages
- Drag & drop installation onto sidebar
- Explorer right-click context menu integration
- SKILL.md YAML frontmatter validation (mirrors `skill-creator` rules)
- Export installed skills as `.skill` archives
- Install from existing folder
- Configurable install directory with `~` expansion
- Overwrite policy setting (`ask` / `always` / `never`)
- Status bar skill count indicator
- Workspace-aware: refreshes on workspace folder change
- Safety: rejects path traversal, absolute paths, zip bombs (>200 MB, >10k entries)
- **Zero runtime dependencies** — custom ZIP reader/writer and YAML parser using only Node.js built-ins
