use naisu_core::EvmChain;
use serde::Serialize;

use crate::common::response::{ApiResponse, ApiSuccessResponse};
use crate::feature::intent::dto::{ChainInfo, ChainsResponse};

/// List supported chains
pub async fn list_chains() -> ApiResponse<ChainsResponse> {
    let chains = vec![
        ChainInfo {
            id: "base".to_string(),
            name: "Base".to_string(),
            chain_type: "evm".to_string(),
            chain_id: EvmChain::Base.chain_id(),
        },
        ChainInfo {
            id: "base_sepolia".to_string(),
            name: "Base Sepolia".to_string(),
            chain_type: "evm".to_string(),
            chain_id: EvmChain::BaseSepolia.chain_id(),
        },
        ChainInfo {
            id: "ethereum".to_string(),
            name: "Ethereum".to_string(),
            chain_type: "evm".to_string(),
            chain_id: EvmChain::Ethereum.chain_id(),
        },
        ChainInfo {
            id: "arbitrum".to_string(),
            name: "Arbitrum".to_string(),
            chain_type: "evm".to_string(),
            chain_id: EvmChain::Arbitrum.chain_id(),
        },
        ChainInfo {
            id: "sui".to_string(),
            name: "Sui".to_string(),
            chain_type: "sui".to_string(),
            chain_id: 0,
        },
        ChainInfo {
            id: "sui_testnet".to_string(),
            name: "Sui Testnet".to_string(),
            chain_type: "sui".to_string(),
            chain_id: 0,
        },
    ];

    Ok(ApiSuccessResponse::new(ChainsResponse { chains }))
}

#[derive(Debug, Serialize)]
pub struct ChainStatus {
    pub chain_id: String,
    pub status: String,
    pub block_height: Option<u64>,
    pub latency_ms: Option<u64>,
}

/// Get chain status/health
pub async fn get_chain_status() -> ApiResponse<Vec<ChainStatus>> {
    // Mock implementation - in real app would check RPC health
    let statuses = vec![
        ChainStatus {
            chain_id: "base_sepolia".to_string(),
            status: "healthy".to_string(),
            block_height: Some(12345678),
            latency_ms: Some(150),
        },
        ChainStatus {
            chain_id: "sui_testnet".to_string(),
            status: "healthy".to_string(),
            block_height: Some(87654321),
            latency_ms: Some(200),
        },
    ];

    Ok(ApiSuccessResponse::new(statuses))
}
