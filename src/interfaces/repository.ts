/**
 * Repository Interfaces
 */

import type {
  CachedDecision,
  DecisionFilters,
  ConfirmationScope,
  AuditEntry,
  AuditFilters,
  Pagination,
  PaginatedResult,
} from './confirmation';

export interface IDecisionRepository {
  find(ruleId: string, projectDir: string, sessionId: string): CachedDecision | null;
  save(decision: CachedDecision): void;
  list(filters?: DecisionFilters): CachedDecision[];
  revoke(id: number): boolean;
  clearByScope(scope: ConfirmationScope): number;
}

export interface IAuditRepository {
  log(entry: AuditEntry): void;
  query(filters: AuditFilters, pagination: Pagination): PaginatedResult<AuditEntry>;
  prune(retentionDays: number): number;
}

export interface IRuleRepository {
  getOverride(ruleId: string): { enabled: boolean } | null;
  setOverride(ruleId: string, enabled: boolean): void;
  clearOverride(ruleId: string): void;
  listOverrides(): Array<{ ruleId: string; enabled: boolean; customSeverity?: string }>;
}
