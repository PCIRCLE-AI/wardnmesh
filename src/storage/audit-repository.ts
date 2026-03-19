import type Database from 'better-sqlite3';
import type { IAuditRepository } from '../interfaces/repository';
import type { AuditEntry, AuditFilters, Pagination, PaginatedResult } from '../interfaces/confirmation';

export class AuditRepository implements IAuditRepository {
  constructor(private db: Database.Database) {}

  log(entry: AuditEntry): void {
    // Truncate content preview to 200 chars
    const preview = entry.contentPreview ? entry.contentPreview.slice(0, 200) : null;

    this.db
      .prepare(
        `
      INSERT INTO audit_log (rule_id, rule_name, severity, action, source, content_preview, project_dir, session_id, response_time_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        entry.ruleId,
        entry.ruleName,
        entry.severity,
        entry.action,
        entry.source,
        preview,
        entry.projectDir || null,
        entry.sessionId || null,
        entry.responseTimeMs || null,
      );
  }

  query(filters: AuditFilters, pagination: Pagination): PaginatedResult<AuditEntry> {
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (filters.severity) {
      whereClauses.push('severity = ?');
      params.push(filters.severity);
    }
    if (filters.action) {
      whereClauses.push('action = ?');
      params.push(filters.action);
    }
    if (filters.ruleId) {
      whereClauses.push('rule_id = ?');
      params.push(filters.ruleId);
    }
    if (filters.dateFrom) {
      whereClauses.push('timestamp >= ?');
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      whereClauses.push('timestamp <= ?');
      params.push(filters.dateTo);
    }

    const where = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Count total
    const countRow = this.db
      .prepare(`SELECT COUNT(*) as cnt FROM audit_log ${where}`)
      .get(...params) as { cnt: number };
    const total = countRow.cnt;

    // Fetch page
    const offset = (pagination.page - 1) * pagination.limit;
    const rows = this.db
      .prepare(`SELECT * FROM audit_log ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
      .all(...params, pagination.limit, offset) as Record<string, unknown>[];

    const items: AuditEntry[] = rows.map((r) => ({
      id: r.id as number,
      timestamp: r.timestamp as string,
      ruleId: r.rule_id as string,
      ruleName: r.rule_name as string,
      severity: r.severity as AuditEntry['severity'],
      action: r.action as AuditEntry['action'],
      source: r.source as AuditEntry['source'],
      contentPreview: (r.content_preview as string) || undefined,
      projectDir: (r.project_dir as string) || undefined,
      sessionId: (r.session_id as string) || undefined,
      responseTimeMs: (r.response_time_ms as number) || undefined,
    }));

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  prune(retentionDays: number): number {
    const result = this.db
      .prepare("DELETE FROM audit_log WHERE timestamp < datetime('now', ? || ' days')")
      .run(-retentionDays);
    return result.changes;
  }
}
