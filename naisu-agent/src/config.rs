//! Agent configuration

use naisu_core::EvmChain;
use naisu_evm::EvmConfig;
use naisu_sui::SuiConfig;
use std::env;

/// Agent configuration (non-custodial: no private keys)
#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub evm: EvmConfig,
    pub sui: SuiConfig,
}

impl AgentConfig {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, ConfigError> {
        let rpc_url = env::var("BASE_SEPOLIA_RPC")
            .unwrap_or_else(|_| "https://sepolia.base.org".to_string());
        let hook_address = env::var("HOOK_ADDRESS")
            .map_err(|_| ConfigError::Missing("HOOK_ADDRESS"))?;

        let evm = EvmConfig::new(EvmChain::BaseSepolia, rpc_url, hook_address);

        let sui_rpc = env::var("SUI_RPC")
            .unwrap_or_else(|_| "https://fullnode.testnet.sui.io:443".to_string());

        let mut sui = SuiConfig::testnet();
        sui.rpc_url = sui_rpc;

        if let Ok(pkg) = env::var("SCALLOP_PACKAGE_ID") {
            sui = sui.with_scallop(pkg);
        }
        if let Ok(pkg) = env::var("NAVI_PACKAGE_ID") {
            sui = sui.with_navi(pkg);
        }

        Ok(Self { evm, sui })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Missing environment variable: {0}")]
    Missing(&'static str),
}
