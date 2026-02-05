use std::net::SocketAddr;

use tokio::net::TcpListener;
use tracing::{error, info};

/// Create a TCP listener that binds to all interfaces on the given port
pub async fn create_dual_stack_listener(port: u16) -> std::io::Result<TcpListener> {
    // Try to bind to IPv4 and IPv6
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    match TcpListener::bind(addr).await {
        Ok(listener) => {
            info!("✅ Server listening on {}", addr);
            Ok(listener)
        }
        Err(e) => {
            error!("❌ Failed to bind to {}: {}", addr, e);
            Err(e)
        }
    }
}
