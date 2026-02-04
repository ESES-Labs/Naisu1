//! Sui configuration

use naisu_core::SuiNetwork;

/// Sui chain configuration
#[derive(Debug, Clone)]
pub struct SuiConfig {
    pub network: SuiNetwork,
    pub rpc_url: String,
    pub private_key: Option<String>,
    /// Scallop protocol package ID
    pub scallop_package: Option<String>,
    /// Navi protocol package ID
    pub navi_package: Option<String>,
    /// USDC coin type on Sui
    pub usdc_coin_type: String,
}

impl SuiConfig {
    pub fn testnet() -> Self {
        Self {
            network: SuiNetwork::Testnet,
            rpc_url: SuiNetwork::Testnet.rpc_url().to_string(),
            private_key: None,
            scallop_package: None,
            navi_package: None,
            // Testnet USDC (example - actual address may differ)
            usdc_coin_type: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN".to_string(),
        }
    }

    pub fn mainnet() -> Self {
        Self {
            network: SuiNetwork::Mainnet,
            rpc_url: SuiNetwork::Mainnet.rpc_url().to_string(),
            private_key: None,
            scallop_package: Some("0x...".to_string()), // Actual Scallop package
            navi_package: Some("0x...".to_string()),    // Actual Navi package
            usdc_coin_type: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN".to_string(),
        }
    }

    pub fn with_private_key(mut self, key: String) -> Self {
        self.private_key = Some(key);
        self
    }

    pub fn with_scallop(mut self, package: String) -> Self {
        self.scallop_package = Some(package);
        self
    }

    pub fn with_navi(mut self, package: String) -> Self {
        self.navi_package = Some(package);
        self
    }
}
