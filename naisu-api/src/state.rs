use std::sync::Arc;

use axum::extract::FromRef;
use naisu_core::{Intent, IntentStatus};
use std::collections::HashMap;
use tokio::sync::RwLock;

use crate::config::Config;

/// A single solver bid persisted in memory
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SolverBidEntry {
    pub intent_id: String,
    pub solver_name: String,
    pub protocol: String,
    pub offered_apy: u64, // basis points
    pub profit_bps: u64,
    pub timestamp: u64, // unix millis
}

/// Application state shared across all handlers
#[derive(Clone, FromRef)]
pub struct AppState {
    pub config: Arc<Config>,
    pub intents: Arc<RwLock<HashMap<String, Intent>>>,
    pub bids: Arc<RwLock<HashMap<String, Vec<SolverBidEntry>>>>,
    pub network: Arc<RwLock<String>>,
}

impl AppState {
    pub fn new() -> Self {
        let config = Arc::new(Config::from_env());

        Self {
            config,
            intents: Arc::new(RwLock::new(HashMap::new())),
            bids: Arc::new(RwLock::new(HashMap::new())),
            network: Arc::new(RwLock::new("testnet".to_string())),
        }
    }

    /// Get current network
    pub fn network(&self) -> String {
        self.network
            .try_read()
            .map(|n| n.clone())
            .unwrap_or_else(|_| "testnet".to_string())
    }

    /// Set current network
    pub fn set_network(&self, network: &str) {
        if let Ok(mut n) = self.network.try_write() {
            *n = network.to_string();
        }
    }

    /// Store a solver bid, keyed by intent_id
    pub async fn add_bid(&self, bid: SolverBidEntry) {
        let mut bids = self.bids.write().await;
        bids.entry(bid.intent_id.clone()).or_default().push(bid);
    }

    /// Retrieve all bids for a given intent
    pub async fn get_bids_for_intent(&self, intent_id: &str) -> Vec<SolverBidEntry> {
        let bids = self.bids.read().await;
        bids.get(intent_id).cloned().unwrap_or_default()
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
