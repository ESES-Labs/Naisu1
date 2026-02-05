//! Scallop Protocol API Adapter
//!
//! Fetches yield data from Scallop API for AI Agent optimization.
//!
//! API Docs: https://docs.scallop.io

use serde::{Deserialize, Serialize};

const SCALLOP_API_BASE: &str = "https://api.scallop.io/v1";

/// Scallop protocol adapter for yield data
#[derive(Debug, Clone)]
pub struct ScallopAdapter {
    client: reqwest::Client,
    base_url: String,
}

/// Market data for a single asset
#[derive(Debug, Clone, Deserialize)]
pub struct MarketData {
    pub asset: String,
    pub supply_apy: f64, // Current supply APY (e.g., 8.5)
    pub borrow_apy: f64,
    pub total_supply: String, // Total supplied amount
    pub total_borrow: String,
    pub liquidity: String, // Available liquidity
    pub ltv: f64,          // Loan to value ratio
    pub price: f64,        // Asset price in USD
}

/// Scallop market response
#[derive(Debug, Clone, Deserialize)]
pub struct MarketResponse {
    pub markets: Vec<MarketData>,
    pub timestamp: u64,
}

/// Yield opportunity for comparison
#[derive(Debug, Clone, Serialize)]
pub struct YieldOpportunity {
    pub protocol: String,
    pub asset: String,
    pub apy: f64,
    pub tvl_usd: f64,
    pub liquidity_usd: f64,
    pub risk_score: u8, // 1-10, lower is safer
}

impl ScallopAdapter {
    /// Create new Scallop adapter
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: SCALLOP_API_BASE.to_string(),
        }
    }

    /// Create with custom base URL (for testing)
    pub fn with_base_url(base_url: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url,
        }
    }

    /// Fetch all market data from Scallop
    pub async fn get_markets(&self) -> Result<Vec<MarketData>, AdapterError> {
        let url = format!("{}/markets", self.base_url);

        let response = self
            .client
            .get(&url)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| AdapterError::RequestFailed(e.to_string()))?;

        if !response.status().is_success() {
            return Err(AdapterError::ApiError(
                response.status().to_string(),
                response.text().await.unwrap_or_default(),
            ));
        }

        let market_response: MarketResponse = response
            .json()
            .await
            .map_err(|e| AdapterError::ParseError(e.to_string()))?;

        Ok(market_response.markets)
    }

    /// Get supply APY for specific asset (e.g., "USDC")
    pub async fn get_supply_apy(&self, asset: &str) -> Result<f64, AdapterError> {
        let markets = self.get_markets().await?;

        let market = markets
            .into_iter()
            .find(|m| m.asset.to_uppercase() == asset.to_uppercase())
            .ok_or_else(|| AdapterError::AssetNotFound(asset.to_string()))?;

        Ok(market.supply_apy)
    }

    /// Get yield opportunity for comparison engine
    pub async fn get_yield_opportunity(
        &self,
        asset: &str,
    ) -> Result<YieldOpportunity, AdapterError> {
        let markets = self.get_markets().await?;

        let market = markets
            .into_iter()
            .find(|m| m.asset.to_uppercase() == asset.to_uppercase())
            .ok_or_else(|| AdapterError::AssetNotFound(asset.to_string()))?;

        let tvl_usd = market.total_supply.parse::<f64>().unwrap_or(0.0) * market.price;
        let liquidity_usd = market.liquidity.parse::<f64>().unwrap_or(0.0) * market.price;
        let risk_score = self.calculate_risk_score(&market);

        Ok(YieldOpportunity {
            protocol: "Scallop".to_string(),
            asset: market.asset,
            apy: market.supply_apy,
            tvl_usd,
            liquidity_usd,
            risk_score,
        })
    }

    /// Get all yield opportunities for an asset
    pub async fn get_all_opportunities(&self) -> Result<Vec<YieldOpportunity>, AdapterError> {
        let markets = self.get_markets().await?;

        let opportunities: Vec<YieldOpportunity> = markets
            .into_iter()
            .map(|m| {
                let tvl_usd = m.total_supply.parse::<f64>().unwrap_or(0.0) * m.price;
                let liquidity_usd = m.liquidity.parse::<f64>().unwrap_or(0.0) * m.price;
                let risk = self.calculate_risk_score(&m);

                YieldOpportunity {
                    protocol: "Scallop".to_string(),
                    asset: m.asset,
                    apy: m.supply_apy,
                    tvl_usd,
                    liquidity_usd,
                    risk_score: risk,
                }
            })
            .collect();

        Ok(opportunities)
    }

    /// Calculate risk score based on market metrics
    /// Lower is safer (1-10 scale)
    fn calculate_risk_score(&self, market: &MarketData) -> u8 {
        let mut score = 5; // Base score

        // Higher TVL = lower risk
        let tvl = market.total_supply.parse::<f64>().unwrap_or(0.0);
        if tvl > 100_000_000.0 {
            score -= 2;
        } else if tvl > 10_000_000.0 {
            score -= 1;
        } else if tvl < 1_000_000.0 {
            score += 2;
        }

        // Higher utilization = higher risk
        let utilization = if market.total_supply.parse::<f64>().unwrap_or(1.0) > 0.0 {
            market.total_borrow.parse::<f64>().unwrap_or(0.0)
                / market.total_supply.parse::<f64>().unwrap_or(1.0)
        } else {
            0.0
        };

        if utilization > 0.9 {
            score += 2;
        } else if utilization > 0.8 {
            score += 1;
        }

        score.clamp(1, 10)
    }

    /// Get recommended deposit amount based on liquidity
    pub fn can_accommodate(&self, opportunity: &YieldOpportunity, amount_usd: f64) -> bool {
        opportunity.liquidity_usd * 0.9 > amount_usd // 90% buffer
    }
}

impl Default for ScallopAdapter {
    fn default() -> Self {
        Self::new()
    }
}

/// Adapter errors
#[derive(Debug, thiserror::Error)]
pub enum AdapterError {
    #[error("HTTP request failed: {0}")]
    RequestFailed(String),

    #[error("API error {0}: {1}")]
    ApiError(String, String),

    #[error("Failed to parse response: {0}")]
    ParseError(String),

    #[error("Asset not found: {0}")]
    AssetNotFound(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_risk_score_calculation() {
        let adapter = ScallopAdapter::new();

        let high_tvl_market = MarketData {
            asset: "USDC".to_string(),
            supply_apy: 8.5,
            borrow_apy: 12.0,
            total_supply: "100000000".to_string(), // $100M
            total_borrow: "50000000".to_string(),
            liquidity: "50000000".to_string(),
            ltv: 0.8,
            price: 1.0,
        };

        let score = adapter.calculate_risk_score(&high_tvl_market);
        assert!(score <= 5, "High TVL should have lower risk score");
    }
}
