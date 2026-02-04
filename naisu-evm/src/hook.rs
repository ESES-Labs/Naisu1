//! Uniswap V4 Hook contract bindings

use alloy::{
    primitives::{Address, U256},
    sol,
};

// Generate contract bindings from ABI
sol! {
    #[sol(rpc)]
    interface INaisuIntentHook {
        // Events
        event IntentCreated(
            bytes32 indexed intentId,
            address indexed user,
            bytes32 suiDestination,
            address inputToken,
            uint256 inputAmount,
            uint256 usdcAmount,
            uint8 strategyId,
            uint256 timestamp
        );

        event IntentBridgeInitiated(
            bytes32 indexed intentId,
            bytes32 lifiTransactionId
        );

        // View functions
        function getIntent(bytes32 intentId) external view returns (
            address user,
            bytes32 suiDestination,
            address inputToken,
            uint256 inputAmount,
            uint256 usdcAmount,
            uint8 strategyId,
            uint8 status,
            uint256 createdAt
        );

        function nextIntentId() external view returns (uint256);

        // Write functions (called by PoolManager via hook)
        // These are internal to the hook, triggered by afterSwap
    }
}

/// Intent data from contract
#[derive(Debug, Clone)]
pub struct HookIntent {
    pub intent_id: [u8; 32],
    pub user: Address,
    pub sui_destination: [u8; 32],
    pub input_token: Address,
    pub input_amount: U256,
    pub usdc_amount: U256,
    pub strategy_id: u8,
    pub status: u8,
    pub created_at: U256,
}

impl HookIntent {
    /// Convert intent_id to hex string
    pub fn id_hex(&self) -> String {
        format!("0x{}", hex::encode(self.intent_id))
    }

    /// Convert sui_destination to hex string
    pub fn sui_destination_hex(&self) -> String {
        format!("0x{}", hex::encode(self.sui_destination))
    }
}

/// Hook status enum matching contract
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum HookIntentStatus {
    Pending = 0,
    SwapCompleted = 1,
    Bridging = 2,
    Completed = 3,
    Failed = 4,
    Cancelled = 5,
}

impl From<u8> for HookIntentStatus {
    fn from(value: u8) -> Self {
        match value {
            0 => HookIntentStatus::Pending,
            1 => HookIntentStatus::SwapCompleted,
            2 => HookIntentStatus::Bridging,
            3 => HookIntentStatus::Completed,
            4 => HookIntentStatus::Failed,
            5 => HookIntentStatus::Cancelled,
            _ => HookIntentStatus::Pending,
        }
    }
}
