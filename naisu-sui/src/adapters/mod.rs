//! Protocol Adapters for Sui DeFi
//!
//! Provides unified interface for querying yield data from:
//! - Scallop (scallop.io)
//! - Navi (navi.ag)
//!
//! # Example
//! ```rust
//! use naisu_sui::adapters::{ScallopAdapter, NaviAdapter, YieldComparator};
//!
//! async fn find_best_yield() {
//!     let scallop = ScallopAdapter::new();
//!     let navi = NaviAdapter::new();
//!     
//!     let comparator = YieldComparator::new(scallop, navi);
//!     let best = comparator.find_best_for_asset("USDC").await.unwrap();
//!     
//!     println!("Best APY: {} at {}", best.apy, best.protocol);
//! }
//! ```

pub mod navi;
pub mod scallop;

pub use navi::{NaviAdapter, YieldOpportunity as NaviYield};
pub use scallop::{ScallopAdapter, YieldOpportunity as ScallopYield};

use serde::Serialize;

/// Raw yield data (protocol-agnostic)
#[derive(Debug, Clone)]
pub struct RawYieldData {
    pub asset: String,
    pub apy: f64,
    pub tvl_usd: f64,
    pub liquidity_usd: f64,
    pub risk_score: u8,
}

/// Unified yield opportunity across protocols
#[derive(Debug, Clone, Serialize)]
pub struct UnifiedYield {
    pub protocol: Protocol,
    pub asset: String,
    pub apy: f64,
    pub tvl_usd: f64,
    pub liquidity_usd: f64,
    pub risk_score: u8,
    pub score: f64, // Composite score for ranking
}

/// Supported protocols
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum Protocol {
    Scallop,
    Navi,
}

impl std::fmt::Display for Protocol {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Protocol::Scallop => write!(f, "Scallop"),
            Protocol::Navi => write!(f, "Navi"),
        }
    }
}

/// Yield comparator for finding optimal routes
pub struct YieldComparator {
    scallop: ScallopAdapter,
    navi: NaviAdapter,
}

/// User preferences for yield optimization
#[derive(Debug, Clone, Default)]
pub struct YieldPreferences {
    pub min_apy: Option<f64>,
    pub max_risk: Option<u8>, // 1-10
    pub min_tvl_usd: Option<f64>,
    pub prefer_liquidity: bool,
}

impl YieldComparator {
    /// Create new comparator with adapters
    pub fn new(scallop: ScallopAdapter, navi: NaviAdapter) -> Self {
        Self { scallop, navi }
    }

    /// Find best yield for a specific asset
    pub async fn find_best_for_asset(&self, asset: &str) -> Result<UnifiedYield, AdapterError> {
        let opportunities = self.compare_asset(asset).await?;

        opportunities
            .into_iter()
            .max_by(|a, b| a.score.partial_cmp(&b.score).unwrap())
            .ok_or_else(|| AdapterError::NoOpportunities(asset.to_string()))
    }

    /// Find best yield with user preferences
    pub async fn find_best_with_preferences(
        &self,
        asset: &str,
        prefs: &YieldPreferences,
    ) -> Result<UnifiedYield, AdapterError> {
        let opportunities = self.compare_asset(asset).await?;

        let filtered: Vec<_> = opportunities
            .into_iter()
            .filter(|o| {
                if let Some(min_apy) = prefs.min_apy {
                    if o.apy < min_apy {
                        return false;
                    }
                }
                if let Some(max_risk) = prefs.max_risk {
                    if o.risk_score > max_risk {
                        return false;
                    }
                }
                if let Some(min_tvl) = prefs.min_tvl_usd {
                    if o.tvl_usd < min_tvl {
                        return false;
                    }
                }
                true
            })
            .collect();

        if filtered.is_empty() {
            return Err(AdapterError::NoMatchingOpportunities(asset.to_string()));
        }

        let best = filtered
            .into_iter()
            .max_by(|a, b| a.score.partial_cmp(&b.score).unwrap())
            .unwrap();

        Ok(best)
    }

