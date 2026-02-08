/**
 * Environment Configuration
 * Validates and exports environment variables
 */
import { z } from 'zod'

// ============================================================================
// Schema Validation
// ============================================================================

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('3000'),
  HOST: z.string().default('0.0.0.0'),

  // Database (Optional - can run without DB for pure blockchain queries)
  DATABASE_URL: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url().startsWith('postgresql://').optional()
  ),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // EVM - Base Sepolia (Testnet)
  BASE_SEPOLIA_RPC: z.string().url().default('https://sepolia.base.org'),
  BASE_SEPOLIA_CHAIN_ID: z.string().default('84532'),

  // EVM - Base Mainnet (Production)
  BASE_MAINNET_RPC: z.string().url().default('https://mainnet.base.org'),
  BASE_MAINNET_CHAIN_ID: z.string().default('8453'),

  // EVM Admin (for write operations - optional)
  EVM_ADMIN_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),

  // Uniswap V4 contracts (selected network)
  NAISU_SWAP_CONTRACT: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default('0xfaBD3bdeecf7f858d6cef1c137694e19Ac7187f6'),
  NAISU_REWARDS_CONTRACT: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default('0xD24463BBde91Df1937F4CFC4F627fFc76728b8A6'),
  POOL_MANAGER: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default('0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408'),

  // EVM Fallback RPC (optional)
  EVM_FALLBACK_RPC_URL: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url().optional()
  ),

  // Feature Flags
  ENABLE_UNISWAP_V4: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // Redis (optional, for caching)
  REDIS_URL: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),

  // Security
  API_KEY_HEADER: z.string().default('x-api-key'),
})

// ============================================================================
// Parse Environment
// ============================================================================

const parseEnv = () => {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      console.error('❌ Environment validation failed:')
      issues.forEach((issue) => console.error(`  - ${issue}`))
      process.exit(1)
    }
    throw error
  }
}

const env = parseEnv()

// ============================================================================
// Exported Config
// ============================================================================

const isDev = env.NODE_ENV === 'development'
const isProd = env.NODE_ENV === 'production'
const isTest = env.NODE_ENV === 'test'

export const config = {
  // Server
  server: {
    env: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    isDev,
    isProd,
    isTest,
  },

  // Database (optional)
  database: {
    url: env.DATABASE_URL,
  },

  // CORS
  cors: {
    origin: env.CORS_ORIGIN,
  },

  // Logging
  log: {
    level: env.LOG_LEVEL,
  },

  // EVM (Base)
  evm: {
    rpcUrl: isProd ? env.BASE_MAINNET_RPC : env.BASE_SEPOLIA_RPC,
    chainId: isProd
      ? parseInt(env.BASE_MAINNET_CHAIN_ID, 10)
      : parseInt(env.BASE_SEPOLIA_CHAIN_ID, 10),
    fallbackRpcUrl: env.EVM_FALLBACK_RPC_URL,
    adminPrivateKey: env.EVM_ADMIN_PRIVATE_KEY,
    contracts: {
      swap: env.NAISU_SWAP_CONTRACT as `0x${string}`,
      rewards: env.NAISU_REWARDS_CONTRACT as `0x${string}`,
      poolManager: env.POOL_MANAGER as `0x${string}`,
    },
  },

  // Features
  features: {
    enableUniswapV4: env.ENABLE_UNISWAP_V4,
  },

  // Redis
  redis: {
    url: env.REDIS_URL,
  },

  // Security
  security: {
    apiKeyHeader: env.API_KEY_HEADER,
  },
} as const

export type Config = typeof config
