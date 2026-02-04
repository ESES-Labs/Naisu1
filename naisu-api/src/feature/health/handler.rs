use crate::common::response::{ApiResponse, ApiSuccessResponse};

/// Public health check endpoint
pub async fn public_health_check() -> ApiResponse<()> {
    Ok(ApiSuccessResponse::new(())
        .with_message("Service is healthy"))
}

/// Detailed health check with version info
#[derive(Debug, serde::Serialize)]
pub struct HealthDetails {
    pub status: String,
    pub version: String,
    pub service: String,
}

pub async fn detailed_health_check() -> ApiResponse<HealthDetails> {
    let health = HealthDetails {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        service: "naisu-api".to_string(),
    };
    
    Ok(ApiSuccessResponse::new(health))
}
