//! Network management API
//!
//! Provides endpoints to switch between testnet and mainnet,
//! and query supported protocols for each network.

use axum::{extract::State, routing::get, Json, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::state::AppState;

/// Network information response
#[derive(Debug, Serialize)]
pub struct NetworkInfo {
    pub current_network: String,
    pub supported_networks: Vec<String>,
    pub supported_protocols: Vec<ProtocolInfo>,
}

/// Protocol information
#[derive(Debug, Serialize)]
pub struct ProtocolInfo {
    pub name: String,
    pub protocol_type: String,
    pub estimated_apy: f64,
    pub available: bool,
}

/// Switch network request
#[derive(Debug, Deserialize)]
pub struct SwitchNetworkRequest {
    pub network: String,
}

/// Switch network response
#[derive(Debug, Serialize)]
pub struct SwitchNetworkResponse {
    pub success: bool,
    pub network: String,
    pub message: String,
}

/// Get current network info
async fn get_network_info(State(state): State<Arc<AppState>>) -> Json<NetworkInfo> {
    let current = state.network();

    let supported_protocols = match current.as_str() {
        "testnet" => vec![
            ProtocolInfo {
                name: "Native Staking".to_string(),
                protocol_type: "staking".to_string(),
                estimated_apy: 0.025,
                available: true,
            },
            ProtocolInfo {
                name: "DeepBook".to_string(),
                protocol_type: "dex_clob".to_string(),
                estimated_apy: 0.05,
                available: false, // TODO: Implement
            },
        ],
        "mainnet" => vec![
            ProtocolInfo {
                name: "Cetus".to_string(),
                protocol_type: "dex_amm".to_string(),
                estimated_apy: 0.08,
                available: false, // TODO: Implement
            },
            ProtocolInfo {
                name: "Scallop".to_string(),
                protocol_type: "lending".to_string(),
                estimated_apy: 0.085,
                available: false,
            },
            ProtocolInfo {
                name: "Navi".to_string(),
                protocol_type: "lending".to_string(),
                estimated_apy: 0.08,
                available: false,
            },
            ProtocolInfo {
                name: "Native Staking".to_string(),
                protocol_type: "staking".to_string(),
                estimated_apy: 0.025,
                available: true,
            },
            ProtocolInfo {
                name: "DeepBook".to_string(),
                protocol_type: "dex_clob".to_string(),
                estimated_apy: 0.05,
                available: false,
            },
        ],
        _ => vec![],
    };

    Json(NetworkInfo {
        current_network: current,
        supported_networks: vec!["testnet".to_string(), "mainnet".to_string()],
        supported_protocols,
    })
}

/// Switch network
async fn switch_network(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SwitchNetworkRequest>,
) -> Json<SwitchNetworkResponse> {
    let network = request.network.to_lowercase();

    match network.as_str() {
        "testnet" | "mainnet" => {
            state.set_network(&network);
            Json(SwitchNetworkResponse {
                success: true,
                network,
                message: "Network switched successfully".to_string(),
            })
        }
        _ => Json(SwitchNetworkResponse {
            success: false,
            network: state.network(),
            message: format!("Unknown network: {}", request.network),
        }),
    }
}

/// Create network routes
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/info", get(get_network_info))
        .route("/switch", axum::routing::post(switch_network))
}
