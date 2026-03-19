/**
 * Confirmation Requester — orchestrates transport selection + state machine
 *
 * State flow: CHECK_CACHE → REQUESTING → DECIDED
 *
 * 1. CHECK_CACHE — look for existing decision (session/project/always)
 * 2. REQUESTING — send to transport (desktop or terminal)
 * 3. DECIDED   — record decision, emit scan event
 */

import { v4 as uuidv4 } from 'uuid';
import type { IConfirmationTransport } from '../interfaces/transport';
import type { ConfirmationResult } from '../interfaces/confirmation';
import type { ViolationInfo } from '../interfaces/scan';
import { DecisionManager } from '../decisions/manager';
import { loadConfig } from '../config/loader';
import { logger } from '../logging/logger';

export class ConfirmationRequester {
  private transport: IConfirmationTransport;
  private decisionManager: DecisionManager;
  private projectDir: string;
  private sessionId: string;

  constructor(
    transport: IConfirmationTransport,
    decisionManager: DecisionManager,
    projectDir: string,
    sessionId: string,
  ) {
    this.transport = transport;
    this.decisionManager = decisionManager;
    this.projectDir = projectDir;
    this.sessionId = sessionId;
  }

  async handle(violation: ViolationInfo): Promise<ConfirmationResult> {
    // 1. CHECK_CACHE — look for existing decision
    const cached = this.decisionManager.check(violation.ruleId, this.projectDir);
    if (cached) {
      return {
        action: cached.approved ? 'allow' : 'block',
        scope: cached.scope,
        source: 'cache',
        responseTimeMs: 0,
      };
    }

    // 2. REQUESTING — send to transport
    const config = loadConfig();
    const timeoutMs = config.confirmation.timeouts[violation.severity as keyof typeof config.confirmation.timeouts]
      || config.confirmation.timeouts.major;

    const request = {
      id: uuidv4(),
      violation,
      projectDir: this.projectDir,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    };

    let result: ConfirmationResult;
    try {
      result = await this.transport.requestConfirmation(request, timeoutMs);
    } catch (err) {
      // Error → fail-closed
      logger.error('confirmation', 'Transport error, blocking', {}, err as Error);
      result = {
        action: 'block',
        scope: 'once',
        source: 'timeout',
        responseTimeMs: 0,
      };
    }

    // 3. DECIDED — record decision (if not 'once')
    this.decisionManager.record(violation, result.action, result.scope, this.projectDir);

    // 4. Send scan event
    this.transport.sendEvent({
      ruleId: violation.ruleId,
      ruleName: violation.ruleName,
      severity: violation.severity,
      action: result.action,
      source: result.source,
      timestamp: new Date().toISOString(),
    });

    return result;
  }
}
