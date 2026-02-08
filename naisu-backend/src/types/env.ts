/**
 * Environment Variable Types
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: 'development' | 'production' | 'test'
      PORT?: string
      HOST?: string
      DATABASE_URL: string
      CORS_ORIGIN?: string
      LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error'

      // Sui Blockchain
      SUI_RPC_URL?: string
      SUI_NETWORK?: 'mainnet' | 'testnet' | 'devnet' | 'localnet'
      SUI_PACKAGE_ID?: string
      SUI_ADMIN_PRIVATE_KEY?: string

      // EVM
      BASE_SEPOLIA_RPC?: string
      BASE_SEPOLIA_CHAIN_ID?: string
      BASE_MAINNET_RPC?: string
      BASE_MAINNET_CHAIN_ID?: string
      EVM_NETWORK?: 'base-sepolia' | 'base'
      NAISU_SWAP_CONTRACT?: string
      NAISU_REWARDS_CONTRACT?: string
      POOL_MANAGER?: string
      EVM_ADMIN_PRIVATE_KEY?: string

      // Wormhole CCTP
      CCTP_TOKEN_MESSENGER_MINTER?: string
      CCTP_STATE_OBJECT?: string

      // Feature Flags
      ENABLE_MOCK_SOLVERS?: string
      ENABLE_WEBSOCKET?: string
      ENABLE_CRON_JOBS?: string

      // External APIs
      COINGECKO_API_KEY?: string
      DEFILLAMA_API_KEY?: string

      // Redis
      REDIS_URL?: string

      // Security
      API_KEY_HEADER?: string
      SOLVER_API_KEY?: string
    }
  }
}

export {}
