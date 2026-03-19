import type Database from 'better-sqlite3';
import type { IDecisionRepository } from '../interfaces/repository';
import type { CachedDecision, DecisionFilters, ConfirmationScope } from '../interfaces/confirmation';

export class DecisionRepository implements IDecisionRepository {
  private sessionDecisions = new Map<string, CachedDecision>();

  constructor(private db: Database.Database) {}

  find(ruleId: string, projectDir: string, sessionId: string): CachedDecision | null {
    // 1. Check session (in-memory)
    const sessionKey = `${sessionId}:${ruleId}`;
    const sessionDecision = this.sessionDecisions.get(sessionKey);
    if (sessionDecision) return sessionDecision;

    // 2. Check project (SQLite)
    const projectRow = this.db
      .prepare(
        "SELECT * FROM decisions WHERE rule_id = ? AND scope = ? AND project_dir = ? AND (expires_at IS NULL OR expires_at > datetime('now'))",
      )
      .get(ruleId, 'project', projectDir) as Record<string, unknown> | undefined;
    if (projectRow) return this.mapRow(projectRow);

    // 3. Check always (SQLite)
    const alwaysRow = this.db
      .prepare(
        "SELECT * FROM decisions WHERE rule_id = ? AND scope = ? AND (expires_at IS NULL OR expires_at > datetime('now'))",
      )
      .get(ruleId, 'always') as Record<string, unknown> | undefined;
    if (alwaysRow) return this.mapRow(alwaysRow);

    return null;
  }

  save(decision: CachedDecision): void {
    if (decision.scope === 'session') {
      const key = `${decision.sessionId}:${decision.ruleId}`;
      this.sessionDecisions.set(key, decision);
      return;
    }

    // Project/always → SQLite
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO decisions (rule_id, scope, approved, project_dir, session_id, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
    `,
      )
      .run(
        decision.ruleId,
        decision.scope,
        decision.approved ? 1 : 0,
        decision.projectDir || null,
        decision.sessionId || null,
        decision.expiresAt || null,
      );
  }

  list(filters?: DecisionFilters): CachedDecision[] {
    let sql = 'SELECT * FROM decisions WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.ruleId) {
      sql += ' AND rule_id = ?';
      params.push(filters.ruleId);
    }
    if (filters?.scope) {
      sql += ' AND scope = ?';
      params.push(filters.scope);
    }
    if (filters?.projectDir) {
      sql += ' AND project_dir = ?';
      params.push(filters.projectDir);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  revoke(id: number): boolean {
    const result = this.db.prepare('DELETE FROM decisions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  clearByScope(scope: ConfirmationScope): number {
    if (scope === 'session') {
      const count = this.sessionDecisions.size;
      this.sessionDecisions.clear();
      return count;
    }
    const result = this.db.prepare('DELETE FROM decisions WHERE scope = ?').run(scope);
    return result.changes;
  }

  clearSessionDecisions(): void {
    this.sessionDecisions.clear();
  }

  private mapRow(row: Record<string, unknown>): CachedDecision {
    return {
      id: row.id as number,
      ruleId: (row.rule_id || row.ruleId) as string,
      scope: row.scope as ConfirmationScope,
      approved: Boolean(row.approved),
      projectDir: (row.project_dir as string) || undefined,
      sessionId: (row.session_id as string) || undefined,
      createdAt: (row.created_at || row.createdAt) as string,
      expiresAt: (row.expires_at as string) || undefined,
    };
  }
}
