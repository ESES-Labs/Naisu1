//! Chain definitions for supported networks

use serde::{Deserialize, Serialize};

/// Supported EVM chains (source chains)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EvmChain {
    /// Ethereum Mainnet
    Ethereum,
    /// Base (L2)
    Base,
    /// Arbitrum One
    Arbitrum,
    /// Optimism
    Optimism,
    /// Base Sepolia (Testnet)
    BaseSepolia,
    /// Sepolia (Testnet)
    Sepolia,
}

impl EvmChain {
    /// Get the chain ID for this EVM chain
    pub fn chain_id(&self) -> u64 {
        match self {
            EvmChain::Ethereum => 1,
            EvmChain::Base => 8453,
            EvmChain::Arbitrum => 42161,
            EvmChain::Optimism => 10,
            EvmChain::BaseSepolia => 84532,
            EvmChain::Sepolia => 11155111,
        }
    }

    /// Get Li.Fi chain key
    pub fn lifi_chain_key(&self) -> &'static str {
        match self {
            EvmChain::Ethereum => "ETH",
            EvmChain::Base => "BAS",
            EvmChain::Arbitrum => "ARB",
            EvmChain::Optimism => "OPT",
            EvmChain::BaseSepolia => "BAS", // Li.Fi may use same key
            EvmChain::Sepolia => "ETH",
        }
    }

    /// Check if this is a testnet
    pub fn is_testnet(&self) -> bool {
        matches!(self, EvmChain::BaseSepolia | EvmChain::Sepolia)
    }
}

/// Sui network variants
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SuiNetwork {
    Mainnet,
    Testnet,
    Devnet,
}

impl SuiNetwork {
    /// Get the RPC URL for this Sui network
    pub fn rpc_url(&self) -> &'static str {
        match self {
            SuiNetwork::Mainnet => "https://fullnode.mainnet.sui.io:443",
            SuiNetwork::Testnet => "https://fullnode.testnet.sui.io:443",
            SuiNetwork::Devnet => "https://fullnode.devnet.sui.io:443",
        }
    }
}

/// Token information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub symbol: String,
    pub address: String,
    pub decimals: u8,
    pub chain: EvmChain,
}

/// Common EVM tokens
pub mod tokens {
    use super::*;

    pub fn usdc_base_sepolia() -> TokenInfo {
        TokenInfo {
            symbol: "USDC".to_string(),
            address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e".to_string(),
            decimals: 6,
            chain: EvmChain::BaseSepolia,
        }
    }

    pub fn weth_base_sepolia() -> TokenInfo {
        TokenInfo {
            symbol: "WETH".to_string(),
            address: "0x4200000000000000000000000000000000000006".to_string(),
            decimals: 18,
            chain: EvmChain::BaseSepolia,
        }
    }
}
