//! Scallop Solver Bot - MAINNET VERSION
//!
//! Specialized solver that fulfills intents using Scallop protocol on MAINNET.
//!
//! ## Protocol Integration (VERIFIED MAINNET)
//!
//! Scallop is a lending protocol on Sui that issues sCoins (yield-bearing tokens)
//! when users deposit assets.
//!
//! ### Mainnet Addresses (from GitHub publish-result.mainnet.json)
//! - Package: `0xd384ded6b9e7f4d2c4c9007b0291ef88fbfed8e709bce83d2da69de2d79d013d`
//! - Market: `0xa757975255146dc9686aa823b7838b507f315d704f428cbadad2f4ea061939d9`
//! - Version: `0x07871c4b3c847a0f674510d4978d5cf6f960452795e8ff6f189fd2088a3f6ac7`
//!
//! ### PTB Flow
//! ```text
//! 1. mint::mint(Coin<SUI>) -> Coin<sSUI>
//!    Deposit SUI to Scallop, receive sSUI (yield-bearing token)
//!
//! 2. intent::fulfill_intent(YieldIntent, Coin<sSUI>)
//!    Transfer sSUI to user, fulfill intent
//! ```

use crate::executor::real_executor::{execute_scallop_fulfillment, ScallopFulfillmentParams};
use crate::solver::{calculate_bid, Bid, IntentRequest, Solver, SolverConfig, SolverError};

/// Scallop protocol constants (MAINNET - VERIFIED)
/// Source: https://github.com/scallop-io/sui-lending-protocol
/// File: contracts/protocol/publish-result.mainnet.json
pub const SCALLOP_PACKAGE: &str =
    "0xd384ded6b9e7f4d2c4c9007b0291ef88fbfed8e709bce83d2da69de2d79d013d";
pub const SCALLOP_MARKET: &str =
    "0xa757975255146dc9686aa823b7838b507f315d704f428cbadad2f4ea061939d9";
pub const SCALLOP_VERSION: &str =
    "0x07871c4b3c847a0f674510d4978d5cf6f960452795e8ff6f189fd2088a3f6ac7";

/// sSUI coin type (Scallop's yield-bearing SUI token)
pub const SSUI_COIN_TYPE: &str = "0xd384ded6b9e7f4d2c4c9007b0291ef88fbfed8e709bce83d2da69de2d79d013d::s_coin::sCoin<0x2::sui::SUI>";

/// Scallop protocol solver
pub struct ScallopSolver {
    config: SolverConfig,
}

impl Default for ScallopSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl ScallopSolver {
    pub fn new() -> Self {
        Self {
            config: SolverConfig {
                name: "ScallopSolver".to_string(),
                min_profit_bps: 20,
                gas_cost_bps: 10,
                max_slippage_bps: 50,
            },
        }
    }

    /// Get current market APY in basis points
    /// Scallop typically offers ~8.5% APY on SUI deposits
    fn get_market_apy_bps(&self) -> u64 {
        850 // 8.5% - In production, fetch from Scallop API
    }
}

#[async_trait::async_trait]
impl Solver for ScallopSolver {
    fn name(&self) -> &str {
        &self.config.name
    }

    async fn evaluate(&self, intent: &IntentRequest, _market_apy: f64) -> Option<Bid> {
        let market_apy_bps = self.get_market_apy_bps();

        calculate_bid(
            market_apy_bps,
            intent.min_apy,
            self.config.gas_cost_bps,
            self.config.min_profit_bps,
        )
        .map(|apy| Bid {
            solver_name: self.name().to_string(),
            apy,
            profit_bps: self.config.min_profit_bps,
            confidence: 0.95, // High confidence for direct protocol
        })
    }

    async fn fulfill(&self, intent: &IntentRequest) -> Result<String, SolverError> {
        tracing::info!("🔥 SCALLOP SOLVER EXECUTING REAL TRANSACTION!");
        tracing::info!("   Intent ID: {}", intent.id);
        tracing::info!("   User: {}", intent.user);
        tracing::info!("   Amount: {} SUI", intent.amount / 1_000_000_000);
        tracing::info!("   Package: {}", SCALLOP_PACKAGE);

        // Execute real Scallop fulfillment
        let params = ScallopFulfillmentParams {
            intent_id: intent.id.clone(),
            user_address: intent.user.clone(),
            amount: intent.amount,
            scallop_package: SCALLOP_PACKAGE.to_string(),
            scallop_market: SCALLOP_MARKET.to_string(),
            scallop_version: SCALLOP_VERSION.to_string(),
        };

        match execute_scallop_fulfillment(params).await {
            Ok(tx_digest) => {
                tracing::info!("✅ SCALLOP FULFILLMENT SUCCESS!");
                tracing::info!("   TX Digest: {}", tx_digest);
                tracing::info!("   View: https://suiscan.xyz/mainnet/tx/{}", tx_digest);
                Ok(tx_digest)
            }
            Err(e) => {
                tracing::error!("❌ SCALLOP FULFILLMENT FAILED: {}", e);
                Err(SolverError::FulfillmentFailed(e.to_string()))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scallop_solver_name() {
        let solver = ScallopSolver::new();
        assert_eq!(solver.name(), "ScallopSolver");
    }

    #[test]
    fn test_scallop_mainnet_addresses() {
        // Verify mainnet addresses are valid Sui addresses
        assert!(SCALLOP_PACKAGE.starts_with("0x"));
        assert!(SCALLOP_MARKET.starts_with("0x"));
        assert!(SCALLOP_VERSION.starts_with("0x"));
        assert_eq!(SCALLOP_PACKAGE.len(), 66);
    }

    #[test]
    fn test_ssui_coin_type() {
        assert!(SSUI_COIN_TYPE.contains("sCoin"));
        assert!(SSUI_COIN_TYPE.contains("sui::SUI"));
    }

    #[tokio::test]
    async fn test_scallop_evaluation() {
        let solver = ScallopSolver::new();
        let intent = IntentRequest {
            id: "0x123".to_string(),
            user: "0xabc".to_string(),
            amount: 1_000_000_000, // 1 SUI
            min_apy: 750,          // 7.5%
            deadline: 3600,
        };

        // Market APY 8.5%, should be profitable
        let bid = solver.evaluate(&intent, 0.085).await;
        assert!(bid.is_some());

        let bid = bid.unwrap();
        assert_eq!(bid.solver_name, "ScallopSolver");
        assert!(bid.apy >= 750);
        assert!(bid.confidence >= 0.9);
    }
}
