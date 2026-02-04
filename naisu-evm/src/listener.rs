//! Event listener for V4 Hook IntentCreated events

use alloy::{
    primitives::Address,
    providers::{Provider, ProviderBuilder, WsConnect},
    rpc::types::eth::Filter,
    sol_types::SolEvent,
};
use naisu_core::IntentCreatedEvent;
use std::str::FromStr;
use tokio::sync::mpsc;
use tracing::{info, warn, error};

use crate::{EvmConfig, hook::INaisuIntentHook};

/// Event listener for V4 Hook
pub struct HookEventListener {
    config: EvmConfig,
}

impl HookEventListener {
    pub fn new(config: EvmConfig) -> Self {
        Self { config }
    }

    /// Start listening for IntentCreated events
    /// Returns a channel receiver for incoming events
    pub async fn start(
        &self,
    ) -> Result<mpsc::Receiver<IntentCreatedEvent>, Box<dyn std::error::Error + Send + Sync>> {
        let (tx, rx) = mpsc::channel::<IntentCreatedEvent>(100);

        let rpc_url = self.config.rpc_url.clone();
        let hook_address = self.config.hook_address.clone();
        let poll_interval = self.config.poll_interval_secs;

        tokio::spawn(async move {
            if let Err(e) = run_listener(rpc_url, hook_address, poll_interval, tx).await {
                error!("Event listener error: {}", e);
            }
        });

        Ok(rx)
    }
}

async fn run_listener(
    rpc_url: String,
    hook_address: String,
    poll_interval: u64,
    tx: mpsc::Sender<IntentCreatedEvent>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Check if WebSocket URL
    let is_ws = rpc_url.starts_with("ws://") || rpc_url.starts_with("wss://");

    if is_ws {
        run_ws_listener(rpc_url, hook_address, tx).await
    } else {
        run_polling_listener(rpc_url, hook_address, poll_interval, tx).await
    }
}

async fn run_ws_listener(
    rpc_url: String,
    hook_address: String,
    tx: mpsc::Sender<IntentCreatedEvent>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("Starting WebSocket event listener on {}", hook_address);

    let ws = WsConnect::new(&rpc_url);
    let provider = ProviderBuilder::new().on_ws(ws).await?;
    let address = Address::from_str(&hook_address)?;

    // Create filter for IntentCreated events
    let filter = Filter::new()
        .address(address)
        .event_signature(INaisuIntentHook::IntentCreated::SIGNATURE_HASH);

    let mut stream = provider.subscribe_logs(&filter).await?.into_stream();

    info!("Subscribed to IntentCreated events");

    while let Some(log) = futures_util::StreamExt::next(&mut stream).await {
        match parse_intent_created_log(&log) {
            Ok(event) => {
                info!("Received IntentCreated event: {:?}", event.intent_id);
                if tx.send(event).await.is_err() {
                    warn!("Event channel closed, stopping listener");
                    break;
                }
            }
            Err(e) => {
                warn!("Failed to parse log: {}", e);
            }
        }
    }

    Ok(())
}

async fn run_polling_listener(
    rpc_url: String,
    hook_address: String,
    poll_interval: u64,
    tx: mpsc::Sender<IntentCreatedEvent>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("Starting polling event listener on {} (interval: {}s)", hook_address, poll_interval);

    let provider = ProviderBuilder::new().on_http(rpc_url.parse()?);
    let address = Address::from_str(&hook_address)?;

    let mut last_block = provider.get_block_number().await?;

    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(poll_interval)).await;

        let current_block = provider.get_block_number().await?;

        if current_block > last_block {
            let filter = Filter::new()
                .address(address)
                .event_signature(INaisuIntentHook::IntentCreated::SIGNATURE_HASH)
                .from_block(last_block + 1)
                .to_block(current_block);

            match provider.get_logs(&filter).await {
                Ok(logs) => {
                    for log in logs {
                        match parse_intent_created_log(&log) {
                            Ok(event) => {
                                info!("Received IntentCreated event: {:?}", event.intent_id);
                                if tx.send(event).await.is_err() {
                                    warn!("Event channel closed, stopping listener");
                                    return Ok(());
                                }
                            }
                            Err(e) => {
                                warn!("Failed to parse log: {}", e);
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!("Failed to get logs: {}", e);
                }
            }

            last_block = current_block;
        }
    }
}

fn parse_intent_created_log(
    log: &alloy::rpc::types::Log,
) -> Result<IntentCreatedEvent, Box<dyn std::error::Error + Send + Sync>> {
    // Decode the log using alloy
    let decoded = log.log_decode::<INaisuIntentHook::IntentCreated>()?;
    let event = decoded.inner.data;

    Ok(IntentCreatedEvent {
        intent_id: format!("0x{}", hex::encode(event.intentId.as_slice())),
        user: format!("{:?}", event.user),
        sui_destination: format!("0x{}", hex::encode(event.suiDestination.as_slice())),
        input_token: format!("{:?}", event.inputToken),
        input_amount: event.inputAmount.to_string(),
        usdc_amount: event.usdcAmount.to_string(),
        strategy_id: event.strategyId,
        timestamp: event.timestamp.try_into().unwrap_or(0),
    })
}

// Re-export futures_util for the stream
use futures_util;
