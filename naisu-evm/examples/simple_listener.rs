use naisu_evm::{EvmConfig, HookEventListener};
use std::error::Error;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

use naisu_core::EvmChain;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error + Send + Sync>> {
    // Setup logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    info!("Starting Naisu EVM Listener Example...");

    // Configuration for local Anvil node
    let config = EvmConfig {
        chain: EvmChain::Base, // Using Base for Base Sepolia
        rpc_url: "https://sepolia.base.org".to_string(), 
        hook_address: "0xf0093fcf07aa10de35b78d1f33c60439d11bc0c0".to_string(),
        private_key: None,
        poll_interval_secs: 2,
    };

    let listener = HookEventListener::new(config);
    let mut rx = listener.start().await?;

    info!("Listening for IntentCreated events...");

    while let Some(event) = rx.recv().await {
        info!("----------------------------------------");
        info!("Intent Captured!");
        info!("ID: {}", event.intent_id);
        info!("User: {}", event.user);
        info!("Sui Dest: {}", event.sui_destination);
        info!("Input Token: {}", event.input_token);
        info!("Input Amount: {}", event.input_amount);
        info!("USDC Amount: {}", event.usdc_amount);
        info!("Strategy ID: {}", event.strategy_id);
        info!("----------------------------------------");
    }

    Ok(())
}
