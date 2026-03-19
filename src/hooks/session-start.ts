/**
 * Session Start Hook
 * 
 * Executed when a new Claude Code session starts.
 * Displays a summary of recent violations and handles first-time setup (Telemetry Consent).
 */

import { AgentGuard } from '../agent-guard';
import { TelemetryService } from '../telemetry/service';
import { ConfigLoader } from '../state/config';
import chalk from 'chalk';
import inquirer from 'inquirer';

async function main() {
  try {
    const butler = new AgentGuard();
    await butler.initialize();
    
    // 1. Compliance Banner
    console.error(chalk.blue('ℹ️  AgentGuard Compliance System Active'));

    // 2. Telemetry Consent Flow (First Run)
    const config = ConfigLoader.load();
    const telemetryService = TelemetryService.getInstance();

    // Check if user has ever made a choice
    if (config.telemetry?.enabled === undefined) {
      console.error(chalk.cyan('\n👋 Welcome to AgentGuard!'));
      console.error(chalk.white('We collect anonymous usage data to improve security rules.'));
      console.error(chalk.gray('Privacy First: We NEVER collect your code, file paths, secrets, or ENV variables.'));
      
      try {
        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'enableTelemetry',
            message: 'Do you want to enable anonymous telemetry?',
            default: true
          }
        ]);

        telemetryService.updateConfig(answers.enableTelemetry);
        console.error(chalk.green(`\nSettings saved. You can change this anytime via config.`));
      } catch {
        // Fallback if TTY is not available
        console.error(chalk.gray('Skipping interactive setup (non-interactive mode detected). Defaulting to Disabled.'));
      }
    }

    if (telemetryService.isEnabled()) {
        telemetryService.track({
            event: 'agent_guard_session_start',
            properties: {
                version: require('../../package.json').version,
                nodeVersion: process.version,
                os: process.platform,
                enabledRulesCount: Object.keys(config.rules || {}).length
            }
        });
    }

    // 3. Violation Summary
    const stats = butler.tracker.getGlobalStats();
    
    if (stats.globalViolations.total > 0) {
        console.error(chalk.yellow(`\n⚠️  Compliance History: ${stats.globalViolations.total} total violations detected.`));
        
        // Find most frequent violations
        const topRules = Object.entries(stats.ruleViolations)
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 3);

        if (topRules.length > 0) {
            console.error(chalk.white(`\nTop Issues:`));
            topRules.forEach(([ruleId, data]) => {
                console.error(chalk.gray(` - ${ruleId}: ${data.count} times (Last: ${new Date(data.lastViolation).toLocaleDateString()})`));
            });
        }
    } else {
        console.error(chalk.green(`\n✅ No previous violations found. Keep up the good work!`));
    }
    
    console.error(''); // spacing

    // Flush telemetry before exiting the hook to ensure start event is sent
    await telemetryService.shutdown();

  } catch (error) {
    console.error('AgentGuard Session Start Error:', error);
  }
}

main();
