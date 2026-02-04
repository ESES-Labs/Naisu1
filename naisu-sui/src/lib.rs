//! Naisu Sui - Sui blockchain integration
//!
//! This crate provides:
//! - Sui RPC client for transaction building
//! - PTB (Programmable Transaction Block) construction
//! - Scallop/Navi protocol integration
//! - Bridge fund detection

pub mod client;
pub mod ptb;
pub mod protocols;
pub mod config;
pub mod cctp;

pub use client::*;
pub use ptb::*;
pub use protocols::*;
pub use config::*;
pub use cctp::*;
