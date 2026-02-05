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
//!
//! # Network Support
//! - Testnet: Native Staking, DeepBook
//! - Mainnet: Cetus, Scallop, Navi, Native Staking, DeepBook

pub mod bots;
pub mod config;
pub mod executor;
pub mod solver;
pub mod solver_factory;

pub use config::{Network, Protocol, ProtocolConfig};
pub use executor::{SuiCoin, SuiExecutor, TransactionResult};
pub use solver::{Bid, Solver, SolverConfig};
pub use solver_factory::{MultiNetworkSolver, SolverFactory};
