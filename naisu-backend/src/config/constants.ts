/**
 * Application Constants
 * Uniswap V4 Backend
 */

// ============================================================================
// Server
// ============================================================================

export const SERVER = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  REQUEST_TIMEOUT: 30000,
} as const

// ============================================================================
// Pagination
// ============================================================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const

// ============================================================================
// EVM Chains
// ============================================================================

export const CHAINS = {
  BASE: {
    id: 'base',
    name: 'Base',
    nativeCurrency: 'ETH',
    decimals: 18,
    explorerUrl: 'https://basescan.org',
  },
  BASE_SEPOLIA: {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    nativeCurrency: 'ETH',
    decimals: 18,
    explorerUrl: 'https://sepolia.basescan.org',
  },
} as const

// ============================================================================
// Uniswap V4 Constants
// ============================================================================

export const UNISWAP_V4 = {
  // Base Sepolia deployed contracts
  BASE_SEPOLIA: {
    SWAP_CONTRACT: '0xe98c6a81ef37b14e9123b803baf08ff99098b088' as `0x${string}`,
    REWARDS_CONTRACT: '0x2c5c7eb00608f910d171c7d7a841338298076a96' as `0x${string}`,
    POOL_MANAGER: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as `0x${string}`,
  },
  // Base Mainnet (TODO: Update with actual mainnet addresses)
  BASE_MAINNET: {
    SWAP_CONTRACT: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    REWARDS_CONTRACT: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    POOL_MANAGER: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
  // Default fee (0.3%)
  DEFAULT_FEE: 3000,
  // Default tick spacing
  DEFAULT_TICK_SPACING: 60,
  // Q96 constant for price calculations
  Q96: BigInt(2) ** BigInt(96),
} as const

// ============================================================================
// API Rate Limits
// ============================================================================

export const RATE_LIMITS = {
  DEFAULT_WINDOW_MS: 60000, // 1 minute
  DEFAULT_MAX_REQUESTS: 1000,
} as const

// ============================================================================
// Cache Settings
// ============================================================================

export const CACHE = {
  POOL_STATE_TTL_SECONDS: 30, // 30 seconds for pool state
  PRICE_TTL_SECONDS: 10, // 10 seconds for prices
} as const

// ============================================================================
// Error Codes
// ============================================================================

export const ERROR_CODES = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  INVALID_POOL_ID: 'INVALID_POOL_ID',

  // Blockchain errors
  CONTRACT_ERROR: 'CONTRACT_ERROR',
  RPC_ERROR: 'RPC_ERROR',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',

  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
} as const

// ============================================================================
// Time Formatting
// ============================================================================

export const TIME = {
  ONE_SECOND: 1000,
  ONE_MINUTE: 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
} as const
