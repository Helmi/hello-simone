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

async function fetchGitHubContent(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'hello-simone' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse JSON response from GitHub.'));
          }
        } else {
          reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchLatestVersion() {
  try {
    const tags = await fetchGitHubContent('https://api.github.com/repos/helmi/claude-simone/tags');
    // Filter for version tags and sort
    const versionTags = tags
      .map(tag => tag.name)
      .filter(name => name.match(/^v\d+\.\d+(\.\d+)?$/))
      .sort((a, b) => {
        const parseVersion = (v) => v.slice(1).split('.').map(n => parseInt(n, 10));
        const va = parseVersion(a);
        const vb = parseVersion(b);
        for (let i = 0; i < Math.max(va.length, vb.length); i++) {
          const diff = (vb[i] || 0) - (va[i] || 0);
          if (diff !== 0) return diff;
        }
        return 0;
      });
    return versionTags[0] || 'v0.3.5'; // fallback to known version
  } catch (error) {
    console.warn(chalk.yellow('Unable to fetch latest version, using default.'));
    return 'v0.3.5'; // fallback version
  }
}

async function downloadFile(url, destPath) {
    await fs.mkdir(path.dirname(destPath), { recursive: true });
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

async function downloadDirectory(githubPath, localPath, spinner, branch) {
  try {
    await fs.mkdir(localPath, { recursive: true });
    const apiUrl = `https://api.github.com/repos/helmi/claude-simone/contents/${githubPath}?ref=${branch}`;
    const items = await fetchGitHubContent(apiUrl);

    for (const item of items) {
      const itemLocalPath = path.join(localPath, item.name);
      if (item.type === 'dir') {
        await downloadDirectory(item.path, itemLocalPath, spinner, branch);
      } else if (item.type === 'file') {
        spinner.text = `Downloading ${item.path}...`;
        await downloadFile(item.download_url, itemLocalPath);
      }
    }
  } catch (error) {
    throw new Error(`Failed to download ${githubPath}: ${error.message}`);
  }
}

async function checkExistingInstallation() {
  // Check if Simone is already installed by looking for key directories
  const simoneDirs = ['.simone/03_SPRINTS', '.simone/02_REQUIREMENTS'];
  for (const dir of simoneDirs) {
    try {
      await fs.access(dir);
      return true; // Found a Simone directory, so it's already installed
    } catch {
      // Directory not found, continue checking
    }
  }
  return false;
}

async function backupCommands() {
  const commandsDir = '.claude/commands/simone';
  const backupDir = '.claude/simone-commands-backup';
  
  try {
    await fs.access(commandsDir);
    // Commands exist, create backup
    await fs.rm(backupDir, { recursive: true, force: true }); // Remove old backup if exists
    await fs.mkdir(path.dirname(backupDir), { recursive: true });
    await fs.rename(commandsDir, backupDir);
    return true;
  } catch {
    // No commands to backup
    return false;
  }
}


async function installSimone(options = {}) {
  const branch = 'master';
  const latestVersion = await fetchLatestVersion();
  const versionDisplay = latestVersion.replace('v', '');

  console.log(chalk.blue.bold('\n🎉 Welcome to HelloSimone!\n'));
  console.log(chalk.gray(`This installer will set up the Simone ${latestVersion} project management framework`));
  console.log(chalk.gray('for your Claude Code project.\n'));

  const spinner = ora('Initializing...').start();

  try {
    spinner.text = 'Checking for existing installation...';
    const hasExisting = await checkExistingInstallation();

    if (hasExisting) {
      // SCENARIO: Update existing installation
      spinner.text = 'Updating existing Simone installation...';
      
      // Backup commands
      const backedUp = await backupCommands();
      if (backedUp) {
        spinner.info(chalk.yellow('Existing commands moved to .claude/simone-commands-backup/'));
      }
      
      // Only update CLAUDE.md files and commands, NOT the .simone directory structure
      const GITHUB_RAW_URL = `https://raw.githubusercontent.com/helmi/claude-simone/${branch}`;
      const claudeFiles = [
        '.simone/CLAUDE.md', '.simone/02_REQUIREMENTS/CLAUDE.md',
        '.simone/03_SPRINTS/CLAUDE.md', '.simone/04_GENERAL_TASKS/CLAUDE.md'
      ];
      spinner.text = 'Updating CLAUDE.md files...';
      for (const claudeFile of claudeFiles) {
        await downloadFile(`${GITHUB_RAW_URL}/${claudeFile}`, claudeFile).catch(()=>{});
      }
    } else {
      // SCENARIO: Fresh install
      spinner.text = 'Installing Simone framework...';
      const simoneDirs = [
        '.simone', '.simone/01_PROJECT_DOCS', '.simone/02_REQUIREMENTS',
        '.simone/03_SPRINTS', '.simone/04_GENERAL_TASKS', '.simone/05_ARCHITECTURE_DECISIONS',
        '.simone/10_STATE_OF_PROJECT', '.simone/99_TEMPLATES'
      ];
      for (const dir of simoneDirs) {
        await fs.mkdir(dir, { recursive: true });
      }
      const GITHUB_RAW_URL = `https://raw.githubusercontent.com/helmi/claude-simone/${branch}`;
      await downloadFile(`${GITHUB_RAW_URL}/.simone/00_PROJECT_MANIFEST.md`, '.simone/00_PROJECT_MANIFEST.md').catch(()=>{});
      await downloadDirectory('.simone/99_TEMPLATES', '.simone/99_TEMPLATES', spinner, branch).catch(()=>{});
      
      const claudeFiles = [
        '.simone/CLAUDE.md', '.simone/02_REQUIREMENTS/CLAUDE.md',
        '.simone/03_SPRINTS/CLAUDE.md', '.simone/04_GENERAL_TASKS/CLAUDE.md'
      ];
      for (const claudeFile of claudeFiles) {
        await downloadFile(`${GITHUB_RAW_URL}/${claudeFile}`, claudeFile).catch(()=>{});
      }
    }

    // Always download/update commands
    spinner.text = 'Downloading latest commands...';
    await downloadDirectory('.claude/commands/simone', '.claude/commands/simone', spinner, branch).catch(()=>{});
    
    spinner.succeed(chalk.green(`✅ Simone ${latestVersion} framework ${hasExisting ? 'updated' : 'installed'} successfully!`));
    console.log(chalk.green('\n🚀 Next steps:'));
    console.log(chalk.white('   1. Open this project in Claude Code'));
    console.log(chalk.white('   2. Use /simone:initialize to set up your project\n'));

  } catch (error) {
    spinner.fail(chalk.red('Installation failed'));
    console.error(chalk.red('\nError details:'), error.message);
    process.exit(1);
  }
}

program
  .name('hello-simone')
  .description('Installer for the Simone project management framework')
  .version('0.5.4')
  .action(installSimone);

program.parse();