use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};

use crate::common::response::{ApiErrorResponse, ApiResponse, ApiSuccessResponse};
use crate::state::{AppState, SolverBidEntry};

/// Response DTO for solver bids (matches frontend expectations)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SolverBidResponse {
    pub solver_id: String,
    pub solver_name: String,
    pub protocol: String,
    pub apy: u64, // basis points
    pub timestamp: u64,
    pub confidence: f64,
}

impl From<SolverBidEntry> for SolverBidResponse {
    fn from(entry: SolverBidEntry) -> Self {
        // Infer solver_id from solver_name (e.g., "ScallopSolver" -> "scallop")
        let solver_id = if entry.solver_name.to_lowercase().contains("scallop") {
            "scallop".to_string()
        } else if entry.solver_name.to_lowercase().contains("navi") {
            "navi".to_string()
        } else {
            entry.protocol.clone()
        };

        Self {
            solver_id,
            solver_name: entry.solver_name,
            protocol: entry.protocol,
            apy: entry.offered_apy,
            timestamp: entry.timestamp,
            confidence: 0.95, // Default high confidence
        }
    }
}

/// POST /solvers/bids — persist a solver bid
pub async fn post_bid(
    State(state): State<AppState>,
    Json(bid): Json<SolverBidEntry>,
) -> ApiResponse<SolverBidEntry> {
    if bid.intent_id.is_empty() {
        return Err(
            ApiErrorResponse::new("intent_id is required").with_code(StatusCode::BAD_REQUEST)
        );
    }
    if bid.solver_name.is_empty() {
        return Err(
            ApiErrorResponse::new("solver_name is required").with_code(StatusCode::BAD_REQUEST)
        );
    }

    tracing::info!(
        intent_id = %bid.intent_id,
        solver = %bid.solver_name,
        apy_bps = bid.offered_apy,
        "New solver bid received"
    );

    let stored = bid.clone();
    state.add_bid(bid).await;

    Ok(ApiSuccessResponse::new(stored)
        .with_code(StatusCode::CREATED)
        .with_message("Bid stored"))
}

/// GET /solvers/bids/:intent_id — retrieve all bids for an intent
pub async fn get_bids(
    State(state): State<AppState>,
    Path(intent_id): Path<String>,
) -> ApiResponse<Vec<SolverBidResponse>> {
    let bids = state.get_bids_for_intent(&intent_id).await;

    // Convert to response DTOs
    let response_bids: Vec<SolverBidResponse> =
        bids.into_iter().map(SolverBidResponse::from).collect();

    Ok(ApiSuccessResponse::new(response_bids))
}
