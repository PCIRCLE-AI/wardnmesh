use tauri::{AppHandle, Manager, State, WebviewUrl};
use tauri::webview::WebviewWindowBuilder;

use crate::database::DatabaseReader;
use crate::ipc_server::{ConnectedSession, IPCServer};
use crate::types::*;

#[tauri::command]
pub fn get_audit_log(
    page: u32,
    limit: u32,
    severity: Option<String>,
    db: State<'_, Option<DatabaseReader>>,
) -> Result<PaginatedAuditLog, String> {
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.get_audit_log(page.max(1), limit.min(100).max(1), severity)
}

#[tauri::command]
pub fn get_decisions(
    scope: Option<String>,
    db: State<'_, Option<DatabaseReader>>,
) -> Result<Vec<Decision>, String> {
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.get_decisions(scope)
}

#[tauri::command]
pub fn revoke_decision(
    id: i64,
    db: State<'_, Option<DatabaseReader>>,
) -> Result<(), String> {
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.revoke_decision(id)
}

#[tauri::command]
pub fn get_all_rules(
    db: State<'_, Option<DatabaseReader>>,
) -> Result<Vec<RuleWithState>, String> {
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.get_all_rules()
}

#[tauri::command]
pub fn toggle_rule(
    rule_id: String,
    enabled: bool,
    db: State<'_, Option<DatabaseReader>>,
) -> Result<(), String> {
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.toggle_rule(rule_id, enabled)
}

#[tauri::command]
pub fn get_stats(
    db: State<'_, Option<DatabaseReader>>,
) -> Result<DashboardStats, String> {
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.get_stats()
}

#[tauri::command]
pub fn get_connected_sessions(
    ipc: State<'_, Option<IPCServer>>,
) -> Result<Vec<ConnectedSession>, String> {
    match ipc.as_ref() {
        Some(server) => Ok(server.get_sessions()),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub fn open_dashboard(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("dashboard") {
        let _ = existing.set_focus();
    } else {
        let _ = WebviewWindowBuilder::new(&app, "dashboard", WebviewUrl::App("index.html".into()))
            .title("WardnMesh Dashboard")
            .inner_size(1200.0, 800.0)
            .center()
            .decorations(true)
            .resizable(true)
            .build()
            .map_err(|e| format!("Failed to open dashboard: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn respond_confirmation(id: String, action: String, scope: String) -> Result<(), String> {
    // Stub for now - will be connected to IPC server in Phase 5
    println!(
        "[WardnMesh] Confirmation response: id={}, action={}, scope={}",
        id, action, scope
    );
    Ok(())
}
