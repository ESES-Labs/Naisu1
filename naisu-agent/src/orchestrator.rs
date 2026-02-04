//! Intent orchestrator - coordinates bidirectional cross-chain flows
//!
//! Non-custodial: builds transactions for the user to sign.
//! Agent monitors bridge status and coordinates multi-step flows.

use naisu_core::{Intent, IntentCreatedEvent, IntentStatus, YieldStrategy};
use naisu_bridge::{CctpClient, CctpError, CCTP_DOMAIN_SUI, CCTP_DOMAIN_BASE};
use naisu_sui::{SuiClient, SuiClientError};
use tracing::info;

use crate::config::AgentConfig;

/// Orchestrates cross-chain intent execution.
pub struct IntentOrchestrator {
    config: AgentConfig,
    cctp: CctpClient,
    sui: SuiClient,
}

impl IntentOrchestrator {
    pub fn new(config: AgentConfig, sui: SuiClient) -> Self {
        let cctp = if config.evm.chain.is_testnet() {
            CctpClient::testnet()
        } else {
            CctpClient::mainnet()
        };
        Self { config, cctp, sui }
    }

    // ─── EVM → Sui ──────────────────────────────────────────────────────────
    //
    // Triggered by IntentCreated event from V4 Hook.
    //
    // Steps:
    //   1. Hook emits IntentCreated after V4 swap → USDC in user wallet
    //   2. Agent builds depositForBurn params → frontend signs
    //   3. Agent polls Circle attestation API
    //   4. Wormhole auto-relayer calls receiveMessage → USDC minted on Sui
    //   5. Agent builds deposit PTB → frontend signs
    //   6. Done
    // ─────────────────────────────────────────────────────────────────────────

    /// Process an EVM→Sui intent triggered by a V4 Hook event.
    pub async fn process_evm_to_sui(&self, event: IntentCreatedEvent) -> Result<Intent, OrchestratorError> {
        info!("EVM→Sui: intent={}", event.intent_id);

        let strategy = YieldStrategy::from_id(event.strategy_id);

        let mut intent = Intent::new_evm_to_sui(
            event.intent_id,
            event.user,
            event.sui_destination,
            self.config.evm.chain,
            event.input_token,
            event.input_amount,
            strategy,
        );
        intent.usdc_amount = Some(event.usdc_amount.clone());
        intent.set_status(IntentStatus::SwapCompleted);
        info!("EVM→Sui: swap completed, usdc_amount={}", event.usdc_amount);

        // Build depositForBurn params (returned to frontend via API)
        let usdc_amount: u64 = event.usdc_amount
            .parse()
            .map_err(|_| OrchestratorError::InvalidAmount(event.usdc_amount))?;

        let _deposit_params = self.cctp.build_deposit_for_burn_params(
            usdc_amount,
            CCTP_DOMAIN_SUI,
            &intent.dest_address,
        );
        info!("EVM→Sui: depositForBurn params ready (amount={}, dest_domain={})",
            usdc_amount, CCTP_DOMAIN_SUI);

        // After frontend signs depositForBurn, agent receives nonce via callback.
        // For MVP demo: simulate with mock nonce.
        let mock_nonce = format!("mock_nonce_{}", intent.id);
        intent.bridge_nonce = Some(mock_nonce.clone());
        intent.set_status(IntentStatus::Bridging);

        // Poll attestation (real flow — uncomment when nonce is real):
        //
        // let attestation = self.cctp
        //     .poll_attestation(&mock_nonce, 60, 5)
        //     .await
        //     .map_err(OrchestratorError::Cctp)?;
        // info!("EVM→Sui: attestation received");
        //
        // let _receive_params = self.cctp.build_receive_message_params(
        //     &attestation,
        //     naisu_bridge::DestChain::Sui,
        // );

        intent.set_status(IntentStatus::BridgeCompleted);
        info!("EVM→Sui: bridge completed (simulated)");

        // Build Sui deposit PTB (via naisu_sui::protocols::ProtocolFactory)
        // Frontend signs and submits the PTB.
        // For MVP: mark as deposited directly.
        intent.set_status(IntentStatus::Deposited);
        intent.set_status(IntentStatus::Completed);
        info!("EVM→Sui: intent {} completed", intent.id);

        Ok(intent)
    }

    // ─── Sui → EVM ──────────────────────────────────────────────────────────
    //
    // Triggered by POST /api/v1/intents with direction=sui_to_evm.
    //
    // Steps:
    //   1. Intent created via API (Pending)
    //   2. If in yield: agent builds withdraw PTB → frontend signs
    //   3. Agent builds depositForBurn params on Sui → frontend signs
    //   4. Agent polls Circle attestation API
    //   5. Wormhole auto-relayer calls receiveMessage on EVM
    //   6. USDC arrives at user's EVM wallet → Done
    // ─────────────────────────────────────────────────────────────────────────

    /// Process a Sui→EVM intent (created via API).
    pub async fn process_sui_to_evm(&self, intent: &mut Intent) -> Result<(), OrchestratorError> {
        info!("Sui→EVM: intent={}", intent.id);

        let usdc_amount: u64 = intent.usdc_amount
            .as_ref()
            .and_then(|a| a.parse().ok())
            .unwrap_or(0);

        if usdc_amount == 0 {
            return Err(OrchestratorError::InvalidAmount("0".to_string()));
        }

        // Build depositForBurn params for Sui USDC (destination = Base)
        let _deposit_params = self.cctp.build_deposit_for_burn_params(
            usdc_amount,
            CCTP_DOMAIN_BASE,
            &intent.dest_address,
        );
        info!("Sui→EVM: depositForBurn params ready (amount={}, dest_domain={})",
            usdc_amount, CCTP_DOMAIN_BASE);

        // Frontend signs depositForBurn on Sui.
        // For MVP: simulate.
        let mock_nonce = format!("mock_nonce_{}", intent.id);
        intent.bridge_nonce = Some(mock_nonce.clone());
        intent.set_status(IntentStatus::Bridging);

        // Poll attestation (real flow):
        // let attestation = self.cctp
        //     .poll_attestation(&mock_nonce, 60, 5)
        //     .await
        //     .map_err(OrchestratorError::Cctp)?;
        //
        // let _receive_params = self.cctp.build_receive_message_params(
        //     &attestation,
        //     naisu_bridge::DestChain::BaseSepolia,
        // );

        intent.set_status(IntentStatus::BridgeCompleted);
        info!("Sui→EVM: bridge completed, USDC arriving on Base");

        // ─── EVM Swap Logic (Solver) ───
        // In a real implementation:
        // 1. Wait for USDC to arrive in Agent's wallet (or User's, if self-bridging).
        // 2. Execute UniV3/V4 swap (USDC -> TargetToken).
        // 3. Send TargetToken to final destination.
        
        info!("Sui→EVM: Executing EVM Swap (Solver Step)...");
        // Simulated delay/action
        info!("Sui→EVM: Swapping USDC -> WETH on Base Sepolia (Simulated)");
        
        intent.set_status(IntentStatus::Completed);
        info!("Sui→EVM: intent {} completed. Assets delivered to user.", intent.id);

        Ok(())
    }
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum OrchestratorError {
    #[error("CCTP error: {0}")]
    Cctp(#[from] CctpError),

    #[error("Sui error: {0}")]
    Sui(#[from] SuiClientError),

    #[error("Invalid amount: {0}")]
    InvalidAmount(String),

    #[error("Bridge failed: {0}")]
    BridgeFailed(String),

    #[error("Timeout waiting for bridge")]
    Timeout,
}
