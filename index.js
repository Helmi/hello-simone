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
}

async function checkExistingV3Installation() {
  // A v0.3 installation is identified by its unique directory structure.
  const v3Dirs = ['.simone/03_SPRINTS', '.simone/02_REQUIREMENTS'];
  for (const dir of v3Dirs) {
    try {
      await fs.access(dir);
      return true; // Found a v0.3 directory, so it's a v0.3 project.
    } catch {
      // Directory not found, continue checking.
    }
  }
  return false;
}

async function checkExistingV4Installation() {
  try {
    await fs.access('.simone/00_FOUNDATION/CONSTITUTION.md');
    return true;
  } catch {
    return false;
  }
}

async function backupV3ForMigration() {
    const backupDir = '.simone_backup';
    await fs.mkdir(backupDir, { recursive: true });
    const spinner = ora('Backing up existing v0.3 installation...').start();
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `simone-v0.3-backup-${timestamp}`);
        await fs.mkdir(backupPath, { recursive: true });

        if (await fs.access('.simone').then(() => true).catch(() => false)) {
            await fs.rename('.simone', path.join(backupPath, '.simone'));
        }
        if (await fs.access('.claude/commands/simone').then(() => true).catch(() => false)) {
            await fs.mkdir(path.join(backupPath, '.claude/commands'), { recursive: true });
            await fs.rename('.claude/commands/simone', path.join(backupPath, '.claude/commands/simone'));
        }
        spinner.succeed(chalk.green(`Backup complete! Old version moved to ${backupPath}`));
    } catch (error) {
        spinner.fail(chalk.red('Backup failed'));
        console.error(error);
        throw new Error('Migration backup failed.');
    }
}

async function updateV4Commands(spinner, branch) {
    const commandsDir = '.claude/commands/simone';
    const backupDir = '.simone_backup';
    await fs.mkdir(backupDir, { recursive: true });
    spinner.start('Backing up existing v0.4 commands...');
    try {
        if (await fs.access(commandsDir).then(() => true).catch(() => false)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(backupDir, `commands-v0.4-backup-${timestamp}`);
            await fs.rename(commandsDir, backupPath);
            spinner.succeed(chalk.green(`Backed up commands to ${backupPath}`));
        } else {
            spinner.info(chalk.gray('No existing commands to back up.'));
        }
    } catch (error) {
        spinner.fail(chalk.red('Command backup failed.'));
        throw error;
    }
    spinner.start('Downloading latest v0.4 commands...');
    await downloadDirectory('framework/commands', commandsDir, spinner, branch);
}


