//! Navi Solver Bot
//!
//! Specialized solver that fulfills intents using Navi protocol.

use crate::solver::{calculate_bid, Bid, IntentRequest, Solver, SolverConfig, SolverError};
use naisu_sui::adapters::NaviAdapter;

/// Navi protocol solver
pub struct NaviSolver {
    config: SolverConfig,
    #[allow(dead_code)]
    adapter: NaviAdapter,
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
                min_profit_bps: 15, // Slightly lower profit margin to compete
                gas_cost_bps: 10,
                max_slippage_bps: 50,
            },
            adapter: NaviAdapter::new(),
        }
    }

    /// Query current Navi APY for USDC
    #[allow(dead_code)]
    async fn get_market_apy(&self) -> Result<f64, SolverError> {
        self.adapter
            .get_supply_apy("USDC")
            .await
            .map_err(|_| SolverError::MarketDataUnavailable)
    }
}

#[async_trait::async_trait]
impl Solver for NaviSolver {
    fn name(&self) -> &str {
        &self.config.name
    }

    async fn evaluate(&self, intent: &IntentRequest, market_apy: f64) -> Option<Bid> {
        let market_apy_bps = (market_apy * 100.0) as u64;

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

    async fn fulfill(&self, _intent: &IntentRequest) -> Result<String, SolverError> {
        // TODO: Implement PTB execution for Navi
        Ok("mock_tx_hash".to_string())
    }
}
