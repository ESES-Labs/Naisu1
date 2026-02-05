//! Naisu Sui - Sui blockchain integration
//!
//! This crate provides:
//! - Sui RPC client for transaction building
//! - PTB (Programmable Transaction Block) construction
//! - Scallop/Navi protocol integration
//! - Bridge fund detection
//! - Protocol adapters for yield optimization

pub mod adapters;
pub mod cctp;
pub mod client;
pub mod config;
pub mod protocols;
pub mod ptb;

pub use adapters::*;
pub use cctp::*;
pub use client::*;
pub use config::*;
pub use protocols::*;
pub use ptb::*;
