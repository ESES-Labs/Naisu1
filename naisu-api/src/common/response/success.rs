use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

/// Standard success response wrapper
#[derive(Debug, Clone, Serialize)]
pub struct ApiSuccessResponse<T> {
    pub success: bool,
    pub code: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub data: T,
}

impl<T: Serialize> ApiSuccessResponse<T> {
    pub fn new(data: T) -> Self {
        Self {
            success: true,
            code: 200,
            message: None,
            data,
        }
    }

    pub fn with_code(mut self, code: StatusCode) -> Self {
        self.code = code.as_u16();
        self
    }

    pub fn with_message(mut self, message: impl Into<String>) -> Self {
        self.message = Some(message.into());
        self
    }

    pub fn with_data(mut self, data: T) -> Self {
        self.data = data;
        self
    }
}

impl<T: Serialize> Default for ApiSuccessResponse<T>
where
    T: Default,
{
    fn default() -> Self {
        Self {
            success: true,
            code: 200,
            message: None,
            data: T::default(),
        }
    }
}

impl<T: Serialize> IntoResponse for ApiSuccessResponse<T> {
    fn into_response(self) -> Response {
        let status = StatusCode::from_u16(self.code).unwrap_or(StatusCode::OK);
        (status, Json(self)).into_response()
    }
}
