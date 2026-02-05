use axum::Router;
use std::sync::Arc;

use crate::{
    feature::{
        health::route::health_routes, network, solver::route::solver_routes,
        strategy::route::strategy_routes,
    },
    state::AppState,
};

/// Build all application routes
pub fn app_routes(state: AppState) -> Router {
    // Convert to Arc for network routes
    let state_arc = Arc::new(state.clone());

    let api_routes = Router::new()
        .nest("/health", health_routes())
        .nest("/network", network::routes().with_state(state_arc))
        .nest("/strategies", strategy_routes())
        .nest("/solvers", solver_routes());

    Router::new()
        .nest("/api/v1", api_routes)
        .fallback(common::handle_404)
        .with_state(state)
}

mod common {
    use axum::http::StatusCode;

    use crate::common::response::ApiErrorResponse;

    pub async fn handle_404() -> ApiErrorResponse {
        ApiErrorResponse::default()
            .with_code(StatusCode::NOT_FOUND)
            .with_message("The requested endpoint does not exist.")
    }
}
