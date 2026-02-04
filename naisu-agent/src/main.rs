//! Naisu Agent - Cross-chain intent orchestrator
//!
//! Listens for IntentCreated events from V4 Hook (EVM→Sui)
//! and coordinates Sui→EVM intents from the API.

use naisu_evm::HookEventListener;
use naisu_sui::SuiClient;
use tracing::{info, error, Level};
use tracing_subscriber::FmtSubscriber;

use naisu_agent::{AgentConfig, IntentOrchestrator};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    dotenvy::dotenv().ok();

    let _subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_target(true)
        .init();

    info!("Starting Naisu Agent...");

    let config = AgentConfig::from_env()?;
    info!("Loaded config: chain_id={}", config.evm.chain.chain_id());

    let sui_client = SuiClient::new(config.sui.clone());
    let orchestrator = IntentOrchestrator::new(config.clone(), sui_client);

    // Start EVM event listener (EvmToSui intents)
    let evm_listener = HookEventListener::new(config.evm.clone());
    let mut event_rx = evm_listener.start().await?;
    info!("Listening for IntentCreated events...");

    // Process Hook events
    while let Some(event) = event_rx.recv().await {
        info!("Received IntentCreated: {}", event.intent_id);

        match orchestrator.process_evm_to_sui(event).await {
            Ok(intent) => info!("Intent {} → {}", intent.id, intent.status.as_str()),
            Err(e) => error!("Failed to process intent: {}", e),
        }
    }

    Ok(())
}
