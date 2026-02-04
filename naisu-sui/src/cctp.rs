//! Circle CCTP integration for Sui
//!
//! Provides PTB construction for burning USDC on Sui via CCTP.
//! The user signs and submits the transaction; we just build it.

use serde::{Deserialize, Serialize};

// ─── CCTP Package IDs (Sui Testnet) ──────────────────────────────────────────
// Source: https://github.com/circlefin/sui-cctp (testnet branch Move.lock)

/// TokenMessengerMinter package on Sui Testnet
pub const TOKEN_MESSENGER_MINTER_PACKAGE: &str = 
    "0x31cc14d80c175ae39777c0238f20594c6d4869cfab199f40b69f3319956b8beb";

/// USDC coin type on Sui Testnet
pub const USDC_COIN_TYPE: &str = 
    "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

/// MessageTransmitter package on Sui Testnet  
pub const MESSAGE_TRANSMITTER_PACKAGE: &str =
    "0x4931e06dce648b3931f890035bd196920770e913e43e45990b383f6486fdd0a5";

/// CCTP State object ID (TokenMessengerMinter State)
/// Source: https://developers.circle.com/cctp/v1/sui-packages#testnet
pub const CCTP_STATE_OBJECT: &str =
    "0x98234bd0fa9ac12cc0a20a144a22e36d6a32f7e0a97baaeaf9c76cdc6d122d2e";

/// MessageTransmitter State object ID
pub const MESSAGE_TRANSMITTER_STATE: &str =
    "0x5252abd1137094ed1db3e0d75bc36abcd287aee4bc310f8e047727ef5682e7c2";

/// USDC Treasury object ID
pub const USDC_TREASURY: &str =
    "0x7170137d4a6431bf83351ac025baf462909bffe2877d87716374fb42b9629ebe";

// ─── CCTP Domain IDs ─────────────────────────────────────────────────────────

pub const CCTP_DOMAIN_BASE: u32 = 5;
pub const CCTP_DOMAIN_SUI: u32 = 10;

// ─── Types ───────────────────────────────────────────────────────────────────

/// Parameters for building a deposit_for_burn PTB
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepositForBurnRequest {
    /// Sender's Sui address
    pub sender: String,
    /// Amount of USDC to burn (in smallest unit, 6 decimals)
    pub amount: u64,
    /// Destination EVM address (will be padded to 32 bytes)
    pub evm_destination: String,
    /// Destination CCTP domain (e.g., 5 for Base)
    pub dest_domain: u32,
}

/// Response containing the PTB for the user to sign
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepositForBurnResponse {
    /// Base64-encoded transaction bytes
    pub tx_bytes: String,
    /// Expected nonce (may be estimated)
    pub expected_nonce: Option<String>,
    /// Human-readable summary
    pub summary: String,
}

/// Result after user submits the burn transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BurnResult {
    /// Transaction digest
    pub tx_digest: String,
    /// CCTP message nonce (extracted from events)
    pub nonce: String,
    /// Source domain
    pub source_domain: u32,
}

// ─── PTB Builder ─────────────────────────────────────────────────────────────

/// Build a Programmable Transaction Block for deposit_for_burn
/// 
/// This constructs the Move call to `token_messenger_minter::deposit_for_burn`
/// which burns USDC on Sui and initiates the CCTP transfer.
pub fn build_deposit_for_burn_ptb(
    request: &DepositForBurnRequest,
    usdc_coin_object_id: &str,
) -> Result<DepositForBurnResponse, CctpSuiError> {
    // The actual PTB construction requires the Sui SDK's TransactionBlock builder
    // For now, we return the parameters needed for the frontend to build it
    
    // Pad EVM address to 32 bytes (required by CCTP)
    let padded_dest = pad_evm_address(&request.evm_destination)?;
    
    let summary = format!(
        "Burn {} USDC on Sui → Mint on Base (domain {})",
        request.amount as f64 / 1_000_000.0,
        request.dest_domain
    );

    // In a real implementation, we would:
    // 1. Fetch the USDC coin object
    // 2. Build PTB with:
    //    - SplitCoins to get exact amount
    //    - MoveCall to token_messenger_minter::deposit_for_burn::deposit_for_burn
    // 3. Serialize to base64
    
    // For MVP, return placeholder - frontend will build the actual PTB
    Ok(DepositForBurnResponse {
        tx_bytes: "PLACEHOLDER_FRONTEND_BUILDS_PTB".to_string(),
        expected_nonce: None,
        summary,
    })
}

/// Extract CCTP nonce from Sui transaction events
pub fn extract_nonce_from_events(events: &[serde_json::Value]) -> Option<String> {
    // Look for DepositForBurn event and extract nonce
    for event in events {
        if let Some(event_type) = event.get("type").and_then(|t| t.as_str()) {
            if event_type.contains("DepositForBurn") {
                if let Some(parsed) = event.get("parsedJson") {
                    if let Some(nonce) = parsed.get("nonce") {
                        return nonce.as_str().map(|s| s.to_string())
                            .or_else(|| nonce.as_u64().map(|n| n.to_string()));
                    }
                }
            }
        }
    }
    None
}

/// Pad EVM address to 32 bytes (CCTP requirement)
fn pad_evm_address(addr: &str) -> Result<String, CctpSuiError> {
    let clean = addr.strip_prefix("0x").unwrap_or(addr);
    if clean.len() != 40 {
        return Err(CctpSuiError::InvalidAddress(addr.to_string()));
    }
    // Pad with 24 zeros on the left (12 bytes = 24 hex chars)
    Ok(format!("0x000000000000000000000000{}", clean))
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum CctpSuiError {
    #[error("Invalid EVM address: {0}")]
    InvalidAddress(String),
    
    #[error("Failed to build PTB: {0}")]
    PtbBuildError(String),
    
    #[error("Coin not found: {0}")]
    CoinNotFound(String),
    
    #[error("Insufficient balance")]
    InsufficientBalance,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pad_evm_address() {
        let addr = "0x1234567890123456789012345678901234567890";
        let padded = pad_evm_address(addr).unwrap();
        assert_eq!(padded, "0x0000000000000000000000001234567890123456789012345678901234567890");
        assert_eq!(padded.len(), 66); // 0x + 64 hex chars
    }
}
