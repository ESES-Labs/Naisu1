//! Yield strategies on Sui

use serde::{Deserialize, Serialize};

/// Available yield strategies on Sui
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum YieldStrategy {
    /// Scallop USDC lending pool
    ScallopUsdc,
    /// Scallop SUI lending pool
    ScallopSui,
    /// Navi USDC lending pool
    NaviUsdc,
    /// Navi SUI lending pool
    NaviSui,
    /// Custom strategy (future)
    Custom(u8),
}

impl YieldStrategy {
    /// Get strategy ID for on-chain encoding
    pub fn id(&self) -> u8 {
        match self {
            YieldStrategy::ScallopUsdc => 1,
            YieldStrategy::ScallopSui => 2,
            YieldStrategy::NaviUsdc => 3,
            YieldStrategy::NaviSui => 4,
            YieldStrategy::Custom(id) => *id,
        }
    }

    /// Get strategy from ID
    pub fn from_id(id: u8) -> Self {
        match id {
            1 => YieldStrategy::ScallopUsdc,
            2 => YieldStrategy::ScallopSui,
            3 => YieldStrategy::NaviUsdc,
            4 => YieldStrategy::NaviSui,
            _ => YieldStrategy::Custom(id),
        }
    }

    /// Get human-readable name
    pub fn name(&self) -> &'static str {
        match self {
            YieldStrategy::ScallopUsdc => "Scallop USDC Lending",
            YieldStrategy::ScallopSui => "Scallop SUI Lending",
            YieldStrategy::NaviUsdc => "Navi USDC Lending",
            YieldStrategy::NaviSui => "Navi SUI Lending",
            YieldStrategy::Custom(_) => "Custom Strategy",
        }
    }

    /// Get protocol name
    pub fn protocol(&self) -> &'static str {
        match self {
            YieldStrategy::ScallopUsdc | YieldStrategy::ScallopSui => "Scallop",
            YieldStrategy::NaviUsdc | YieldStrategy::NaviSui => "Navi",
            YieldStrategy::Custom(_) => "Custom",
        }
    }

    /// Get the asset used in this strategy
    pub fn asset(&self) -> &'static str {
        match self {
            YieldStrategy::ScallopUsdc | YieldStrategy::NaviUsdc => "USDC",
            YieldStrategy::ScallopSui | YieldStrategy::NaviSui => "SUI",
            YieldStrategy::Custom(_) => "Unknown",
        }
    }

    /// Whether this strategy requires a swap on Sui (USDC -> SUI)
    pub fn requires_sui_swap(&self) -> bool {
        matches!(self, YieldStrategy::ScallopSui | YieldStrategy::NaviSui)
    }
}

/// Strategy info with APY data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyInfo {
    pub strategy: YieldStrategy,
    pub name: String,
    pub protocol: String,
    pub asset: String,
    pub apy: f64,
    pub tvl: String,
    pub enabled: bool,
}

impl StrategyInfo {
    pub fn new(strategy: YieldStrategy, apy: f64, tvl: String, enabled: bool) -> Self {
        Self {
            strategy,
            name: strategy.name().to_string(),
            protocol: strategy.protocol().to_string(),
            asset: strategy.asset().to_string(),
            apy,
            tvl,
            enabled,
        }
    }
}
