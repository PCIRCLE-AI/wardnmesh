import chalk from 'chalk';
import { DatabaseManager } from '../storage/database';
import { AuditRepository } from '../storage/audit-repository';

type Severity = 'critical' | 'major' | 'minor';
const VALID_SEVERITIES: Severity[] = ['critical', 'major', 'minor'];

const SEVERITY_COLORS: Record<string, (s: string) => string> = {
  critical: chalk.red,
  major: chalk.yellow,
  minor: chalk.blue,
};

const ACTION_COLORS: Record<string, (s: string) => string> = {
  allow: chalk.green,
  block: chalk.red,
};

export async function auditCommand(args: string[]): Promise<void> {
  const db = DatabaseManager.getInstance();
  const repo = new AuditRepository(db.getDb());

  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const severityArg = args.find(a => a.startsWith('--severity='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg, 10) : 20;

  if (severityArg && !VALID_SEVERITIES.includes(severityArg as Severity)) {
    console.log(chalk.red(`Invalid severity: "${severityArg}". Valid: ${VALID_SEVERITIES.join(', ')}`));
    return;
  }

  const result = repo.query(
    severityArg ? { severity: severityArg as Severity } : {},
    { page: 1, limit }
  );

  if (result.total === 0) {
    console.log(chalk.gray('No audit entries found.'));
    return;
  }

  console.log(chalk.bold(`\n📊 Audit Log (showing ${result.items.length} of ${result.total}):\n`));

  for (const entry of result.items) {
    const sevColor = SEVERITY_COLORS[entry.severity] || chalk.white;
    const actColor = ACTION_COLORS[entry.action] || chalk.white;
    const timestamp = entry.timestamp?.slice(0, 19).replace('T', ' ') || 'N/A';

    console.log(`  ${chalk.gray(timestamp)}  ${sevColor(entry.severity.padEnd(9))} ${actColor(entry.action.padEnd(6))} ${entry.ruleName}  ${chalk.gray(`(${entry.source})`)}`);
  }
  console.log('');
}
