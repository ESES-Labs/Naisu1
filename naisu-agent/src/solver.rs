//! Solver trait and base implementation
//!
//! Solvers compete to fulfill yield intents by bidding APY rates.
//! The solver with the best user outcome wins and executes the fill.

// Solver implementations are in bots/ module

/// Solver configuration
#[derive(Debug, Clone)]
pub struct SolverConfig {
    /// Solver name/identifier
    pub name: String,
    /// Minimum profit margin (basis points, e.g., 20 = 0.2%)
    pub min_profit_bps: u16,
    /// Estimated gas cost (basis points)
    pub gas_cost_bps: u16,
    /// Maximum slippage tolerance
    pub max_slippage_bps: u16,
}

impl Default for SolverConfig {
    fn default() -> Self {
        Self {
            name: "unnamed_solver".to_string(),
            min_profit_bps: 20,   // 0.2% minimum profit
            gas_cost_bps: 10,     // 0.1% gas estimate
            max_slippage_bps: 50, // 0.5% max slippage
        }
    }
}

/// A bid from a solver
#[derive(Debug, Clone)]
pub struct Bid {
    /// Solver identifier
    pub solver_name: String,
    /// Offered APY (basis points, e.g., 750 = 7.5%)
    pub apy: u64,
    /// Estimated profit for solver (basis points)
    pub profit_bps: u16,
    /// Confidence score (0.0 - 1.0)
    pub confidence: f64,
}

/// Core solver trait
#[async_trait::async_trait]
pub trait Solver {
    /// Get solver name
    fn name(&self) -> &str;

    /// Evaluate an intent and return a bid if profitable
    ///
    /// # Arguments
    /// * `intent` - The yield intent to evaluate
    /// * `market_apy` - Current market APY for the asset
    ///
    /// # Returns
    /// * `Some(Bid)` if solver can fulfill profitably
    /// * `None` if not profitable
    async fn evaluate(&self, intent: &IntentRequest, market_apy: f64) -> Option<Bid>;

    /// Attempt to fulfill the intent (race condition!)
    ///
    /// This is called when the solver wins the bid.
    /// Must execute quickly to win the race.
    async fn fulfill(&self, intent: &IntentRequest) -> Result<String, SolverError>;
}

/// Intent request from user
#[derive(Debug, Clone)]
pub struct IntentRequest {
    /// Intent object ID on Sui
    pub id: String,
    /// User address
    pub user: String,
    /// Input amount (USDC)
    pub amount: u64,
    /// Minimum acceptable APY (basis points)
    pub min_apy: u64,
    /// Deadline timestamp
    pub deadline: u64,
}

/// Solver errors
#[derive(Debug, thiserror::Error)]
pub enum SolverError {
    #[error("Intent not available: {0}")]
    IntentUnavailable(String),

    #[error("Fulfillment failed: {0}")]
    FulfillmentFailed(String),

    #[error("Race lost: another solver won")]
    RaceLost,

    #[error("Market data unavailable")]
    MarketDataUnavailable,
}

/// Calculate optimal bid for a solver
///
/// Formula: bid_apy = market_apy - solver_profit - gas_cost
///
/// # Example
/// - Market APY: 8.5% (850 bps)
/// - User min: 7.5% (750 bps)
/// - Spread: 1.0% (100 bps)
/// - Gas cost: 0.1% (10 bps)
/// - Solver profit: 0.2% (20 bps)
/// - Bid APY: 8.2% (820 bps)
pub fn calculate_bid(
    market_apy: u64,     // e.g., 850 (8.5%)
    user_min: u64,       // e.g., 750 (7.5%)
    gas_cost_bps: u16,   // e.g., 10 (0.1%)
    min_profit_bps: u16, // e.g., 20 (0.2%)
) -> Option<u64> {
    let spread = market_apy.saturating_sub(user_min);
    let required = (gas_cost_bps + min_profit_bps) as u64;

    if spread <= required {
        // Not profitable
        return None;
    }

    // Bid: give user most of the spread, keep small profit
    let bid_apy = market_apy - min_profit_bps as u64;
    Some(bid_apy)
}

/// Select winning bid from multiple solvers
///
/// Winner is the bid with highest APY for user
/// (as long as it's above user's minimum)
pub fn select_winner(bids: Vec<Bid>, min_apy: u64) -> Option<Bid> {
    bids.into_iter()
        .filter(|b| b.apy >= min_apy)
        .max_by(|a, b| a.apy.cmp(&b.apy))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_bid_profitable() {
        // Market: 8.5%, User min: 7.5%, Spread: 1.0%
        let market_apy = 850; // 8.5%
        let user_min = 750; // 7.5%
        let gas_cost = 10; // 0.1%
        let profit = 20; // 0.2%

        let bid = calculate_bid(market_apy, user_min, gas_cost, profit);

        assert!(bid.is_some());
        assert_eq!(bid.unwrap(), 830); // 8.3% (market - profit)
    }

    #[test]
    fn test_calculate_bid_not_profitable() {
        // Market: 8.0%, User min: 7.9%, Spread: 0.1% (too small)
        let market_apy = 800;
        let user_min = 790;
        let gas_cost = 10;
        let profit = 20;

        let bid = calculate_bid(market_apy, user_min, gas_cost, profit);

        assert!(bid.is_none()); // Not worth it
    }

    #[test]
    fn test_select_winner() {
        let bids = vec![
            Bid {
                solver_name: "A".to_string(),
                apy: 820,
                profit_bps: 30,
                confidence: 0.9,
            },
            Bid {
                solver_name: "B".to_string(),
                apy: 800,
                profit_bps: 20,
                confidence: 0.8,
            },
            Bid {
                solver_name: "C".to_string(),
                apy: 810,
                profit_bps: 25,
                confidence: 0.85,
            },
        ];

        let winner = select_winner(bids, 750);

        assert!(winner.is_some());
        assert_eq!(winner.unwrap().solver_name, "A"); // Highest APY
    }
}
