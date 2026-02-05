//! Naisu Solver Bots
//!
//! Competitive solvers for the Naisu intent marketplace.
//! Multiple solvers race to fulfill yield intents, optimizing for user outcomes.
//!
//! # Architecture
//! ```text
//! Intent Discovery (Shared Objects)
//!         ↓
//! Solver A (Scallop) → Bid: 8.2%
//! Solver B (Navi)    → Bid: 8.0%
//!         ↓
//! Winner fills via PTB
//! ```

pub mod bots;
pub mod solver;

pub use solver::{Bid, Solver, SolverConfig};
