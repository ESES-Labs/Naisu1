//! Sui RPC client using JSON-RPC

use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::SuiConfig;

/// Sui RPC client
pub struct SuiClient {
    config: SuiConfig,
    client: Client,
}

impl SuiClient {
    pub fn new(config: SuiConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    /// Make a JSON-RPC call
    async fn rpc_call<T: for<'de> Deserialize<'de>>(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<T, SuiClientError> {
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params
        });

        let response = self
            .client
            .post(&self.config.rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| SuiClientError::Request(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(SuiClientError::Rpc {
                code: status.as_u16() as i32,
                message: body,
            });
        }

        let rpc_response: RpcResponse<T> = response
            .json()
            .await
            .map_err(|e| SuiClientError::Parse(e.to_string()))?;

        match rpc_response.result {
            Some(result) => Ok(result),
            None => {
                let err = rpc_response.error.unwrap_or(RpcError {
                    code: -1,
                    message: "Unknown error".to_string(),
                });
                Err(SuiClientError::Rpc {
                    code: err.code,
                    message: err.message,
                })
            }
        }
    }

    /// Get coins owned by an address
    pub async fn get_coins(
        &self,
        owner: &str,
        coin_type: Option<&str>,
    ) -> Result<Vec<CoinObject>, SuiClientError> {
        let params = serde_json::json!([
            owner, coin_type, null, // cursor
            null  // limit
        ]);

        let response: CoinsResponse = self.rpc_call("suix_getCoins", params).await?;
        Ok(response.data)
    }

    /// Get USDC balance for an address
    pub async fn get_usdc_balance(&self, owner: &str) -> Result<u64, SuiClientError> {
        let coins = self
            .get_coins(owner, Some(&self.config.usdc_coin_type))
            .await?;
        let total: u64 = coins
            .iter()
            .map(|c| c.balance.parse::<u64>().unwrap_or(0))
            .sum();
        Ok(total)
    }

    /// Get object by ID
    pub async fn get_object(&self, object_id: &str) -> Result<SuiObject, SuiClientError> {
        let params = serde_json::json!([
            object_id,
            {
                "showType": true,
                "showOwner": true,
                "showContent": true
            }
        ]);

        let response: ObjectResponse = self.rpc_call("sui_getObject", params).await?;
        response
            .data
            .ok_or(SuiClientError::ObjectNotFound(object_id.to_string()))
    }

    /// Execute a transaction
    pub async fn execute_transaction(
        &self,
        tx_bytes: &str,
        signatures: Vec<String>,
    ) -> Result<TransactionResponse, SuiClientError> {
        let params = serde_json::json!([
            tx_bytes,
            signatures,
            {
                "showInput": true,
                "showEffects": true,
                "showEvents": true
            },
            "WaitForLocalExecution"
        ]);

        self.rpc_call("sui_executeTransactionBlock", params).await
    }

    /// Dry run a transaction
    pub async fn dry_run_transaction(
        &self,
        tx_bytes: &str,
    ) -> Result<DryRunResponse, SuiClientError> {
        let params = serde_json::json!([tx_bytes]);
        self.rpc_call("sui_dryRunTransactionBlock", params).await
    }
}

// RPC Types
#[derive(Debug, Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
    error: Option<RpcError>,
}

#[derive(Debug, Deserialize)]
struct RpcError {
    code: i32,
    message: String,
}

#[derive(Debug, Deserialize)]
pub struct CoinsResponse {
    pub data: Vec<CoinObject>,
    #[serde(rename = "nextCursor")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoinObject {
    pub coin_type: String,
    pub coin_object_id: String,
    pub version: String,
    pub digest: String,
    pub balance: String,
}

#[derive(Debug, Deserialize)]
pub struct ObjectResponse {
    pub data: Option<SuiObject>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuiObject {
    pub object_id: String,
    pub version: String,
    pub digest: String,
    pub r#type: Option<String>,
    pub owner: Option<serde_json::Value>,
    pub content: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionResponse {
    pub digest: String,
    pub effects: TransactionEffects,
    pub events: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionEffects {
    pub status: TransactionStatus,
    pub gas_used: GasUsed,
}

#[derive(Debug, Deserialize)]
pub struct TransactionStatus {
    pub status: String, // "success" or "failure"
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GasUsed {
    pub computation_cost: String,
    pub storage_cost: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DryRunResponse {
    pub effects: TransactionEffects,
    pub events: Vec<serde_json::Value>,
}

/// Sui client errors
#[derive(Debug, thiserror::Error)]
pub enum SuiClientError {
    #[error("Request failed: {0}")]
    Request(String),

    #[error("RPC error ({code}): {message}")]
    Rpc { code: i32, message: String },

    #[error("Failed to parse response: {0}")]
    Parse(String),

    #[error("Object not found: {0}")]
    ObjectNotFound(String),

    #[error("Transaction failed: {0}")]
    TransactionFailed(String),

    #[error("Insufficient balance")]
    InsufficientBalance,
}
