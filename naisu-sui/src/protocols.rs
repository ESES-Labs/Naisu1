//! Sui DeFi protocol integrations (Scallop, Navi)

use naisu_core::YieldStrategy;
use crate::ptb::{PtbBuilder, PtbArgument};

/// Scallop protocol integration
pub struct ScallopProtocol {
    pub package_id: String,
    pub market_id: String,
}

impl ScallopProtocol {
    pub fn new(package_id: String, market_id: String) -> Self {
        Self { package_id, market_id }
    }

    /// Build PTB commands for depositing USDC into Scallop
    pub fn build_deposit_usdc(
        &self,
        ptb: &mut PtbBuilder,
        usdc_coin: PtbArgument,
        market: PtbArgument,
    ) -> PtbArgument {
        // Call scallop::lending::deposit<USDC>
        ptb.move_call(
            &self.package_id,
            "lending",
            "deposit",
            vec![
                // USDC type argument
                "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN".to_string(),
            ],
            vec![market, usdc_coin],
        )
    }

    /// Build PTB commands for withdrawing from Scallop
    pub fn build_withdraw_usdc(
        &self,
        ptb: &mut PtbBuilder,
        amount: PtbArgument,
        market: PtbArgument,
    ) -> PtbArgument {
        ptb.move_call(
            &self.package_id,
            "lending",
            "withdraw",
            vec![
                "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN".to_string(),
            ],
            vec![market, amount],
        )
    }
}

/// Navi protocol integration
pub struct NaviProtocol {
    pub package_id: String,
    pub pool_id: String,
}

impl NaviProtocol {
    pub fn new(package_id: String, pool_id: String) -> Self {
        Self { package_id, pool_id }
    }

    /// Build PTB commands for depositing USDC into Navi
    pub fn build_deposit_usdc(
        &self,
        ptb: &mut PtbBuilder,
        usdc_coin: PtbArgument,
        pool: PtbArgument,
    ) -> PtbArgument {
        ptb.move_call(
            &self.package_id,
            "pool",
            "deposit",
            vec![
                "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN".to_string(),
            ],
            vec![pool, usdc_coin],
        )
    }

    /// Build PTB commands for withdrawing from Navi
    pub fn build_withdraw_usdc(
        &self,
        ptb: &mut PtbBuilder,
        amount: PtbArgument,
        pool: PtbArgument,
    ) -> PtbArgument {
        ptb.move_call(
            &self.package_id,
            "pool",
            "withdraw",
            vec![
                "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN".to_string(),
            ],
            vec![pool, amount],
        )
    }
}

/// Protocol factory for creating protocol instances based on strategy
pub struct ProtocolFactory;

impl ProtocolFactory {
    /// Create a deposit PTB for the given strategy
    pub fn build_deposit_ptb(
        strategy: YieldStrategy,
        usdc_coin: PtbArgument,
        protocol_config: &ProtocolConfig,
    ) -> Result<PtbBuilder, ProtocolError> {
        let mut ptb = PtbBuilder::new();

        match strategy {
            YieldStrategy::ScallopUsdc => {
                let scallop = ScallopProtocol::new(
                    protocol_config.scallop_package.clone().ok_or(ProtocolError::NotConfigured("Scallop"))?,
                    protocol_config.scallop_market.clone().ok_or(ProtocolError::NotConfigured("Scallop market"))?,
                );
                let market = ptb.add_shared_object(
                    &protocol_config.scallop_market.clone().unwrap(),
                    1, // initial version
                    true,
                );
                scallop.build_deposit_usdc(&mut ptb, usdc_coin, market);
            }
            YieldStrategy::NaviUsdc => {
                let navi = NaviProtocol::new(
                    protocol_config.navi_package.clone().ok_or(ProtocolError::NotConfigured("Navi"))?,
                    protocol_config.navi_pool.clone().ok_or(ProtocolError::NotConfigured("Navi pool"))?,
                );
                let pool = ptb.add_shared_object(
                    &protocol_config.navi_pool.clone().unwrap(),
                    1,
                    true,
                );
                navi.build_deposit_usdc(&mut ptb, usdc_coin, pool);
            }
            YieldStrategy::ScallopSui | YieldStrategy::NaviSui => {
                // For SUI strategies, need to swap USDC -> SUI first
                // This would involve DeepBook integration
                return Err(ProtocolError::NotImplemented("SUI deposit strategies require swap"));
            }
            YieldStrategy::Custom(_) => {
                return Err(ProtocolError::NotImplemented("Custom strategies"));
            }
        }

        Ok(ptb)
    }
}

/// Protocol configuration
#[derive(Debug, Clone, Default)]
pub struct ProtocolConfig {
    pub scallop_package: Option<String>,
    pub scallop_market: Option<String>,
    pub navi_package: Option<String>,
    pub navi_pool: Option<String>,
    pub deepbook_package: Option<String>,
}

/// Protocol errors
#[derive(Debug, thiserror::Error)]
pub enum ProtocolError {
    #[error("Protocol not configured: {0}")]
    NotConfigured(&'static str),

    #[error("Not implemented: {0}")]
    NotImplemented(&'static str),

    #[error("Execution failed: {0}")]
    ExecutionFailed(String),
}
