//! Solver Daemon - Multi-Network Event Listener & Executor
//!
//! This daemon:
//! 1. Polls for YieldIntent shared objects on testnet/mainnet
//! 2. Evaluates intents with appropriate solvers for the network
//! 3. Executes winning PTB to fulfill intents
//!
//! Run: cargo run -p naisu-agent --bin solver-daemon -- --network testnet
//!
//! # Network Routes
//! - Testnet: StakingSolver, DeepBookSolver (when implemented)
//! - Mainnet: CetusSolver, ScallopSolver, NaviSolver, StakingSolver, DeepBookSolver

use naisu_agent::bots::{CetusSolver, DeepBookSolver, NaviSolver, ScallopSolver, StakingSolver};
use naisu_agent::config::Network;
use naisu_agent::solver::{select_winner, Bid, IntentRequest, Solver};
use std::collections::HashSet;
use std::time::Duration;
use tracing::{error, info, warn};

use dotenvy::dotenv;
use std::env;

/// Get intent package from environment variables based on network
fn get_intent_package(network: Network) -> String {
    dotenv().ok(); // Load .env file if present

    match network {
        Network::Testnet => {
            env::var("TESTNET_INTENT_PACKAGE").expect("TESTNET_INTENT_PACKAGE must be set in .env")
        }
        Network::Mainnet => {
            env::var("MAINNET_INTENT_PACKAGE").expect("MAINNET_INTENT_PACKAGE must be set in .env")
        }
    }
}

/// CLI Arguments
#[derive(Debug)]
struct Args {
    network: Network,
}

impl Args {
    fn parse() -> Self {
        let args: Vec<String> = std::env::args().collect();

        let network = args
            .iter()
            .position(|a| a == "--network" || a == "-n")
            .and_then(|i| args.get(i + 1))
            .and_then(|n| n.parse().ok())
            .unwrap_or(Network::Testnet);

        Self { network }
    }
}

/// Recent intent tracker (avoid duplicates)
struct SolverDaemon {
    network: Network,
    solvers: Vec<Box<dyn Solver + Send + Sync>>,
    processed_intents: HashSet<String>,
    sui_client: reqwest::Client,
}

impl SolverDaemon {
    fn new(network: Network) -> Self {
        // Create solvers based on network
        let solvers: Vec<Box<dyn Solver + Send + Sync>> = match network {
            Network::Testnet => {
                vec![
                    Box::new(StakingSolver::new()),
                    Box::new(DeepBookSolver::new()),
                ]
            }
            Network::Mainnet => {
                vec![
                    Box::new(StakingSolver::new()),
                    Box::new(ScallopSolver::new()),
                    Box::new(NaviSolver::new()),
                    Box::new(CetusSolver::new(Network::Mainnet)),
                    Box::new(DeepBookSolver::new()),
                ]
            }
        };

        Self {
            network,
            solvers,
            processed_intents: HashSet::new(),
            sui_client: reqwest::Client::new(),
        }
    }

