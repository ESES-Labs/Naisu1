use naisu_core::{CreateIntentRequest, Intent, YieldStrategy};
use serde::{Deserialize, Serialize};

/// Response wrapper for Intent
#[derive(Debug, Clone, Serialize)]
pub struct IntentResponse {
    pub id: String,
    pub direction: String,
    pub status: String,
    pub source_address: String,
    pub dest_address: String,
    pub evm_chain: String,
    pub input_token: String,
    pub input_amount: String,
    pub strategy: Option<String>,
    pub bridge_nonce: Option<String>,
    pub created_at: i64,
}

impl From<&Intent> for IntentResponse {
    fn from(intent: &Intent) -> Self {
        Self {
            id: intent.id.clone(),
            direction: format!("{:?}", intent.direction),
            status: intent.status.as_str().to_string(),
            source_address: intent.source_address.clone(),
            dest_address: intent.dest_address.clone(),
            evm_chain: format!("{:?}", intent.evm_chain),
            input_token: intent.input_token.clone(),
            input_amount: intent.input_amount.clone(),
            strategy: intent.strategy.map(|s| s.name().to_string()),
            bridge_nonce: intent.bridge_nonce.clone(),
            created_at: intent.created_at,
        }
    }
}

/// List response wrapper
#[derive(Debug, Clone, Serialize)]
pub struct IntentListResponse {
    pub intents: Vec<IntentResponse>,
    pub total: usize,
}

/// Status response with detailed info
#[derive(Debug, Clone, Serialize)]
pub struct IntentStatusResponse {
    pub id: String,
    pub status: String,
    pub swap_tx_hash: Option<String>,
    pub bridge_tx_hash: Option<String>,
    pub bridge_nonce: Option<String>,
    pub dest_tx_hash: Option<String>,
    pub error_message: Option<String>,
}

impl From<&Intent> for IntentStatusResponse {
    fn from(intent: &Intent) -> Self {
        Self {
            id: intent.id.clone(),
            status: intent.status.as_str().to_string(),
            swap_tx_hash: intent.swap_tx_hash.clone(),
            bridge_tx_hash: intent.bridge_tx_hash.clone(),
            bridge_nonce: intent.bridge_nonce.clone(),
            dest_tx_hash: intent.dest_tx_hash.clone(),
            error_message: intent.error_message.clone(),
        }
    }
}

/// Request body for creating intent
pub type CreateIntentPayload = CreateIntentRequest;

/// Chain info response
#[derive(Debug, Clone, Serialize)]
pub struct ChainInfo {
    pub id: String,
    pub name: String,
    pub chain_type: String,
    pub chain_id: u64,
}

/// Chains list response
#[derive(Debug, Clone, Serialize)]
pub struct ChainsResponse {
    pub chains: Vec<ChainInfo>,
}

/// Strategy info response
#[derive(Debug, Clone, Serialize)]
pub struct StrategyResponse {
    pub id: u8,
    pub name: String,
    pub protocol: String,
    pub asset: String,
    pub enabled: bool,
}

impl From<YieldStrategy> for StrategyResponse {
    fn from(strategy: YieldStrategy) -> Self {
        Self {
            id: strategy.id(),
            name: strategy.name().to_string(),
            protocol: strategy.protocol().to_string(),
            asset: strategy.asset().to_string(),
            enabled: true,
        }
    }
}

/// Quote request
#[derive(Debug, Clone, Deserialize)]
pub struct QuoteRequest {
    pub input_token: String,
    pub output_token: String,
    pub amount: String,
    pub chain_id: Option<u64>,
}

/// Quote response
#[derive(Debug, Clone, Serialize)]
pub struct QuoteResponse {
    pub input_token: String,
    pub output_token: String,
    pub input_amount: String,
    pub output_amount: String,
    pub exchange_rate: f64,
    pub fee: Option<String>,
}

/// Bridge status response
#[derive(Debug, Clone, Serialize)]
pub struct BridgeStatusResponse {
    pub intent_id: String,
    pub status: String,
    pub source_chain: String,
    pub dest_chain: String,
    pub amount: String,
    pub nonce: Option<String>,
}

/// Sui to EVM bridge request
#[derive(Debug, Clone, Deserialize)]
pub struct SuiToEvmBridgeRequest {
    /// Optional intent ID (for tracking, not required for manual bridges)
    pub intent_id: Option<String>,
    /// Sender's Sui address
    pub sender: String,
    /// USDC amount to bridge
    pub amount: String,
    /// Destination EVM address
    pub evm_destination: String,
}

/// Attestation poll request
#[derive(Debug, Clone, Deserialize)]
pub struct AttestationRequest {
    pub nonce: String,
    pub max_attempts: Option<u32>,
    pub interval_secs: Option<u64>,
}

/// Attestation response
#[derive(Debug, Clone, Serialize)]
pub struct AttestationResponse {
    pub nonce: String,
    pub attestation: Option<String>,
    pub status: String,
    pub message: String,
}
