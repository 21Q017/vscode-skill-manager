<div align="center">

# 🧩 Skill Manager

**A VSCode extension for managing AI skill packages — with presets, drag & drop, and bilingual UI.**

**一个 VSCode 扩展，用于管理 AI 技能包 —— 支持技能组合、拖拽安装和中英双语界面。**

[![VSCode](https://img.shields.io/badge/VSCode-%3E%3D1.80.0-007ACC?logo=visual-studio-code)](https://code.visualstudio.com/)
[![Version](https://img.shields.io/badge/version-0.3.0-blue)](https://github.com/Q1anfang2/skill-manager/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Publisher](https://img.shields.io/badge/publisher-Q1anfang2-purple)](https://github.com/Q1anfang2)
[![Zero Dependencies](https://img.shields.io/badge/runtime%20deps-0-brightgreen)](#zero-dependencies)

[English](#features) · [中文](#功能特性)

</div>

---

## ✨ Features

### 📦 Install Skills — Four Ways

| Method | How |
|--------|-----|
| **Sidebar button** | Click the upload icon, pick `.skill` / `.zip` files |
| **Drag & drop** | Drop files or folders directly onto the sidebar |
| **Explorer right-click** | Right-click any `.skill` / `.zip` → *Install Skill Package* |
| **From folder** | Command palette → *Skill Manager: From Folder* |

Every install validates `SKILL.md` frontmatter, rejects unsafe archives (path traversal, zip bombs), and handles name collisions gracefully.

### 🎛️ Skill Presets — One-Click Combos

Create named collections of skills and switch between them instantly.

```
▸ 📚 PRESETS (2)
    ⚡ Writing        Active · 3 skills
       docx
       pdf
       frontend-design
    🔬 Research       4 skills
▸ 📖 ALL SKILLS (6)
    ✓ docx
    ✓ pdf
    ○ xlsx
    ✓ frontend-design
    ○ skill-creator
    ○ canvas-design
```

- **Click a preset** to activate it — all its skills light up, the rest go dark.
- **Click again** to deactivate and return to manual selection.
- **Status bar** shows the active preset — click it for a **quick-switch** dropdown.
- Presets are saved to `.skill-presets.json` in your skills directory — commit it to share with your team.

### ✅ Per-Skill Toggle

Click any skill in the "ALL SKILLS" section to enable/disable it individually. Icons change in real time:

- `✓` green check = enabled
- `○` gray circle = disabled

Use the checklist button (☑) in the sidebar header to bulk-select via a multi-pick dialog.

### 📤 Export & Share

- Right-click an installed skill → **Export as `.skill` Package**
- Or right-click any folder in the Explorer that has a `SKILL.md`
- Auto-excludes junk: `__pycache__`, `node_modules`, `.git`, `*.pyc`, `.DS_Store`, and root-level `evals/`

### 🌐 Bilingual UI (English / 中文)

- Auto-detects your VSCode language
- Manual switch: sidebar menu → **Switch Language** or set `skillManager.language`
- All commands, messages, and prompts are fully translated

### 🔒 Zero Dependencies

The extension ships with **zero runtime npm dependencies**. ZIP reading/writing and YAML parsing are implemented from scratch using only Node.js built-ins (`zlib`, `Buffer`). This means:

- Tiny install size (~48 KB `.vsix`)
- No supply-chain risk
- Fast activation

---

## 🚀 Quick Start

### Install

**Option A — From `.vsix` file:**

1. Download `skill-manager-0.3.0.vsix` from [Releases](https://github.com/Q1anfang2/skill-manager/releases)
2. In VSCode: Extensions view → `···` → **Install from VSIX...** → select the file

**Option B — From source:**

```bash
git clone https://github.com/Q1anfang2/skill-manager.git
cd skill-manager
npm install
npm run compile
npx vsce package --allow-missing-repository
code --install-extension skill-manager-0.3.0.vsix
```

### First Use

1. Open a project in VSCode
2. Click the **📚 Skill Manager** icon in the activity bar (left sidebar)
3. Upload a `.skill` package or drag one onto the panel
4. Create a preset to group your favorite skills

---

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `skillManager.installDir` | `""` | Skills directory. Default: `<workspace>/.github/skills` (or `~/.github/skills` without a workspace). Supports `~` expansion, absolute and relative paths. |
| `skillManager.overwriteExisting` | `ask` | What to do when a skill already exists: `ask` / `always` / `never` |
| `skillManager.language` | `auto` | UI language: `auto` / `en` / `zh-cn` |

---

## 📋 Commands

### Skill Management

| Command | Description |
|---------|-------------|
| `Upload \| 上传安装` | Pick and install `.skill` / `.zip` packages |
| `From Folder \| 从文件夹` | Install from a folder containing `SKILL.md` |
| `Export \| 导出` | Package an installed skill as `.skill` archive |
| `Delete Skill \| 删除技能` | Remove a skill folder from disk |
| `Open SKILL.md \| 打开` | Open the skill's `SKILL.md` in the editor |
| `Refresh \| 刷新` | Rescan the install directory |
| `Reveal Dir \| 打开目录` | Open the install folder in your OS file manager |
| `Set Dir \| 设置目录` | Choose a custom install directory |

### Skill Selection

| Command | Description |
|---------|-------------|
| `Select Skills \| 选择技能` | Multi-pick dialog to enable/disable skills |
| `Enable All \| 全部启用` | Activate all installed skills |
| `Disable All \| 全部禁用` | Deactivate all installed skills |
| `Toggle \| 切换启用` | Toggle a single skill on/off |

### Presets

| Command | Description |
|---------|-------------|
| `New Preset \| 新建组合` | Create a preset (name → icon → select skills) |
| `Apply Preset \| 应用组合` | Activate a preset |
| `Edit Preset \| 编辑组合` | Change which skills are in a preset |
| `Rename Preset \| 重命名组合` | Rename a preset |
| `Delete Preset \| 删除组合` | Remove a preset |
| `Quick Switch \| 快速切换组合` | Status bar dropdown to switch presets |
| `Language \| 语言` | Switch between English and 中文 |

---

## 📐 Skill Package Format

A `.skill` file is a ZIP archive. Two layouts are supported:

**Flat** (SKILL.md at root):
```
SKILL.md
scripts/
references/
assets/
```

**Nested** (as produced by `skill-creator`):
```
my-skill/
  SKILL.md
  scripts/
  references/
```

### SKILL.md Spec

Must begin with YAML frontmatter:

```yaml
---
name: my-skill                    # kebab-case, max 64 chars
description: What this skill does # max 1024 chars, no < >
---

# My Skill

Instructions for the AI go here...
```

**Allowed frontmatter fields:** `name`, `description`, `license`, `allowed-tools`, `metadata`, `compatibility`

**Validation rules:**
- `name` is required, must be kebab-case (`a-z`, `0-9`, `-`), no leading/trailing/double hyphens
- `description` is required, no angle brackets, max 1024 characters
- Unknown properties are rejected

---

## 📁 Persistent Files

The extension creates two JSON files in the install directory:

| File | Purpose |
|------|---------|
| `.active-skills.json` | Which skills are enabled/disabled |
| `.skill-presets.json` | Preset definitions and active preset |

Both are plain JSON, safe to commit to version control for team sharing.

---

## 🛠️ Development

```
skill-manager/
├── package.json               # Extension manifest
├── tsconfig.json
├── src/
│   ├── extension.ts           # Activation, commands, status bar
│   ├── i18n.ts                # Bilingual text (en / zh-cn)
│   ├── skillTreeProvider.ts   # Two-section sidebar tree + drag-and-drop
│   ├── skillSelector.ts       # Per-skill enable/disable state
│   ├── skillPresets.ts        # Preset (combo) management
│   ├── skillInstaller.ts      # Inspect / extract / install / export
│   ├── skillValidator.ts      # SKILL.md YAML frontmatter validation
│   ├── miniYaml.ts            # Zero-dep YAML frontmatter parser
│   └── miniZip.ts             # Zero-dep ZIP reader/writer (Node zlib)
├── .vscodeignore
└── .gitignore
```

### Build

```bash
npm install        # Install type definitions only (zero runtime deps)
npm run compile    # TypeScript → out/
```

### Debug

Open the folder in VSCode, press **F5** to launch an Extension Development Host.

### Package

```bash
npx vsce package --allow-missing-repository
# → skill-manager-0.3.0.vsix
```

---

## 📄 License

[MIT](LICENSE)

---

<div align="center">

# 🧩 Skill Manager

**中文文档**

</div>

## 功能特性

### 📦 四种安装方式

| 方式 | 操作 |
|------|------|
| **侧边栏按钮** | 点击上传图标，选择 `.skill` / `.zip` 文件 |
| **拖拽安装** | 直接拖拽文件或文件夹到侧边栏 |
| **右键菜单** | 在资源管理器中右键 `.skill` / `.zip` → *安装技能包* |
| **从文件夹** | 命令面板 → *Skill Manager: 从文件夹* |

每次安装都会验证 `SKILL.md` 格式、检查压缩包安全性（路径穿越、zip 炸弹等），并妥善处理重名冲突。

### 🎛️ 技能组合 — 一键切换

创建常用技能的命名组合，随时一键切换：

```
▸ 📚 技能组合 (2)
    ⚡ 写作           使用中 · 3 个技能
       docx
       pdf
       frontend-design
    🔬 研究           4 个技能
▸ 📖 全部技能 (6)
    ✓ docx
    ✓ pdf
    ○ xlsx
    ...
```

- **点击组合**立即激活，再点取消
- **状态栏**显示当前组合名，点击弹出快速切换面板
- 组合配置保存在 `.skill-presets.json`，可提交 Git 与团队共享

### ✅ 单个技能切换

在「全部技能」区域点击任意技能，即可启用/禁用。颜色实时变化：

- `✓` 绿色 = 已启用
- `○` 灰色 = 未启用

也可通过侧边栏顶部的 ☑ 按钮批量勾选。

### 📤 导出分享

- 右键已安装的技能 → **导出为 .skill 包**
- 或右键资源管理器中任意含 `SKILL.md` 的文件夹
- 自动排除：`__pycache__`、`node_modules`、`.git`、`*.pyc`、`.DS_Store`、`evals/`

### 🌐 中英双语

- 自动跟随 VSCode 语言设置
- 手动切换：侧边栏菜单 → **切换语言**，或设置 `skillManager.language`
- 所有命令、提示、消息均已完整翻译

### 🔒 零依赖

插件没有任何运行时 npm 依赖。ZIP 读写和 YAML 解析均使用 Node.js 内置模块手写实现，安装包仅 ~48 KB。

---

## 🚀 快速开始

### 安装

1. 从 [Releases](https://github.com/Q1anfang2/skill-manager/releases) 下载 `skill-manager-0.3.0.vsix`
2. 在 VSCode 中：扩展视图 → `···` → **从 VSIX 安装...** → 选择文件

### 首次使用

1. 在 VSCode 中打开一个项目
2. 点击左侧活动栏的 **📚 Skill Manager** 图标
3. 上传或拖入一个 `.skill` 技能包
4. 创建一个技能组合，把常用技能分组

---

## ⚙️ 设置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `skillManager.installDir` | `""` | 技能目录。默认：`<工作区>/.github/skills`。支持 `~`、绝对路径和相对路径。 |
| `skillManager.overwriteExisting` | `ask` | 同名技能覆盖策略：`ask` 询问 / `always` 总是 / `never` 从不 |
| `skillManager.language` | `auto` | 界面语言：`auto` 自动 / `en` 英文 / `zh-cn` 中文 |

---

## 📐 技能包格式

`.skill` 文件本质是 ZIP 压缩包。`SKILL.md` 必须以 YAML 头部开始：

```yaml
---
name: my-skill            # 小写字母、数字、连字符，最长 64 字符
description: 这个技能做什么  # 最长 1024 字符，不能含 < >
---

# 我的技能

AI 使用说明写在这里...
```

---

<div align="center">

Made with ❤️ by [Q1anfang2](https://github.com/Q1anfang2)

</div>
