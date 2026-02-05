use axum::{extract::Request, middleware::Next, response::Response};
use std::time::Instant;
use tracing::{info, warn};

/// HTTP request tracing middleware
/// Logs request method, path, duration, and status code
pub async fn http_trace_middleware(request: Request, next: Next) -> Response {
    let start = Instant::now();
    let method = request.method().to_string();
    let path = request.uri().path().to_string();
    let request_id = uuid::Uuid::new_v4().to_string();

    tracing::Span::current().record("request_id", request_id.as_str());

    info!(
        request_id = %request_id,
        method = %method,
        path = %path,
        "→ Request started"
    );

    let response = next.run(request).await;
    let duration = start.elapsed();
    let status = response.status();

    if status.is_success() || status.is_informational() {
        info!(
            request_id = %request_id,
            method = %method,
            path = %path,
            status = %status.as_u16(),
            duration_ms = %duration.as_millis(),
            "← Request completed"
        );
    } else if status.is_client_error() {
        warn!(
            request_id = %request_id,
            method = %method,
            path = %path,
            status = %status.as_u16(),
            duration_ms = %duration.as_millis(),
            "← Client error"
        );
    } else {
        warn!(
            request_id = %request_id,
            method = %method,
            path = %path,
            status = %status.as_u16(),
            duration_ms = %duration.as_millis(),
            "← Server error"
        );
    }

    response
}
