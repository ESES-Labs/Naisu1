/**
 * Uniswap V4 Service
 * Business logic for interacting with Naisu Uniswap V4 contracts
 */
import {
  getContract,
  parseAbiItem,
  formatUnits,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  toHex,
} from 'viem'
import { getPublicClient, getContractAddresses } from '@lib/evm-client'
import { naisuUniswapV4SwapAbi, naisuUniswapV4RewardsAbi, poolManagerAbi } from '@abis/uniswap-v4'
import { logger } from '@lib/logger'
import { AppError } from '@utils/validation'
import { ERROR_CODES } from '@config/constants'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const DEFAULT_FEE = 3000
const DEFAULT_TICK_SPACING = 60
const POOLS_SLOT = 6n
const LIQUIDITY_OFFSET = 3n

/** Fee tier in bps (e.g. 500 = 0.05%, 3000 = 0.3%) */
const FEE_TIER_LABELS: Record<number, string> = {
  500: '0.05%',
  1000: '0.1%',
  3000: '0.3%',
  10000: '1%',
}

function formatFeeTier(fee: number): string {
  return FEE_TIER_LABELS[fee] ?? `${fee / 10000}%`
}

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function buildPoolNotFoundMessage(
  tokenIn: string,
  tokenOut: string,
  feeTiersTried: number[]
): string {
  const tiers = [...new Set(feeTiersTried)].map(formatFeeTier).join(', ')
  return `No liquidity pool found for ${shortAddress(tokenIn)} / ${shortAddress(tokenOut)}. Tried fee tiers: ${tiers}. Create a pool for this pair on this network (e.g. via pool manager) or use a token pair that already has a pool.`
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

function isPoolMissingError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase()
  return (
    message.includes('poolnotinitialized') ||
    message.includes('pool not initialized') ||
    message.includes('function "getslot0" reverted')
  )
}

function isArithmeticOverflowError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase()
  const isSwapQuoteError = message.includes('getswapquote')
  return (
    isSwapQuoteError &&
    message.includes('overflow') ||
    (isSwapQuoteError && message.includes('underflow')) ||
    (isSwapQuoteError && message.includes('arithmetic operation resulted in underflow or overflow'))
  )
}

function derivePoolId(
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
  fee: number = DEFAULT_FEE,
  tickSpacing: number = DEFAULT_TICK_SPACING
): `0x${string}` {
  const [currency0, currency1] =
    tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA]

  return keccak256(
    encodeAbiParameters(
      [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' },
      ],
      [currency0, currency1, fee, tickSpacing, ZERO_ADDRESS]
    )
  )
}

function getPoolStateSlot(poolId: `0x${string}`): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { name: 'poolId', type: 'bytes32' },
        { name: 'slot', type: 'uint256' },
      ],
      [poolId, POOLS_SLOT]
    )
  )
}

function parseSignedInt24(value: bigint): number {
  const raw = Number(value & 0xffffffn)
  return raw >= 0x800000 ? raw - 0x1000000 : raw
}

async function readPoolSlot0(
  poolManager: Awaited<ReturnType<typeof getCanonicalPoolManagerContract>>,
  poolId: `0x${string}`
): Promise<{ sqrtPriceX96: bigint; tick: number; protocolFee: number; swapFee: number }> {
  try {
    const [sqrtPriceX96, tick, protocolFee, swapFee] = await poolManager.read.getSlot0([poolId])
    return {
      sqrtPriceX96: BigInt(sqrtPriceX96),
      tick: Number(tick),
      protocolFee: Number(protocolFee),
      swapFee: Number(swapFee),
    }
  } catch (_error) {
    // Fallback to raw storage decode for PoolManager variants that don't expose helpers.
    const stateSlot = getPoolStateSlot(poolId)
    const dataHex = (await poolManager.read.extsload([stateSlot])) as `0x${string}`
    const data = BigInt(dataHex)

    const sqrtPriceX96 = data & ((1n << 160n) - 1n)
    const tick = parseSignedInt24(data >> 160n)
    const protocolFee = Number((data >> 184n) & 0xffffffn)
    const swapFee = Number((data >> 208n) & 0xffffffn)

    return { sqrtPriceX96, tick, protocolFee, swapFee }
  }
}

