//! Network Configuration
//!
//! Supports both Testnet and Mainnet with different protocol configurations.
//! User can switch between networks in the frontend.
//!
//! # Verified Mainnet Addresses
//! - Scallop: 0xd384ded6b9e7f4d2c4c9007b0291ef88fbfed8e709bce83d2da69de2d79d013d (GitHub official)
//! - Navi: 0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0
//! - DeepBook: 0x000000000000000000000000000000000000000000000000000000000000dee9
//! - Cetus: 0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb (CLMM Core)
//!
//! # Verified Testnet Addresses  
//! - Cetus: 0x0c7ae833c220aa73a3643a0d508afa4ac5d50d97312ea4584e35f9eb21b9df12 (CLMM Core)
//!
//! Sources:
//! - Cetus SDK: https://github.com/CetusProtocol/cetus-clmm-sui-sdk/tree/main/src/config

/// Network type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Network {
    #[default]
    Testnet,
    Mainnet,
}

impl Network {
    /// Get RPC URL for network
    pub fn rpc_url(&self) -> &'static str {
        match self {
            Network::Testnet => "https://fullnode.testnet.sui.io:443",
            Network::Mainnet => "https://fullnode.mainnet.sui.io:443",
        }
    }

    /// Get explorer URL
    pub fn explorer_url(&self) -> &'static str {
        match self {
            Network::Testnet => "https://suiscan.xyz/testnet",
            Network::Mainnet => "https://suiscan.xyz/mainnet",
        }
    }

    /// Get supported protocols for this network
    pub fn supported_protocols(&self) -> Vec<Protocol> {
        match self {
            Network::Testnet => vec![
                Protocol::NativeStaking,
                Protocol::DeepBook,
                Protocol::Cetus, // Now available on testnet!
            ],
            Network::Mainnet => vec![
                Protocol::Cetus,
                Protocol::Scallop,
                Protocol::Navi,
                Protocol::NativeStaking,
                Protocol::DeepBook,
            ],
        }
    }
}

impl std::str::FromStr for Network {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "testnet" => Ok(Network::Testnet),
            "mainnet" => Ok(Network::Mainnet),
            _ => Err(format!("Unknown network: {}", s)),
        }
    }
}

/// Protocol types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Protocol {
    /// Native Sui staking (always works)
    NativeStaking,
    /// DeepBook CLOB DEX (Sui native)
    DeepBook,
    /// Scallop lending protocol (mainnet only)
    Scallop,
    /// Navi lending protocol (mainnet only)
    Navi,
    /// Cetus AMM DEX (mainnet only) - TODO: Find address
    Cetus,
}

impl Protocol {
    pub fn name(&self) -> &'static str {
        match self {
            Protocol::NativeStaking => "NativeStaking",
            Protocol::DeepBook => "DeepBook",
            Protocol::Scallop => "Scallop",
            Protocol::Navi => "Navi",
            Protocol::Cetus => "Cetus",
        }
    }

    pub fn protocol_type(&self) -> &'static str {
        match self {
            Protocol::NativeStaking => "Staking",
            Protocol::DeepBook => "DEX (CLOB)",
            Protocol::Scallop => "Lending",
            Protocol::Navi => "Lending",
            Protocol::Cetus => "DEX (AMM)",
        }
    }

    pub fn apy_estimate(&self) -> f64 {
        match self {
            Protocol::NativeStaking => 0.025, // 2.5%
            Protocol::DeepBook => 0.05,       // 5% (market making)
            Protocol::Scallop => 0.085,       // 8.5%
            Protocol::Navi => 0.08,           // 8%
            Protocol::Cetus => 0.10,          // 10% (LP fees)
        }
    }

    pub fn is_available(&self, network: Network) -> bool {
        match (self, network) {
            // Testnet protocols
            (Protocol::NativeStaking, Network::Testnet) => true,
            (Protocol::DeepBook, Network::Testnet) => true,

            // Mainnet protocols
            (Protocol::NativeStaking, Network::Mainnet) => true,
            (Protocol::DeepBook, Network::Mainnet) => true,
            (Protocol::Scallop, Network::Mainnet) => true,
            (Protocol::Navi, Network::Mainnet) => true,

            // Cetus - now available on both networks
            (Protocol::Cetus, Network::Testnet) => true,
            (Protocol::Cetus, Network::Mainnet) => true,

            // Everything else not available
            _ => false,
        }
    }
}

/// Protocol configuration for each network
#[derive(Debug, Clone)]
pub struct ProtocolConfig {
    pub network: Network,
    pub protocol: Protocol,
    pub package_id: String,
    pub module: String,
    pub config_objects: Vec<(String, String)>, // (name, object_id)
}

