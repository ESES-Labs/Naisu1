/**
 * Uniswap V4 Routes
 * REST API endpoints for querying Uniswap V4 pool data
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import * as uniswapV4Service from '@services/uniswap-v4.service'
import {
  poolPriceQuerySchema,
  poolStateQuerySchema,
  poolLiquidityQuerySchema,
  positionQuerySchema,
  poolSlot0QuerySchema,
  quoteSwapSchema,
  solverCheckSchema,
  multiplePoolsSchema,
  buildSwapTxSchema,
} from '@models/uniswap-v4.model'
import { rateLimit } from '@middleware/rate-limit'
import { logger } from '@lib/logger'

export const uniswapV4Router = new Hono()

// Apply rate limiting to all Uniswap V4 endpoints
uniswapV4Router.use('*', rateLimit({ windowMs: 60000, maxRequests: 100 }))

// ============================================================================
// Pool State Endpoints
// ============================================================================

/**
 * Get pool price
 * GET /uniswap-v4/pool/price?token0=...&token1=...
 */
uniswapV4Router.get('/pool/price', zValidator('query', poolPriceQuerySchema), async (c) => {
  const { token0, token1, fee } = c.req.valid('query')

  logger.info({ token0, token1 }, 'Fetching pool price')

  const price = await uniswapV4Service.getPoolPrice(
    token0 as `0x${string}`,
    token1 as `0x${string}`,
    fee
  )

  return c.json({
    success: true,
    data: {
      sqrtPriceX96: price.sqrtPriceX96.toString(),
      tick: price.tick,
      price: price.price,
    },
  })
})

/**
 * Get comprehensive pool state
 * GET /uniswap-v4/pool/state?token0=...&token1=...
 */
uniswapV4Router.get('/pool/state', zValidator('query', poolStateQuerySchema), async (c) => {
  const { token0, token1, fee } = c.req.valid('query')

  logger.info({ token0, token1 }, 'Fetching pool state')

  const state = await uniswapV4Service.getPoolState(
    token0 as `0x${string}`,
    token1 as `0x${string}`,
    fee
  )

  return c.json({
    success: true,
    data: {
      poolId: state.poolId,
      sqrtPriceX96: state.sqrtPriceX96.toString(),
      tick: state.tick,
      price: state.price,
      liquidity: state.liquidity.toString(),
      fee: state.fee,
      tickSpacing: state.tickSpacing,
    },
  })
})

/**
 * Get pool liquidity
 * GET /uniswap-v4/pool/liquidity?token0=...&token1=...
 */
uniswapV4Router.get('/pool/liquidity', zValidator('query', poolLiquidityQuerySchema), async (c) => {
  const { token0, token1, fee } = c.req.valid('query')

  logger.info({ token0, token1 }, 'Fetching pool liquidity')

  const liquidity = await uniswapV4Service.getPoolLiquidity(
    token0 as `0x${string}`,
    token1 as `0x${string}`,
    fee
  )

  return c.json({
    success: true,
    data: {
      poolId: liquidity.poolId,
      liquidity: liquidity.liquidity.toString(),
    },
  })
})

/**
 * Get multiple pools state
 * POST /uniswap-v4/pools/batch
 */
uniswapV4Router.post('/pools/batch', zValidator('json', multiplePoolsSchema), async (c) => {
  const { pools } = c.req.valid('json')

  logger.info({ poolCount: pools.length }, 'Fetching multiple pools state')

  const results = await uniswapV4Service.getMultiplePoolsState(
    pools.map((p) => ({
      token0: p.token0 as `0x${string}`,
      token1: p.token1 as `0x${string}`,
      fee: p.fee,
    }))
  )

  return c.json({
    success: true,
    data: results.map((r) => ({
      token0: r.token0,
      token1: r.token1,
      poolId: r.poolId,
      sqrtPriceX96: r.sqrtPriceX96.toString(),
      tick: r.tick,
      price: r.price,
      liquidity: r.liquidity.toString(),
    })),
    meta: {
      requested: pools.length,
      returned: results.length,
    },
  })
})

// ============================================================================
// Position Endpoints
// ============================================================================

/**
 * Get user position
 * GET /uniswap-v4/position?owner=...&token0=...&token1=...&tickLower=...&tickUpper=...
 */
uniswapV4Router.get('/position', zValidator('query', positionQuerySchema), async (c) => {
  const { owner, token0, token1, tickLower, tickUpper } = c.req.valid('query')

  logger.info({ owner, token0, token1, tickLower, tickUpper }, 'Fetching position')

  const position = await uniswapV4Service.getPosition(
    owner as `0x${string}`,
    token0 as `0x${string}`,
    token1 as `0x${string}`,
    tickLower,
    tickUpper
  )

  return c.json({
    success: true,
    data: {
      liquidity: position.liquidity.toString(),
      feeGrowthInside0LastX128: position.feeGrowthInside0LastX128.toString(),
      feeGrowthInside1LastX128: position.feeGrowthInside1LastX128.toString(),
    },
  })
})

