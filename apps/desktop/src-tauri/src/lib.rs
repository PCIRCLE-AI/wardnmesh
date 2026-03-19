mod commands;
mod confirmation;
mod database;
mod ipc_server;
mod types;

use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode, DebounceEventResult};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    webview::WebviewWindowBuilder,
    AppHandle, Emitter, Manager, State, WebviewUrl,
};
use tauri_plugin_store::StoreExt;

// Constants for window positioning
const TRAY_PANEL_MARGIN_RIGHT: i32 = 12;
const TRAY_PANEL_MARGIN_TOP: i32 = 30;

// Valid protection levels
const VALID_PROTECTION_LEVELS: [&str; 3] = ["LOW", "MEDIUM", "HIGH"];

// Store keys
const STORE_FILE: &str = "settings.json";
const KEY_PROTECTION_LEVEL: &str = "protection_level";
const KEY_IS_ARMED: &str = "is_armed";

// Session state file path
const SESSION_STATE_DIR: &str = ".claude/state/agent-guard";
const SESSION_STATE_FILE: &str = "session-state.json";

// Debounce time for file watcher
const FILE_WATCH_DEBOUNCE_MS: u64 = 500;

// Violation from session state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Violation {
    pub id: String,
    pub timestamp: String,
    pub tool_name: String,
    pub threat_level: String,
    pub reason: String,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_id: Option<String>,
}

// Session state from CLI
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    #[serde(default)]
    pub session_id: String,
    #[serde(default)]
    pub start_time: String,
    #[serde(default)]
    pub is_armed: bool,
    #[serde(default)]
    pub protection_level: String,
    #[serde(default)]
    pub violations: Vec<Violation>,
    #[serde(default)]
    pub tool_calls: u32,
    #[serde(default)]
    pub blocked_calls: u32,
}

// App state
struct AppState {
    is_armed: bool,
    protection_level: String,
    today_blocked: u32,
    today_tool_calls: u32,
    recent_violations: Vec<Violation>,
    session_state: Option<SessionState>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            is_armed: false,
            protection_level: "MEDIUM".to_string(),
            today_blocked: 0,
            today_tool_calls: 0,
            recent_violations: Vec::new(),
            session_state: None,
        }
    }
}

impl AppState {
    fn update_from_session(&mut self, session: SessionState) {
        self.today_tool_calls = session.tool_calls;
        self.today_blocked = session.blocked_calls;
        // Keep only last 10 violations
        self.recent_violations = session.violations.into_iter().take(10).collect();
        // Sync armed state from CLI
        self.is_armed = session.is_armed;
        if !session.protection_level.is_empty() {
            self.protection_level = session.protection_level;
        }
        self.session_state = Some(SessionState {
            session_id: session.session_id,
            start_time: session.start_time,
            is_armed: self.is_armed,
            protection_level: self.protection_level.clone(),
            violations: self.recent_violations.clone(),
            tool_calls: self.today_tool_calls,
            blocked_calls: self.today_blocked,
        });
    }
}

// Persisted settings structure
#[derive(Serialize, Deserialize, Default)]
struct PersistedSettings {
    protection_level: String,
    is_armed: bool,
}

fn get_session_state_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(SESSION_STATE_DIR).join(SESSION_STATE_FILE))
}

fn load_session_state() -> Option<SessionState> {
    let path = get_session_state_path()?;
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

fn load_settings(app: &AppHandle) -> PersistedSettings {
    let store = match app.store(STORE_FILE) {
        Ok(s) => s,
        Err(_) => return PersistedSettings::default(),
    };

    PersistedSettings {
        protection_level: store
            .get(KEY_PROTECTION_LEVEL)
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "MEDIUM".to_string()),
        is_armed: store
            .get(KEY_IS_ARMED)
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
    }
}

