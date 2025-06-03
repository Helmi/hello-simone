#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();

const GITHUB_API_URL = 'https://api.github.com/repos/helmi/claude-simone';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/helmi/claude-simone/master';

async function fetchGitHubContent(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'hello-simone' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    https.get(url, { headers: { 'User-Agent': 'hello-simone' } }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      pipeline(response, file)
        .then(() => resolve())
        .catch(reject);
    }).on('error', reject);
  });
}

async function getDirectoryStructure(path = '') {
  const url = `${GITHUB_API_URL}/contents/${path}`;
  const content = await fetchGitHubContent(url);
  return JSON.parse(content);
}

async function checkExistingInstallation() {
  const simoneExists = await fs.access('.simone').then(() => true).catch(() => false);
  const claudeCommandsExists = await fs.access('.claude/commands/simone').then(() => true).catch(() => false);
  return simoneExists || claudeCommandsExists;
}

async function backupFile(filePath) {
  try {
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (exists) {
      const backupPath = `${filePath}.bak`;
      await fs.copyFile(filePath, backupPath);
      return backupPath;
    }
  } catch (error) {
    // Backup failed, but continue
  }
  return null;
}

async function backupCommandsAndDocs() {
  const spinner = ora('Backing up existing commands and documentation...').start();
  const backedUpFiles = [];
  
  try {
    // Files that will be updated and need backup
    const filesToBackup = [
      '.simone/CLAUDE.md',
      '.simone/02_REQUIREMENTS/CLAUDE.md',
      '.simone/03_SPRINTS/CLAUDE.md',
      '.simone/04_GENERAL_TASKS/CLAUDE.md'
    ];

    // Backup CLAUDE.md files
    for (const file of filesToBackup) {
      const backupPath = await backupFile(file);
      if (backupPath) {
        backedUpFiles.push(backupPath);
      }
    }

    // Backup all command files
    const commandsDir = '.claude/commands/simone';
    const commandsExist = await fs.access(commandsDir).then(() => true).catch(() => false);
    if (commandsExist) {
      try {
        const commandFiles = await fs.readdir(commandsDir, { recursive: true });
        for (const file of commandFiles) {
          const filePath = path.join(commandsDir, file);
          const stat = await fs.stat(filePath);
          if (stat.isFile()) {
            const backupPath = await backupFile(filePath);
            if (backupPath) {
              backedUpFiles.push(backupPath);
            }
          }
        }
      } catch (error) {
        // Commands directory might be empty or have issues
      }
    }

    if (backedUpFiles.length > 0) {
      spinner.succeed(chalk.green(`Backed up ${backedUpFiles.length} files (*.bak)`));
    } else {
      spinner.succeed(chalk.gray('No existing files to backup'));
    }
    return backedUpFiles;
  } catch (error) {
    spinner.fail(chalk.red('Backup failed'));
    throw error;
  }
}

async function downloadDirectory(githubPath, localPath, spinner) {
  await fs.mkdir(localPath, { recursive: true });
  
  const items = await getDirectoryStructure(githubPath);
  
  for (const item of items) {
    const itemLocalPath = path.join(localPath, item.name);
    
    if (item.type === 'dir') {
      await downloadDirectory(item.path, itemLocalPath, spinner);
    } else if (item.type === 'file') {
      spinner.text = `Downloading ${item.path}...`;
      await downloadFile(item.download_url, itemLocalPath);
    }
  }
}

