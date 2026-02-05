//! Intent types - bidirectional cross-chain yield migration

use crate::chain::EvmChain;
use crate::strategy::YieldStrategy;
use serde::{Deserialize, Serialize};

/// Direction of the cross-chain intent
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    /// EVM → Sui: swap to USDC on EVM, bridge via CCTP, deposit to yield on Sui
    EvmToSui,
    /// Sui → EVM: withdraw from yield on Sui, bridge via CCTP, USDC arrives on EVM
    SuiToEvm,
}

/// Intent status throughout its lifecycle
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntentStatus {
    /// Created, waiting for initial action
    Pending,
    /// V4 swap done (EvmToSui) or withdraw done (SuiToEvm)
    SwapCompleted,
    /// CCTP depositForBurn executed, polling attestation
    Bridging,
    /// Funds arrived on destination chain
    BridgeCompleted,
    /// Deposited into yield protocol (EvmToSui only)
    Deposited,
    /// Fully executed
    Completed,
    /// Failed at some stage
    Failed,
    /// Cancelled by user
    Cancelled,
}

impl IntentStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            IntentStatus::Pending => "pending",
            IntentStatus::SwapCompleted => "swap_completed",
            IntentStatus::Bridging => "bridging",
            IntentStatus::BridgeCompleted => "bridge_completed",
            IntentStatus::Deposited => "deposited",
            IntentStatus::Completed => "completed",
            IntentStatus::Failed => "failed",
            IntentStatus::Cancelled => "cancelled",
        }
    }
}

/// Cross-chain intent (bidirectional)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Intent {
    pub id: String,
    /// Direction of the intent
    pub direction: Direction,
    /// Source wallet address
    pub source_address: String,
    /// Destination wallet address
    pub dest_address: String,
    /// EVM chain involved (source for EvmToSui, dest for SuiToEvm)
    pub evm_chain: EvmChain,
    /// Input token address on source chain
    pub input_token: String,
    /// Input amount (raw, with decimals)
    pub input_amount: String,
    /// USDC amount (the bridge token)
    pub usdc_amount: Option<String>,
    /// Target yield strategy (Some for EvmToSui, None for SuiToEvm)
    pub strategy: Option<YieldStrategy>,
    /// Current status
    pub status: IntentStatus,
    /// Source swap tx hash (V4 swap for EvmToSui)
    pub swap_tx_hash: Option<String>,
    /// CCTP depositForBurn tx hash
    pub bridge_tx_hash: Option<String>,
    /// CCTP nonce for attestation polling
    pub bridge_nonce: Option<String>,
    /// Destination tx hash (deposit PTB or receiveMessage)
    pub dest_tx_hash: Option<String>,
    /// Error message if failed
    pub error_message: Option<String>,
    /// Created timestamp (unix)
    pub created_at: i64,
    /// Last updated timestamp (unix)
    pub updated_at: i64,
}

impl Intent {
    /// Create a new EVM→Sui intent
    pub fn new_evm_to_sui(
        id: String,
        evm_address: String,
        sui_address: String,
        evm_chain: EvmChain,
        input_token: String,
        input_amount: String,
        strategy: YieldStrategy,
    ) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id,
            direction: Direction::EvmToSui,
            source_address: evm_address,
            dest_address: sui_address,
            evm_chain,
            input_token,
            input_amount,
            usdc_amount: None,
            strategy: Some(strategy),
            status: IntentStatus::Pending,
            swap_tx_hash: None,
            bridge_tx_hash: None,
            bridge_nonce: None,
            dest_tx_hash: None,
            error_message: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Create a new Sui→EVM intent
    pub fn new_sui_to_evm(
        id: String,
        sui_address: String,
        evm_address: String,
        evm_chain: EvmChain,
        input_token: String,
        input_amount: String,
    ) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id,
            direction: Direction::SuiToEvm,
            source_address: sui_address,
            dest_address: evm_address,
            evm_chain,
            input_token,
            input_amount: input_amount.clone(),
            usdc_amount: Some(input_amount),
            strategy: None,
            status: IntentStatus::Pending,
            swap_tx_hash: None,
            bridge_tx_hash: None,
            bridge_nonce: None,
            dest_tx_hash: None,
            error_message: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Update status with timestamp
    pub fn set_status(&mut self, status: IntentStatus) {
        self.status = status;
        self.updated_at = chrono::Utc::now().timestamp();
    }

    /// Mark as failed with error message
    pub fn fail(&mut self, message: String) {
        self.status = IntentStatus::Failed;
        self.error_message = Some(message);
        self.updated_at = chrono::Utc::now().timestamp();
    }
}

/// Intent creation request from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateIntentRequest {
    pub direction: Direction,
    pub source_address: String,
    pub dest_address: String,
    pub evm_chain: EvmChain,
    pub input_token: String,
    pub input_amount: String,
    /// Required for EvmToSui, ignored for SuiToEvm
    pub strategy: Option<YieldStrategy>,
}

/// Intent event emitted by V4 Hook (EVM side, EvmToSui trigger)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentCreatedEvent {
    pub intent_id: String,
    pub user: String,
    pub sui_destination: String,
    pub input_token: String,
    pub input_amount: String,
    pub usdc_amount: String,
    pub strategy_id: u8,
    pub timestamp: u64,
}