async function installSimone(options = {}) {
  const isPreview = options.preview;
  const branch = isPreview ? 'v0.4' : 'master';

  if (isPreview) {
    console.log(chalk.yellow.bold('\n🎉 Welcome to HelloSimone v0.4 PREVIEW!\n'));
    console.log(chalk.red.bold('This is a preview version and may have bugs. Use with caution.\n'));
  } else {
    console.log(chalk.blue.bold('\n🎉 Welcome to HelloSimone!\n'));
    console.log(chalk.gray('This installer will set up the Simone v0.3 project management framework'));
  }
  console.log(chalk.gray('for your Claude Code project.\n'));

  const spinner = ora('Initializing...').start(); // Start spinner early

  try {
    spinner.text = 'Checking for existing v0.3 installation...';
    const hasV3 = await checkExistingV3Installation();
    spinner.text = `v0.3 detected: ${hasV3}. Checking for existing v0.4 installation...`;
    const hasV4 = await checkExistingV4Installation();
    spinner.text = `v0.4 detected: ${hasV4}. Determining installation path...`;

    if (isPreview) {
        // --- V0.4 PREVIEW WORKFLOW ---
        if (hasV4) {
            // SCENARIO: Update existing v0.4
            spinner.stop(); // Stop spinner for prompt
            const { confirm } = await prompts({
                type: 'confirm', name: 'confirm',
                message: 'Existing v0.4 installation detected. Update framework commands?',
                initial: true
            });
            spinner.start('Proceeding with v0.4 update...'); // Restart spinner
            if (!confirm) { console.log(chalk.yellow('Update cancelled.')); process.exit(0); }
            await updateV4Commands(spinner, branch);
            spinner.succeed(chalk.green('✅ Simone v0.4 commands updated successfully!'));
            console.log(chalk.gray('   Your .simone directory (Foundation, Progress, Docs) remains untouched.'));

        } else if (hasV3) {
            // SCENARIO: Migrate from v0.3 to v0.4
            spinner.stop(); // Stop spinner for prompt
            const { confirm } = await prompts({
                type: 'confirm', name: 'confirm',
                message: 'Existing v0.3 installation detected. Upgrade to v0.4? This will back up and replace your current setup.',
                initial: true
            });
            spinner.start('Proceeding with v0.3 to v0.4 migration...'); // Restart spinner
            if (!confirm) { console.log(chalk.yellow('Upgrade cancelled.')); process.exit(0); }
            await backupV3ForMigration();
            spinner.text = 'Installing v0.4 framework...';
            await downloadDirectory('framework/.simone', '.simone', spinner, branch);
            await downloadDirectory('framework/commands', '.claude/commands/simone', spinner, branch);
            spinner.succeed(chalk.green('✅ Simone v0.4 PREVIEW installed successfully!'));
            console.log(chalk.yellow.bold('\n⚠️ IMPORTANT: Your old work has been backed up.'));
            console.log(chalk.green('\n🚀 Your next step is crucial:'));
            console.log(chalk.white('   Run /initialize to begin the guided migration of your tasks into the new Epic format.'));

        } else {
            // SCENARIO: Fresh install of v0.4
            spinner.text = 'Installing v0.4 framework...';
            await downloadDirectory('framework/.simone', '.simone', spinner, branch);
            await downloadDirectory('framework/commands', '.claude/commands/simone', spinner, branch);
            spinner.succeed(chalk.green('✅ Simone v0.4 PREVIEW installed successfully!'));
            console.log(chalk.green('\n🚀 Next steps:'));
            console.log(chalk.white('   1. Open this project in Claude Code'));
            console.log(chalk.white('   2. Use /initialize to set up your project foundation and first epic.'));
        }

    } else {
    // --- V0.3 STABLE WORKFLOW ---
    console.log(chalk.blue.bold('\n🎉 Welcome to HelloSimone!\n'));
    const spinner = ora('Initializing...').start(); // Start spinner early

    try {
        spinner.text = 'Checking for existing v0.3 installation...';
        const hasV3 = await checkExistingV3Installation();
        spinner.text = `v0.3 detected: ${hasV3}. Checking for existing v0.4 installation...`;
        const hasV4 = await checkExistingV4Installation();
        spinner.text = `v0.4 detected: ${hasV4}. Determining installation path...`;

        if (hasV4) {
            spinner.fail(chalk.red('A v0.4 project was detected.'));
            console.error(chalk.red('Downgrading to v0.3 is not supported. Installation cancelled.'));
            process.exit(1);
        }

        if (hasV3) {
            // SCENARIO: Update existing v0.3
            spinner.succeed(chalk.green('Existing v0.3 installation detected. Updating commands and docs...'));
        } else {
            // SCENARIO: Fresh install of v0.3
            spinner.text = 'Installing v0.3 framework...';
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
        }

        const GITHUB_RAW_URL = `https://raw.githubusercontent.com/helmi/claude-simone/${branch}`;
        const claudeFiles = [
            '.simone/CLAUDE.md', '.simone/02_REQUIREMENTS/CLAUDE.md',
            '.simone/03_SPRINTS/CLAUDE.md', '.simone/04_GENERAL_TASKS/CLAUDE.md'
        ];
        for (const claudeFile of claudeFiles) {
            await downloadFile(`${GITHUB_RAW_URL}/${claudeFile}`, claudeFile).catch(()=>{});
        }
        await downloadDirectory('.claude/commands/simone', '.claude/commands/simone', spinner, branch).catch(()=>{});
        spinner.succeed(chalk.green('✅ Simone v0.3 framework installed/updated successfully!'));
        console.log(chalk.green('\n🚀 Next steps:'));
        console.log(chalk.white('   1. Open this project in Claude Code'));
        console.log(chalk.white('   2. Use /project:simone:initialize to set up your project\n'));

    } catch (error) {
        spinner.fail(chalk.red('Installation failed'));
        console.error(chalk.red('\nError details:'), error.message);
        process.exit(1);
    }
  }
  
  } catch (error) {
    spinner.fail(chalk.red('Installation failed'));
    console.error(chalk.red('\nError details:'), error.message);
    process.exit(1);
  }
}

program
  .name('hello-simone')
  .description('Installer for the Simone project management framework')
  .version('0.5.1')
  .option('--preview', 'Install the preview version (v0.4) of Simone')
  .action(installSimone);

program.parse();