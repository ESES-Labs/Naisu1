/**
 * Type exports
 */

import type { Context } from 'hono'

// ============================================================================
// Hono Context Types
// ============================================================================

export type AppContext = Context<{
  Variables: {
    userAddress?: string
    solverId?: number
    requestId: string
  }
}>

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: PaginationMeta
  message?: string
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ============================================================================
// Web3 Types
// ============================================================================

export interface WalletSignature {
  address: string
  message: string
  signature: string
}

export interface TransactionReceipt {
  txHash: string
  blockNumber: bigint
  blockHash: string
  gasUsed: bigint
  gasPrice: bigint
  status: 'success' | 'failed' | 'reverted'
  logs: Log[]
}

export interface Log {
  address: string
  topics: string[]
  data: string
}

export interface ChainConfig {
  id: string
  name: string
  nativeCurrency: string
  decimals: number
  rpcUrl: string
  explorerUrl: string
}
