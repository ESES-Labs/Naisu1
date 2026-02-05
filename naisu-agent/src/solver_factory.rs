//! Solver Factory
//!
//! Creates appropriate solvers based on network configuration.
//! Supports both Testnet and Mainnet with different protocol availability.

use crate::bots::StakingSolver;
use crate::config::{Network, Protocol};
use crate::solver::{Solver, SolverError};

/// Factory for creating solvers based on network
pub struct SolverFactory {
    network: Network,
}

impl SolverFactory {
    /// Create new solver factory for specific network
    pub fn new(network: Network) -> Self {
        Self { network }
    }

    /// Get all available solvers for current network
    pub fn create_solvers(&self) -> Vec<Box<dyn Solver + Send + Sync>> {
        // Native staking works on all networks
        let solvers: Vec<Box<dyn Solver + Send + Sync>> = vec![Box::new(StakingSolver::new())];

        // Add network-specific solvers
        match self.network {
            Network::Testnet => {
                // Testnet: Only staking and DeepBook
                // DeepBook solver would be added here when implemented
                tracing::info!("Testnet mode: Staking + DeepBook (when implemented)");
            }
            Network::Mainnet => {
                // Mainnet: All protocols
                // TODO: Add CetusSolver, ScallopSolver, NaviSolver when implemented
                tracing::info!("Mainnet mode: Full protocol suite (when implemented)");
            }
        }

        solvers
    }

    /// Get solver for specific protocol
    pub fn create_solver_for_protocol(
        &self,
        protocol: Protocol,
    ) -> Result<Box<dyn Solver + Send + Sync>, SolverError> {
        // Check if protocol is supported on this network
        let supported = self.network.supported_protocols();
        if !supported.contains(&protocol) {
            return Err(SolverError::MarketDataUnavailable);
        }

        match protocol {
            Protocol::NativeStaking => Ok(Box::new(StakingSolver::new())),
            _ => Err(SolverError::MarketDataUnavailable),
        }
    }

    /// Get current network
    pub fn network(&self) -> Network {
        self.network
    }

    /// Get supported protocols for current network
    pub fn supported_protocols(&self) -> Vec<Protocol> {
        self.network.supported_protocols()
    }
}

/// Multi-network solver manager
pub struct MultiNetworkSolver {
    testnet_factory: SolverFactory,
    mainnet_factory: SolverFactory,
}

impl MultiNetworkSolver {
    /// Create new multi-network solver
    pub fn new() -> Self {
        Self {
            testnet_factory: SolverFactory::new(Network::Testnet),
            mainnet_factory: SolverFactory::new(Network::Mainnet),
        }
    }

    /// Get solvers for specific network
    pub fn get_solvers(&self, network: Network) -> Vec<Box<dyn Solver + Send + Sync>> {
        match network {
            Network::Testnet => self.testnet_factory.create_solvers(),
            Network::Mainnet => self.mainnet_factory.create_solvers(),
        }
    }

    /// Get factory for specific network
    pub fn get_factory(&self, network: Network) -> &SolverFactory {
        match network {
            Network::Testnet => &self.testnet_factory,
            Network::Mainnet => &self.mainnet_factory,
        }
    }
}

impl Default for MultiNetworkSolver {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solver_factory_testnet() {
        let factory = SolverFactory::new(Network::Testnet);
        let solvers = factory.create_solvers();
        assert!(!solvers.is_empty());

        let protocols = factory.supported_protocols();
        assert!(protocols.contains(&Protocol::NativeStaking));
        assert!(protocols.contains(&Protocol::DeepBook));
        // Cetus now available on testnet (MVR v5)
        assert!(protocols.contains(&Protocol::Cetus));
    }

    #[test]
    fn test_solver_factory_mainnet() {
        let factory = SolverFactory::new(Network::Mainnet);
        let protocols = factory.supported_protocols();
        assert!(protocols.contains(&Protocol::Cetus));
        assert!(protocols.contains(&Protocol::Scallop));
        assert!(protocols.contains(&Protocol::Navi));
    }

    #[test]
    fn test_multi_network_solver() {
        let multi = MultiNetworkSolver::new();

        let testnet_solvers = multi.get_solvers(Network::Testnet);
        let mainnet_solvers = multi.get_solvers(Network::Mainnet);

        assert!(!testnet_solvers.is_empty());
        assert!(!mainnet_solvers.is_empty());
    }
}
