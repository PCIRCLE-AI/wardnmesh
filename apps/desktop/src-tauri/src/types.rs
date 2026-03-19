use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditEntry {
    pub id: i64,
    pub timestamp: String,
    pub rule_id: String,
    pub rule_name: String,
    pub severity: String,
    pub action: String,
    pub source: String,
    pub content_preview: Option<String>,
    pub project_dir: Option<String>,
    pub session_id: Option<String>,
    pub response_time_ms: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Decision {
    pub id: i64,
    pub rule_id: String,
    pub scope: String,
    pub approved: bool,
    pub project_dir: Option<String>,
    pub session_id: Option<String>,
    pub created_at: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuleWithState {
    pub rule_id: String,
    pub enabled: bool,
    pub custom_severity: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaginatedAuditLog {
    pub items: Vec<AuditEntry>,
    pub total: u32,
    pub page: u32,
    pub limit: u32,
    pub total_pages: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardStats {
    pub total_scans: u32,
    pub total_blocks: u32,
    pub total_allows: u32,
    pub rules_enabled: u32,
    pub rules_disabled: u32,
    pub active_sessions: u32,
}
