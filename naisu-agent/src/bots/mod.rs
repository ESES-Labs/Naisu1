//! Concrete solver implementations
//!
//! Each solver is a separate bot that competes to fulfill intents.

pub mod navi_solver;
pub mod scallop_solver;

pub use navi_solver::NaviSolver;
pub use scallop_solver::ScallopSolver;