// ============================================================================
// Pool Manager Endpoints
// ============================================================================

/**
 * Get pool slot0 data
 * GET /uniswap-v4/pool/slot0?poolId=...
 */
uniswapV4Router.get('/pool/slot0', zValidator('query', poolSlot0QuerySchema), async (c) => {
  const { poolId } = c.req.valid('query')

  logger.info({ poolId }, 'Fetching pool slot0')

  const slot0 = await uniswapV4Service.getPoolSlot0(poolId as `0x${string}`)

  return c.json({
    success: true,
    data: {
      sqrtPriceX96: slot0.sqrtPriceX96.toString(),
      tick: slot0.tick,
      protocolFee: slot0.protocolFee,
      swapFee: slot0.swapFee,
    },
  })
})

// ============================================================================
// Swap Quote Endpoints
// ============================================================================

/**
 * Quote a swap
 * GET /uniswap-v4/swap/quote?tokenIn=...&tokenOut=...&amountIn=...
 */
uniswapV4Router.get('/swap/quote', zValidator('query', quoteSwapSchema), async (c) => {
  const { tokenIn, tokenOut, amountIn, fee } = c.req.valid('query')

  logger.info({ tokenIn, tokenOut, amountIn }, 'Quoting swap')

  const quote = await uniswapV4Service.quoteSwap(
    tokenIn as `0x${string}`,
    tokenOut as `0x${string}`,
    BigInt(amountIn),
    fee
  )

  return c.json({
    success: true,
    data: quote,
  })
})

/**
 * Build swap transaction for user to sign
 * POST /uniswap-v4/swap/build
 *
 * Returns unsigned transaction(s) that the user signs client-side.
 * Includes ERC20 approve tx if current allowance is insufficient.
 */
uniswapV4Router.post('/swap/build', zValidator('json', buildSwapTxSchema), async (c) => {
  const { sender, tokenIn, tokenOut, amountIn, minAmountOut, fee, deadlineSeconds } =
    c.req.valid('json')

  logger.info({ sender, tokenIn, tokenOut, amountIn }, 'Building swap transaction')

  const result = await uniswapV4Service.buildSwapTransaction({
    sender: sender as `0x${string}`,
    tokenIn: tokenIn as `0x${string}`,
    tokenOut: tokenOut as `0x${string}`,
    amountIn: BigInt(amountIn),
    minAmountOut: BigInt(minAmountOut),
    fee,
    deadlineSeconds,
  })

  return c.json({
    success: true,
    data: {
      transactions: result.transactions.map((tx) => ({
        to: tx.to,
        data: tx.data,
        value: tx.value,
        chainId: tx.chainId,
        description: tx.description,
      })),
      summary: result.summary,
    },
  })
})

// ============================================================================
// Solver Endpoints
// ============================================================================

/**
 * Check if address is authorized solver
 * GET /uniswap-v4/solver/check?address=...
 */
uniswapV4Router.get('/solver/check', zValidator('query', solverCheckSchema), async (c) => {
  const { address } = c.req.valid('query')

  logger.info({ address }, 'Checking solver authorization')

  const isAuthorized = await uniswapV4Service.isAuthorizedSolver(address as `0x${string}`)

  return c.json({
    success: true,
    data: {
      address,
      isAuthorized,
    },
  })
})

/**
 * Get contract owner
 * GET /uniswap-v4/contract/owner
 */
uniswapV4Router.get('/contract/owner', async (c) => {
  const owner = await uniswapV4Service.getContractOwner()

  return c.json({
    success: true,
    data: {
      owner,
    },
  })
})

// ============================================================================
// Utility Endpoints
// ============================================================================

/**
 * Get contract addresses
 * GET /uniswap-v4/addresses
 */
uniswapV4Router.get('/addresses', async (c) => {
  const { getContractAddresses } = await import('@lib/evm-client')
  const { config } = await import('@config/env')
  const addresses = getContractAddresses()

  return c.json({
    success: true,
    data: {
      ...addresses,
      chain: config.evm.network,
    },
  })
})

/**
 * Health check for Uniswap V4 integration
 * GET /uniswap-v4/health
 */
uniswapV4Router.get('/health', async (c) => {
  try {
    // Try to get owner as health check
    const owner = await uniswapV4Service.getContractOwner()

    return c.json({
      success: true,
      data: {
        status: 'healthy',
        contractOwner: owner,
      },
    })
  } catch (error) {
    logger.error({ error }, 'Uniswap V4 health check failed')

    return c.json(
      {
        success: false,
        error: {
          code: 'UNHEALTHY',
          message: 'Uniswap V4 integration is not healthy',
        },
      },
      503
    )
  }
})
