# hello-simone

> 🚀 Quick installer for the Simone project management framework for Claude Code

## What is Simone?

Simone is a markdown-based project management framework designed specifically for AI-assisted development with Claude Code. It helps break down software projects into manageable chunks for effective AI handling.

## Installation

Install Simone in any project directory:

```bash
npx hello-simone
```

That's it! The installer will:
- Create the `.simone/` directory structure for project management
- Set up `.claude/commands/simone/` for custom Claude commands
- Download the latest templates and documentation

## Usage

### First Time Installation

```bash
npx hello-simone
```

### Update Existing Installation

If Simone is already installed, the installer will detect it and offer options to:
- Update (with automatic backup)
- Skip installation
- Cancel

### Force Installation

Skip all prompts and force installation:

```bash
npx hello-simone --force
```

## What Gets Installed

```
your-project/
├── .simone/
│   ├── 00_PROJECT_MANIFEST.md      # Project overview
│   ├── 01_PROJECT_DOCS/            # Documentation
│   ├── 02_REQUIREMENTS/            # Requirements & specs
│   ├── 03_SPRINTS/                 # Sprint planning
│   ├── 04_GENERAL_TASKS/           # Task management
│   ├── 05_ARCHITECTURE_DECISIONS/  # ADRs
│   ├── 10_STATE_OF_PROJECT/        # Current state
│   └── 99_TEMPLATES/               # Reusable templates
└── .claude/
    └── commands/
        └── simone/                 # Claude custom commands
```

## Next Steps

After installation:

1. Open your project in Claude Code
2. Use `/simone` commands to manage your project
3. Start with `/simone init` to set up your project

## Features

- 🎨 Beautiful CLI with colors and progress indicators
- 🔄 Smart update detection with automatic backups
- 📦 Downloads directly from the official GitHub repository
- 🚀 Works with `npx` - no global installation needed
- 💾 Creates timestamped backups when updating

## Requirements

- Node.js 14.0.0 or higher
- Internet connection to download from GitHub

## Source

This installer fetches the Simone framework from:
https://github.com/helmi/claude-simone

## License

MIT