import chalk from 'chalk';
import { getRuleRegistry } from '../rules/registry';
import { DatabaseManager } from '../storage/database';
import { RuleRepository } from '../storage/rule-repository';

const SEVERITY_COLORS: Record<string, (s: string) => string> = {
  critical: chalk.red,
  major: chalk.yellow,
  minor: chalk.blue,
};

export async function rulesCommand(subcommand: string, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'list': {
      const registry = getRuleRegistry();
      const allRules = registry.getAllRules();
      const categoryFilter = args.find(a => a.startsWith('--category='))?.split('=')[1];

      let rules = allRules;
      if (categoryFilter) {
        rules = allRules.filter(r => r.category === categoryFilter);
      }

      const enabled = rules.filter(r => registry.isRuleEnabled(r.id));
      const disabled = rules.filter(r => !registry.isRuleEnabled(r.id));

      console.log(chalk.bold(`\n🛡️  Rules (${enabled.length} enabled, ${disabled.length} disabled, ${rules.length} total):\n`));
      console.log(chalk.gray('  ID                | Severity  | Category         | Status'));
      console.log(chalk.gray('  ------------------+-----------+------------------+---------'));

      for (const rule of rules) {
        const sevColor = SEVERITY_COLORS[rule.severity] || chalk.white;
        const status = registry.isRuleEnabled(rule.id)
          ? chalk.green('enabled')
          : chalk.red('disabled');
        console.log(`  ${rule.id.padEnd(18)}| ${sevColor(rule.severity.padEnd(10))}| ${rule.category.padEnd(17)}| ${status}`);
      }
      console.log('');
      break;
    }

    case 'enable': {
      const ruleId = args[0];
      if (!ruleId) {
        console.log(chalk.red('Usage: wardn rules enable <ruleId>'));
        return;
      }
      const db = DatabaseManager.getInstance();
      const ruleRepo = new RuleRepository(db.getDb());
      ruleRepo.setOverride(ruleId, true);
      getRuleRegistry().enableRule(ruleId);
      console.log(chalk.green(`Rule ${ruleId} enabled.`));
      break;
    }

    case 'disable': {
      const ruleId = args[0];
      if (!ruleId) {
        console.log(chalk.red('Usage: wardn rules disable <ruleId>'));
        return;
      }
      const db = DatabaseManager.getInstance();
      const ruleRepo = new RuleRepository(db.getDb());
      ruleRepo.setOverride(ruleId, false);
      getRuleRegistry().disableRule(ruleId);
      console.log(chalk.green(`Rule ${ruleId} disabled.`));
      break;
    }

    default:
      console.log(`
Usage: wardn rules <subcommand>

Subcommands:
  list                List all rules
    --category=<cat>    Filter by category (safety|network_boundary|workflow|quality)
  enable <ruleId>     Enable a rule
  disable <ruleId>    Disable a rule
`);
  }
}
