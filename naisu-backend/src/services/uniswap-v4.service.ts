/**
 * Uniswap V4 Service
 * Business logic for interacting with Naisu Uniswap V4 contracts
 */
import { getContract, parseAbiItem, formatUnits } from 'viem'
import { getPublicClient, getContractAddresses } from '@lib/evm-client'
import { naisuUniswapV4SwapAbi, naisuUniswapV4RewardsAbi, poolManagerAbi } from '@abis/uniswap-v4'
import { logger } from '@lib/logger'
import { AppError } from '@utils/validation'
import { ERROR_CODES } from '@config/constants'

// ============================================================================
// Contract Instances
// ============================================================================

function getSwapContract() {
  const client = getPublicClient()
  const addresses = getContractAddresses()

  return getContract({
    address: addresses.swap,
    abi: naisuUniswapV4SwapAbi,
    client,
  })
}

function getRewardsContract() {
  const client = getPublicClient()
  const addresses = getContractAddresses()

  return getContract({
    address: addresses.rewards,
    abi: naisuUniswapV4RewardsAbi,
    client,
  })
}

function getPoolManagerContract() {
  const client = getPublicClient()
  const addresses = getContractAddresses()

  return getContract({
    address: addresses.poolManager,
    abi: poolManagerAbi,
    client,
  })
}

// ============================================================================
// Pool State Queries
// ============================================================================

/**
 * Get pool price and tick
 */