    /// Compare yields across all protocols for an asset
    pub async fn compare_asset(&self, asset: &str) -> Result<Vec<UnifiedYield>, AdapterError> {
        let mut opportunities = Vec::new();

        // Fetch from Scallop
        match self.scallop.get_yield_opportunity(asset).await {
            Ok(opp) => {
                let raw = RawYieldData {
                    asset: opp.asset,
                    apy: opp.apy,
                    tvl_usd: opp.tvl_usd,
                    liquidity_usd: opp.liquidity_usd,
                    risk_score: opp.risk_score,
                };
                let score = Self::calculate_score(&raw, false);
                opportunities.push(UnifiedYield {
                    protocol: Protocol::Scallop,
                    asset: raw.asset,
                    apy: raw.apy,
                    tvl_usd: raw.tvl_usd,
                    liquidity_usd: raw.liquidity_usd,
                    risk_score: raw.risk_score,
                    score,
                });
            }
            Err(e) => tracing::warn!("Failed to fetch Scallop data: {}", e),
        }

        // Fetch from Navi
        match self.navi.get_yield_opportunity(asset).await {
            Ok(opp) => {
                let raw = RawYieldData {
                    asset: opp.asset,
                    apy: opp.apy,
                    tvl_usd: opp.tvl_usd,
                    liquidity_usd: opp.liquidity_usd,
                    risk_score: opp.risk_score,
                };
                let score = Self::calculate_score(&raw, false);
                opportunities.push(UnifiedYield {
                    protocol: Protocol::Navi,
                    asset: raw.asset,
                    apy: raw.apy,
                    tvl_usd: raw.tvl_usd,
                    liquidity_usd: raw.liquidity_usd,
                    risk_score: raw.risk_score,
                    score,
                });
            }
            Err(e) => tracing::warn!("Failed to fetch Navi data: {}", e),
        }

        if opportunities.is_empty() {
            return Err(AdapterError::NoOpportunities(asset.to_string()));
        }

        // Sort by score descending
        opportunities.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

        Ok(opportunities)
    }

    /// Get all opportunities across all protocols
    pub async fn get_all_opportunities(&self) -> Result<Vec<UnifiedYield>, AdapterError> {
        let mut all = Vec::new();

        // Fetch all from Scallop
        match self.scallop.get_all_opportunities().await {
            Ok(opps) => {
                for opp in opps {
                    let raw = RawYieldData {
                        asset: opp.asset,
                        apy: opp.apy,
                        tvl_usd: opp.tvl_usd,
                        liquidity_usd: opp.liquidity_usd,
                        risk_score: opp.risk_score,
                    };
                    let score = Self::calculate_score(&raw, false);
                    all.push(UnifiedYield {
                        protocol: Protocol::Scallop,
                        asset: raw.asset,
                        apy: raw.apy,
                        tvl_usd: raw.tvl_usd,
                        liquidity_usd: raw.liquidity_usd,
                        risk_score: raw.risk_score,
                        score,
                    });
                }
            }
            Err(e) => tracing::warn!("Failed to fetch all Scallop data: {}", e),
        }

        // Fetch all from Navi
        match self.navi.get_all_opportunities().await {
            Ok(opps) => {
                for opp in opps {
                    let raw = RawYieldData {
                        asset: opp.asset,
                        apy: opp.apy,
                        tvl_usd: opp.tvl_usd,
                        liquidity_usd: opp.liquidity_usd,
                        risk_score: opp.risk_score,
                    };
                    let score = Self::calculate_score(&raw, false);
                    all.push(UnifiedYield {
                        protocol: Protocol::Navi,
                        asset: raw.asset,
                        apy: raw.apy,
                        tvl_usd: raw.tvl_usd,
                        liquidity_usd: raw.liquidity_usd,
                        risk_score: raw.risk_score,
                        score,
                    });
                }
            }
            Err(e) => tracing::warn!("Failed to fetch all Navi data: {}", e),
        }

        // Sort by score
        all.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

        Ok(all)
    }

    /// Calculate composite score for ranking
    /// Weights: APY (50%), Safety (30%), Liquidity (20%)
    fn calculate_score(opp: &RawYieldData, prefer_liquidity: bool) -> f64 {
        let apy_score = opp.apy * 5.0; // 8% APY = 40 points
        let safety_score = (11.0 - opp.risk_score as f64) * 3.0; // Risk 3 = 24 points

        let liquidity_score = if prefer_liquidity {
            (opp.liquidity_usd / 1_000_000.0).min(20.0) // Cap at 20 points
        } else {
            (opp.tvl_usd / 10_000_000.0).min(20.0) // Cap at 20 points
        };

        apy_score + safety_score + liquidity_score
    }
}

/// Unified adapter error
#[derive(Debug, thiserror::Error)]
pub enum AdapterError {
    #[error("Scallop adapter error: {0}")]
    Scallop(#[from] scallop::AdapterError),

    #[error("Navi adapter error: {0}")]
    Navi(#[from] navi::AdapterError),

    #[error("No opportunities found for {0}")]
    NoOpportunities(String),

    #[error("No opportunities matching preferences for {0}")]
    NoMatchingOpportunities(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_display() {
        assert_eq!(Protocol::Scallop.to_string(), "Scallop");
        assert_eq!(Protocol::Navi.to_string(), "Navi");
    }
}