impl ProtocolConfig {
    /// Get protocol config for specific protocol and network
    pub fn get(protocol: Protocol, network: Network) -> Option<Self> {
        match (protocol, network) {
            // ===== TESTNET CONFIGS =====

            // Native Staking (Testnet)
            (Protocol::NativeStaking, Network::Testnet) => Some(Self {
                network,
                protocol,
                package_id: "0x3".to_string(),
                module: "sui_system".to_string(),
                config_objects: vec![
                    ("sui_system_state".to_string(), "0x5".to_string()),
                    ("clock".to_string(), "0x6".to_string()),
                ],
            }),

            // DeepBook (Testnet)
            (Protocol::DeepBook, Network::Testnet) => Some(Self {
                network,
                protocol,
                package_id: "0x000000000000000000000000000000000000000000000000000000000000dee9"
                    .to_string(),
                module: "clob_v2".to_string(),
                config_objects: vec![],
            }),

            // Cetus (Testnet) - VERIFIED FROM MVR (Move Registry)
            // Source: https://www.moveregistry.com/package/@cetuspackages/clmm
            // MVR Version: 5 (Latest)
            // GitHub Tag: testnet-v0.0.2
            (Protocol::Cetus, Network::Testnet) => Some(Self {
                network,
                protocol,
                // CLMM Package ID (MVR v5)
                package_id: "0x5372d555ac734e272659136c2a0cd3227f9b92de67c80dc11250307268af2db8"
                    .to_string(),
                module: "pool".to_string(),
                config_objects: vec![
                    // Latest PublishedAt (where upgraded code lives)
                    (
                        "published_at".to_string(),
                        "0x6bbdf09f9fa0baa1524080a5b8991042e95061c4e1206217279aec51ba08edf7"
                            .to_string(),
                    ),
                    // Global Config ID
                    (
                        "global_config".to_string(),
                        "0x9774e359588ead122af1c7e7f64e14ade261cfeecdb5d0eb4a5b3b4c8ab8bd3e"
                            .to_string(),
                    ),
                    // Pools ID (Object containing all pools)
                    (
                        "pools_id".to_string(),
                        "0x50eb61dd5928cec5ea04711a2e9b72e5237e79e9fbcd2ce3d5469dc8708e0ee2"
                            .to_string(),
                    ),
                    // Cetus Config Package
                    (
                        "config_package".to_string(),
                        "0xf5ff7d5ba73b581bca6b4b9fa0049cd320360abd154b809f8700a8fd3cfaf7ca"
                            .to_string(),
                    ),
                    // Integrate Package (for swaps)
                    (
                        "integrate_package".to_string(),
                        "0x2918cf39850de6d5d94d8196dc878c8c722cd79db659318e00bff57fbb4e2ede"
                            .to_string(),
                    ),
                    // Global Vault ID
                    (
                        "global_vault".to_string(),
                        "0xf78d2ee3c312f298882cb680695e5e8c81b1d441a646caccc058006c2851ddea"
                            .to_string(),
                    ),
                ],
            }),

            // ===== MAINNET CONFIGS =====

            // Native Staking (Mainnet)
            (Protocol::NativeStaking, Network::Mainnet) => Some(Self {
                network,
                protocol,
                package_id: "0x3".to_string(),
                module: "sui_system".to_string(),
                config_objects: vec![
                    ("sui_system_state".to_string(), "0x5".to_string()),
                    ("clock".to_string(), "0x6".to_string()),
                ],
            }),

            // Scallop (Mainnet) - VERIFIED FROM GITHUB
            // Source: https://github.com/scallop-io/sui-lending-protocol
            // File: contracts/protocol/publish-result.mainnet.json
            // Version: 17 (UPGRADED - LATEST)
            (Protocol::Scallop, Network::Mainnet) => Some(Self {
                network,
                protocol,
                package_id: "0xd384ded6b9e7f4d2c4c9007b0291ef88fbfed8e709bce83d2da69de2d79d013d"
                    .to_string(),
                module: "mint".to_string(), // For deposit/mint sSUI
                config_objects: vec![
                    (
                        "market".to_string(),
                        "0xa757975255146dc9686aa823b7838b507f315d704f428cbadad2f4ea061939d9"
                            .to_string(),
                    ),
                    (
                        "version".to_string(),
                        "0x07871c4b3c847a0f674510d4978d5cf6f960452795e8ff6f189fd2088a3f6ac7"
                            .to_string(),
                    ),
                    (
                        "version_cap".to_string(),
                        "0x38527d154618d1fd5a644b90717fe07cf0e9f26b46b63e9568e611a3f86d5c1a"
                            .to_string(),
                    ),
                    (
                        "admin_cap".to_string(),
                        "0x09689d018e71c337d9db6d67cbca06b74ed92196103624028ccc3ecea411777c"
                            .to_string(),
                    ),
                ],
            }),

            // Navi (Mainnet) - VERIFIED
            // Source: On-chain verification
            (Protocol::Navi, Network::Mainnet) => Some(Self {
                network,
                protocol,
                package_id: "0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0"
                    .to_string(),
                module: "incentive_v3".to_string(),
                config_objects: vec![(
                    "storage".to_string(),
                    "0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe"
                        .to_string(),
                )],
            }),

            // DeepBook (Mainnet) - VERIFIED
            // Source: Sui native (0xdee9)
            (Protocol::DeepBook, Network::Mainnet) => Some(Self {
                network,
                protocol,
                package_id: "0x000000000000000000000000000000000000000000000000000000000000dee9"
                    .to_string(),
                module: "clob_v2".to_string(),
                config_objects: vec![],
            }),

            // Cetus (Mainnet) - VERIFIED FROM SDK & MVR
            // Source:
            // - SDK: https://github.com/CetusProtocol/cetus-clmm-sui-sdk/blob/main/src/config/mainnet.ts
            // - MVR: https://www.moveregistry.com/package/@cetuspackages/clmm (for latest)
            //
            // CETUS is modular with multiple packages:
            // 1. CLMM Pool Package  - Core pool operations, liquidity management
            // 2. Cetus Config       - Protocol configuration, pool registry
            // 3. Integrate Package  - Swap routing, multi-hop swaps
            (Protocol::Cetus, Network::Mainnet) => Some(Self {
                network,
                protocol,
                // CLMM Pool Package - Core pool operations
                package_id: "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb"
                    .to_string(),
                module: "pool".to_string(),
                config_objects: vec![
                    // Global Config ID - Protocol-wide settings
                    (
                        "global_config".to_string(),
                        "0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f"
                            .to_string(),
                    ),
                    // Pools ID - Object containing all pool data
                    (
                        "pools_id".to_string(),
                        "0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0"
                            .to_string(),
                    ),
                    // Global Vault - Protocol fee vault
                    (
                        "global_vault".to_string(),
                        "0xce7bceef26d3ad1f6d9b6f13a953f053e6ed3ca77907516481ce99ae8e588f2b"
                            .to_string(),
                    ),
                    // Cetus Config Package - Pool factory & registry
                    (
                        "config_package".to_string(),
                        "0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f"
                            .to_string(),
                    ),
                    // Integrate Package - Swap router
                    (
                        "integrate_package".to_string(),
                        "0x996c4d9480708fb8b92aa7acf819fb0497b5ec8e65ba06601cae2fb6db3312c3"
                            .to_string(),
                    ),
                    // Published_at for CLMM (version tracking)
                    (
                        "published_at".to_string(),
                        "0xc6faf3703b0e8ba9ed06b7851134bbbe7565eb35ff823fd78432baa4cbeaa12e"
                            .to_string(),
                    ),
                ],
            }),

            // Unsupported combinations
            _ => None,
        }
    }
}

