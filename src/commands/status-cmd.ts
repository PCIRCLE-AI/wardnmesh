import chalk from 'chalk';
import fs from 'fs';
import { version } from '../index';
import { getRuleRegistry } from '../rules/registry';
import { getDbPath, getSocketPath } from '../config/loader';

export async function statusCommand(): Promise<void> {
  const registry = getRuleRegistry();
  const dbPath = getDbPath();
  const socketPath = getSocketPath();

  console.log('');
  console.log(chalk.bold.blue(`🛡️  WardnMesh v${version}`));
  console.log(chalk.gray('═'.repeat(48)));

  // Rules
  console.log(chalk.bold('\n📋 Rules:'));
  console.log(`  • Total:    ${chalk.cyan(registry.getRuleCount())}`);
  console.log(`  • Enabled:  ${chalk.green(registry.getEnabledRuleCount())}`);
  console.log(`  • Disabled: ${chalk.yellow(registry.getRuleCount() - registry.getEnabledRuleCount())}`);

  // Database
  console.log(chalk.bold('\n💾 Database:'));
  console.log(`  • Path: ${chalk.gray(dbPath)}`);
  if (fs.existsSync(dbPath)) {
    const stat = fs.statSync(dbPath);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
    console.log(`  • Size: ${chalk.cyan(sizeMb + ' MB')}`);
  } else {
    console.log(`  • Size: ${chalk.gray('(not created yet)')}`);
  }

  // Socket
  console.log(chalk.bold('\n🔌 Desktop Connection:'));
  if (fs.existsSync(socketPath)) {
    console.log(`  • Socket: ${chalk.green('exists')} (${chalk.gray(socketPath)})`);
  } else {
    console.log(`  • Socket: ${chalk.yellow('not found')} — Desktop app not running`);
  }

  // Mode
  console.log(chalk.bold('\n🔒 Mode:'));
  console.log(`  • ${chalk.green('Standalone (Local-Only)')}`);
  console.log(`  • No telemetry, no cloud sync`);
  console.log('');
}
