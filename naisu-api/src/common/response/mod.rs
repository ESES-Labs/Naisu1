use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};

pub mod error;
pub mod success;

pub use error::ApiErrorResponse;
pub use success::ApiSuccessResponse;

/// Generic API response type
pub type ApiResponse<T> = Result<ApiSuccessResponse<T>, ApiErrorResponse>;

/// Standard API response wrapper (for backwards compatibility)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseWrapper<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<u16>,
}

impl<T: Serialize> ApiResponseWrapper<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: None,
            code: None,
        }
    }

    pub fn error(message: impl Into<String>, code: u16) -> Self {
        Self {
            success: false,
            data: None,
            message: Some(message.into()),
            code: Some(code),
        }
    }
}

impl<T: Serialize> IntoResponse for ApiResponseWrapper<T> {
    fn into_response(self) -> Response {
        let status = if self.success {
            StatusCode::OK
        } else {
            match self.code {
                Some(400) => StatusCode::BAD_REQUEST,
                Some(401) => StatusCode::UNAUTHORIZED,
                Some(404) => StatusCode::NOT_FOUND,
                Some(500) => StatusCode::INTERNAL_SERVER_ERROR,
                _ => StatusCode::OK,
            }
        };
        (status, Json(self)).into_response()
    }
}