async function readPoolLiquidity(
  poolManager: Awaited<ReturnType<typeof getCanonicalPoolManagerContract>>,
  poolId: `0x${string}`
): Promise<bigint> {
  try {
    return (await poolManager.read.getLiquidity([poolId])) as bigint
  } catch (_error) {
    const stateSlot = BigInt(getPoolStateSlot(poolId))
    const liquiditySlot = toHex(stateSlot + LIQUIDITY_OFFSET, { size: 32 })
    const dataHex = (await poolManager.read.extsload([liquiditySlot])) as `0x${string}`
    const data = BigInt(dataHex)
    return data & ((1n << 128n) - 1n)
  }
}

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

async function getCanonicalPoolManagerContract(source: 'swap' | 'rewards' = 'swap') {
  const client = getPublicClient()
  const poolManagerAddress =
    source === 'swap'
      ? await getSwapContract().read.poolManager()
      : await getRewardsContract().read.poolManager()

  return getContract({
    address: poolManagerAddress,
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
  token1: `0x${string}`,
  fee?: number
): Promise<{
  sqrtPriceX96: bigint
  tick: number
  price: string
}> {
  try {
    const poolManager = await getCanonicalPoolManagerContract('swap')
    const poolId = derivePoolId(token0, token1, fee ?? DEFAULT_FEE)
    const { sqrtPriceX96, tick } = await readPoolSlot0(poolManager, poolId)
    if (sqrtPriceX96 === 0n) {
      throw new AppError(
        'Pool not initialized for this token pair on current network/fee settings',
        404,
        ERROR_CODES.NOT_FOUND
      )
    }

    // Calculate human-readable price (simplified - for full sqrtPriceX96 decoding use tick math)
    const price = calculatePriceFromSqrtX96(sqrtPriceX96)

    return {
      sqrtPriceX96,
      tick,
      price,
    }
  } catch (error) {
    if (isPoolMissingError(error)) {
      throw new AppError(
        'Pool not initialized for this token pair on current network/fee settings',
        404,
        ERROR_CODES.NOT_FOUND
      )
    }
    logger.error({ error, token0, token1 }, 'Failed to get pool price')
    throw new AppError('Failed to get pool price', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}

/**
 * Get pool liquidity
 */
export async function getPoolLiquidity(
  token0: `0x${string}`,
  token1: `0x${string}`,
  fee?: number
): Promise<{
  poolId: `0x${string}`
  liquidity: bigint
}> {
  try {
    const poolManager = await getCanonicalPoolManagerContract('swap')
    const poolId = derivePoolId(token0, token1, fee ?? DEFAULT_FEE)
    const { sqrtPriceX96 } = await readPoolSlot0(poolManager, poolId)
    if (sqrtPriceX96 === 0n) {
      throw new AppError(
        'Pool not initialized for this token pair on current network/fee settings',
        404,
        ERROR_CODES.NOT_FOUND
      )
    }
    const liquidity = await readPoolLiquidity(poolManager, poolId)

    return {
      poolId,
      liquidity,
    }
  } catch (error) {
    if (isPoolMissingError(error)) {
      throw new AppError(
        'Pool not initialized for this token pair on current network/fee settings',
        404,
        ERROR_CODES.NOT_FOUND
      )
    }
    logger.error({ error, token0, token1 }, 'Failed to get pool liquidity')
    throw new AppError('Failed to get pool liquidity', 500, ERROR_CODES.INTERNAL_ERROR)
  }
}

/**
 * Get comprehensive pool state
 */
export async function getPoolState(
  token0: `0x${string}`,
  token1: `0x${string}`,
  feeOverride?: number
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
    const poolManager = await getCanonicalPoolManagerContract('swap')
    const swap = getSwapContract()

    const [feeRaw, tickSpacingRaw] = await Promise.all([
      swap.read.DEFAULT_FEE(),
      swap.read.DEFAULT_TICK_SPACING(),
    ])

    const fee = feeOverride ?? Number(feeRaw)
    const tickSpacing = Number(tickSpacingRaw)
    const poolId = derivePoolId(token0, token1, fee, tickSpacing)

    const [slot0, liquidity] = await Promise.all([
      readPoolSlot0(poolManager, poolId),
      readPoolLiquidity(poolManager, poolId),
    ])
    const { sqrtPriceX96, tick } = slot0
    if (sqrtPriceX96 === 0n) {
      throw new AppError(
        'Pool not initialized for this token pair on current network/fee settings',
        404,
        ERROR_CODES.NOT_FOUND
      )
    }

    const price = calculatePriceFromSqrtX96(sqrtPriceX96)

    return {
      poolId,
      sqrtPriceX96,
      tick,
      price,
      liquidity,
      fee,
      tickSpacing,
    }
  } catch (error) {
    if (isPoolMissingError(error)) {
      throw new AppError(
        'Pool not initialized for this token pair on current network/fee settings',
        404,
        ERROR_CODES.NOT_FOUND
      )
    }
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
    const poolId = derivePoolId(token0, token1)

    const position = await rewards.read.getUserPosition([owner, poolId])
    const hasTickMatch = position.tickLower === tickLower && position.tickUpper === tickUpper

    return {
      liquidity: hasTickMatch ? position.liquidity : 0n,
      feeGrowthInside0LastX128: 0n,
      feeGrowthInside1LastX128: 0n,
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
    const poolManager = await getCanonicalPoolManagerContract('swap')
    const { sqrtPriceX96, tick, protocolFee, swapFee } = await readPoolSlot0(poolManager, poolId)
    if (sqrtPriceX96 === 0n) {
      throw new AppError('Pool not initialized for provided poolId', 404, ERROR_CODES.NOT_FOUND)
    }

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
    const poolManager = await getCanonicalPoolManagerContract('swap')
    return await readPoolLiquidity(poolManager, poolId)
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
  amountIn: bigint,
  feeOverride?: number
): Promise<{
  poolId: `0x${string}`
  poolManager: `0x${string}`
  sqrtPriceX96: string
  tick: number
  tickSpacing: number
  amountIn: string
  amountInAfterFee: string
  expectedOutput: string
  priceX18: string
  priceImpact: string
  fee: number
  quoteMethod: 'contract' | 'fallback_math'
}> {
  try {
    const swap = getSwapContract()
    const [feeRaw, tickSpacingRaw, poolManagerAddress] = await Promise.all([
      swap.read.DEFAULT_FEE(),
      swap.read.DEFAULT_TICK_SPACING(),
      swap.read.poolManager(),
    ])
    const poolManager = getContract({
      address: poolManagerAddress,
      abi: poolManagerAbi,
      client: getPublicClient(),
    })
    const tickSpacing = Number(tickSpacingRaw)
    const contractFee = Number(feeRaw)
    const feeCandidates = [
      ...(feeOverride !== undefined ? [feeOverride] : []),
      contractFee,
      DEFAULT_FEE,
      500,
      1000,
      3000,
      10000,
    ].filter((v, i, arr) => arr.indexOf(v) === i)
    let fee = feeCandidates[0]!
    let poolId = derivePoolId(tokenIn, tokenOut, fee, tickSpacing)
    let sqrtPriceX96: bigint = 0n
    let tick = 0
    for (const feeTry of feeCandidates) {
      const pid = derivePoolId(tokenIn, tokenOut, feeTry, tickSpacing)
      const slot0 = await readPoolSlot0(poolManager, pid)
      if (slot0.sqrtPriceX96 !== 0n) {
        fee = feeTry
        poolId = pid
        sqrtPriceX96 = slot0.sqrtPriceX96
        tick = slot0.tick
        break
      }
    }
    if (sqrtPriceX96 === 0n) {
      throw new AppError(
        buildPoolNotFoundMessage(tokenIn, tokenOut, feeCandidates),
        404,
        ERROR_CODES.NOT_FOUND
      )
    }
    const q192 = BigInt(2) ** BigInt(192)
    const priceX18 = (sqrtPriceX96 * sqrtPriceX96 * BigInt(1e18)) / q192

    const feeAmount = (amountIn * BigInt(fee)) / BigInt(1_000_000)
    const amountAfterFee = amountIn - feeAmount

    let amountOut: bigint
    let quoteMethod: 'contract' | 'fallback_math' = 'contract'
    try {
      ;[amountOut] = await swap.read.getSwapQuote([tokenIn, tokenOut, amountIn])
    } catch (quoteError) {
      // Use fallback when contract quote fails: overflow, or pool not init (e.g. contract DEFAULT_FEE differs from initialized pool).
      const useFallback =
        isArithmeticOverflowError(quoteError) || isPoolMissingError(quoteError)
      if (!useFallback) {
        throw quoteError
      }
      if (priceX18 <= 0n) {
        throw new AppError('Pool price is zero for this pair', 404, ERROR_CODES.NOT_FOUND)
      }

      const zeroForOne = BigInt(tokenIn) < BigInt(tokenOut)
      amountOut = zeroForOne
        ? (amountAfterFee * priceX18) / BigInt(1e18)
        : (amountAfterFee * BigInt(1e18)) / priceX18
      quoteMethod = 'fallback_math'
    }

    return {
      poolId,
      poolManager: poolManagerAddress,
      sqrtPriceX96: sqrtPriceX96.toString(),
      tick,
      tickSpacing,
      amountIn: amountIn.toString(),
      amountInAfterFee: amountAfterFee.toString(),
      expectedOutput: amountOut.toString(),
      priceX18: priceX18.toString(),
      priceImpact: '0.00', // Would need full liquidity depth for accurate calculation
      fee: Number(fee),
      quoteMethod,
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }
    if (isArithmeticOverflowError(error)) {
      throw new AppError(
        'Invalid amountIn for quote; use raw token units (example: 1 USDC = 1000000)',
        400,
        ERROR_CODES.VALIDATION_ERROR
      )
    }
    if (isPoolMissingError(error)) {
      const swap = getSwapContract()
      const [feeRaw] = await Promise.all([swap.read.DEFAULT_FEE()])
      const contractFee = Number(feeRaw)
      const feeTiersTried = [
        ...(feeOverride !== undefined ? [feeOverride] : []),
        contractFee,
        DEFAULT_FEE,
        500,
        1000,
        3000,
        10000,
      ].filter((v, i, arr) => arr.indexOf(v) === i)
      throw new AppError(
        buildPoolNotFoundMessage(tokenIn, tokenOut, feeTiersTried),
        404,
        ERROR_CODES.NOT_FOUND
      )
    }
    // Disambiguate generic reverts: confirm whether slot0 exists before returning NOT_FOUND.
    try {
      const swap = getSwapContract()
      const [feeRaw, tickSpacingRaw, poolManagerAddress] = await Promise.all([
        swap.read.DEFAULT_FEE(),
        swap.read.DEFAULT_TICK_SPACING(),
        swap.read.poolManager(),
      ])
      const fee = feeOverride ?? Number(feeRaw)
      const tickSpacing = Number(tickSpacingRaw)
      const poolId = derivePoolId(tokenIn, tokenOut, fee, tickSpacing)
      const probeManager = getContract({
        address: poolManagerAddress,
        abi: poolManagerAbi,
        client: getPublicClient(),
      })

      const probeSlot0 = await readPoolSlot0(probeManager, poolId)
      if (probeSlot0.sqrtPriceX96 === 0n) {
        throw new Error('Pool not initialized')
      }
    } catch (innerError) {
      const msg = extractErrorMessage(innerError).toLowerCase()
      if (msg.includes('pool') && msg.includes('initialized')) {
        const feeTiersTried = [
          ...(feeOverride !== undefined ? [feeOverride] : []),
          500,
          1000,
          3000,
          10000,
        ].filter((v, i, arr) => arr.indexOf(v) === i)
        throw new AppError(
          buildPoolNotFoundMessage(tokenIn, tokenOut, feeTiersTried),
          404,
          ERROR_CODES.NOT_FOUND
        )
      }
      throw innerError
    }

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
  pools: Array<{ token0: `0x${string}`; token1: `0x${string}`; fee?: number }>
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
      pools.map(async ({ token0, token1, fee }) => {
        try {
          const state = await getPoolState(token0, token1, fee)
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
// ERC20 ABI (minimal for allowance + approve)
// ============================================================================

const erc20Abi = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// ============================================================================
// Build Swap Transaction
// ============================================================================

export interface UnsignedTransaction {
  to: `0x${string}`
  data: `0x${string}`
  value: string
  chainId: number
  description: string
}

/**
 * Build unsigned swap transaction(s) for the user to sign.
 * Returns an ordered array of transactions:
 *   1. ERC20 approve (only if current allowance < amountIn)
 *   2. executeSwap call on the NaisuUniswapV4Swap contract
 */
export async function buildSwapTransaction(params: {
  sender: `0x${string}`
  tokenIn: `0x${string}`
  tokenOut: `0x${string}`
  amountIn: bigint
  minAmountOut: bigint
  fee?: number
  deadlineSeconds?: number
}): Promise<{
  transactions: UnsignedTransaction[]
  summary: {
    tokenIn: string
    tokenOut: string
    amountIn: string
    minAmountOut: string
    deadline: string
    swapContract: string
    needsApproval: boolean
  }
}> {
  const {
    sender,
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    fee = DEFAULT_FEE,
    deadlineSeconds = 3600,
  } = params

  try {
    const client = getPublicClient()
    const addresses = getContractAddresses()
    const chain = client.chain

    if (!chain) {
      throw new AppError('EVM client has no chain configured', 500, ERROR_CODES.INTERNAL_ERROR)
    }

    const swapAddress = addresses.swap
    const transactions: UnsignedTransaction[] = []

    // 1. Check current ERC20 allowance for the swap contract
    const currentAllowance = (await client.readContract({
      address: tokenIn,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [sender, swapAddress],
    })) as bigint

    const needsApproval = currentAllowance < amountIn

    if (needsApproval) {
      // Approve exactly the amount the user is swapping (no unlimited approval)
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [swapAddress, amountIn],
      })

      transactions.push({
        to: tokenIn,
        data: approveData,
        value: '0',
        chainId: chain.id,
        description: `Approve ${amountIn.toString()} wei for NaisuSwap`,
      })
    }

    // 2. Build executeSwap transaction
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds)

    const swapData = encodeFunctionData({
      abi: naisuUniswapV4SwapAbi,
      functionName: 'executeSwap',
      args: [tokenIn, tokenOut, amountIn, minAmountOut, deadline],
    })

    transactions.push({
      to: swapAddress,
      data: swapData,
      value: '0',
      chainId: chain.id,
      description: `Swap ${amountIn.toString()} of ${tokenIn} for ${tokenOut} (min output: ${minAmountOut.toString()})`,
    })

    return {
      transactions,
      summary: {
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString(),
        deadline: deadline.toString(),
        swapContract: swapAddress,
        needsApproval,
      },
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    logger.error({ error, params }, 'Failed to build swap transaction')
    throw new AppError('Failed to build swap transaction', 500, ERROR_CODES.INTERNAL_ERROR)
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