fn save_settings(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.set(
        KEY_PROTECTION_LEVEL,
        serde_json::json!(&state.protection_level),
    );
    store.set(KEY_IS_ARMED, serde_json::json!(state.is_armed));

    store
        .save()
        .map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

#[tauri::command]
fn get_status(state: State<Arc<Mutex<AppState>>>) -> Result<serde_json::Value, String> {
    let state = state.lock();

    Ok(serde_json::json!({
        "activated": true,
        "protected": state.is_armed,
        "protectionLevel": state.protection_level,
        "isArmed": state.is_armed,
        "todayBlocked": state.today_blocked,
        "todayToolCalls": state.today_tool_calls,
        "recentViolations": state.recent_violations,
        "hasApiKey": true,
        "hasActiveSession": state.session_state.is_some()
    }))
}

#[tauri::command]
fn toggle_protection(
    app: AppHandle,
    state: State<Arc<Mutex<AppState>>>,
) -> Result<serde_json::Value, String> {
    let mut state = state.lock();

    state.is_armed = !state.is_armed;
    save_settings(&app, &state)?;

    Ok(serde_json::json!({
        "success": true,
        "isArmed": state.is_armed
    }))
}

#[tauri::command]
fn set_protection_level(
    level: String,
    app: AppHandle,
    state: State<Arc<Mutex<AppState>>>,
) -> Result<serde_json::Value, String> {
    if !VALID_PROTECTION_LEVELS.contains(&level.as_str()) {
        return Err(format!(
            "Invalid protection level: '{}'. Valid values are: {:?}",
            level, VALID_PROTECTION_LEVELS
        ));
    }

    let mut state = state.lock();

    state.protection_level = level.clone();
    save_settings(&app, &state)?;

    Ok(serde_json::json!({
        "success": true,
        "protectionLevel": level
    }))
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    // Allow common domains for open-source usage
    let parsed = url::Url::parse(&url).map_err(|_| "Invalid URL format".to_string())?;
    let scheme = parsed.scheme();

    if scheme != "https" && scheme != "http" {
        return Err(format!("Only http/https URLs are allowed, got: {}", scheme));
    }

    tauri_plugin_opener::open_url(url, None::<&str>)
        .map_err(|e| format!("Failed to open URL: {}", e))?;

    Ok(())
}

// System info for diagnostics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub has_wardn: bool,
    pub wardn_version: Option<String>,
    pub home_path: Option<String>,
}

#[tauri::command]
fn check_system() -> Result<SystemInfo, String> {
    use std::process::Command;

    // Detect OS
    let os = if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "unknown"
    };

    // Detect architecture
    let arch = if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else {
        "unknown"
    };

    // Check wardn CLI
    let (has_wardn, wardn_version) = match Command::new("wardn").arg("--version").output() {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout)
                .trim()
                .replace("wardn ", "")
                .to_string();
            (true, Some(version))
        }
        _ => (false, None),
    };

    // Get home path
    let home_path = dirs::home_dir().map(|p| p.to_string_lossy().to_string());

    Ok(SystemInfo {
        os: os.to_string(),
        arch: arch.to_string(),
        has_wardn,
        wardn_version,
        home_path,
    })
}

fn initialize_state_from_store(app: &AppHandle, state: &Arc<Mutex<AppState>>) {
    let settings = load_settings(app);
    let mut state = state.lock();

    state.protection_level = settings.protection_level;
    state.is_armed = settings.is_armed;

    // Load initial session state
    if let Some(session) = load_session_state() {
        state.update_from_session(session);
    }
}

