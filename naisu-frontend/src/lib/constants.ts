/**
 * Global Constants
 * 
 * NOTE: For network-aware values (package IDs, RPC URLs, etc.),
 * use the useNetworkConfig() hook instead of these constants.
 * These are kept for backward compatibility.
 */

// Default network
export const DEFAULT_NETWORK = import.meta.env.VITE_SUI_NETWORK || 'testnet';

// Testnet Configuration
export const TESTNET_PACKAGE_ID = import.meta.env.VITE_TESTNET_INTENT_PACKAGE || '0xa3a26135f436323ea0fe00330fbdcd188f2c07bf33a5ee4c49aa736cea88a71f';
export const TESTNET_RPC_URL = import.meta.env.VITE_TESTNET_RPC_URL || 'https://fullnode.testnet.sui.io:443';

// Mainnet Configuration
export const MAINNET_PACKAGE_ID = import.meta.env.VITE_MAINNET_INTENT_PACKAGE || '';
export const MAINNET_RPC_URL = import.meta.env.VITE_MAINNET_RPC_URL || 'https://fullnode.mainnet.sui.io:443';

// Legacy constant (deprecated - use useNetworkConfig hook instead)
export const NAISU_PACKAGE_ID = TESTNET_PACKAGE_ID;

// Legacy constant (deprecated - use useNetworkConfig hook instead)
export const SUI_NETWORK = DEFAULT_NETWORK;

// Legacy constant (deprecated - use useNetworkConfig hook instead)
export const SUI_RPC_URL = TESTNET_RPC_URL;

// Contract module names
export const INTENT_MODULE = 'intent';
export const ADAPTER_MODULE = 'adapter';

// Feature flags
export const ENABLE_MOCK_SOLVERS = import.meta.env.VITE_ENABLE_MOCK_SOLVERS === 'true' || false;
export const MOCK_DELAY_MS = 1000;

// Protocol APY Estimates (basis points)
export const PROTOCOL_APYS = {
  scallop: 850,    // 8.5%
  navi: 800,       // 8.0%
  cetus: 1000,     // 10%
  deepbook: 500,   // 5%
  staking: 250,    // 2.5%
};

// Protocol info for display
export const PROTOCOL_INFO = {
  scallop: {
    name: 'Scallop',
    type: 'Lending',
    description: 'Yield-bearing sSUI tokens',
    color: 'emerald',
  },
  navi: {
    name: 'Navi',
    type: 'Lending',
    description: 'Account-based lending',
    color: 'blue',
  },
  cetus: {
    name: 'Cetus',
    type: 'CLMM DEX',
    description: 'Concentrated liquidity',
    color: 'purple',
  },
  deepbook: {
    name: 'DeepBook',
    type: 'CLOB DEX',
    description: 'Native orderbook',
    color: 'orange',
  },
  staking: {
    name: 'Native Staking',
    type: 'Staking',
    description: 'Sui validator staking',
    color: 'cyan',
  },
};
