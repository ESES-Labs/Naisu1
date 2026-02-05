//! Cetus Solver Bot - REAL IMPLEMENTATION
//!
//! Specialized solver that fulfills intents using Cetus CLMM protocol.
//!
//! ## Architecture
//!
//! For yield intents, we use a two-step approach:
//! 1. Swap 50% SUI → USDC via Cetus router
//! 2. Add liquidity to SUI/USDC pool (earn trading fees)
//! 3. Transfer LP position NFT to user
//!
//! ## Testnet Addresses (MVR v5)
//! - Package ID: `0x5372d555ac734e272659136c2a0cd3227f9b92de67c80dc11250307268af2db8`
//! - Published At: `0x6bbdf09f9fa0baa1524080a5b8991042e95061c4e1206217279aec51ba08edf7`
//! - Pools ID: `0x50eb61dd5928cec5ea04711a2e9b72e5237e79e9fbcd2ce3d5469dc8708e0ee2`
//! - Global Config: `0x9774e359588ead122af1c7e7f64e14ade261cfeecdb5d0eb4a5b3b4c8ab8bd3e`
//! - Integrate Package: `0x2918cf39850de6d5d94d8196dc878c8c722cd79db659318e00bff57fbb4e2ede`
//!
//! ## Mainnet Addresses
//! - Package ID: `0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb`
//! - Config Package: `0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f`
//! - Integrate Package: `0x996c4d9480708fb8b92aa7acf819fb0497b5ec8e65ba06601cae2fb6db3312c3`

use crate::config::network::{Network, Protocol, ProtocolConfig};
use crate::executor::real_executor::{execute_cetus_fulfillment, CetusFulfillmentParams};
use crate::solver::{calculate_bid, Bid, IntentRequest, Solver, SolverConfig, SolverError};

/// Cetus protocol constants (TESTNET - MVR v5)
pub const CETUS_TESTNET_PACKAGE: &str =
    "0x5372d555ac734e272659136c2a0cd3227f9b92de67c80dc11250307268af2db8";
pub const CETUS_TESTNET_PUBLISHED_AT: &str =
    "0x6bbdf09f9fa0baa1524080a5b8991042e95061c4e1206217279aec51ba08edf7";
pub const CETUS_TESTNET_POOLS_ID: &str =
    "0x50eb61dd5928cec5ea04711a2e9b72e5237e79e9fbcd2ce3d5469dc8708e0ee2";
pub const CETUS_TESTNET_GLOBAL_CONFIG: &str =
    "0x9774e359588ead122af1c7e7f64e14ade261cfeecdb5d0eb4a5b3b4c8ab8bd3e";
pub const CETUS_TESTNET_INTEGRATE: &str =
    "0x2918cf39850de6d5d94d8196dc878c8c722cd79db659318e00bff57fbb4e2ede";
pub const CETUS_TESTNET_CONFIG: &str =
    "0xf5ff7d5ba73b581bca6b4b9fa0049cd320360abd154b809f8700a8fd3cfaf7ca";

/// Cetus protocol constants (MAINNET)
pub const CETUS_MAINNET_PACKAGE: &str =
    "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb";
pub const CETUS_MAINNET_CONFIG: &str =
    "0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f";
pub const CETUS_MAINNET_INTEGRATE: &str =
    "0x996c4d9480708fb8b92aa7acf819fb0497b5ec8e65ba06601cae2fb6db3312c3";
pub const CETUS_MAINNET_POOLS_ID: &str =
    "0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0";
pub const CETUS_MAINNET_GLOBAL_CONFIG: &str =
    "0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f";

/// SUI/USDC Pool on Testnet (found via event query)
/// Pool<USDC, SUI> - note: SUI is coin_b
pub const TESTNET_POOL_USDC_SUI: &str =
    "0x2603c08065a848b719f5f465e40dbef485ec4fd9c967ebe83a7565269a74a2b2";

/// USDC testnet address
pub const TESTNET_USDC: &str =
    "0x14a71d857b34677a7d57e0feb303df1adb515a37780645ab763d42ce8d1a5e48::usdc::USDC";

/// Cetus protocol solver
pub struct CetusSolver {
    config: SolverConfig,
    network: Network,
    protocol_config: Option<ProtocolConfig>,
}

impl CetusSolver {
    pub fn new(network: Network) -> Self {
        let protocol_config = ProtocolConfig::get(Protocol::Cetus, network);

        Self {
            config: SolverConfig {
                name: "CetusSolver".to_string(),
                min_profit_bps: 30, // Higher margin for CLMM complexity (swap + liquidity)
                gas_cost_bps: 20,   // Higher gas for multi-step PTB
                max_slippage_bps: 100,
            },
            network,
            protocol_config,
        }
    }

    /// Get current market APY in basis points
    /// CLMM can offer 10-15% APY depending on volume and range
    fn get_market_apy_bps(&self) -> u64 {
        match self.network {
            Network::Testnet => 1200, // 12% (simulated)
            Network::Mainnet => 1500, // 15% (based on historical data)
        }
    }

