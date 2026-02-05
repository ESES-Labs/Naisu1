//! Scallop Solver Bot
//!
//! Specialized solver that fulfills intents using Scallop protocol.

use crate::solver::{calculate_bid, Bid, IntentRequest, Solver, SolverConfig, SolverError};
use naisu_sui::adapters::ScallopAdapter;

/// Scallop protocol solver
pub struct ScallopSolver {
    config: SolverConfig,
    #[allow(dead_code)]
    adapter: ScallopAdapter,
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
            adapter: ScallopAdapter::new(),
        }
    }

    /// Query current Scallop APY for USDC
    #[allow(dead_code)]
    async fn get_market_apy(&self) -> Result<f64, SolverError> {
        self.adapter
            .get_supply_apy("USDC")
            .await
            .map_err(|_| SolverError::MarketDataUnavailable)
    }
}

#[async_trait::async_trait]
impl Solver for ScallopSolver {
    fn name(&self) -> &str {
        &self.config.name
    }

    async fn evaluate(&self, intent: &IntentRequest, market_apy: f64) -> Option<Bid> {
        let market_apy_bps = (market_apy * 100.0) as u64; // Convert to basis points

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

    async fn fulfill(&self, _intent: &IntentRequest) -> Result<String, SolverError> {
        // TODO: Implement PTB execution
        // 1. Deposit USDC to Scallop
        // 2. Transfer sUSDC to user
        // 3. Claim solver fee

        Ok("mock_tx_hash".to_string())
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
}