async function installSimone(options = {}) {
  console.log(chalk.blue.bold('\n🎉 Welcome to HelloSimone!\n'));
  console.log(chalk.gray('This installer will set up the Simone project management framework'));
  console.log(chalk.gray('for your Claude Code project.\n'));

  const hasExisting = await checkExistingInstallation();
  
  if (hasExisting && !options.force) {
    const response = await prompts({
      type: 'select',
      name: 'action',
      message: 'Existing Simone installation detected. What would you like to do?',
      choices: [
        { title: 'Update (updates commands and docs only, preserves your work)', value: 'update' },
        { title: 'Skip installation', value: 'skip' },
        { title: 'Cancel', value: 'cancel' }
      ]
    });

    if (response.action === 'skip' || response.action === 'cancel') {
      console.log(chalk.yellow('\nInstallation cancelled.'));
      process.exit(0);
    }

    if (response.action === 'update') {
      await backupCommandsAndDocs();
    }
  }

  const spinner = ora('Fetching Simone framework from GitHub...').start();

  try {
    // Create .simone directory structure
    const simoneDirs = [
      '.simone',
      '.simone/01_PROJECT_DOCS',
      '.simone/02_REQUIREMENTS',
      '.simone/03_SPRINTS',
      '.simone/04_GENERAL_TASKS',
      '.simone/05_ARCHITECTURE_DECISIONS',
      '.simone/10_STATE_OF_PROJECT',
      '.simone/99_TEMPLATES'
    ];

    for (const dir of simoneDirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Only download manifest on fresh installs
    if (!hasExisting) {
      spinner.text = 'Downloading Simone framework files...';
      
      // Get the root manifest
      try {
        const manifestUrl = `${GITHUB_RAW_URL}/.simone/00_PROJECT_MANIFEST.md`;
        await downloadFile(manifestUrl, '.simone/00_PROJECT_MANIFEST.md');
      } catch (error) {
        // If manifest doesn't exist, that's okay
      }

      // Download templates on fresh install
      try {
        await downloadDirectory('.simone/99_TEMPLATES', '.simone/99_TEMPLATES', spinner);
      } catch (error) {
        spinner.text = 'Templates directory not found, skipping...';
      }
    }

    // Always update CLAUDE.md documentation files
    spinner.text = 'Updating documentation...';
    const claudeFiles = [
      '.simone/CLAUDE.md',
      '.simone/02_REQUIREMENTS/CLAUDE.md',
      '.simone/03_SPRINTS/CLAUDE.md',
      '.simone/04_GENERAL_TASKS/CLAUDE.md'
    ];

    for (const claudeFile of claudeFiles) {
      try {
        const claudeUrl = `${GITHUB_RAW_URL}/${claudeFile}`;
        await downloadFile(claudeUrl, claudeFile);
      } catch (error) {
        // If CLAUDE.md doesn't exist, that's okay
      }
    }

    // Create .claude/commands/simone directory
    await fs.mkdir('.claude/commands/simone', { recursive: true });

    // Always update commands
    spinner.text = 'Updating Simone commands...';
    try {
      await downloadDirectory('.claude/commands/simone', '.claude/commands/simone', spinner);
    } catch (error) {
      spinner.text = 'Commands directory not found, skipping...';
    }

    if (hasExisting) {
      spinner.succeed(chalk.green('✅ Simone framework updated successfully!'));
      console.log(chalk.blue('\n🔄 Updated:'));
      console.log(chalk.gray('   • Commands in .claude/commands/simone/'));
      console.log(chalk.gray('   • Documentation (CLAUDE.md files)'));
      console.log(chalk.green('\n💾 Your work is preserved:'));
      console.log(chalk.gray('   • All tasks, sprints, and project files remain untouched'));
      console.log(chalk.gray('   • Backups created as *.bak files'));
    } else {
      spinner.succeed(chalk.green('✅ Simone framework installed successfully!'));
    }

    console.log(chalk.blue('\n📁 Created structure:'));
    console.log(chalk.gray('   .simone/              - Project management root'));
    console.log(chalk.gray('   .claude/commands/     - Claude custom commands'));

    console.log(chalk.green('\n🚀 Next steps:'));
    console.log(chalk.white('   1. Open this project in Claude Code'));
    console.log(chalk.white('   2. Use /project:simone commands to manage your project'));
    console.log(chalk.white('   3. Start with /project:simone:initialize to set up your project\n'));

  } catch (error) {
    spinner.fail(chalk.red('Installation failed'));
    console.error(chalk.red('\nError details:'), error.message);
    process.exit(1);
  }
}

program
  .name('hello-simone')
  .description('Installer for the Simone project management framework')
  .version('0.3.0')
  .option('-f, --force', 'Force installation without prompts')
  .action(installSimone);

program.parse();