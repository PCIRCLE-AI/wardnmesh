use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct ConfirmationManager {
    active_windows: Arc<Mutex<HashMap<String, String>>>, // id -> window label
}

impl ConfirmationManager {
    pub fn new() -> Self {
        Self {
            active_windows: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn active_count(&self) -> usize {
        self.active_windows
            .lock()
            .map(|w| w.len())
            .unwrap_or(0)
    }
}
