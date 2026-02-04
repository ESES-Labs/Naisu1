use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use naisu_core::{Direction, Intent};
use tracing::{error, info};
use uuid::Uuid;

use crate::{
    common::response::{ApiErrorResponse, ApiResponse, ApiSuccessResponse},
    feature::intent::dto::{
        CreateIntentPayload, IntentListResponse, IntentResponse, IntentStatusResponse,
    },
    state::AppState,
};

/// List all intents
pub async fn list_intents(
    State(state): State<AppState>,
) -> ApiResponse<IntentListResponse> {
    let intents = state.list_intents().await;
    let intent_list: Vec<IntentResponse> = intents.iter().map(IntentResponse::from).collect();
    let total = intent_list.len();

    Ok(ApiSuccessResponse::new(IntentListResponse { intents: intent_list, total }))
}

/// Get a single intent by ID
pub async fn get_intent(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<IntentResponse>, ApiErrorResponse> {
    match state.get_intent(&id).await {
        Some(intent) => Ok(Json(IntentResponse::from(&intent))),
        None => Err(ApiErrorResponse::new("Intent not found")
            .with_code(StatusCode::NOT_FOUND)),
    }
}

/// Get intent status
pub async fn get_intent_status(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<IntentStatusResponse>, ApiErrorResponse> {
    match state.get_intent(&id).await {
        Some(intent) => Ok(Json(IntentStatusResponse::from(&intent))),
        None => Err(ApiErrorResponse::new("Intent not found")
            .with_code(StatusCode::NOT_FOUND)),
    }
}

/// Create a new intent (supports both directions)
pub async fn create_intent(
    State(state): State<AppState>,
    Json(request): Json<CreateIntentPayload>,
) -> Result<Json<IntentResponse>, ApiErrorResponse> {
    let id = Uuid::new_v4().to_string();

    info!("Creating intent: id={}, direction={:?}", id, request.direction);

    let mut intent = match request.direction {
        Direction::EvmToSui => {
            let strategy = request.strategy.ok_or_else(|| {
                ApiErrorResponse::new("strategy is required for EvmToSui")
                    .with_code(StatusCode::BAD_REQUEST)
            })?;
            Intent::new_evm_to_sui(
                id.clone(),
                request.source_address,
                request.dest_address,
                request.evm_chain,
                request.input_token,
                request.input_amount,
                strategy,
            )
        }
        Direction::SuiToEvm => Intent::new_sui_to_evm(
            id.clone(),
            request.source_address,
            request.dest_address,
            request.evm_chain,
            request.input_token,
            request.input_amount,
        ),
    };

    // Store initial intent
    state.upsert_intent(intent.clone()).await;
    info!("Intent {} stored with status {:?}", id, intent.status);

    // Trigger Orchestrator for Sui -> EVM
    if matches!(request.direction, Direction::SuiToEvm) {
        let orchestrator = state.orchestrator.clone();
        let intent_id = intent.id.clone();
        let mut processing_intent = intent.clone();

        // Process immediately for MVP
        match orchestrator.process_sui_to_evm(&mut processing_intent).await {
            Ok(_) => {
                state.upsert_intent(processing_intent).await;
                info!("Sui->EVM intent {} processed successfully", intent_id);
                // Get updated intent for response
                if let Some(updated) = state.get_intent(&id).await {
                    intent = updated;
                }
            }
            Err(e) => {
                error!("Failed to process Sui->EVM intent {}: {}", intent_id, e);
                // Don't fail the request, just log the error
            }
        }
    }

    let response = IntentResponse::from(&intent);
    Ok(Json(response))
}

/// List intents by creator address
pub async fn list_user_intents(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> ApiResponse<IntentListResponse> {
    let intents = state.list_intents_by_creator(&address).await;
    let intent_list: Vec<IntentResponse> = intents.iter().map(IntentResponse::from).collect();
    let total = intent_list.len();

    Ok(ApiSuccessResponse::new(IntentListResponse { intents: intent_list, total }))
}
