use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;

use crate::types::*;

pub struct DatabaseReader {
    conn: Mutex<Connection>,
}

impl DatabaseReader {
    pub fn new(db_path: PathBuf) -> Result<Self, String> {
        let conn =
            Connection::open(&db_path).map_err(|e| format!("Failed to open DB: {}", e))?;
        conn.pragma_update(None, "journal_mode", "WAL")
            .map_err(|e| format!("WAL mode failed: {}", e))?;
        conn.pragma_update(None, "busy_timeout", 5000)
            .map_err(|e| format!("busy_timeout failed: {}", e))?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn get_audit_log(
        &self,
        page: u32,
        limit: u32,
        severity: Option<String>,
    ) -> Result<PaginatedAuditLog, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Lock failed: {}", e))?;

        let offset = (page - 1) * limit;

        let (total, items) = if let Some(ref sev) = severity {
            let total: u32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM audit_log WHERE severity = ?1",
                    params![sev],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            let mut stmt = conn
                .prepare(
                    "SELECT id, timestamp, rule_id, rule_name, severity, action, source, \
                     content_preview, project_dir, session_id, response_time_ms \
                     FROM audit_log WHERE severity = ?1 ORDER BY timestamp DESC LIMIT ?2 OFFSET ?3",
                )
                .map_err(|e| format!("Prepare failed: {}", e))?;

            let items: Vec<AuditEntry> = stmt
                .query_map(params![sev, limit, offset], |row| {
                    Ok(AuditEntry {
                        id: row.get(0)?,
                        timestamp: row.get(1)?,
                        rule_id: row.get(2)?,
                        rule_name: row.get(3)?,
                        severity: row.get(4)?,
                        action: row.get(5)?,
                        source: row.get(6)?,
                        content_preview: row.get(7)?,
                        project_dir: row.get(8)?,
                        session_id: row.get(9)?,
                        response_time_ms: row.get(10)?,
                    })
                })
                .map_err(|e| format!("Query failed: {}", e))?
                .filter_map(|r| r.ok())
                .collect();

            (total, items)
        } else {
            let total: u32 = conn
                .query_row("SELECT COUNT(*) FROM audit_log", [], |row| row.get(0))
                .unwrap_or(0);

            let mut stmt = conn
                .prepare(
                    "SELECT id, timestamp, rule_id, rule_name, severity, action, source, \
                     content_preview, project_dir, session_id, response_time_ms \
                     FROM audit_log ORDER BY timestamp DESC LIMIT ?1 OFFSET ?2",
                )
                .map_err(|e| format!("Prepare failed: {}", e))?;

            let items: Vec<AuditEntry> = stmt
                .query_map(params![limit, offset], |row| {
                    Ok(AuditEntry {
                        id: row.get(0)?,
                        timestamp: row.get(1)?,
                        rule_id: row.get(2)?,
                        rule_name: row.get(3)?,
                        severity: row.get(4)?,
                        action: row.get(5)?,
                        source: row.get(6)?,
                        content_preview: row.get(7)?,
                        project_dir: row.get(8)?,
                        session_id: row.get(9)?,
                        response_time_ms: row.get(10)?,
                    })
                })
                .map_err(|e| format!("Query failed: {}", e))?
                .filter_map(|r| r.ok())
                .collect();

            (total, items)
        };

        let total_pages = if total > 0 {
            (total + limit - 1) / limit
        } else {
            0
        };

        Ok(PaginatedAuditLog {
            items,
            total,
            page,
            limit,
            total_pages,
        })
    }

    pub fn get_decisions(&self, scope: Option<String>) -> Result<Vec<Decision>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock: {}", e))?;

        if let Some(ref s) = scope {
            let mut stmt = conn
                .prepare(
                    "SELECT id, rule_id, scope, approved, project_dir, session_id, \
                     created_at, expires_at \
                     FROM decisions WHERE scope = ?1 ORDER BY created_at DESC",
                )
                .map_err(|e| format!("Prepare: {}", e))?;

            let items: Vec<Decision> = stmt
                .query_map(params![s], |row| {
                    Ok(Decision {
                        id: row.get(0)?,
                        rule_id: row.get(1)?,
                        scope: row.get(2)?,
                        approved: row.get::<_, i32>(3)? != 0,
                        project_dir: row.get(4)?,
                        session_id: row.get(5)?,
                        created_at: row.get(6)?,
                        expires_at: row.get(7)?,
                    })
                })
                .map_err(|e| format!("Query: {}", e))?
                .filter_map(|r| r.ok())
                .collect();

            Ok(items)
        } else {
            let mut stmt = conn
                .prepare(
                    "SELECT id, rule_id, scope, approved, project_dir, session_id, \
                     created_at, expires_at \
                     FROM decisions ORDER BY created_at DESC",
                )
                .map_err(|e| format!("Prepare: {}", e))?;

            let items: Vec<Decision> = stmt
                .query_map([], |row| {
                    Ok(Decision {
                        id: row.get(0)?,
                        rule_id: row.get(1)?,
                        scope: row.get(2)?,
                        approved: row.get::<_, i32>(3)? != 0,
                        project_dir: row.get(4)?,
                        session_id: row.get(5)?,
                        created_at: row.get(6)?,
                        expires_at: row.get(7)?,
                    })
                })
                .map_err(|e| format!("Query: {}", e))?
                .filter_map(|r| r.ok())
                .collect();

            Ok(items)
        }
    }

    pub fn revoke_decision(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock: {}", e))?;
        conn.execute("DELETE FROM decisions WHERE id = ?1", params![id])
            .map_err(|e| format!("Delete: {}", e))?;
        Ok(())
    }

    pub fn get_all_rules(&self) -> Result<Vec<RuleWithState>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock: {}", e))?;
        let mut stmt = conn
            .prepare("SELECT rule_id, enabled, custom_severity FROM rules_config")
            .map_err(|e| format!("Prepare: {}", e))?;
        let items: Vec<RuleWithState> = stmt
            .query_map([], |row| {
                Ok(RuleWithState {
                    rule_id: row.get(0)?,
                    enabled: row.get::<_, i32>(1)? != 0,
                    custom_severity: row.get(2)?,
                })
            })
            .map_err(|e| format!("Query: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(items)
    }

    pub fn toggle_rule(&self, rule_id: String, enabled: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock: {}", e))?;
        conn.execute(
            "INSERT INTO rules_config (rule_id, enabled, updated_at) \
             VALUES (?1, ?2, datetime('now')) \
             ON CONFLICT(rule_id) DO UPDATE SET enabled = ?2, updated_at = datetime('now')",
            params![rule_id, if enabled { 1 } else { 0 }],
        )
        .map_err(|e| format!("Upsert: {}", e))?;
        Ok(())
    }

    pub fn get_stats(&self) -> Result<DashboardStats, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock: {}", e))?;

        let total_scans: u32 = conn
            .query_row("SELECT COUNT(*) FROM audit_log", [], |row| row.get(0))
            .unwrap_or(0);
        let total_blocks: u32 = conn
            .query_row(
                "SELECT COUNT(*) FROM audit_log WHERE action = 'block'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        let total_allows: u32 = conn
            .query_row(
                "SELECT COUNT(*) FROM audit_log WHERE action = 'allow'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        let rules_disabled: u32 = conn
            .query_row(
                "SELECT COUNT(*) FROM rules_config WHERE enabled = 0",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        Ok(DashboardStats {
            total_scans,
            total_blocks,
            total_allows,
            rules_enabled: 0,  // Will be calculated by frontend (total - disabled)
            rules_disabled,
            active_sessions: 0, // Will be provided by IPC server
        })
    }
}
