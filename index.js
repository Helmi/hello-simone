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

async function createBackup() {
  const backupDir = `.simone_backup_${Date.now()}`;
  const spinner = ora('Creating backup...').start();
  
  try {
    if (await fs.access('.simone').then(() => true).catch(() => false)) {
      await fs.cp('.simone', backupDir, { recursive: true });
    }
    if (await fs.access('.claude/commands/simone').then(() => true).catch(() => false)) {
      await fs.mkdir(path.join(backupDir, '.claude/commands'), { recursive: true });
      await fs.cp('.claude/commands/simone', path.join(backupDir, '.claude/commands/simone'), { recursive: true });
    }
    spinner.succeed(chalk.green(`Backup created at ${backupDir}`));
    return backupDir;
  } catch (error) {
    spinner.fail(chalk.red('Failed to create backup'));
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
        { title: 'Update (overwrites commands and templates)', value: 'update' },
        { title: 'Skip installation', value: 'skip' },
        { title: 'Cancel', value: 'cancel' }
      ]
    });

    if (response.action === 'skip' || response.action === 'cancel') {
      console.log(chalk.yellow('\nInstallation cancelled.'));
      process.exit(0);
    }

    if (response.action === 'update') {
      await createBackup();
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

    // Download .simone content
    spinner.text = 'Downloading Simone framework files...';
    
    // Get the root manifest
    try {
      const manifestUrl = `${GITHUB_RAW_URL}/.simone/00_PROJECT_MANIFEST.md`;
      await downloadFile(manifestUrl, '.simone/00_PROJECT_MANIFEST.md');
    } catch (error) {
      // If manifest doesn't exist, that's okay
    }

    // Download templates
    try {
      await downloadDirectory('.simone/99_TEMPLATES', '.simone/99_TEMPLATES', spinner);
    } catch (error) {
      spinner.text = 'Templates directory not found, skipping...';
    }

    // Create .claude/commands/simone directory
    await fs.mkdir('.claude/commands/simone', { recursive: true });

    // Download commands
    spinner.text = 'Installing Simone commands...';
    try {
      await downloadDirectory('.claude/commands/simone', '.claude/commands/simone', spinner);
    } catch (error) {
      spinner.text = 'Commands directory not found, skipping...';
    }

    spinner.succeed(chalk.green('✅ Simone framework installed successfully!'));

    console.log(chalk.blue('\n📁 Created structure:'));
    console.log(chalk.gray('   .simone/              - Project management root'));
    console.log(chalk.gray('   .claude/commands/     - Claude custom commands'));

    console.log(chalk.green('\n🚀 Next steps:'));
    console.log(chalk.white('   1. Open this project in Claude Code'));
    console.log(chalk.white('   2. Use /simone commands to manage your project'));
    console.log(chalk.white('   3. Start with /simone init to set up your project\n'));

  } catch (error) {
    spinner.fail(chalk.red('Installation failed'));
    console.error(chalk.red('\nError details:'), error.message);
    process.exit(1);
  }
}

program
  .name('hello-simone')
  .description('Installer for the Simone project management framework')
  .version('0.1.0')
  .option('-f, --force', 'Force installation without prompts')
  .action(installSimone);

program.parse();