/// Get all verified protocol configs for a network
pub fn get_network_configs(network: Network) -> Vec<ProtocolConfig> {
    network
        .supported_protocols()
        .into_iter()
        .filter_map(|p| ProtocolConfig::get(p, network))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_network_rpc() {
        assert_eq!(
            Network::Testnet.rpc_url(),
            "https://fullnode.testnet.sui.io:443"
        );
        assert_eq!(
            Network::Mainnet.rpc_url(),
            "https://fullnode.mainnet.sui.io:443"
        );
    }

    #[test]
    fn test_verified_mainnet_addresses() {
        // Scallop - GitHub official addresses (publish-result.mainnet.json)
        let scallop = ProtocolConfig::get(Protocol::Scallop, Network::Mainnet);
        assert!(scallop.is_some());
        let scallop = scallop.unwrap();
        assert_eq!(
            scallop.package_id,
            "0xd384ded6b9e7f4d2c4c9007b0291ef88fbfed8e709bce83d2da69de2d79d013d"
        );
        assert_eq!(scallop.config_objects.len(), 4); // market, version, version_cap, admin_cap

        // Navi
        let navi = ProtocolConfig::get(Protocol::Navi, Network::Mainnet);
        assert!(navi.is_some());
        let navi = navi.unwrap();
        assert_eq!(
            navi.package_id,
            "0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0"
        );

        // DeepBook
        let deepbook = ProtocolConfig::get(Protocol::DeepBook, Network::Mainnet);
        assert!(deepbook.is_some());

        // Cetus - now available
        let cetus = ProtocolConfig::get(Protocol::Cetus, Network::Mainnet);
        assert!(cetus.is_some());
        assert_eq!(
            cetus.unwrap().package_id,
            "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb"
        );
    }

    #[test]
    fn test_native_staking_both_networks() {
        let testnet = ProtocolConfig::get(Protocol::NativeStaking, Network::Testnet);
        let mainnet = ProtocolConfig::get(Protocol::NativeStaking, Network::Mainnet);

        assert!(testnet.is_some());
        assert!(mainnet.is_some());
        assert_eq!(testnet.unwrap().package_id, "0x3");
        assert_eq!(mainnet.unwrap().package_id, "0x3");
    }
}
