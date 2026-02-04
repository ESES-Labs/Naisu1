//! Naisu API Server
//!
//! Entry point for the HTTP API server.

use std::{net::SocketAddr, sync::Arc};

use axum::{
    http::{HeaderValue, Method, header},
    middleware,
};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

use naisu_api::{
    common::server::create_dual_stack_listener,
    config::Config,
    middleware::http_trace_middleware,
    route::app_routes,
    state::AppState,
};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Load environment
    dotenvy::dotenv().ok();

    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set subscriber");

    info!("🚀 Starting Naisu API...");

    // Load configuration
    let config = Arc::new(Config::from_env());
    info!(
        env = %config.rust_env,
        port = config.server.port,
        chain_id = config.evm.chain_id,
        "✅ Configuration loaded"
    );

    // Initialize application state
    let app_state = AppState::new();
    info!("✅ Application state initialized");

    // Setup CORS - handle wildcard separately
    let cors = if config.server.cors_allowed_origins.len() == 1 
        && config.server.cors_allowed_origins[0] == "*" {
        // Wildcard: allow any origin
        CorsLayer::new()
            .allow_origin(AllowOrigin::any())
            .allow_methods([Method::GET, Method::POST])
            .allow_headers([header::ACCEPT, header::CONTENT_TYPE])
    } else {
        // Specific origins: parse and use list
        let allowed_origins: Vec<_> = config
            .server
            .cors_allowed_origins
            .iter()
            .map(|origin| {
                origin
                    .parse::<HeaderValue>()
                    .expect("Invalid CORS origin in config")
            })
            .collect();
        
        CorsLayer::new()
            .allow_origin(allowed_origins)
            .allow_methods([Method::GET, Method::POST])
            .allow_headers([header::ACCEPT, header::CONTENT_TYPE])
    };

    // Build application router
    let app = app_routes(app_state.clone())
        .layer(middleware::from_fn(http_trace_middleware))
        .layer(cors)
        .into_make_service_with_connect_info::<SocketAddr>();

    // Create listener
    let listener = create_dual_stack_listener(config.server.port).await?;
    
    info!("🚀 Server ready! Listening on port {}", config.server.port);
    info!("📡 API available at http://localhost:{}/api/v1", config.server.port);

    // Run server
    axum::serve(listener, app).await
}
