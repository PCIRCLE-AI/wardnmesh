export interface Migration {
  version: number;
  description: string;
  up: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema',
    up: `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now')),
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id TEXT NOT NULL,
        scope TEXT NOT NULL CHECK(scope IN ('session','project','always')),
        approved INTEGER NOT NULL CHECK(approved IN (0,1)),
        project_dir TEXT,
        session_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT,
        UNIQUE(rule_id, scope, project_dir)
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        rule_id TEXT NOT NULL,
        rule_name TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('critical','major','minor')),
        action TEXT NOT NULL CHECK(action IN ('allow','block')),
        source TEXT NOT NULL CHECK(source IN ('desktop','terminal','cache','timeout')),
        content_preview TEXT,
        project_dir TEXT,
        session_id TEXT,
        response_time_ms INTEGER
      );

      CREATE TABLE IF NOT EXISTS rules_config (
        rule_id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1,
        custom_severity TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_log(severity);
      CREATE INDEX IF NOT EXISTS idx_audit_rule ON audit_log(rule_id);
      CREATE INDEX IF NOT EXISTS idx_decisions_lookup ON decisions(rule_id, scope);
    `,
  },
];