fn setup_file_watcher(app: AppHandle, state: Arc<Mutex<AppState>>) {
    let state_dir = match dirs::home_dir() {
        Some(home) => home.join(SESSION_STATE_DIR),
        None => {
            eprintln!("Could not determine home directory for file watcher");
            return;
        }
    };

    // Create directory if it doesn't exist
    if !state_dir.exists() {
        if let Err(e) = fs::create_dir_all(&state_dir) {
            eprintln!("Failed to create state directory: {}", e);
            return;
        }
    }

    let app_clone = app.clone();
    let state_clone = state.clone();

    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();

        let mut debouncer = match new_debouncer(
            Duration::from_millis(FILE_WATCH_DEBOUNCE_MS),
            move |res: DebounceEventResult| {
                if let Ok(events) = res {
                    for event in events {
                        let _ = tx.send(event.path);
                    }
                }
            },
        ) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("Failed to create file watcher: {}", e);
                return;
            }
        };

        // Watch the state directory
        if let Err(e) = debouncer.watcher().watch(&state_dir, RecursiveMode::NonRecursive) {
            eprintln!("Failed to watch directory {:?}: {}", state_dir, e);
            return;
        }

        println!("File watcher started for {:?}", state_dir);

        // Track previous violation count for notifications
        let mut prev_violation_count = 0usize;

        // Process file change events
        for path in rx {
            if path.file_name().map(|n| n == SESSION_STATE_FILE).unwrap_or(false) {
                if let Some(session) = load_session_state() {
                    let new_violation_count = session.violations.len();

                    // Check for new violations to send notifications
                    // Only process new violations if count increased
                    if new_violation_count > prev_violation_count {
                        let new_count = new_violation_count - prev_violation_count;
                        let new_violations: Vec<_> = session.violations
                            .iter()
                            .take(new_count)
                            .collect();

                        // Send notification for critical/high threats
                        for violation in new_violations {
                            if violation.threat_level == "CRITICAL" || violation.threat_level == "HIGH" {
                                use tauri_plugin_notification::NotificationExt;
                                let _ = app_clone.notification()
                                    .builder()
                                    .title("Agent Guard: Threat Blocked")
                                    .body(format!(
                                        "{} threat: {} - {}",
                                        violation.threat_level,
                                        violation.tool_name,
                                        violation.reason
                                    ))
                                    .show();
                            }
                        }
                    }

                    // Always update prev_violation_count regardless of whether it increased or decreased
                    // This prevents missing notifications if violations are cleared and then new ones appear
                    prev_violation_count = new_violation_count;

                    {
                        let mut state = state_clone.lock();
                        state.update_from_session(session.clone());
                    }

                    // Emit event to frontend
                    let _ = app_clone.emit("session-state-changed", &session);
                    println!("Session state updated: {} violations", session.violations.len());
                }
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(Mutex::new(AppState::default()));

    // Initialize database reader (reads CLI's SQLite DB)
    let db_reader: Option<database::DatabaseReader> = dirs::home_dir()
        .map(|home| home.join(".wardnmesh").join("wardnmesh.db"))
        .and_then(|db_path| {
            if db_path.exists() {
                match database::DatabaseReader::new(db_path.clone()) {
                    Ok(reader) => {
                        println!("Database opened: {:?}", db_path);
                        Some(reader)
                    }
                    Err(e) => {
                        eprintln!("Failed to open database {:?}: {}", db_path, e);
                        None
                    }
                }
            } else {
                println!("Database not found at {:?}, database commands will return errors", db_path);
                None
            }
        });

    // Initialize IPC server (stub — will be started with async runtime later)
    let ipc_server: Option<ipc_server::IPCServer> = dirs::home_dir().map(|home| {
        let socket_path = home.join(".wardnmesh").join("wardn.sock");
        ipc_server::IPCServer::new(socket_path)
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .manage(app_state.clone())
        .manage(db_reader)
        .manage(ipc_server)
        .invoke_handler(tauri::generate_handler![
            get_status,
            toggle_protection,
            set_protection_level,
            open_external_url,
            check_system,
            commands::get_audit_log,
            commands::get_decisions,
            commands::revoke_decision,
            commands::get_all_rules,
            commands::toggle_rule,
            commands::get_stats,
            commands::get_connected_sessions,
            commands::respond_confirmation,
            commands::open_dashboard,
        ])
        .setup(move |app| {
            // Initialize state from persisted store
            initialize_state_from_store(app.handle(), &app_state);

            // Setup file watcher for session state
            setup_file_watcher(app.handle().clone(), app_state.clone());

            // Create tray icon (following official Tauri 2 docs exactly)
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let dashboard_item = MenuItem::with_id(app, "dashboard", "Open Dashboard", true, None::<&str>)?;
            let toggle_item = MenuItem::with_id(app, "toggle", "Toggle Protection", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&dashboard_item, &toggle_item, &quit_item])?;

            let state_for_tray = app_state.clone();

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .title("WM")
                .tooltip("WardnMesh - Click here")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "dashboard" => {
                        if let Some(existing) = app.get_webview_window("dashboard") {
                            let _ = existing.set_focus();
                        } else {
                            let _ = WebviewWindowBuilder::new(
                                app,
                                "dashboard",
                                WebviewUrl::App("index.html".into()),
                            )
                            .title("WardnMesh Dashboard")
                            .inner_size(1200.0, 800.0)
                            .center()
                            .decorations(true)
                            .resizable(true)
                            .build();
                        }
                    }
                    "toggle" => {
                        let mut state = state_for_tray.lock();
                        state.is_armed = !state.is_armed;
                        let _ = app.emit("protection-toggled", state.is_armed);
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            println!("Agent Guard Desktop started - tray icon active");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
