//! Concrete solver implementations
//!
//! Each solver is a separate bot that competes to fulfill intents.

pub mod cetus_solver;
pub mod deepbook_solver;
pub mod navi_solver;
pub mod scallop_solver;
pub mod staking_solver;

pub use cetus_solver::CetusSolver;
pub use deepbook_solver::DeepBookSolver;
pub use navi_solver::NaviSolver;
pub use scallop_solver::ScallopSolver;
pub use staking_solver::StakingSolver;
