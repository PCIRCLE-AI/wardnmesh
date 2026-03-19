import chalk from 'chalk';
import { DatabaseManager } from '../storage/database';
import { DecisionRepository } from '../storage/decision-repository';
import type { ConfirmationScope } from '../interfaces/confirmation';

const VALID_SCOPES: ConfirmationScope[] = ['once', 'session', 'project', 'always'];

function isValidScope(s: string): s is ConfirmationScope {
  return VALID_SCOPES.includes(s as ConfirmationScope);
}

export async function decisionsCommand(subcommand: string, args: string[]): Promise<void> {
  const db = DatabaseManager.getInstance();
  const repo = new DecisionRepository(db.getDb());

  switch (subcommand) {
    case 'list': {
      const scopeFlag = args.find(a => a.startsWith('--scope='))?.split('=')[1];
      let validScope: ConfirmationScope | undefined;
      if (scopeFlag) {
        if (!isValidScope(scopeFlag)) {
          console.log(chalk.red(`Invalid scope: "${scopeFlag}". Valid: ${VALID_SCOPES.join(', ')}`));
          return;
        }
        validScope = scopeFlag;
      }
      const decisions = repo.list(validScope ? { scope: validScope } : undefined);

      if (decisions.length === 0) {
        console.log(chalk.gray('No cached decisions found.'));
        return;
      }

      console.log(chalk.bold(`\n📋 Cached Decisions (${decisions.length}):\n`));
      console.log(chalk.gray('  ID   | Rule ID          | Scope    | Action  | Project'));
      console.log(chalk.gray('  -----+------------------+----------+---------+--------'));

      for (const d of decisions) {
        const action = d.approved ? chalk.green('allow') : chalk.red('block');
        const project = d.projectDir || '-';
        console.log(`  ${String(d.id).padEnd(5)}| ${d.ruleId.padEnd(17)}| ${d.scope.padEnd(9)}| ${action.padEnd(16)}| ${project}`);
      }
      console.log('');
      break;
    }

    case 'clear': {
      const scope = args.find(a => a.startsWith('--scope='))?.split('=')[1];
      if (!scope || !isValidScope(scope)) {
        console.log(chalk.red(`Usage: wardn decisions clear --scope=<${VALID_SCOPES.join('|')}>`));
        return;
      }

      const cleared = repo.clearByScope(scope);
      console.log(chalk.green(`Cleared ${cleared} ${scope}-scoped decisions.`));
      break;
    }

    default:
      console.log(`
Usage: wardn decisions <subcommand>

Subcommands:
  list              List cached decisions
    --scope=<scope>   Filter by scope (session|project|always)
  clear             Clear decisions by scope
    --scope=<scope>   Required: session|project|always
`);
  }
}
