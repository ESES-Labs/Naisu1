use axum::routing::{Router, get};

use crate::state::AppState;

use super::handler;

pub fn quote_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(handler::get_quote))
}
