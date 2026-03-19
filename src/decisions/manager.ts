import { DecisionRepository } from '../storage/decision-repository';
import type { CachedDecision, ConfirmationScope, ConfirmationAction } from '../interfaces/confirmation';
import type { ViolationInfo } from '../interfaces/scan';

export class DecisionManager {
  private sessionId: string;

  constructor(
    private repo: DecisionRepository,
    sessionId: string,
  ) {
    this.sessionId = sessionId;
  }

  /**
   * Check if there's a cached decision for this rule.
   * Priority: session -> project -> always
   */
  check(ruleId: string, projectDir: string): CachedDecision | null {
    return this.repo.find(ruleId, projectDir, this.sessionId);
  }

  /**
   * Record a decision from user confirmation.
   */
  record(
    violation: ViolationInfo,
    action: ConfirmationAction,
    scope: ConfirmationScope,
    projectDir: string,
  ): void {
    // 'once' scope is never cached
    if (scope === 'once') return;

    const decision: CachedDecision = {
      ruleId: violation.ruleId,
      scope,
      approved: action === 'allow',
      projectDir: scope === 'project' ? projectDir : undefined,
      sessionId: scope === 'session' ? this.sessionId : undefined,
      createdAt: new Date().toISOString(),
    };

    this.repo.save(decision);
  }

  /**
   * List all decisions with optional filters.
   */
  list(filters?: { scope?: ConfirmationScope; ruleId?: string }): CachedDecision[] {
    return this.repo.list(filters);
  }

  /**
   * Revoke a specific decision by ID.
   */
  revoke(id: number): boolean {
    return this.repo.revoke(id);
  }

  /**
   * Clear decisions by scope.
   */
  clearByScope(scope: ConfirmationScope): number {
    return this.repo.clearByScope(scope);
  }
}
