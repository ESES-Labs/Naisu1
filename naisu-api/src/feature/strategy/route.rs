use axum::routing::get;
use axum::Router;

use crate::state::AppState;

use super::handler;

pub fn strategy_routes() -> Router<AppState> {
    Router::new().route("/", get(handler::get_strategies))
}