    /// Get RPC URL for current network
    fn rpc_url(&self) -> &'static str {
        self.network.rpc_url()
    }

    /// Get intent package for current network
    fn intent_package(&self) -> String {
        get_intent_package(self.network)
    }

    /// Poll for YieldIntent objects (existing + new)
    async fn poll_intents(
        &mut self,
        _include_existing: bool,
    ) -> anyhow::Result<Vec<IntentRequest>> {
        // Query for YieldIntent shared objects
        let query = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "suix_queryEvents",
            "params": [{
                "MoveEventType": format!("{}::intent::IntentCreated", self.intent_package())
            }, null, 10]
        });

        let response = self
            .sui_client
            .post(self.rpc_url())
            .json(&query)
            .send()
            .await?;

        let result: serde_json::Value = response.json().await?;

        // Parse intents from events
        let mut intents = Vec::new();

        if let Some(data) = result.get("result") {
            if let Some(events) = data.get("data") {
                for event in events.as_array().unwrap_or(&vec![]) {
                    if let Some(intent) = self.parse_intent_event(event).await {
                        if !self.processed_intents.contains(&intent.id) {
                            intents.push(intent);
                        }
                    }
                }
            }
        }

        Ok(intents)
    }

    /// Parse IntentCreated event from suix_queryEvents format
    async fn parse_intent_event(&self, event: &serde_json::Value) -> Option<IntentRequest> {
        // Parse event data from parsedJson field
        let parsed = event.get("parsedJson")?;

        let id = parsed.get("intent_id")?.as_str()?.to_string();
        let user = parsed.get("user")?.as_str()?.to_string();

        // Parse amount (can be string or number)
        let amount_str = parsed.get("amount")?.as_str()?;
        let amount = amount_str.parse::<u64>().ok()?;

        // Parse min_apy
        let min_apy_str = parsed.get("min_apy")?.as_str()?;
        let min_apy = min_apy_str.parse::<u64>().ok()?;

        // Parse deadline
        let deadline_str = parsed.get("deadline")?.as_str()?;
        let deadline = deadline_str.parse::<u64>().ok()?;

        Some(IntentRequest {
            id,
            user,
            amount,
            min_apy,
            deadline,
        })
    }

    /// Evaluate and bid on an intent
    async fn evaluate_intent(&self, intent: &IntentRequest) -> Vec<Bid> {
        let mut bids = Vec::new();

        // Get bids from each solver
        for solver in &self.solvers {
            // Use solver-specific APY estimate
            let market_apy = 0.08; // 8% default

            if let Some(bid) = solver.evaluate(intent, market_apy).await {
                info!(
                    "📊 {} bid: {} bps ({}%)",
                    solver.name(),
                    bid.apy,
                    bid.apy as f64 / 100.0
                );
                bids.push(bid);
            }
        }

        bids
    }

    /// Execute winning fulfillment
    async fn execute_winning_bid(&self, intent: &IntentRequest, bids: Vec<Bid>) {
        if let Some(winner) = select_winner(bids, intent.min_apy) {
            info!("🏆 Winner: {} with {} bps", winner.solver_name, winner.apy);

            // Find the winning solver
            let solver = self.solvers.iter().find(|s| s.name() == winner.solver_name);

            match solver {
                Some(s) => match s.fulfill(intent).await {
                    Ok(tx_digest) => {
                        info!("✅ Intent fulfilled! TX: {}", tx_digest);
                        info!("   View: {}/tx/{}", self.network.explorer_url(), tx_digest);
                    }
                    Err(e) => {
                        error!("❌ Fulfillment failed: {}", e);
                    }
                },
                None => {
                    warn!("Winning solver not found: {}", winner.solver_name);
                }
            }
        } else {
            info!("ℹ️ No winning bid for intent {}", intent.id);
        }
    }

    /// Main loop
    async fn run(&mut self) -> anyhow::Result<()> {
        info!("🤖 Solver Daemon starting...");
        info!("   Network: {:?}", self.network);
        info!("   Intent Package: {}", self.intent_package());
        info!("   RPC: {}", self.rpc_url());
        info!("   Solvers: {}", self.solvers.len());

        for solver in &self.solvers {
            info!("     - {}", solver.name());
        }

        loop {
            info!("\n📡 Polling for new intents...");

            match self.poll_intents(false).await {
                Ok(intents) => {
                    if intents.is_empty() {
                        info!("   No new intents");
                    } else {
                        info!("   Found {} new intent(s)", intents.len());

                        for intent in intents {
                            info!("\n🎯 Processing Intent: {}", intent.id);
                            info!("   User: {}", intent.user);
                            info!(
                                "   Amount: {} MIST ({} SUI)",
                                intent.amount,
                                intent.amount / 1_000_000_000
                            );
                            info!("   Min APY: {} bps", intent.min_apy);

                            // Mark as processed
                            self.processed_intents.insert(intent.id.clone());

                            // Get bids
                            let bids = self.evaluate_intent(&intent).await;

                            if bids.is_empty() {
                                info!("   No bids placed");
                                continue;
                            }

                            // Execute winning bid
                            self.execute_winning_bid(&intent, bids).await;
                        }
                    }
                }
                Err(e) => {
                    error!("❌ Failed to poll intents: {}", e);
                }
            }

            // Wait before next poll
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Parse arguments
    let args = Args::parse();

    // Setup tracing
    tracing_subscriber::fmt().with_env_filter("info").init();

    info!("Starting Naisu Solver Daemon");
    info!("Network: {:?}", args.network);

    // Create and run daemon
    let mut daemon = SolverDaemon::new(args.network);

    // Handle Ctrl+C
    let shutdown = tokio::spawn(async move {
        tokio::signal::ctrl_c().await.ok();
        info!("\n👋 Shutting down solver daemon...");
    });

    // Run daemon
    tokio::select! {
        result = daemon.run() => result,
        _ = shutdown => Ok(()),
    }
}
