//! EVM configuration

use naisu_core::EvmChain;

/// EVM chain configuration
#[derive(Debug, Clone)]
pub struct EvmConfig {
    pub chain: EvmChain,
    pub rpc_url: String,
    pub hook_address: String,
    pub private_key: Option<String>,
    pub poll_interval_secs: u64,
}

impl EvmConfig {
    pub fn new(
        chain: EvmChain,
        rpc_url: String,
        hook_address: String,
    ) -> Self {
        Self {
            chain,
            rpc_url,
            hook_address,
            private_key: None,
            poll_interval_secs: 5,
        }
    }

    pub fn with_private_key(mut self, key: String) -> Self {
        self.private_key = Some(key);
        self
    }

    pub fn with_poll_interval(mut self, secs: u64) -> Self {
        self.poll_interval_secs = secs;
        self
    }
}
