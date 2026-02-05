//! Navi Protocol API Adapter
//!
//! Fetches yield data from Navi API for AI Agent optimization.
//!
//! API Docs: https://docs.navi.ag

use serde::{Deserialize, Serialize};

const NAVI_API_BASE: &str = "https://api.navi.ag/v1";

/// Navi protocol adapter for yield data
#[derive(Debug, Clone)]
pub struct NaviAdapter {
    client: reqwest::Client,
    base_url: String,
}

/// Navi pool/reserve data
#[derive(Debug, Clone, Deserialize)]
pub struct ReserveData {
    pub asset: String,
    pub symbol: String,
    pub supply_apy: f64, // Current supply APY (e.g., 7.8)
    pub borrow_apy: f64,
    pub total_supply: String, // Total supplied
    pub available_liquidity: String,
    pub utilization_rate: f64, // 0.0 - 1.0
    pub price_usd: f64,
    pub ltv: f64,
    pub liquidation_threshold: f64,
}

/// Navi market overview
#[derive(Debug, Clone, Deserialize)]
pub struct MarketOverview {
    pub reserves: Vec<ReserveData>,
    pub total_tvl: f64,
    pub timestamp: u64,
}

/// Yield opportunity (shared struct with Scallop)
#[derive(Debug, Clone, Serialize)]
pub struct YieldOpportunity {
    pub protocol: String,
    pub asset: String,
    pub apy: f64,
    pub tvl_usd: f64,
    pub liquidity_usd: f64,
    pub risk_score: u8, // 1-10, lower is safer
}

impl NaviAdapter {
    /// Create new Navi adapter
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: NAVI_API_BASE.to_string(),
        }
    }

    /// Create with custom base URL (for testing)
    pub fn with_base_url(base_url: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url,
        }
    }

    /// Fetch all reserve data from Navi
    pub async fn get_reserves(&self) -> Result<Vec<ReserveData>, AdapterError> {
        let url = format!("{}/reserves", self.base_url);

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

        let overview: MarketOverview = response
            .json()
            .await
            .map_err(|e| AdapterError::ParseError(e.to_string()))?;

        Ok(overview.reserves)
    }

    /// Get supply APY for specific asset (e.g., "USDC")
    pub async fn get_supply_apy(&self, asset: &str) -> Result<f64, AdapterError> {
        let reserves = self.get_reserves().await?;

        let reserve = reserves
            .into_iter()
            .find(|r| r.symbol.to_uppercase() == asset.to_uppercase())
            .ok_or_else(|| AdapterError::AssetNotFound(asset.to_string()))?;

        Ok(reserve.supply_apy)
    }

    /// Get yield opportunity for comparison engine
    pub async fn get_yield_opportunity(
        &self,
        asset: &str,
    ) -> Result<YieldOpportunity, AdapterError> {
        let reserves = self.get_reserves().await?;

        let reserve = reserves
            .into_iter()
            .find(|r| r.symbol.to_uppercase() == asset.to_uppercase())
            .ok_or_else(|| AdapterError::AssetNotFound(asset.to_string()))?;

        let tvl_usd = reserve.total_supply.parse::<f64>().unwrap_or(0.0) * reserve.price_usd;
        let liquidity_usd =
            reserve.available_liquidity.parse::<f64>().unwrap_or(0.0) * reserve.price_usd;
        let risk_score = self.calculate_risk_score(&reserve);

        Ok(YieldOpportunity {
            protocol: "Navi".to_string(),
            asset: reserve.symbol,
            apy: reserve.supply_apy,
            tvl_usd,
            liquidity_usd,
            risk_score,
        })
    }

    /// Get all yield opportunities
    pub async fn get_all_opportunities(&self) -> Result<Vec<YieldOpportunity>, AdapterError> {
        let reserves = self.get_reserves().await?;

        let opportunities: Vec<YieldOpportunity> = reserves
            .into_iter()
            .map(|r| {
                let tvl_usd = r.total_supply.parse::<f64>().unwrap_or(0.0) * r.price_usd;
                let liquidity_usd =
                    r.available_liquidity.parse::<f64>().unwrap_or(0.0) * r.price_usd;
                let risk = self.calculate_risk_score(&r);

                YieldOpportunity {
                    protocol: "Navi".to_string(),
                    asset: r.symbol,
                    apy: r.supply_apy,
                    tvl_usd,
                    liquidity_usd,
                    risk_score: risk,
                }
            })
            .collect();

        Ok(opportunities)
    }

    /// Calculate risk score based on reserve metrics
    /// Lower is safer (1-10 scale)
    fn calculate_risk_score(&self, reserve: &ReserveData) -> u8 {
        let mut score = 5; // Base score

        // Higher TVL = lower risk
        let tvl = reserve.total_supply.parse::<f64>().unwrap_or(0.0) * reserve.price_usd;
        if tvl > 100_000_000.0 {
            score -= 2;
        } else if tvl > 10_000_000.0 {
            score -= 1;
        } else if tvl < 1_000_000.0 {
            score += 2;
        }

        // High utilization = higher risk
        if reserve.utilization_rate > 0.9 {
            score += 2;
        } else if reserve.utilization_rate > 0.8 {
            score += 1;
        }

        // Lower LTV = safer
        if reserve.ltv < 0.7 {
            score -= 1;
        } else if reserve.ltv > 0.8 {
            score += 1;
        }

        score.clamp(1, 10)
    }

    /// Check if reserve can accommodate deposit
    pub fn can_accommodate(&self, opportunity: &YieldOpportunity, amount_usd: f64) -> bool {
        opportunity.liquidity_usd * 0.9 > amount_usd // 90% buffer
    }
}

impl Default for NaviAdapter {
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
        let adapter = NaviAdapter::new();

        let safe_reserve = ReserveData {
            asset: "USDC".to_string(),
            symbol: "USDC".to_string(),
            supply_apy: 7.8,
            borrow_apy: 11.0,
            total_supply: "150000000".to_string(), // $150M
            available_liquidity: "75000000".to_string(),
            utilization_rate: 0.5,
            price_usd: 1.0,
            ltv: 0.75,
            liquidation_threshold: 0.8,
        };

        let score = adapter.calculate_risk_score(&safe_reserve);
        assert!(
            score <= 4,
            "Safe reserve should have low risk score, got {}",
            score
        );
    }
}
