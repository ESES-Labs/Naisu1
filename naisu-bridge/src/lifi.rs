//! Li.Fi API client

use reqwest::Client;
use tracing::{info, error};

use crate::types::*;

const LIFI_API_URL: &str = "https://li.quest/v1";

/// Li.Fi API client for cross-chain bridging
pub struct LiFiClient {
    client: Client,
    api_url: String,
    api_key: Option<String>,
}

impl LiFiClient {
    /// Create a new Li.Fi client
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            api_url: LIFI_API_URL.to_string(),
            api_key: None,
        }
    }

    /// Create with custom API URL
    pub fn with_url(url: String) -> Self {
        Self {
            client: Client::new(),
            api_url: url,
            api_key: None,
        }
    }

    /// Set API key
    pub fn with_api_key(mut self, key: String) -> Self {
        self.api_key = Some(key);
        self
    }

    /// Get a quote for bridging tokens
    pub async fn get_quote(&self, request: QuoteRequest) -> Result<QuoteResponse, LiFiError> {
        info!("Fetching Li.Fi quote: {} {} -> {} {}",
            request.from_chain, request.from_token,
            request.to_chain, request.to_token
        );

        let url = format!("{}/quote", self.api_url);

        let mut req = self.client.get(&url).query(&[
            ("fromChain", &request.from_chain),
            ("toChain", &request.to_chain),
            ("fromToken", &request.from_token),
            ("toToken", &request.to_token),
            ("fromAmount", &request.from_amount),
            ("fromAddress", &request.from_address),
            ("toAddress", &request.to_address),
        ]);

        if let Some(slippage) = request.slippage {
            req = req.query(&[("slippage", &slippage.to_string())]);
        }

        if let Some(ref key) = self.api_key {
            req = req.header("x-lifi-api-key", key);
        }

        let response = req.send().await.map_err(|e| LiFiError::Request(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            error!("Li.Fi API error: {} - {}", status, body);
            return Err(LiFiError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let quote: QuoteResponse = response
            .json()
            .await
            .map_err(|e| LiFiError::Parse(e.to_string()))?;

        info!("Got quote: {} -> {} (est. {}s)",
            quote.estimate.from_amount,
            quote.estimate.to_amount,
            quote.estimate.execution_duration
        );

        Ok(quote)
    }

    /// Get available routes for a token pair
    pub async fn get_routes(
        &self,
        from_chain: &str,
        to_chain: &str,
        from_token: &str,
        to_token: &str,
        from_amount: &str,
    ) -> Result<Vec<QuoteResponse>, LiFiError> {
        let url = format!("{}/routes", self.api_url);

        let body = serde_json::json!({
            "fromChainId": from_chain,
            "toChainId": to_chain,
            "fromTokenAddress": from_token,
            "toTokenAddress": to_token,
            "fromAmount": from_amount,
            "options": {
                "slippage": 0.03,
                "order": "RECOMMENDED"
            }
        });

        let mut req = self.client.post(&url).json(&body);

        if let Some(ref key) = self.api_key {
            req = req.header("x-lifi-api-key", key);
        }

        let response = req.send().await.map_err(|e| LiFiError::Request(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(LiFiError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        #[derive(serde::Deserialize)]
        struct RoutesResponse {
            routes: Vec<QuoteResponse>,
        }

        let routes: RoutesResponse = response
            .json()
            .await
            .map_err(|e| LiFiError::Parse(e.to_string()))?;

        Ok(routes.routes)
    }

    /// Check the status of a bridge transaction
    pub async fn get_status(&self, tx_hash: &str, from_chain: &str) -> Result<BridgeStatus, LiFiError> {
        let url = format!("{}/status", self.api_url);

        let response = self
            .client
            .get(&url)
            .query(&[("txHash", tx_hash), ("fromChain", from_chain)])
            .send()
            .await
            .map_err(|e| LiFiError::Request(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(LiFiError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        let status: BridgeStatus = response
            .json()
            .await
            .map_err(|e| LiFiError::Parse(e.to_string()))?;

        Ok(status)
    }

    /// Get supported chains
    pub async fn get_chains(&self) -> Result<Vec<ChainInfo>, LiFiError> {
        let url = format!("{}/chains", self.api_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| LiFiError::Request(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(LiFiError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        #[derive(serde::Deserialize)]
        struct ChainsResponse {
            chains: Vec<ChainInfo>,
        }

        let chains: ChainsResponse = response
            .json()
            .await
            .map_err(|e| LiFiError::Parse(e.to_string()))?;

        Ok(chains.chains)
    }

    /// Get supported tokens for a chain
    pub async fn get_tokens(&self, chain_id: &str) -> Result<Vec<TokenInfo>, LiFiError> {
        let url = format!("{}/tokens", self.api_url);

        let response = self
            .client
            .get(&url)
            .query(&[("chains", chain_id)])
            .send()
            .await
            .map_err(|e| LiFiError::Request(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(LiFiError::Api {
                status: status.as_u16(),
                message: body,
            });
        }

        #[derive(serde::Deserialize)]
        struct TokensResponse {
            tokens: std::collections::HashMap<String, Vec<TokenInfo>>,
        }

        let tokens: TokensResponse = response
            .json()
            .await
            .map_err(|e| LiFiError::Parse(e.to_string()))?;

        Ok(tokens.tokens.into_values().flatten().collect())
    }
}

impl Default for LiFiClient {
    fn default() -> Self {
        Self::new()
    }
}

/// Chain info from Li.Fi
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainInfo {
    pub id: u64,
    pub key: String,
    pub name: String,
    pub logo_uri: Option<String>,
    pub native_token: TokenInfo,
}

/// Li.Fi API errors
#[derive(Debug, thiserror::Error)]
pub enum LiFiError {
    #[error("Request failed: {0}")]
    Request(String),

    #[error("API error ({status}): {message}")]
    Api { status: u16, message: String },

    #[error("Failed to parse response: {0}")]
    Parse(String),

    #[error("No route found")]
    NoRoute,

    #[error("Bridge transaction failed: {0}")]
    BridgeFailed(String),
}
