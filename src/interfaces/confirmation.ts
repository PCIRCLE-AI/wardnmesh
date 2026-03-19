/**
 * Confirmation Flow Interfaces
 */

export type ConfirmationAction = 'allow' | 'block';
export type ConfirmationScope = 'once' | 'session' | 'project' | 'always';
export type ConfirmationSource = 'desktop' | 'terminal' | 'cache' | 'timeout';

export interface ConfirmationRequest {
  id: string; // UUID v4
  violation: import('./scan').ViolationInfo;
  projectDir: string;
  sessionId: string;
  timestamp: string; // ISO 8601
}

export interface ConfirmationResult {
  action: ConfirmationAction;
  scope: ConfirmationScope;
  source: ConfirmationSource;
  responseTimeMs: number;
}

export interface CachedDecision {
  id?: number;
  ruleId: string;
  scope: ConfirmationScope;
  approved: boolean;
  projectDir?: string;
  sessionId?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface DecisionFilters {
  ruleId?: string;
  scope?: ConfirmationScope;
  projectDir?: string;
}

export interface AuditEntry {
  id?: number;
  timestamp?: string;
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'major' | 'minor';
  action: ConfirmationAction;
  source: ConfirmationSource;
  contentPreview?: string;
  projectDir?: string;
  sessionId?: string;
  responseTimeMs?: number;
}

export interface AuditFilters {
  severity?: 'critical' | 'major' | 'minor';
  action?: ConfirmationAction;
  ruleId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
