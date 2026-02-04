use axum::Router;

use crate::{
    feature::{
        ai::route::ai_routes,
        bridge::route::bridge_routes,
        chains::route::chain_routes,
        health::route::health_routes,
        intent::route::intent_routes,
        quotes::route::quote_routes,
        strategies::route::strategy_routes,
    },
    state::AppState,
};

/// Build all application routes
pub fn app_routes(state: AppState) -> Router {
    let api_routes = Router::new()
        .nest("/health", health_routes())
        .nest("/intents", intent_routes())
        .nest("/chains", chain_routes())
        .nest("/strategies", strategy_routes())
        .nest("/quotes", quote_routes())
        .nest("/ai", ai_routes())
        .nest("/bridge", bridge_routes());

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
