import { spawn } from 'child_process';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';

import { getRuleRegistry } from './rules/registry';
import { ScanPipeline } from './scan/pipeline';
import { PatternScanner } from './scan/pattern-scanner';
import { SecurityTransform } from './scan/security-transform';
import { ConfirmationRequester } from './confirmation/requester';
import { DesktopTransport } from './ipc/desktop-transport';
import { TerminalTransport } from './ipc/terminal-transport';
import { DatabaseManager } from './storage/database';
import { DecisionRepository } from './storage/decision-repository';
import { AuditRepository } from './storage/audit-repository';
import { DecisionManager } from './decisions/manager';
import { loadConfig } from './config/loader';
import { logger } from './logging/logger';
import type { IConfirmationTransport } from './interfaces/transport';
import type { ScanContext } from './interfaces/scan';

export class ActiveDefense {
  static async run(command: string, args: string[]) {
    const sessionId = uuidv4();
    const projectDir = process.cwd();
    const config = loadConfig();

    console.error(chalk.blue(`🛡️  WardnMesh: Wrapping '${command} ${args.join(' ')}'`));

    // Initialize storage
    let auditRepo: AuditRepository | undefined;
    let decisionManager: DecisionManager | undefined;
    try {
      const db = DatabaseManager.getInstance();
      auditRepo = new AuditRepository(db.getDb());
      const decisionRepo = new DecisionRepository(db.getDb());
      decisionManager = new DecisionManager(decisionRepo, sessionId);
    } catch (err) {
      logger.warn('active-defense', 'Database init failed, running without persistence', {
        error: (err as Error).message,
      });
    }

    // Build scan pipeline with all enabled rules
    const registry = getRuleRegistry();
    const enabledRules = registry.getEnabledRules();
    const pipeline = new ScanPipeline();
    pipeline.register(new PatternScanner(enabledRules, 'stdout'));

    console.error(chalk.gray(`  ${enabledRules.length} rules loaded`));

    // Pre-execution command scan
    const fullCommand = `${command} ${args.join(' ')}`;
    const context: ScanContext = { projectDir, sessionId, command: fullCommand };
    const preCheck = pipeline.scan(fullCommand, context);

    if (preCheck.violation) {
      console.error(chalk.red(`\n⛔ BLOCKED: ${preCheck.violation.ruleName}`));
      console.error(chalk.gray(`  Rule: ${preCheck.violation.ruleId} [${preCheck.violation.severity}]`));
      if (auditRepo) {
        auditRepo.log({
          ruleId: preCheck.violation.ruleId,
          ruleName: preCheck.violation.ruleName,
          severity: preCheck.violation.severity,
          action: 'block',
          source: 'cache',
          contentPreview: preCheck.violation.contentPreview,
          projectDir,
          sessionId,
        });
      }
      process.exit(1);
    }

    // Select confirmation transport
    let transport: IConfirmationTransport;
    if (config.confirmation.preferDesktop) {
      const desktop = new DesktopTransport(sessionId, fullCommand);
      const connected = await desktop.connect();
      if (connected) {
        transport = desktop;
        console.error(chalk.gray('  Desktop app connected'));
      } else {
        transport = new TerminalTransport();
        console.error(chalk.gray('  Using terminal confirmation mode'));
      }
    } else {
      transport = new TerminalTransport();
    }

    // Build confirmation requester
    let confirmationFlow: ConfirmationRequester | undefined;
    if (decisionManager) {
      confirmationFlow = new ConfirmationRequester(transport, decisionManager, projectDir, sessionId);
    }

    // Spawn subprocess
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Pipe stdout through SecurityTransform
    const stdoutTransform = new SecurityTransform(pipeline, context, auditRepo, confirmationFlow);
    child.stdout.pipe(stdoutTransform).pipe(process.stdout);

    // Pipe stdin through (with scanning)
    const stdinTransform = new SecurityTransform(
      pipeline,
      { ...context, command: 'stdin' },
      auditRepo,
      confirmationFlow,
    );
    process.stdin.pipe(stdinTransform).pipe(child.stdin);

    // Pass stderr through directly
    child.stderr.pipe(process.stderr);

    // Handle child exit
    child.on('close', async (code) => {
      // Disconnect transport
      await transport.disconnect();
      process.exit(code || 0);
    });

    child.on('error', (err) => {
      console.error(chalk.red(`\nFailed to start: ${err.message}`));
      process.exit(1);
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      child.kill('SIGINT');
    });
  }
}
