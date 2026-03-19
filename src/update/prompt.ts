/**
 * Update Prompt Display
 *
 * Non-blocking silent prompt to notify users of available updates.
 */

import chalk from 'chalk';
import type { UpdateCheckResult } from './types';

/**
 * Display update notification prompt
 */
export function showUpdatePrompt(result: UpdateCheckResult): void {
  if (!result.hasUpdate || !result.shouldNotify) {
    return;
  }

  const { latestVersion, priority, releaseUrl } = result;

  // Priority colors
  const priorityColor =
    priority === 'CRITICAL'
      ? chalk.red
      : priority === 'IMPORTANT'
      ? chalk.yellow
      : chalk.blue;

  const priorityLabel = priorityColor.bold(priority);

  // Box width
  const boxWidth = 60;
  const border = '─'.repeat(boxWidth - 2);

  console.log('');
  console.log(chalk.gray(`╭${border}╮`));
  console.log(
    chalk.gray('│') +
      chalk.bold(` 📦 Update Available: ${chalk.cyan(`v${result.currentVersion}`)} → ${chalk.green(`v${latestVersion}`)}`) +
      ' '.repeat(boxWidth - 25 - result.currentVersion.length - (latestVersion?.length || 0)) +
      chalk.gray('│')
  );
  console.log(chalk.gray('│') + ' '.repeat(boxWidth - 2) + chalk.gray('│'));
  console.log(chalk.gray('│') + ` Priority: ${priorityLabel}` + ' '.repeat(boxWidth - 12 - (priority?.length || 0)) + chalk.gray('│'));
  console.log(chalk.gray('│') + ' '.repeat(boxWidth - 2) + chalk.gray('│'));
  console.log(
    chalk.gray('│') +
      chalk.dim(` Run: ${chalk.white('npm install -g @wardnmesh/cli@latest')}`) +
      ' '.repeat(boxWidth - 48) +
      chalk.gray('│')
  );
  console.log(chalk.gray('│') + ' '.repeat(boxWidth - 2) + chalk.gray('│'));

  if (releaseUrl) {
    const shortUrl = releaseUrl.replace('https://github.com/', '');
    console.log(
      chalk.gray('│') +
        chalk.dim(` Release Notes: ${chalk.underline(shortUrl)}`) +
        ' '.repeat(Math.max(0, boxWidth - shortUrl.length - 17)) +
        chalk.gray('│')
    );
  }

  console.log(chalk.gray(`╰${border}╯`));
  console.log('');
}