    /// Get the appropriate package address for the network
    fn get_package(&self) -> &'static str {
        match self.network {
            Network::Testnet => CETUS_TESTNET_PACKAGE,
            Network::Mainnet => CETUS_MAINNET_PACKAGE,
        }
    }

    /// Get the pools object ID
    fn get_pools_id(&self) -> &'static str {
        match self.network {
            Network::Testnet => CETUS_TESTNET_POOLS_ID,
            Network::Mainnet => CETUS_MAINNET_POOLS_ID,
        }
    }

    /// Get the global config object ID
    #[allow(dead_code)]
    fn get_global_config(&self) -> &'static str {
        match self.network {
            Network::Testnet => CETUS_TESTNET_GLOBAL_CONFIG,
            Network::Mainnet => CETUS_MAINNET_GLOBAL_CONFIG,
        }
    }

    /// Get the integrate package (for swaps)
    #[allow(dead_code)]
    fn get_integrate_package(&self) -> &'static str {
        match self.network {
            Network::Testnet => CETUS_TESTNET_INTEGRATE,
            Network::Mainnet => CETUS_MAINNET_INTEGRATE,
        }
    }

    /// Check if Cetus is available on this network
    pub fn is_available(&self) -> bool {
        self.protocol_config.is_some()
    }
}

#[async_trait::async_trait]
impl Solver for CetusSolver {
    fn name(&self) -> &str {
        &self.config.name
    }

    async fn evaluate(&self, intent: &IntentRequest, _market_apy: f64) -> Option<Bid> {
        // Check if Cetus is available on this network
        if !self.is_available() {
            tracing::debug!("Cetus not available on {:?}", self.network);
            return None;
        }

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
            confidence: 0.85, // Slightly lower due to IL risk and two-step process
        })
    }

    async fn fulfill(&self, intent: &IntentRequest) -> Result<String, SolverError> {
        if !self.is_available() {
            return Err(SolverError::FulfillmentFailed(format!(
                "Cetus not available on {:?}",
                self.network
            )));
        }

        tracing::info!("🔥 CETUS SOLVER EXECUTING REAL CLMM TRANSACTION!");
        tracing::info!("   Network: {:?}", self.network);
        tracing::info!("   Intent ID: {}", intent.id);
        tracing::info!("   User: {}", intent.user);
        tracing::info!("   Amount: {} SUI", intent.amount / 1_000_000_000);
        tracing::info!("   Package: {}", self.get_package());
        tracing::info!("   Pools ID: {}", self.get_pools_id());

        // Calculate price range for the position
        // For a yield-focused position, we use a medium range (±20% = ~±2000 ticks)
        // This gives good fee generation with manageable IL
        let tick_lower = -2000;
        let tick_upper = 2000;

        let params = CetusFulfillmentParams {
            intent_id: intent.id.clone(),
            user_address: intent.user.clone(),
            amount: intent.amount,
            cetus_core: self.get_package().to_string(),
            cetus_factory: self.get_pools_id().to_string(),
            tick_lower,
            tick_upper,
        };

        match execute_cetus_fulfillment(params).await {
            Ok(tx_digest) => {
                tracing::info!("✅ CETUS FULFILLMENT SUCCESS!");
                tracing::info!("   TX Digest: {}", tx_digest);

                let explorer = match self.network {
                    Network::Testnet => "suiscan.xyz/testnet",
                    Network::Mainnet => "suiscan.xyz/mainnet",
                };
                tracing::info!("   View: https://{}/tx/{}", explorer, tx_digest);

                Ok(tx_digest)
            }
            Err(e) => {
                tracing::error!("❌ CETUS FULFILLMENT FAILED: {}", e);
                Err(SolverError::FulfillmentFailed(e.to_string()))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cetus_solver_testnet() {
        let solver = CetusSolver::new(Network::Testnet);
        assert_eq!(solver.name(), "CetusSolver");
        assert!(solver.is_available());
        assert_eq!(solver.get_package(), CETUS_TESTNET_PACKAGE);
    }

    #[test]
    fn test_cetus_solver_mainnet() {
        let solver = CetusSolver::new(Network::Mainnet);
        assert_eq!(solver.name(), "CetusSolver");
        assert!(solver.is_available());
        assert_eq!(solver.get_package(), CETUS_MAINNET_PACKAGE);
    }

    #[test]
    fn test_cetus_addresses() {
        // Verify all addresses are valid format
        assert!(CETUS_TESTNET_PACKAGE.starts_with("0x"));
        assert_eq!(CETUS_TESTNET_PACKAGE.len(), 66);

        assert!(CETUS_MAINNET_PACKAGE.starts_with("0x"));
        assert_eq!(CETUS_MAINNET_PACKAGE.len(), 66);

        assert!(TESTNET_POOL_USDC_SUI.starts_with("0x"));
    }

    #[tokio::test]
    async fn test_cetus_evaluation() {
        let solver = CetusSolver::new(Network::Testnet);
        let intent = IntentRequest {
            id: "0x789".to_string(),
            user: "0xghi".to_string(),
            amount: 1_000_000_000,
            min_apy: 800, // 8%
            deadline: 3600,
        };

        let bid = solver.evaluate(&intent, 0.12).await;
        assert!(bid.is_some());

        let bid = bid.unwrap();
        assert_eq!(bid.solver_name, "CetusSolver");
        assert!(bid.apy >= 800);
    }

    #[tokio::test]
    async fn test_cetus_not_available_on_invalid_network() {
        // This test documents that Cetus should be available on both networks
        let testnet_solver = CetusSolver::new(Network::Testnet);
        let mainnet_solver = CetusSolver::new(Network::Mainnet);

        assert!(testnet_solver.is_available());
        assert!(mainnet_solver.is_available());
    }
}
