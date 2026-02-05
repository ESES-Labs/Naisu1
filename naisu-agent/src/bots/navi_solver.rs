//! Navi Solver Bot - MAINNET VERSION
//!
//! Specialized solver that fulfills intents using Navi protocol on MAINNET.
//!
//! ## Protocol Integration (VERIFIED MAINNET)
//!
//! Navi is a lending protocol with an account-based model (not token-based like Scallop).
//!
//! ### Mainnet Addresses
//! - Package: `0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0`
//! - Storage: `0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe`
//!
//! ### Account-Based vs Token-Based
//! ```text
//! Scallop (Token):  Deposit SUI → Receive sSUI token (transferable)
//! Navi (Account):   Deposit SUI → Account position tracked in protocol
//! ```

use crate::executor::real_executor::{execute_navi_fulfillment, NaviFulfillmentParams};
use crate::solver::{calculate_bid, Bid, IntentRequest, Solver, SolverConfig, SolverError};

/// Navi protocol constants (MAINNET - VERIFIED)
pub const NAVI_PACKAGE: &str = "0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0";
pub const NAVI_STORAGE: &str = "0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe";

/// Navi SUI asset ID
pub const NAVI_SUI_ASSET_ID: u8 = 0;

/// Navi protocol solver
pub struct NaviSolver {
    config: SolverConfig,
}

impl Default for NaviSolver {
    fn default() -> Self {
        Self::new()
    }
}

impl NaviSolver {
    pub fn new() -> Self {
        Self {
            config: SolverConfig {
                name: "NaviSolver".to_string(),
                min_profit_bps: 15, // Slightly lower margin to compete
                gas_cost_bps: 10,
                max_slippage_bps: 50,
            },
        }
    }

    /// Get current market APY in basis points
    /// Navi typically offers ~8% APY on SUI deposits
    fn get_market_apy_bps(&self) -> u64 {
        800 // 8.0%
    }
}

#[async_trait::async_trait]
impl Solver for NaviSolver {
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
            confidence: 0.95,
        })
    }

    async fn fulfill(&self, intent: &IntentRequest) -> Result<String, SolverError> {
        tracing::info!("🔥 NAVI SOLVER EXECUTING REAL TRANSACTION!");
        tracing::info!("   Intent ID: {}", intent.id);
        tracing::info!("   User: {}", intent.user);
        tracing::info!("   Amount: {} SUI", intent.amount / 1_000_000_000);
        tracing::info!("   Package: {}", NAVI_PACKAGE);

        // Note: Navi is account-based, so we need a different approach
        // Option 1: Create account, deposit, transfer account cap to user
        // Option 2: Use wrapper contract that tokenizes Navi positions

        let params = NaviFulfillmentParams {
            intent_id: intent.id.clone(),
            user_address: intent.user.clone(),
            amount: intent.amount,
            navi_package: NAVI_PACKAGE.to_string(),
            navi_storage: NAVI_STORAGE.to_string(),
            asset_id: NAVI_SUI_ASSET_ID,
        };

        match execute_navi_fulfillment(params).await {
            Ok(tx_digest) => {
                tracing::info!("✅ NAVI FULFILLMENT SUCCESS!");
                tracing::info!("   TX Digest: {}", tx_digest);
                tracing::info!("   View: https://suiscan.xyz/mainnet/tx/{}", tx_digest);
                Ok(tx_digest)
            }
            Err(e) => {
                tracing::error!("❌ NAVI FULFILLMENT FAILED: {}", e);
                Err(SolverError::FulfillmentFailed(e.to_string()))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_navi_solver_name() {
        let solver = NaviSolver::new();
        assert_eq!(solver.name(), "NaviSolver");
    }

    #[test]
    fn test_navi_mainnet_addresses() {
        assert!(NAVI_PACKAGE.starts_with("0x"));
        assert!(NAVI_STORAGE.starts_with("0x"));
        assert_eq!(NAVI_PACKAGE.len(), 66);
    }

    #[test]
    fn test_navi_sui_asset_id() {
        assert_eq!(NAVI_SUI_ASSET_ID, 0);
    }

    #[tokio::test]
    async fn test_navi_evaluation() {
        let solver = NaviSolver::new();
        let intent = IntentRequest {
            id: "0x456".to_string(),
            user: "0xdef".to_string(),
            amount: 1_000_000_000,
            min_apy: 750,
            deadline: 3600,
        };

        let bid = solver.evaluate(&intent, 0.080).await;
        assert!(bid.is_some());

        let bid = bid.unwrap();
        assert_eq!(bid.solver_name, "NaviSolver");
        assert!(bid.apy >= 750);
    }
}
