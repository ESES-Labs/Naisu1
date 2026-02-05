//! Intent Handlers
//!
//! API endpoints for querying intents (cached/indexed)

use axum::{extract::Query, Json};
use serde::{Deserialize, Serialize};

use crate::common::response::{success::ApiSuccessResponse, ApiResponse};

/// Intent response
#[derive(Serialize)]
pub struct IntentResponse {
    pub intent_id: String,
    pub user: String,
    pub amount: String,
    pub min_apy: u64,
    pub deadline: u64,
    pub status: String,
    pub target_protocol: String,
    pub created_at: u64,
    pub tx_digest: String,
}

/// Query parameters for listing intents
#[derive(Deserialize)]
pub struct ListIntentsQuery {
    pub status: Option<String>, // "open", "fulfilled", "expired"
    pub limit: Option<usize>,
}

/// List intents (cached from blockchain)
pub async fn list_intents(
    Query(params): Query<ListIntentsQuery>,
) -> ApiResponse<Json<ApiSuccessResponse<Vec<IntentResponse>>>> {
    // In production: query from database (cached)
    // For now: mock data showing structure
    
    let mut intents = vec![
        IntentResponse {
            intent_id: "0x56241772c0fc5bf95d2e18ed2e8129f1a2ae4b592b21b3a66e67d09b851d20b6".to_string(),
            user: "0xf800cb70f9f90d4f9858efbfe3ecdf0c1540d36c185807532892a98883e9c7fa".to_string(),
            amount: "1000000000".to_string(),
            min_apy: 720,
            deadline: 1770326616245,
            status: "open".to_string(),
            target_protocol: "any".to_string(),
            created_at: 1770287442164,
            tx_digest: "BpJnnnSRkjUNqFR27rHexcCEf9Dr6uwhiUi2UCkAPhzj".to_string(),
        },
        IntentResponse {
            intent_id: "0x6053a19f8240c8c6134e1955f443ee9fa207aa57f18258711b83a6611bbee01c".to_string(),
            user: "0xf800cb70f9f90d4f9858efbfe3ecdf0c1540d36c185807532892a98883e9c7fa".to_string(),
            amount: "1000".to_string(),
            min_apy: 720,
            deadline: 1770326616245,
            status: "fulfilled".to_string(),
            target_protocol: "scallop".to_string(),
            created_at: 1770287538404,
            tx_digest: "t6uFYkEcB1DFjNmodqRGVC2rUhuFc4cX5YaqdJwEA94".to_string(),
        },
    ];
    
    // Filter by status if provided
    if let Some(status) = params.status {
        intents.retain(|i| i.status == status);
    }
    
    // Apply limit
    let limit = params.limit.unwrap_or(20);
    intents.truncate(limit);
    
    Ok(ApiSuccessResponse::new(intents))
}

/// Get single intent by ID
pub async fn get_intent(
    axum::extract::Path(intent_id): axum::extract::Path<String>,
) -> ApiResponse<Json<ApiSuccessResponse<IntentResponse>>> {
    // Mock: in production query from DB
    let intent = IntentResponse {
        intent_id: intent_id.clone(),
        user: "0xf800cb70f9f90d4f9858efbfe3ecdf0c1540d36c185807532892a98883e9c7fa".to_string(),
        amount: "1000000000".to_string(),
        min_apy: 720,
        deadline: 1770326616245,
        status: "open".to_string(),
        target_protocol: "any".to_string(),
        created_at: 1770287442164,
        tx_digest: "BpJnnnSRkjUNqFR27rHexcCEf9Dr6uwhiUi2UCkAPhzj".to_string(),
    };
    
    Ok(ApiSuccessResponse::new(intent))
}

/// Intent stats
#[derive(Serialize)]
pub struct IntentStats {
    pub total_intents: u64,
    pub open_intents: u64,
    pub fulfilled_intents: u64,
    pub total_volume_sui: String,
    pub avg_apy: f64,
}

pub async fn get_stats() -> ApiResponse<Json<ApiSuccessResponse<IntentStats>>> {
    let stats = IntentStats {
        total_intents: 15,
        open_intents: 3,
        fulfilled_intents: 12,
        total_volume_sui: "45.5".to_string(),
        avg_apy: 8.25,
    };
    
    Ok(ApiSuccessResponse::new(stats))
}

/// Solver bids for an intent
#[derive(Serialize)]
pub struct BidResponse {
    pub solver: String,
    pub protocol: String,
    pub apy: u64,
    pub timestamp: u64,
}

pub async fn get_intent_bids(
    axum::extract::Path(_intent_id): axum::extract::Path<String>,
) -> ApiResponse<Json<ApiSuccessResponse<Vec<BidResponse>>>> {
    // Mock bids
    let bids = vec![
        BidResponse {
            solver: "ScallopSolver".to_string(),
            protocol: "Scallop".to_string(),
            apy: 830,
            timestamp: 1770287450000,
        },
        BidResponse {
            solver: "NaviSolver".to_string(),
            protocol: "Navi".to_string(),
            apy: 785,
            timestamp: 1770287451000,
        },
    ];
    
    Ok(ApiSuccessResponse::new(bids))
}
