use serde::Deserialize;

use crate::common::response::{ApiResponse, ApiSuccessResponse};
use crate::feature::intent::dto::QuoteResponse;

#[derive(Debug, Deserialize)]
pub struct QuoteQuery {
    pub input_token: String,
    pub output_token: String,
    pub amount: String,
    pub chain_id: Option<u64>,
}

/// Get quote for swap/bridge
/// Currently mock implementation - can be integrated with 0x API or similar
pub async fn get_quote(
    axum::extract::Query(query): axum::extract::Query<QuoteQuery>,
) -> ApiResponse<QuoteResponse> {
    // Parse amount
    let amount_f: f64 = query.amount.parse().unwrap_or(0.0);
    
    // Mock exchange rate calculation
    let rate = if query.input_token.to_lowercase().contains("eth") 
        && query.output_token.to_lowercase().contains("usdc") {
        3000.0
    } else if query.input_token.to_lowercase().contains("usdc")
        && query.output_token.to_lowercase().contains("eth") {
        1.0 / 3000.0
    } else {
        1.0
    };

    let output_amount = amount_f * rate;
    let fee = amount_f * 0.003; // 0.3% fee

    let quote = QuoteResponse {
        input_token: query.input_token,
        output_token: query.output_token,
        input_amount: query.amount,
        output_amount: output_amount.to_string(),
        exchange_rate: rate,
        fee: Some(fee.to_string()),
    };

    Ok(ApiSuccessResponse::new(quote))
}
