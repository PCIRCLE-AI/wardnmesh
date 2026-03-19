import { Transform, TransformCallback } from 'stream';
import chalk from 'chalk';
import type { ScanPipeline } from './pipeline';
import type { ScanContext } from '../interfaces/scan';
import type { IAuditRepository } from '../interfaces/repository';
import { logger } from '../logging/logger';

/**
 * Confirmation flow interface (will be implemented in Phase 3).
 * For now, auto-blocks all violations.
 */
interface ConfirmationFlow {
  handle(violation: import('../interfaces/scan').ViolationInfo): Promise<{
    action: 'allow' | 'block';
    source: string;
    responseTimeMs: number;
  }>;
}

export class SecurityTransform extends Transform {
  private pipeline: ScanPipeline;
  private context: ScanContext;
  private auditRepo?: IAuditRepository;
  private confirmationFlow?: ConfirmationFlow;

  constructor(
    pipeline: ScanPipeline,
    context: ScanContext,
    auditRepo?: IAuditRepository,
    confirmationFlow?: ConfirmationFlow,
  ) {
    super();
    this.pipeline = pipeline;
    this.context = context;
    this.auditRepo = auditRepo;
    this.confirmationFlow = confirmationFlow;
  }

  async _transform(chunk: Buffer, _encoding: string, callback: TransformCallback): Promise<void> {
    const content = chunk.toString();
    const result = this.pipeline.scan(content, this.context);

    if (!result.violation) {
      callback(null, chunk);
      return;
    }

    // Violation found
    const violation = result.violation;

    if (this.confirmationFlow) {
      try {
        const decision = await this.confirmationFlow.handle(violation);

        if (this.auditRepo) {
          this.auditRepo.log({
            ruleId: violation.ruleId,
            ruleName: violation.ruleName,
            severity: violation.severity,
            action: decision.action,
            source: decision.source as 'desktop' | 'terminal' | 'cache' | 'timeout',
            contentPreview: violation.contentPreview,
            projectDir: this.context.projectDir,
            sessionId: this.context.sessionId,
            responseTimeMs: decision.responseTimeMs,
          });
        }

        if (decision.action === 'allow') {
          callback(null, chunk);
        } else {
          process.stderr.write(chalk.red(`\n⛔ BLOCKED: ${violation.ruleName}\n`));
          callback(null); // drop data
        }
        return;
      } catch {
        // Error during confirmation → fail-closed
      }
    }

    // No confirmation flow or error → auto-block (fail-closed)
    process.stderr.write(chalk.red(`\n⛔ BLOCKED: ${violation.ruleName}\n`));

    if (this.auditRepo) {
      this.auditRepo.log({
        ruleId: violation.ruleId,
        ruleName: violation.ruleName,
        severity: violation.severity,
        action: 'block',
        source: 'timeout',
        contentPreview: violation.contentPreview,
        projectDir: this.context.projectDir,
        sessionId: this.context.sessionId,
      });
    }

    logger.warn('scan.transform', `Auto-blocked: ${violation.ruleName}`, {
      ruleId: violation.ruleId,
      severity: violation.severity,
    });

    callback(null); // drop data
  }
}
