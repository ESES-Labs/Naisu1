/**
 * Uniswap V4 Model Types & Schemas
 * Zod schemas for validation and TypeScript types
 */
import { z } from 'zod'

// ============================================================================
// Base Types
// ============================================================================

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address')
export const bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid bytes32')
export const uint256Schema = z.string().regex(/^\d+$/, 'Must be a valid integer')

// ============================================================================
// Request Schemas
// ============================================================================

export const poolQuerySchema = z.object({
  token0: addressSchema,
  token1: addressSchema,
  fee: z.coerce.number().int().min(100).max(10000).optional().default(3000),
})

export const positionQuerySchema = z.object({
  owner: addressSchema,
  token0: addressSchema,
  token1: addressSchema,
  tickLower: z.coerce.number().int(),
  tickUpper: z.coerce.number().int(),
})

export const swapQuoteSchema = z.object({
  tokenIn: addressSchema,
  tokenOut: addressSchema,
  amountIn: uint256Schema,
  fee: z.coerce.number().int().min(100).max(10000).optional().default(3000),
})

export const solverCheckSchema = z.object({
  address: addressSchema,
})

export const batchPoolQuerySchema = z.object({
  pools: z
    .array(
      z.object({
        token0: addressSchema,
        token1: addressSchema,
        fee: z.number().int().optional().default(3000),
      })
    )
    .min(1)
    .max(20),
})

// ============================================================================
// Response Schemas (for OpenAPI documentation)
// ============================================================================

export const poolPriceResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    poolId: z.string(),
    sqrtPriceX96: z.string(),
    tick: z.number(),
    price: z.string(),
  }),
})

export const poolStateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    poolId: z.string(),
    sqrtPriceX96: z.string(),
    tick: z.number(),
    price: z.string(),
    liquidity: z.string(),
    fee: z.number(),
    tickSpacing: z.number(),
  }),
})

export const swapQuoteResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    expectedOutput: z.string(),
    priceImpact: z.string(),
    fee: z.number(),
    poolId: z.string(),
  }),
})

export const solverCheckResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    address: z.string(),
    isSolver: z.boolean(),
  }),
})

export const contractAddressesResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    swap: z.string(),
    rewards: z.string(),
    poolManager: z.string(),
    chain: z.string(),
  }),
})

export const healthResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    contracts: z.object({
      swap: z.boolean(),
      rewards: z.boolean(),
      poolManager: z.boolean(),
    }),
    blockNumber: z.string().optional(),
  }),
})

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
})

// ============================================================================
// Legacy Schemas (for backward compatibility)
// ============================================================================

export const poolPriceQuerySchema = poolQuerySchema
export const poolStateQuerySchema = poolQuerySchema
export const poolLiquidityQuerySchema = poolQuerySchema
export const poolSlot0QuerySchema = z.object({
  poolId: bytes32Schema,
})

export const quoteSwapSchema = swapQuoteSchema

export const multiplePoolsSchema = batchPoolQuerySchema

export const poolPairSchema = z.object({
  token0: addressSchema,
  token1: addressSchema,
})

// ============================================================================
// Legacy Response Schemas
// ============================================================================

export const positionResponseSchema = z.object({
  liquidity: z.string(),
  feeGrowthInside0LastX128: z.string(),
  feeGrowthInside1LastX128: z.string(),
})

export const slot0ResponseSchema = z.object({
  sqrtPriceX96: z.string(),
  tick: z.number(),
  protocolFee: z.number(),
  swapFee: z.number(),
})

// ============================================================================
// Type Exports
// ============================================================================

export type PoolQuery = z.infer<typeof poolQuerySchema>
export type PositionQuery = z.infer<typeof positionQuerySchema>
export type SwapQuoteInput = z.infer<typeof swapQuoteSchema>
export type SolverCheckQuery = z.infer<typeof solverCheckSchema>
export type BatchPoolQuery = z.infer<typeof batchPoolQuerySchema>

export type PoolPriceResponse = z.infer<typeof poolPriceResponseSchema>
export type PoolStateResponse = z.infer<typeof poolStateResponseSchema>
export type SwapQuoteResponse = z.infer<typeof swapQuoteResponseSchema>
export type SolverCheckResponse = z.infer<typeof solverCheckResponseSchema>
export type ContractAddressesResponse = z.infer<typeof contractAddressesResponseSchema>
export type HealthResponse = z.infer<typeof healthResponseSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>

// Legacy types
export type PoolPriceQuery = z.infer<typeof poolPriceQuerySchema>
export type PoolStateQuery = z.infer<typeof poolStateQuerySchema>
export type PoolLiquidityQuery = z.infer<typeof poolLiquidityQuerySchema>
export type PoolSlot0Query = z.infer<typeof poolSlot0QuerySchema>
export type QuoteSwapInput = z.infer<typeof quoteSwapSchema>
export type MultiplePoolsInput = z.infer<typeof multiplePoolsSchema>
export type PositionResponse = z.infer<typeof positionResponseSchema>
export type Slot0Response = z.infer<typeof slot0ResponseSchema>
export type QuoteSwapResponse = z.infer<typeof swapQuoteResponseSchema>
