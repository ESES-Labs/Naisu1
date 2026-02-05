//! Naisu Core - Core types and traits for cross-chain intent system
//!
//! This crate defines the fundamental types used across all Naisu components:
//! - Intent: User's cross-chain yield migration request
//! - Chain: Supported blockchain networks
//! - Strategy: Yield strategies on destination chain (Sui)

pub mod chain;
pub mod error;
pub mod intent;
pub mod strategy;

pub use chain::*;
pub use error::*;
pub use intent::*;
pub use strategy::*;
