use naisu_core::YieldStrategy;

use crate::common::response::{ApiResponse, ApiSuccessResponse};
use crate::feature::intent::dto::StrategyResponse;

/// List available yield strategies
pub async fn list_strategies() -> ApiResponse<Vec<StrategyResponse>> {
    let strategies = vec![
        StrategyResponse {
            id: 1,
            name: "Scallop USDC Lending".to_string(),
            protocol: "Scallop".to_string(),
            asset: "USDC".to_string(),
            enabled: true,
        },
        StrategyResponse {
            id: 2,
            name: "Scallop SUI Lending".to_string(),
            protocol: "Scallop".to_string(),
            asset: "SUI".to_string(),
            enabled: true,
        },
        StrategyResponse {
            id: 3,
            name: "Navi USDC Lending".to_string(),
            protocol: "Navi".to_string(),
            asset: "USDC".to_string(),
            enabled: true,
        },
        StrategyResponse {
            id: 4,
            name: "Navi SUI Lending".to_string(),
            protocol: "Navi".to_string(),
            asset: "SUI".to_string(),
            enabled: true,
        },
    ];

    Ok(ApiSuccessResponse::new(strategies))
}

/// Get strategy details by ID
pub async fn get_strategy(
    axum::extract::Path(id): axum::extract::Path<u8>,
) -> ApiResponse<StrategyResponse> {
    let strategy = YieldStrategy::from_id(id);
    
    Ok(ApiSuccessResponse::new(StrategyResponse::from(strategy)))
}
