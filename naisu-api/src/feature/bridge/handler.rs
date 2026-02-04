use axum::Json;
use axum::extract::State;
use serde::Deserialize;

use crate::common::response::{ApiErrorResponse, ApiResponse, ApiSuccessResponse};
use crate::feature::intent::dto::{
    AttestationRequest, AttestationResponse, BridgeStatusResponse, SuiToEvmBridgeRequest,
};
use crate::state::AppState;

/// Get bridge status for an intent
pub async fn bridge_status(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<BridgeStatusResponse>, ApiErrorResponse> {
    let intent_id = params.get("intent_id").cloned().unwrap_or_default();
    
    let intent = state.get_intent(&intent_id).await
        .ok_or_else(|| ApiErrorResponse::new("Intent not found")
            .with_code(axum::http::StatusCode::NOT_FOUND))?;

    let status = BridgeStatusResponse {
        intent_id: intent.id.clone(),
        status: intent.status.as_str().to_string(),
        source_chain: match intent.direction {
            naisu_core::Direction::EvmToSui => format!("{:?}", intent.evm_chain),
            naisu_core::Direction::SuiToEvm => "sui".to_string(),
        },
        dest_chain: match intent.direction {
            naisu_core::Direction::EvmToSui => "sui".to_string(),
            naisu_core::Direction::SuiToEvm => format!("{:?}", intent.evm_chain),
        },
        amount: intent.usdc_amount.clone().unwrap_or_else(|| "0".to_string()),
        nonce: intent.bridge_nonce.clone(),
    };

    Ok(Json(status))
}

/// Initiate Sui to EVM bridge
/// Returns tx_params for the frontend to build the PTB
pub async fn init_sui_to_evm_bridge(
    State(_state): State<AppState>,
    Json(request): Json<SuiToEvmBridgeRequest>,
) -> ApiResponse<serde_json::Value> {
    // Parse amount (USDC has 6 decimals)
    let amount_f: f64 = request.amount.parse().unwrap_or(0.0);
    let amount_raw = (amount_f * 1_000_000.0) as u64;
    
    // Pad EVM address to 32 bytes (Sui Move address format)
    let evm_addr = request.evm_destination.trim_start_matches("0x");
    let padded_mint_recipient = format!("0x000000000000000000000000{}", evm_addr);
    
    // Base Sepolia domain
    let dest_domain: u32 = 6; // CCTP domain for Base
    
    let response = serde_json::json!({
        "tx_params": {
            "target": "0x31cc14d80c175ae39777c0238f20594c6d4869cfab199f40b69f3319956b8beb::deposit_for_burn::deposit_for_burn",
            "amount_raw": amount_raw,
            "dest_domain": dest_domain,
            "mint_recipient": padded_mint_recipient,
        },
        "summary": format!("Bridge {} USDC from Sui to Base Sepolia", request.amount),
    });

    Ok(ApiSuccessResponse::new(response)
        .with_message("Bridge parameters calculated"))
}

/// Poll attestation status
pub async fn poll_attestation(
    Json(request): Json<AttestationRequest>,
) -> ApiResponse<AttestationResponse> {
    // Mock implementation - in real app would poll Circle API
    let response = AttestationResponse {
        nonce: request.nonce.clone(),
        attestation: Some("0xmockattestation".to_string()),
        status: "complete".to_string(),
        message: "Attestation available".to_string(),
    };

    Ok(ApiSuccessResponse::new(response))
}

/// Request body for bridge initiation
#[derive(Debug, Deserialize)]
pub struct BridgeInitRequest {
    pub intent_id: String,
    pub source_chain: String,
    pub dest_chain: String,
    pub amount: String,
    pub token: String,
}

/// Get bridge fee estimate
pub async fn get_bridge_fee(
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> ApiResponse<serde_json::Value> {
    let amount = params.get("amount").cloned().unwrap_or_else(|| "0".to_string());
    let amount_f: f64 = amount.parse().unwrap_or(0.0);
    
    // Mock fee calculation
    let fee = amount_f * 0.001; // 0.1%
    let gas_fee = 0.5; // Fixed gas fee in USDC

    let response = serde_json::json!({
        "bridge_fee": fee.to_string(),
        "gas_fee": gas_fee.to_string(),
        "total_fee": (fee + gas_fee).to_string(),
        "token": "USDC",
    });

    Ok(ApiSuccessResponse::new(response))
}
