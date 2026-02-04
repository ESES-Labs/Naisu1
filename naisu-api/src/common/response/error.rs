use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use std::fmt;

/// Standard error response
#[derive(Debug, Clone, Serialize)]
pub struct ApiErrorResponse {
    pub success: bool,
    pub code: u16,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl ApiErrorResponse {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            success: false,
            code: 500,
            message: message.into(),
            error: None,
        }
    }

    pub fn with_code(mut self, code: StatusCode) -> Self {
        self.code = code.as_u16();
        self
    }

    pub fn with_message(mut self, message: impl Into<String>) -> Self {
        self.message = message.into();
        self
    }

    pub fn with_error(mut self, error: impl Into<String>) -> Self {
        self.error = Some(error.into());
        self
    }
}

impl Default for ApiErrorResponse {
    fn default() -> Self {
        Self {
            success: false,
            code: 500,
            message: "Internal server error".to_string(),
            error: None,
        }
    }
}

impl fmt::Display for ApiErrorResponse {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "API Error {}: {}", self.code, self.message)
    }
}

impl std::error::Error for ApiErrorResponse {}

impl IntoResponse for ApiErrorResponse {
    fn into_response(self) -> Response {
        let status = StatusCode::from_u16(self.code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        (status, Json(self)).into_response()
    }
}

/// Helper trait for converting errors to ApiErrorResponse
pub trait IntoApiError {
    fn into_api_error(self) -> ApiErrorResponse;
}

impl IntoApiError for String {
    fn into_api_error(self) -> ApiErrorResponse {
        ApiErrorResponse::new(self)
    }
}

impl IntoApiError for &str {
    fn into_api_error(self) -> ApiErrorResponse {
        ApiErrorResponse::new(self)
    }
}
