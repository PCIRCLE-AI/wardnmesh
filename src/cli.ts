#!/usr/bin/env node

/**
 * WardnMesh CLI
 *
 * The main entrypoint for user interaction (status, config, audit, rules, decisions).
 */

import chalk from 'chalk';
import { version } from './index';
import { checkAndNotifyUpdate } from './update';

import { runCommand } from './commands/run';
import { doctorCommand } from './commands/doctor';
import { decisionsCommand } from './commands/decisions';
import { auditCommand } from './commands/audit-cmd';
import { rulesCommand } from './commands/rules-cmd';
import { statusCommand } from './commands/status-cmd';
import { getRuleRegistry } from './rules/registry';
import path from 'path';
import fs from 'fs';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  // Handle --version early (before loading rules) for fast response
  if (command === '--version' || command === '-v' || command === 'version') {
    console.log(`wardn ${version}`);
    return;
  }

  // Check for updates (non-blocking, silent)
  // Skip for fast commands (--help, version)
  if (command !== 'help' && command !== '--help' && command !== '-h') {
    checkAndNotifyUpdate(version).catch(() => {
      // Fail silently - update check errors should not block CLI
    });
  }

  // Load built-in static rules
  getRuleRegistry().loadRules();

  // Always try to load dynamic rules from CWD at startup
  initDynamicRules();

  switch (command) {
    case 'run':
       // Pass all arguments after 'run'
       await runCommand(args.slice(1));
       break;
    case 'status':
      await statusCommand();
      break;
    case 'decisions':
      await decisionsCommand(args[1], args.slice(2));
      break;
    case 'audit':
      await auditCommand(args.slice(1));
      break;
    case 'rules':
      await rulesCommand(args[1], args.slice(2));
      break;
    case 'scan':
      console.log(chalk.yellow('The "scan" command has been removed. Use "wardn run <tool>" for real-time protection.'));
      break;
    case 'check-update':
      await checkUpdate(args[1] === '--force');
      break;
    case 'doctor': {
      const verbose = args.includes('--verbose');
      const fix = args.includes('--fix');
      await doctorCommand(verbose, fix);
      break;
    }
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      if (command) {
        console.log(chalk.red(`Unknown command: ${command}`));
      }
      showHelp();
      break;
  }
}

function initDynamicRules() {
    const cwdRulesPath = path.join(process.cwd(), 'wardnmesh-rules.json');
    if (fs.existsSync(cwdRulesPath)) {
        console.log(chalk.blue(`\n[WardnMesh] Found local rules: ${cwdRulesPath}`));
        getRuleRegistry().loadDynamicRules(cwdRulesPath);
    }
}

async function checkUpdate(force: boolean = false) {
  const { VersionChecker, showUpdatePrompt } = await import('./update');

  try {
    // Clear cache if force flag is set
    const checker = new VersionChecker(version);
    if (force) {
      checker.clearCache();
      console.log(chalk.gray('Forcing update check (cache cleared)...\n'));
    } else {
      console.log(chalk.gray('Checking for updates...\n'));
    }

    const result = await checker.checkForUpdate();

    if (!result.hasUpdate) {
      console.log(chalk.green(`You're on the latest version: v${version}`));
      console.log('');
      return;
    }

    // Show update prompt (always show when manually checking)
    showUpdatePrompt({
      ...result,
      shouldNotify: true, // Always show when user explicitly checks
    });

    // Mark as notified
    checker.markNotified();
  } catch (error) {
    console.error(chalk.red('Failed to check for updates:'), error instanceof Error ? error.message : error);
    console.log(chalk.gray('\nPlease check your internet connection and try again.'));
  }
}

function showHelp() {
  console.log(`
Usage: wardn <command>

Commands:
  run <command>      Run a command with real-time protection
  status             Show current configuration and status
  rules              Manage compliance rules
    list               List all rules (--category=<cat>)
    enable <ruleId>    Enable a rule
    disable <ruleId>   Disable a rule
  decisions          Manage cached decisions
    list               List cached decisions (--scope=<scope>)
    clear              Clear decisions (--scope=<scope>)
  audit              View audit log (--limit=N --severity=<sev>)
  doctor             System health check
                       --verbose  Show detailed diagnostics
                       --fix      Auto-fix common issues
  check-update       Check for CLI updates (--force to skip cache)
  help               Show this help message
`);
}

main().catch(err => {
    console.error(chalk.red('CLI Error:'), err);
    process.exit(1);
});
