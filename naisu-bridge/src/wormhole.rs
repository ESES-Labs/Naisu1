//! Circle CCTP (Cross-Chain Transfer Protocol) client for USDC bridging
//!
//! Supports bidirectional USDC transfer between EVM chains and Sui
//! using Circle's native burn-and-mint mechanism.
//!
//! Flow:
//!   1. Source chain: depositForBurn() → burns USDC, emits MessageSent
//!   2. Circle Attestation Service signs the message
//!   3. Destination chain: receiveMessage(message, attestation) → mints USDC

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::info;

// ─── CCTP Domain IDs ─────────────────────────────────────────────────────────

pub const CCTP_DOMAIN_ETHEREUM: u32 = 0;
pub const CCTP_DOMAIN_AVALANCHE: u32 = 1;
pub const CCTP_DOMAIN_OPTIMISM: u32 = 2;
pub const CCTP_DOMAIN_ARBITRUM: u32 = 3;
pub const CCTP_DOMAIN_BASE: u32 = 5;
pub const CCTP_DOMAIN_SUI: u32 = 10;

// ─── CCTP Contract Addresses (Testnet) ───────────────────────────────────────

/// USDC on Base Sepolia
pub const USDC_BASE_SEPOLIA: &str = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
/// TokenMessenger on Base Sepolia (call depositForBurn here)
pub const TOKEN_MESSENGER_BASE_SEPOLIA: &str = "0x9a4427fd4196d315517ed71ddd16BD053cC9c4a4";
/// MessageTransmitter on Base Sepolia (call receiveMessage here)
pub const MESSAGE_TRANSMITTER_BASE_SEPOLIA: &str = "0x241661E680D1F25deb4cE5230b2D7165B3ba580e";

// ─── Circle Attestation API ─────────────────────────────────────────────────

const ATTESTATION_TESTNET_URL: &str = "https://iris-api-sandbox.circle.com/v1";
const ATTESTATION_MAINNET_URL: &str = "https://attestation.circle.com/v1";

// ─── Client ──────────────────────────────────────────────────────────────────

/// Circle CCTP client.
///
/// Non-custodial: builds transaction parameters for the frontend to sign.
/// Agent only monitors attestation status.
pub struct CctpClient {
    client: Client,
    attestation_url: String,
    testnet: bool,
}

impl CctpClient {
    pub fn testnet() -> Self {
        Self {
            client: Client::new(),
            attestation_url: ATTESTATION_TESTNET_URL.to_string(),
            testnet: true,
        }
    }

    pub fn mainnet() -> Self {
        Self {
            client: Client::new(),
            attestation_url: ATTESTATION_MAINNET_URL.to_string(),
            testnet: false,
        }
    }

    /// Build depositForBurn parameters.
    /// Frontend uses these to construct + sign the transaction on the source chain.
    ///
    /// - `amount`: USDC amount in smallest unit (6 decimals)
    /// - `dest_domain`: CCTP domain ID of destination (e.g. CCTP_DOMAIN_SUI)
    /// - `dest_address`: recipient address on destination chain
    pub fn build_deposit_for_burn_params(
        &self,
        amount: u64,
        dest_domain: u32,
        dest_address: &str,
    ) -> DepositForBurnParams {
        let token_messenger = if self.testnet {
            TOKEN_MESSENGER_BASE_SEPOLIA
        } else {
            TOKEN_MESSENGER_BASE_SEPOLIA // TODO: swap to mainnet when available
        };

        DepositForBurnParams {
            token_messenger: token_messenger.to_string(),
            usdc_address: USDC_BASE_SEPOLIA.to_string(),
            amount,
            destination_domain: dest_domain,
            destination_address: dest_address.to_string(),
        }
    }

    /// Check Circle attestation API for a given source tx nonce.
    /// Returns None if attestation is not yet ready.
    pub async fn get_attestation(&self, nonce: &str) -> Result<Option<CctpAttestation>, CctpError> {
        let url = format!("{}/attestations/{}", self.attestation_url, nonce);

        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| CctpError::Request(e.to_string()))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response.text().await.unwrap_or_default();
            return Err(CctpError::Api {
                status,
                message: body,
            });
        }

        let resp: AttestationApiResponse = response
            .json()
            .await
            .map_err(|e| CctpError::Parse(e.to_string()))?;

        match resp.data {
            Some(data) if data.status == "complete" => Ok(Some(CctpAttestation {
                message: data.message,
                attestation_signature: data.attestation_signature,
            })),
            _ => Ok(None),
        }
    }

    /// Poll attestation until ready or timeout.
    /// `max_attempts` × `interval_secs` = total max wait time.
    pub async fn poll_attestation(
        &self,
        nonce: &str,
        max_attempts: u32,
        interval_secs: u64,
    ) -> Result<CctpAttestation, CctpError> {
        info!("Polling CCTP attestation for nonce: {}", nonce);

        for attempt in 0..max_attempts {
            if let Some(attestation) = self.get_attestation(nonce).await? {
                info!("Attestation ready after {} attempts", attempt + 1);
                return Ok(attestation);
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(interval_secs)).await;
        }

        Err(CctpError::AttestationTimeout)
    }

    /// Build receiveMessage parameters for the destination chain.
    /// This call is permissionless — Wormhole auto-relayer or anyone can submit it.
    pub fn build_receive_message_params(
        &self,
        attestation: &CctpAttestation,
        dest: DestChain,
    ) -> ReceiveMessageParams {
        let message_transmitter = match dest {
            DestChain::BaseSepolia => MESSAGE_TRANSMITTER_BASE_SEPOLIA.to_string(),
            DestChain::Sui => String::new(), // Sui side uses Move call, not EVM
        };

        ReceiveMessageParams {
            message_transmitter,
            message: attestation.message.clone(),
            attestation_signature: attestation.attestation_signature.clone(),
        }
    }
}

// ─── Types ───────────────────────────────────────────────────────────────────

/// Destination chain enum for receiveMessage routing
#[derive(Debug, Clone, Copy)]
pub enum DestChain {
    BaseSepolia,
    Sui,
}

/// Parameters for depositForBurn — passed to frontend for signing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepositForBurnParams {
    /// TokenMessenger contract to call
    pub token_messenger: String,
    /// USDC contract to approve
    pub usdc_address: String,
    /// Amount in smallest unit (6 decimals for USDC)
    pub amount: u64,
    /// CCTP domain ID of destination chain
    pub destination_domain: u32,
    /// Destination address (hex string)
    pub destination_address: String,
}

/// Completed attestation from Circle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CctpAttestation {
    /// Encoded CCTP message
    pub message: String,
    /// Circle's attestation signature
    pub attestation_signature: String,
}

/// Parameters for receiveMessage — passed to relayer or auto-submitted
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiveMessageParams {
    /// MessageTransmitter contract on destination
    pub message_transmitter: String,
    /// Encoded message from attestation
    pub message: String,
    /// Attestation signature from Circle
    pub attestation_signature: String,
}

// ─── Internal API Response Types ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct AttestationApiResponse {
    data: Option<AttestationData>,
}

#[derive(Debug, Deserialize)]
struct AttestationData {
    message: String,
    attestation_signature: String,
    status: String,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum CctpError {
    #[error("HTTP request failed: {0}")]
    Request(String),

    #[error("Circle API error ({status}): {message}")]
    Api { status: u16, message: String },

    #[error("Failed to parse response: {0}")]
    Parse(String),

    #[error("Attestation polling timed out")]
    AttestationTimeout,
}
