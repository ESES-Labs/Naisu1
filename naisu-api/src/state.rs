use std::sync::Arc;

use axum::extract::FromRef;
use naisu_core::{Intent, IntentStatus};
use std::collections::HashMap;
use tokio::sync::RwLock;

use crate::config::Config;

/// Application state shared across all handlers
#[derive(Clone, FromRef)]
pub struct AppState {
    pub config: Arc<Config>,
    pub intents: Arc<RwLock<HashMap<String, Intent>>>,
    // TODO: Re-add orchestrator when solver architecture is rebuilt
    // pub orchestrator: Arc<IntentOrchestrator>,
}

impl AppState {
    pub fn new() -> Self {
        let config = Arc::new(Config::from_env());

        Self {
            config,
            intents: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get an intent by ID
    pub async fn get_intent(&self, id: &str) -> Option<Intent> {
        let intents = self.intents.read().await;
        intents.get(id).cloned()
    }

    /// Insert or update an intent
    pub async fn upsert_intent(&self, intent: Intent) {
        let mut intents = self.intents.write().await;
        intents.insert(intent.id.clone(), intent);
    }

    /// Update intent status
    pub async fn update_intent_status(&self, id: &str, status: IntentStatus) -> bool {
        let mut intents = self.intents.write().await;
        if let Some(intent) = intents.get_mut(id) {
            intent.set_status(status);
            true
        } else {
            false
        }
    }

    /// List all intents
    pub async fn list_intents(&self) -> Vec<Intent> {
        let intents = self.intents.read().await;
        intents.values().cloned().collect()
    }

    /// List intents by creator address
    pub async fn list_intents_by_creator(&self, creator: &str) -> Vec<Intent> {
        let intents = self.intents.read().await;
        intents
            .values()
            .filter(|i| i.source_address.to_lowercase() == creator.to_lowercase())
            .cloned()
            .collect()
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
