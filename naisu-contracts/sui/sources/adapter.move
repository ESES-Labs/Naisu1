/// Naisu Protocol Adapter Interface
///
/// Standard interface for integrating yield protocols (Scallop, Navi, etc.)
module naisu::adapter {
    use std::string::{Self, String};
    use std::vector;

    // ============ Protocol Info ============

    /// Information about a supported protocol
    public struct ProtocolInfo has copy, drop, store {
        name: String,
        version: String,
        supported_assets: vector<String>,
    }

    /// Get protocol info for Scallop
    public fun scallop_info(): ProtocolInfo {
        ProtocolInfo {
            name: string::utf8(b"Scallop"),
            version: string::utf8(b"1.0"),
            supported_assets: vector::singleton(string::utf8(b"USDC")),
        }
    }

    /// Get protocol info for Navi
    public fun navi_info(): ProtocolInfo {
        ProtocolInfo {
            name: string::utf8(b"Navi"),
            version: string::utf8(b"1.0"),
            supported_assets: vector::singleton(string::utf8(b"USDC")),
        }
    }

    /// Verify protocol is supported
    public fun is_supported_protocol(name: &String): bool {
        let scallop = string::utf8(b"scallop");
        let navi = string::utf8(b"navi");
        let any = string::utf8(b"any");
        
        name == &scallop || name == &navi || name == &any
    }

    /// Normalize protocol name (lowercase)
    public fun normalize_protocol_name(name: String): String {
        // For now, return as-is
        // TODO: Implement lowercase conversion
        name
    }

    /// Get protocol APY (mock for MVP)
    /// Returns APY in basis points (e.g., 850 = 8.5%)
    public fun get_protocol_apy(name: &String): u64 {
        let scallop = string::utf8(b"scallop");
        let navi = string::utf8(b"navi");
        
        if (name == &scallop) {
            850 // 8.5%
        } else if (name == &navi) {
            800 // 8.0%
        } else {
            0
        }
    }
}
