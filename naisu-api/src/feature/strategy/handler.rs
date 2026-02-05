use serde::Serialize;

use crate::common::response::{ApiResponse, ApiSuccessResponse};

#[derive(Debug, Clone, Serialize)]
pub struct StrategyData {
    pub id: String,
    pub protocol: String,
    pub asset: String,
    pub apy: f64,
    pub risk_score: u8,
}

/// Hardcoded fallback matching MOCK_RATES used by the solver bots
fn mock_strategies() -> Vec<StrategyData> {
    vec![
        StrategyData {
            id: "scallop_sui".to_string(),
            protocol: "Scallop".to_string(),
            asset: "SUI".to_string(),
            apy: 8.5,
            risk_score: 3,
        },
        StrategyData {
            id: "scallop_usdc".to_string(),
            protocol: "Scallop".to_string(),
            asset: "USDC".to_string(),
            apy: 7.2,
            risk_score: 2,
        },
        StrategyData {
            id: "navi_sui".to_string(),
            protocol: "Navi".to_string(),
            asset: "SUI".to_string(),
            apy: 8.0,
            risk_score: 4,
        },
        StrategyData {
            id: "navi_usdc".to_string(),
            protocol: "Navi".to_string(),
            asset: "USDC".to_string(),
            apy: 6.8,
            risk_score: 3,
        },
    ]
}

/// GET /strategies — returns yield strategies.
/// Attempts live adapter fetch; on any failure returns mock data.
pub async fn get_strategies() -> ApiResponse<Vec<StrategyData>> {
    // Try real adapters via naisu-sui
    let live = fetch_live_strategies().await;

    let strategies = match live {
        Some(data) if !data.is_empty() => data,
        _ => {
            tracing::info!("Using mock strategy fallback");
            mock_strategies()
        }
    };

    Ok(ApiSuccessResponse::new(strategies))
}

/// Attempt to pull data from the real Scallop/Navi adapters.
/// Returns None on any error so we can fall back gracefully.
async fn fetch_live_strategies() -> Option<Vec<StrategyData>> {
    use naisu_sui::adapters::{NaviAdapter, ScallopAdapter, YieldComparator};

    let scallop = ScallopAdapter::new();
    let navi = NaviAdapter::new();
    let comparator = YieldComparator::new(scallop, navi);

    let opportunities = comparator.get_all_opportunities().await.ok()?;

    if opportunities.is_empty() {
        return None;
    }

    let strategies: Vec<StrategyData> = opportunities
        .into_iter()
        .map(|o| StrategyData {
            id: format!(
                "{}_{}",
                o.protocol.to_string().to_lowercase(),
                o.asset.to_lowercase()
            ),
            protocol: o.protocol.to_string(),
            asset: o.asset,
            apy: o.apy,
            risk_score: o.risk_score,
        })
        .collect();

    Some(strategies)
}
