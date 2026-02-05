/**
 * Global Constants
 */

// Sui Package ID (will be updated after deployment)
export const NAISU_PACKAGE_ID = import.meta.env.VITE_NAISU_PACKAGE_ID || '0xa3a26135f436323ea0fe00330fbdcd188f2c07bf33a5ee4c49aa736cea88a71f';

// Network configuration
export const SUI_NETWORK = import.meta.env.VITE_SUI_NETWORK || 'testnet';

// Contract module names
export const INTENT_MODULE = 'intent';
export const ADAPTER_MODULE = 'adapter';

// API endpoints
export const SUI_RPC_URL = import.meta.env.VITE_SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443';

// Feature flags
export const ENABLE_MOCK_SOLVERS = import.meta.env.VITE_ENABLE_MOCK_SOLVERS === 'true' || true;
export const MOCK_DELAY_MS = 1000;
