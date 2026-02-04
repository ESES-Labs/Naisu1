//! Bridge types and DTOs

use serde::{Deserialize, Serialize};

/// Bridge route information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeRoute {
    pub id: String,
    pub from_chain_id: u64,
    pub to_chain_id: String, // Sui uses string IDs
    pub from_token: String,
    pub to_token: String,
    pub from_amount: String,
    pub to_amount: String,
    pub to_amount_min: String,
    pub estimated_gas: String,
    pub estimated_time_seconds: u64,
    pub bridge_name: String,
    pub steps: Vec<BridgeStep>,
}

/// Individual step in a bridge route
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeStep {
    pub step_type: String, // "swap", "bridge", "deposit"
    pub tool: String,      // "uniswap", "stargate", "wormhole"
    pub from_token: String,
    pub to_token: String,
    pub from_amount: String,
    pub to_amount: String,
}

/// Quote request for Li.Fi
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteRequest {
    pub from_chain: String,
    pub to_chain: String,
    pub from_token: String,
    pub to_token: String,
    pub from_amount: String,
    pub from_address: String,
    pub to_address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slippage: Option<f64>,
}

/// Li.Fi quote response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteResponse {
    pub id: String,
    pub r#type: String,
    pub tool: String,
    pub action: QuoteAction,
    pub estimate: QuoteEstimate,
    pub transaction_request: Option<TransactionRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteAction {
    pub from_chain_id: u64,
    pub to_chain_id: u64,
    pub from_token: TokenInfo,
    pub to_token: TokenInfo,
    pub from_amount: String,
    pub slippage: f64,
    pub from_address: String,
    pub to_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteEstimate {
    pub from_amount: String,
    pub to_amount: String,
    pub to_amount_min: String,
    pub approval_address: String,
    pub execution_duration: u64,
    pub fee_costs: Vec<FeeCost>,
    pub gas_costs: Vec<GasCost>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenInfo {
    pub address: String,
    pub symbol: String,
    pub decimals: u8,
    pub chain_id: u64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeeCost {
    pub name: String,
    pub percentage: String,
    pub token: TokenInfo,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GasCost {
    pub r#type: String,
    pub estimate: String,
    pub limit: String,
    pub amount: String,
    pub token: TokenInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRequest {
    pub to: String,
    pub data: String,
    pub value: String,
    pub gas_limit: String,
    pub gas_price: String,
    pub chain_id: u64,
}

/// Bridge status check response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeStatus {
    pub transaction_id: String,
    pub sending: TransactionStatus,
    pub receiving: Option<TransactionStatus>,
    pub status: String, // "PENDING", "DONE", "FAILED"
    pub substatus: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionStatus {
    pub tx_hash: String,
    pub chain_id: u64,
    pub amount: String,
    pub token: TokenInfo,
}
