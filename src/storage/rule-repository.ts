import type Database from 'better-sqlite3';
import type { IRuleRepository } from '../interfaces/repository';

export class RuleRepository implements IRuleRepository {
  constructor(private db: Database.Database) {}

  getOverride(ruleId: string): { enabled: boolean } | null {
    const row = this.db.prepare('SELECT enabled FROM rules_config WHERE rule_id = ?').get(ruleId) as
      | { enabled: number }
      | undefined;
    if (!row) return null;
    return { enabled: Boolean(row.enabled) };
  }

  setOverride(ruleId: string, enabled: boolean): void {
    this.db
      .prepare(
        `
      INSERT INTO rules_config (rule_id, enabled, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(rule_id) DO UPDATE SET enabled = ?, updated_at = datetime('now')
    `,
      )
      .run(ruleId, enabled ? 1 : 0, enabled ? 1 : 0);
  }

  clearOverride(ruleId: string): void {
    this.db.prepare('DELETE FROM rules_config WHERE rule_id = ?').run(ruleId);
  }

  listOverrides(): Array<{ ruleId: string; enabled: boolean; customSeverity?: string }> {
    const rows = this.db
      .prepare('SELECT rule_id, enabled, custom_severity FROM rules_config')
      .all() as Array<{
      rule_id: string;
      enabled: number;
      custom_severity: string | null;
    }>;
    return rows.map((r) => ({
      ruleId: r.rule_id,
      enabled: Boolean(r.enabled),
      customSeverity: r.custom_severity || undefined,
    }));
  }
}
