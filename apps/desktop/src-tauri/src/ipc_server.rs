use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectedSession {
    pub session_id: String,
    pub command: String,
    pub pid: u32,
    pub cli_version: String,
    pub connected_at: String,
}

pub struct IPCServer {
    socket_path: PathBuf,
    sessions: Arc<Mutex<HashMap<String, ConnectedSession>>>,
}

impl IPCServer {
    pub fn new(socket_path: PathBuf) -> Self {
        Self {
            socket_path,
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_socket_path(&self) -> &PathBuf {
        &self.socket_path
    }

    pub fn get_sessions(&self) -> Vec<ConnectedSession> {
        self.sessions
            .lock()
            .map(|s| s.values().cloned().collect())
            .unwrap_or_default()
    }

    pub fn session_count(&self) -> usize {
        self.sessions.lock().map(|s| s.len()).unwrap_or(0)
    }
}
