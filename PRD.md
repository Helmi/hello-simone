# HelloSimone - Installer for Simone Framework

## Overview

A minimal npx-executable tool to install the Simone project management framework into Claude Code projects.

## Core Functionality

### Installation Command
```bash
npx HelloSimone
```

### What It Does

1. **Creates Directory Structure**
   - Creates `.simone/` with all subdirectories
   - Creates `.claude/commands/simone/` for custom commands

2. **Fetches From GitHub**
   - Downloads latest Simone structure from github.com/helmi/claude-simone
   - Installs commands and templates

3. **Handles Existing Installations**
   - Detects existing `.simone/` or `.claude/commands/simone/`
   - Offers update/upgrade option (overwrites commands and templates only)
   - Preserves user data (tasks, sprints, documentation)

## Technical Approach

- **Zero dependencies** - Uses only Node.js built-ins
- **GitHub fetching** - Downloads files directly from repository
- **Simple CLI** - Minimal prompts, clear messages

## Installation Flow

1. Show welcome message and brief description
2. Check for existing installation
3. If exists, ask: Update / Skip / Cancel
4. Fetch files from GitHub
5. Create directories and copy files
6. Show success message with next steps

## File Structure Created

```
project-root/
├── .simone/
│   ├── 00_PROJECT_MANIFEST.md
│   ├── 01_PROJECT_DOCS/
│   ├── 02_REQUIREMENTS/
│   ├── 03_SPRINTS/
│   ├── 04_GENERAL_TASKS/
│   ├── 05_ARCHITECTURE_DECISIONS/
│   ├── 10_STATE_OF_PROJECT/
│   └── 99_TEMPLATES/
└── .claude/
    └── commands/
        └── simone/
            └── (all Simone commands)
```

## Success Criteria

- One command installation
- Works in any project directory
- Respects existing Claude setups
- Clear feedback to user
- No complex configuration

## Future Considerations

- Version selection (not for v0.1.0)
- Execution controller features
- AI-guided setup (separate discussion)