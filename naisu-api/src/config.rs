use std::env;

use dotenvy::dotenv;

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub port: u16,
    pub cors_allowed_origins: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct EvmConfig {
    pub rpc_url: String,
    pub hook_address: String,
    pub chain_id: u64,
}

#[derive(Debug, Clone)]
pub struct SuiConfig {
    pub rpc_url: String,
    pub package_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct BridgeConfig {
    pub cctp_api_url: String,
    pub wormhole_api_url: String,
    pub lifi_api_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub rust_env: String,
    pub is_production: bool,
    pub server: ServerConfig,
    pub evm: EvmConfig,
    pub sui: SuiConfig,
    pub bridge: BridgeConfig,
}

impl Config {
    pub fn from_env() -> Self {
        dotenv().ok();

        let rust_env = Self::get_rust_env();
        let is_production = rust_env == "production";

        Self {
            rust_env,
            is_production,
            server: ServerConfig {
                port: env::var("PORT")
                    .ok()
                    .and_then(|p| p.parse().ok())
                    .unwrap_or(8080),
                cors_allowed_origins: env::var("CORS_ALLOWED_ORIGINS")
                    .unwrap_or_else(|_| "*".to_string())
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .collect(),
            },
            evm: EvmConfig {
                rpc_url: env::var("EVM_RPC_URL")
                    .unwrap_or_else(|_| "https://sepolia.base.org".to_string()),
                hook_address: env::var("HOOK_ADDRESS")
                    .unwrap_or_else(|_| "0x0000000000000000000000000000000000000000".to_string()),
                chain_id: env::var("EVM_CHAIN_ID")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(84532),
            },
            sui: SuiConfig {
                rpc_url: env::var("SUI_RPC_URL")
                    .unwrap_or_else(|_| "https://fullnode.testnet.sui.io:443".to_string()),
                package_id: env::var("SUI_PACKAGE_ID").ok(),
            },
            bridge: BridgeConfig {
                cctp_api_url: env::var("CCTP_API_URL")
                    .unwrap_or_else(|_| "https://iris-api-sandbox.circle.com".to_string()),
                wormhole_api_url: env::var("WORMHOLE_API_URL")
                    .unwrap_or_else(|_| "https://api.testnet.wormholescan.io".to_string()),
                lifi_api_url: env::var("LIFI_API_URL").ok(),
            },
        }
    }

    fn get_rust_env() -> String {
        if cfg!(debug_assertions) {
            "development".to_string()
        } else {
            "production".to_string()
        }
    }
}
