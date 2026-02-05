//! Naisu Solver Bot Runner
//!
//! Run multiple solver bots that compete to fulfill yield intents.

use naisu_agent::bots::{NaviSolver, ScallopSolver};
use naisu_agent::solver::Solver;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    info!("🤖 Starting Naisu Solver Bots...");

    // Initialize solvers
    let scallop = ScallopSolver::new();
    let navi = NaviSolver::new();

    info!("✅ Loaded solvers:");
    info!("   - {}", scallop.name());
    info!("   - {}", navi.name());

    // TODO: Start solver event loops
    // 1. Poll for new YieldIntent shared objects
    // 2. Evaluate and bid
    // 3. Race to fulfill

    info!("⏳ Solver bots ready (implementation in progress)");

    // Keep alive
    tokio::signal::ctrl_c().await?;
    info!("👋 Shutting down solver bots");

    Ok(())
}
