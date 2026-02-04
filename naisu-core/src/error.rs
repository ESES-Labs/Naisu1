//! Error types for Naisu

use thiserror::Error;

/// Core error type
#[derive(Error, Debug)]
pub enum NaisuError {
    #[error("EVM error: {0}")]
    Evm(String),

    #[error("Bridge error: {0}")]
    Bridge(String),

    #[error("Sui error: {0}")]
    Sui(String),

    #[error("Intent not found: {0}")]
    IntentNotFound(String),

    #[error("Invalid intent state: expected {expected}, got {actual}")]
    InvalidState { expected: String, actual: String },

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("API error: {0}")]
    Api(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl NaisuError {
    pub fn evm(msg: impl Into<String>) -> Self {
        Self::Evm(msg.into())
    }

    pub fn bridge(msg: impl Into<String>) -> Self {
        Self::Bridge(msg.into())
    }

    pub fn sui(msg: impl Into<String>) -> Self {
        Self::Sui(msg.into())
    }
}
