use axum::Json;
use serde::{Deserialize, Serialize};
use tracing::info;

use crate::common::response::{ApiErrorResponse, ApiResponse, ApiSuccessResponse};

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub reply: String,
    pub intent: Option<IntentParams>,
}

#[derive(Debug, Serialize)]
pub struct IntentParams {
    pub action: String,
    pub dest_chain: String,
    pub protocol: String,
    pub sui_dest: String,
    pub strategy_id: u8,
}

/// AI Chat endpoint
/// Currently mock implementation - can be extended with real LLM integration
pub async fn chat(
    Json(payload): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, ApiErrorResponse> {
    info!("AI Chat request: {}", payload.message);

    // Simple mock logic based on keywords
    let (reply, intent) = if payload.message.to_lowercase().contains("yield") 
        || payload.message.to_lowercase().contains("apy")
        || payload.message.to_lowercase().contains("earn") {
        (
            "I've analyzed the current yield opportunities on Sui. Scallop Protocol offers 8.5% APY on USDC with $12M TVL. Would you like me to prepare a cross-chain intent to bridge and deposit?".to_string(),
            Some(IntentParams {
                action: "bridge_and_supply".to_string(),
                dest_chain: "sui".to_string(),
                protocol: "scallop".to_string(),
                sui_dest: "0x1234567890abcdef".to_string(),
                strategy_id: 1,
            })
        )
    } else if payload.message.to_lowercase().contains("bridge") {
        (
            "I can help you bridge assets between EVM and Sui via Wormhole CCTP. Which direction would you like to go?".to_string(),
            None
        )
    } else if payload.message.to_lowercase().contains("swap") {
        (
            "For swapping on EVM, I can route through Uniswap V4. If you want to swap and bridge to Sui, that's a cross-chain intent. Which would you prefer?".to_string(),
            None
        )
    } else {
        (
            "Hello! I'm Naisu AI Agent. I can help you:\n\n• Find best yield opportunities on Sui\n• Create cross-chain intents (EVM ↔ Sui)\n• Bridge assets via CCTP\n• Get swap quotes\n\nWhat would you like to do?".to_string(),
            None
        )
    };

    Ok(Json(ChatResponse { reply, intent }))
}

/// Health check for AI service
pub async fn ai_health_check() -> ApiResponse<()> {
    // In real implementation, check LLM service availability
    Ok(ApiSuccessResponse::new(())
        .with_message("AI service is available"))
}