export async function getPoolPrice(
  token0: `0x${string}`,
  token1: `0x${string}`
): Promise<{
  sqrtPriceX96: bigint
  tick: number
  price: string
}> {
  try {
    const rewards = getRewardsContract()

    const [sqrtPriceX96, tick] = await rewards.read.getPoolPrice([token0, token1])

    // Calculate human-readable price (simplified - for full sqrtPriceX96 decoding use tick math)
    const price = calculatePriceFromSqrtX96(sqrtPriceX96)

    return {
      sqrtPriceX96,
      tick,
      price,
    }
  } catch (error) {
    logger.error({ error, token0, token1 }, 'Failed to get pool price')
    throw new AppError('Failed to get pool price', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}

/**
 * Get pool liquidity
 */
export async function getPoolLiquidity(
  token0: `0x${string}`,
  token1: `0x${string}`
): Promise<{
  poolId: `0x${string}`
  liquidity: bigint
}> {
  try {
    const rewards = getRewardsContract()

    const poolId = await rewards.read.getPoolId([token0, token1])
    const liquidity = await rewards.read.getPoolLiquidity([poolId])

    return {
      poolId,
      liquidity,
    }
  } catch (error) {
    logger.error({ error, token0, token1 }, 'Failed to get pool liquidity')
    throw new AppError('Failed to get pool liquidity', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}

/**
 * Get comprehensive pool state
 */
export async function getPoolState(
  token0: `0x${string}`,
  token1: `0x${string}`
): Promise<{
  poolId: `0x${string}`
  sqrtPriceX96: bigint
  tick: number
  price: string
  liquidity: bigint
  fee: number
  tickSpacing: number
}> {
  try {
    const rewards = getRewardsContract()
    const swap = getSwapContract()

    // Fetch all data in parallel
    const [[sqrtPriceX96, tick], poolId, liquidity, fee, tickSpacing] = await Promise.all([
      rewards.read.getPoolPrice([token0, token1]),
      rewards.read.getPoolId([token0, token1]),
      rewards.read.getPoolLiquidity([await rewards.read.getPoolId([token0, token1])]),
      swap.read.DEFAULT_FEE(),
      swap.read.DEFAULT_TICK_SPACING(),
    ])

    const price = calculatePriceFromSqrtX96(sqrtPriceX96)

    return {
      poolId,
      sqrtPriceX96,
      tick,
      price,
      liquidity,
      fee: Number(fee),
      tickSpacing: Number(tickSpacing),
    }
  } catch (error) {
    logger.error({ error, token0, token1 }, 'Failed to get pool state')
    throw new AppError('Failed to get pool state', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}

// ============================================================================
// Position Queries
// ============================================================================

/**
 * Get user position
 */
export async function getPosition(
  owner: `0x${string}`,
  token0: `0x${string}`,
  token1: `0x${string}`,
  tickLower: number,
  tickUpper: number
): Promise<{
  liquidity: bigint
  feeGrowthInside0LastX128: bigint
  feeGrowthInside1LastX128: bigint
}> {
  try {
    const rewards = getRewardsContract()

    const poolId = await rewards.read.getPoolId([token0, token1])
    const [liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128] =
      await rewards.read.getPosition([owner, poolId, tickLower, tickUpper])

    return {
      liquidity,
      feeGrowthInside0LastX128,
      feeGrowthInside1LastX128,
    }
  } catch (error) {
    logger.error({ error, owner, token0, token1 }, 'Failed to get position')
    throw new AppError('Failed to get position', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}

// ============================================================================
// Solver Management
// ============================================================================

/**
 * Check if address is authorized solver
 */
export async function isAuthorizedSolver(address: `0x${string}`): Promise<boolean> {
  try {
    const rewards = getRewardsContract()
    return await rewards.read.authorizedSolvers([address])
  } catch (error) {
    logger.error({ error, address }, 'Failed to check solver authorization')
    throw new AppError('Failed to check solver authorization', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}

/**
 * Get contract owner
 */
export async function getContractOwner(): Promise<`0x${string}`> {
  try {
    const rewards = getRewardsContract()
    return await rewards.read.owner()
  } catch (error) {
    logger.error({ error }, 'Failed to get contract owner')
    throw new AppError('Failed to get contract owner', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}

// ============================================================================
// Pool Manager Direct Queries
// ============================================================================

/**
 * Get pool slot0 data directly from PoolManager
 */
export async function getPoolSlot0(poolId: `0x${string}`): Promise<{
  sqrtPriceX96: bigint
  tick: number
  protocolFee: number
  swapFee: number
}> {
  try {
    const poolManager = getPoolManagerContract()

    const [sqrtPriceX96, tick, protocolFee, swapFee] = await poolManager.read.getSlot0([poolId])

    return {
      sqrtPriceX96,
      tick,
      protocolFee: Number(protocolFee),
      swapFee: Number(swapFee),
    }
  } catch (error) {
    logger.error({ error, poolId }, 'Failed to get pool slot0')
    throw new AppError('Failed to get pool slot0', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}

/**
 * Get liquidity from PoolManager
 */
export async function getPoolManagerLiquidity(poolId: `0x${string}`): Promise<bigint> {
  try {
    const poolManager = getPoolManagerContract()
    return await poolManager.read.getLiquidity([poolId])
  } catch (error) {
    logger.error({ error, poolId }, 'Failed to get pool manager liquidity')
    throw new AppError('Failed to get pool manager liquidity', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}

// ============================================================================
// Swap Simulation/Quote
// ============================================================================

/**
 * Calculate expected output amount (simplified - for production use quoter contract)
 */
export async function quoteSwap(
  tokenIn: `0x${string}`,
  tokenOut: `0x${string}`,
  amountIn: bigint
): Promise<{
  expectedOutput: string
  priceImpact: string
  fee: number
}> {
  try {
    const swap = getSwapContract()

    // Get pool price for calculation
    const rewards = getRewardsContract()
    const [sqrtPriceX96] = await rewards.read.getPoolPrice([tokenIn, tokenOut])

    // Get fee
    const fee = await swap.read.DEFAULT_FEE()

    // Simplified calculation - in production use Uniswap V4 quoter
    const feeAmount = (amountIn * BigInt(fee)) / BigInt(1000000)
    const amountAfterFee = amountIn - feeAmount

    // Rough price calculation (this is simplified)
    const currentPrice = calculatePriceFromSqrtX96(sqrtPriceX96)
    const expectedOutput = Number(amountAfterFee) * parseFloat(currentPrice)

    return {
      expectedOutput: expectedOutput.toFixed(18),
      priceImpact: '0.00', // Would need full liquidity depth for accurate calculation
      fee: Number(fee),
    }
  } catch (error) {
    logger.error({ error, tokenIn, tokenOut, amountIn }, 'Failed to quote swap')
    throw new AppError('Failed to quote swap', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate price from sqrtPriceX96
 * This is a simplified version - for production use full TickMath library
 */
function calculatePriceFromSqrtX96(sqrtPriceX96: bigint): string {
  // sqrtPriceX96 = sqrt(price) * 2^96
  // price = (sqrtPriceX96 / 2^96)^2
  const Q96 = BigInt(2) ** BigInt(96)
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96)
  const price = sqrtPrice * sqrtPrice
  return price.toFixed(18)
}

/**
 * Format liquidity for display
 */
export function formatLiquidity(liquidity: bigint, decimals: number = 18): string {
  return formatUnits(liquidity, decimals)
}

/**
 * Calculate tick range for a given price range
 * Simplified version - for production use full TickMath
 */
export function priceToTick(price: number): number {
  // log base 1.0001 of price
  return Math.floor(Math.log(price) / Math.log(1.0001))
}

/**
 * Get multiple pools state
 */
export async function getMultiplePoolsState(
  pools: Array<{ token0: `0x${string}`; token1: `0x${string}` }>
): Promise<
  Array<{
    token0: `0x${string}`
    token1: `0x${string}`
    poolId: `0x${string}`
    sqrtPriceX96: bigint
    tick: number
    price: string
    liquidity: bigint
  }>
> {
  try {
    const results = await Promise.all(
      pools.map(async ({ token0, token1 }) => {
        try {
          const state = await getPoolState(token0, token1)
          return {
            token0,
            token1,
            poolId: state.poolId,
            sqrtPriceX96: state.sqrtPriceX96,
            tick: state.tick,
            price: state.price,
            liquidity: state.liquidity,
          }
        } catch (error) {
          logger.warn({ error, token0, token1 }, 'Failed to get pool state for pair')
          return null
        }
      })
    )

    return results.filter((r): r is NonNullable<typeof r> => r !== null)
  } catch (error) {
    logger.error({ error }, 'Failed to get multiple pools state')
    throw new AppError('Failed to get multiple pools state', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}

// ============================================================================
// Event Logs
// ============================================================================

/**
 * Get swap events for a pool
 */
export async function getPoolSwapEvents(
  poolId: `0x${string}`,
  fromBlock?: bigint,
  toBlock?: bigint
) {
  try {
    const client = getPublicClient()
    const addresses = getContractAddresses()

    // SwapExecuted event signature
    const eventSignature = 'SwapExecuted(address,address,address,uint256,uint256)'

    const logs = await client.getLogs({
      address: addresses.swap,
      event: parseAbiItem(`event ${eventSignature}`),
      fromBlock,
      toBlock,
    })

    return logs
  } catch (error) {
    logger.error({ error, poolId }, 'Failed to get pool swap events')
    throw new AppError('Failed to get pool swap events', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}
