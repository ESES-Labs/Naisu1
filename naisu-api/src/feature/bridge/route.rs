use axum::routing::{Router, get, post};

use crate::state::AppState;

use super::handler;

pub fn bridge_routes() -> Router<AppState> {
    Router::new()
        .route("/status", get(handler::bridge_status))
        .route("/sui-to-evm", post(handler::init_sui_to_evm_bridge))
        .route("/poll-attestation", post(handler::poll_attestation))
        .route("/fee", get(handler::get_bridge_fee))
}
