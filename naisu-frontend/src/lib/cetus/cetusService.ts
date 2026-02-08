/**
 * Cetus Integration Service
 * Using Integration Package: 0x2918cf39850de6d5d94d8196dc878c8c722cd79db659318e00bff57fbb4e2ede
 */

import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";

// === CONSTANTS ===

// Integration Package (has public entry functions) - TESTNET version from working TX!
// Working TX: 6yYkroba6tBEUdQfembnM68sC1TGgNB6BefAc4mW4ari
export const CETUS_INTEGRATE_PACKAGE =
  "0xab2d58dd28ff0dc19b18ab2c634397b785a38c342a8f5065ade5f53f9dbffa1c";

// Core Package (works with ALL pools including legacy)
// This package was used in the working SUI/USDC transaction
export const CETUS_CORE_PACKAGE =
  "0x6bbdf09f9fa0baa1524080a5b8991042e95061c4e1206217279aec51ba08edf7";

// Global Config (from working SUI/USDC transaction)
export const CETUS_GLOBAL_CONFIG =
  "0xc6273f844b4bc258952c4e477697aa12c918c8e08106fac6b934811298c9820a";

// Factory Pools object — must match CORE package deployment (0x5372d555...)
// Old value 0x50eb61dd... was from a DIFFERENT deployment and caused TypeMismatch
export const CETUS_FACTORY =
  "0x20a086e6fa0741b3ca77d033a65faf0871349b986ddbdde6fa1d85d78a5f4222";

// Clock
export const SUI_CLOCK = "0x6";

// Tick Constants
// Cetus Max Tick is 443636. We use a slightly smaller number that is divisible by 60, 10, 2 etc.
export const MIN_TICK = -443520;
export const MAX_TICK = 443520;

/**
 * Convert signed tick (i32) to unsigned u32 for PTB encoding
 * Cetus uses i32 ticks, but Sui PTB requires u32 encoding
 * Negative numbers use two's complement representation
 */
export function tickToU32(tick: number): number {
  if (tick >= 0) {
    return tick;
  }
  // Two's complement: 2^32 + negative_tick
  return 4294967296 + tick;
}

// Coin Types
export const COIN_SUI = "0x2::sui::SUI";
export const COIN_USDC_CIRCLE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";
export const COIN_USDC_CETUS = "0x14a71d857b34677a7d57e0feb303df1adb515a37780645ab763d42ce8d1a5e48::usdc::USDC";

/**
 * Check if a coin type is SUI
 */
export function isSuiCoin(coinType: string): boolean {
  return coinType === COIN_SUI || coinType.endsWith("::sui::SUI");
}

/**
 * Get full range ticks for a pool
 * Aligns MIN_TICK and MAX_TICK to be multiples of tickSpacing
 */
export function getFullRangeTicks(tickSpacing: number): { tickLower: number; tickUpper: number } {
  // Ensure tickLower is a multiple of tickSpacing
  const tickLower = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;

  // Ensure tickUpper is a multiple of tickSpacing
  const tickUpper = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;

  return { tickLower, tickUpper };
}

// Popular Pools (Testnet)
// NOTE: Only pools created with compatible Cetus version work with Integration Package
export const CETUS_POOLS = {
  // MEME/SUI - WORKING
  MEME_SUI: {
    id: "0x9501ab9cc94da40151c28defbda9c12a4b244fe774d5c97700a86c6a2265546f",
    coinA:
      "0xf156ab04f762382cc6c842f4c99597b6df07a313309664f05f2141383aa9fa81::meme_coin::MEME_COIN",
    coinB: COIN_SUI,
    name: "MEME/SUI",
  },
  // USDC/ETH - WORKING
  USDC_ETH: {
    id: "0x86df52cc5640362bfcec7804986ebf9bf7611b3ed56a1970abb5d3999837c0d8",
    coinA:
      "0x14a71d857b34677a7d57e0feb303df1adb515a37780645ab763d42ce8d1a5e48::usdc::USDC",
    coinB:
      "0x60e1bfe10ee41a417a982f26bfc2137bf6e61269a87e57c5d4407627c7b2f8d::eth::ETH",
    name: "USDC/ETH",
  },
  // USDT/USDC - WORKING
  USDT_USDC: {
    id: "0x2dc1713be847f95b72da730463b1cd6120de3ad05a1ce8248cc3becc790dc9ce",
    coinA:
      "0x26b3bc67befc214058ca78ea9a2690298d731a2d4309485ec3d40198063c4abc::usdt::USDT",
    coinB:
      "0x14a71d857b34677a7d57e0feb303df1adb515a37780645ab763d42ce8d1a5e48::usdc::USDC",
    name: "USDT/USDC",
  },
  // SUI/USDC (NEW - WORKING!) - Compatible with Integration Package
  SUI_USDC: {
    id: "0xce144501b2e09fd9438e22397b604116a3874e137c8ae0c31144b45b2bf84f10",
    coinA:
      "0x14a71d857b34677a7d57e0feb303df1adb515a37780645ab763d42ce8d1a5e48::usdc::USDC",
    coinB: COIN_SUI,
    name: "SUI/USDC ✅",
  },
  // SUI/USDC (Legacy) - Works with CORE package, not Integration Package
  SUI_USDC_LEGACY: {
    id: "0x2603c08065a848b719f5f465e40dbef485ec4fd9c967ebe83a7565269a74a2b2",
    coinA:
      "0x14a71d857b34677a7d57e0feb303df1adb515a37780645ab763d42ce8d1a5e48::usdc::USDC",
    coinB: COIN_SUI,
    name: "SUI/USDC (Legacy)",
    isLegacy: true, // Flag to indicate this pool won't work
  },
  // Circle USDC / SUI — native Circle USDC on testnet (tick_spacing 200, skewed price)
  USDC_CIRCLE_SUI: {
    id: "0xc0b2d0d3ef3851f176235953616cd7799bede294a828ce3871ef110447859a78",
    coinA: COIN_USDC_CIRCLE,
    coinB: COIN_SUI,
    name: "USDC(Circle)/SUI [ts200]",
  },
  // Circle USDC / SUI — 1:1 price pool (tick_spacing 2)
  USDC_CIRCLE_SUI_1TO1: {
    id: "0x0b72395179f0f37759f9395ac2fb659bf2b924123864181161608d9dd1c5fa59",
    coinA: COIN_USDC_CIRCLE,
    coinB: COIN_SUI,
    name: "USDC(Circle)/SUI [1:1]",
  },
  // Circle USDC / SUI — 1 SUI = 20 USDC pool (tick_spacing 10)
  USDC_CIRCLE_SUI_20: {
    id: "0x396d6233b42fb8a58004e937bd3e9b37bf2626e7074aab179fc0eb1d6487cfae",
    coinA: COIN_USDC_CIRCLE,
    coinB: COIN_SUI,
    name: "USDC(Circle)/SUI [1:20]",
  },
};

/**
 * Get human-readable symbol for a coin type, labeling Circle USDC distinctly
 */
export function coinSymbol(coinType: string): string {
  if (coinType === COIN_USDC_CIRCLE) return "USDC(Circle)";
  if (coinType === COIN_USDC_CETUS) return "USDC(Cetus)";
  return coinType.split("::").pop() || "?";
}

// === TYPES ===

export interface PoolInfo {
  id: string;
  coinA: string;
  coinB: string;
  name: string;
  tickSpacing?: number;
  currentTick?: number;
  liquidity?: string;
  currentSqrtPrice?: string;
  isPause?: boolean;
}

export interface PositionInfo {
  id: string;
  poolId: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
}

// === HELPER FUNCTIONS ===

/**
 * Calculate tick range around current tick
 * 
 * Cetus ticks are i32 (signed). When stored as u32 in BCS,
 * negative values use two's complement representation.
 * 
 * Valid tick range must be:
 * - tickLower < tickUpper
 * - Both must be multiples of tickSpacing
 * - Must be within [-443636, 443636] (MAX_TICK)
 */
export function calculateTickRange(
  currentTick: number,
  tickSpacing: number,
  rangeMultiplier: number = 20
): { tickLower: number; tickUpper: number } {
  // Handle negative currentTick (convert from bits if needed)
  let actualCurrentTick = currentTick;
  if (currentTick > 2_000_000_000) {
    actualCurrentTick = currentTick - 4_294_967_296;
  }

  const MIN_TICK = -443636;
  const MAX_TICK = 443636;

  // Use smaller range for safer execution (local range around current price)
  const tickRange = tickSpacing * rangeMultiplier;

  // 1. Calculate raw target ticks
  let rawLower = actualCurrentTick - tickRange;
  let rawUpper = actualCurrentTick + tickRange;

  // 2. Clamp raw values to global limits FIRST
  rawLower = Math.max(MIN_TICK, rawLower);
  rawUpper = Math.min(MAX_TICK, rawUpper);

  // 3. Align to tickSpacing (Round INWARDS to safe zone)
  // For Lower: Ceil deals with negative numbers effectively to keep it "higher" (more positive) or use Floor?
  // We want tickLower to be a multiple.
  // floor(x / spacing) * spacing is the standard "snap to grid" which rounds down.

  let tickLower = Math.floor(rawLower / tickSpacing) * tickSpacing;
  let tickUpper = Math.ceil(rawUpper / tickSpacing) * tickSpacing;

  // 4. Final Clamp check to ensure alignment didn't push out of bounds
  // If tickLower < MIN_TICK after alignment, move it UP to next multiple
  if (tickLower < MIN_TICK) {
    tickLower = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;
  }
  // If tickUpper > MAX_TICK after alignment, move it DOWN to previous multiple
  if (tickUpper > MAX_TICK) {
    tickUpper = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
  }

  // 5. Ensure Lower < Upper
  if (tickLower >= tickUpper) {
    tickUpper = tickLower + tickSpacing;
  }

  // 6. Security double-check: if Upper is still > MAX (rare edge case with spacing)
  if (tickUpper > MAX_TICK) {
    tickUpper = tickLower; // Collapse or invalid
    tickLower = tickUpper - tickSpacing;
  }

  return { tickLower, tickUpper };
}

/**
 * Fetch pool info from chain
 */
export async function fetchPoolInfo(
  client: SuiClient,
  poolId: string
): Promise<PoolInfo | null> {
  try {
    const poolObj = await client.getObject({
      id: poolId,
      options: { showType: true, showContent: true },
    });

    if (!poolObj.data) return null;

    const content = poolObj.data.content as any;
    const fields = content?.fields;

    // Log raw pool type for debugging
    const rawType = poolObj.data.type;
    console.log("🔎 Raw pool type:", rawType);

    // Parse type to get coin types
    // Format: 0x...::pool::Pool<CoinTypeA, CoinTypeB>
    const typeMatch = rawType?.match(
      /Pool<([^,]+),\s*([^>]+)>/
    );

    const coinA = typeMatch?.[1]?.trim() || "";
    const coinB = typeMatch?.[2]?.trim() || "";

    console.log("🔎 Extracted coin types:", { coinA, coinB });

    // Convert u32 bits to signed i32 for currentTick
    const rawBits = fields?.current_tick_index?.fields?.bits;
    const currentTick = rawBits !== undefined && rawBits >= 2 ** 31 ? rawBits - 2 ** 32 : rawBits;

    return {
      id: poolId,
      coinA,
      coinB,
      name: "",
      tickSpacing: fields?.tick_spacing,
      currentTick,
      liquidity: fields?.liquidity,
      currentSqrtPrice: fields?.current_sqrt_price,
      isPause: fields?.is_pause,
    };
  } catch (e) {
    console.error("Failed to fetch pool info:", e);
    return null;
  }
}

// === TRANSACTION BUILDERS ===

/**
 * Build swap transaction (SUI -> CoinA)
 * Uses router::swap from integration package
 */
export function buildSwapTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinInType: string;
    coinOutType: string;
    amountIn: bigint;
    aToB: boolean; // true = A->B, false = B->A (SUI is usually B)
    byAmountIn: boolean;
    slippage: number;
  },
  accountAddress: string
): Transaction {
  const { poolId, coinInType, coinOutType, amountIn, aToB, byAmountIn } =
    params;

  console.log("🏗️ buildSwapTx PARAMS:", {
    package: CETUS_INTEGRATE_PACKAGE,
    config: CETUS_GLOBAL_CONFIG,
    poolId,
    coinInType,
    coinOutType,
    amountIn: amountIn.toString(),
    aToB,
    byAmountIn,
  });

  // Split coin for input
  const [coinIn] = tx.splitCoins(tx.gas, [tx.pure.u64(amountIn)]);

  // Create empty output coin
  const coinOut = tx.moveCall({
    target: "0x2::coin::zero",
    typeArguments: [aToB ? coinOutType : coinInType],
  });

  // Price limit (max for the direction)
  const MAX_SQRT_PRICE = "79226673515401279992447579055";
  const MIN_SQRT_PRICE = "4295048016";
  const sqrtPriceLimit = aToB ? MIN_SQRT_PRICE : MAX_SQRT_PRICE;

  console.log("🔧 Calling router::swap with:", {
    target: `${CETUS_INTEGRATE_PACKAGE}::router::swap`,
    typeArguments: [coinOutType, coinInType],
  });

  // Call router::swap
  const [resultOut, resultIn] = tx.moveCall({
    target: `${CETUS_INTEGRATE_PACKAGE}::router::swap`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      aToB ? coinIn : coinOut, // coin_a (input if a_to_b)
      aToB ? coinOut : coinIn, // coin_b (input if !a_to_b)
      tx.pure.bool(aToB), // a_to_b
      tx.pure.bool(byAmountIn), // by_amount_in
      tx.pure.u64(amountIn), // amount
      tx.pure.u128(BigInt(sqrtPriceLimit)), // sqrt_price_limit
      tx.pure.bool(false), // is_exact_in
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinOutType, coinInType],
  });

  // Transfer results back
  tx.transferObjects([resultOut, resultIn], tx.pure.address(accountAddress));

  return tx;
}

/**
 * Build open position transaction (empty position)
 * Uses pool_script::open_position
 * 
 * NOTE: Entry function - handles transfer internally
 */
export function buildOpenPositionTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    tickLower: number;
    tickUpper: number;
  },
  _accountAddress: string // Not needed for entry function
): Transaction {
  const { poolId, coinA, coinB, tickLower, tickUpper } = params;

  console.log("🏗️ buildOpenPositionTx params:", {
    poolId,
    coinA,
    coinB,
    tickLower,
    tickUpper,
    tickLowerU32: tickToU32(tickLower),
    tickUpperU32: tickToU32(tickUpper),
  });

  // Entry function - handles transfer internally
  // Convert signed ticks to u32 (two's complement for negative values)
  tx.moveCall({
    target: `${CETUS_INTEGRATE_PACKAGE}::pool_script::open_position`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.pure.u32(tickToU32(tickLower)),
      tx.pure.u32(tickToU32(tickUpper)),
    ],
    typeArguments: [coinA, coinB],
  });

  return tx;
}

/**
 * Build open position transaction using CORE CLMM package (empty position)
 * Uses core package pool::open_position - works with ALL pools including legacy!
 *
 * NOTE: This is NOT an entry function - returns Position NFT that must be transferred
 */
export function buildOpenPositionCoreTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    tickLower: number;
    tickUpper: number;
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, tickLower, tickUpper } = params;

  console.log("🏗️ buildOpenPositionCoreTx (CORE package) params:", {
    poolId,
    coinA,
    coinB,
    tickLower,
    tickUpper,
  });

  // Call pool::open_position from CORE package
  // This returns a Position NFT
  const position = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::open_position`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.pure.u32(tickLower),  // Already positive ticks from working tx
      tx.pure.u32(tickUpper),
    ],
    typeArguments: [coinA, coinB],
  });

  // Transfer position NFT to user
  tx.transferObjects([position], tx.pure.address(accountAddress));

  return tx;
}

/**
 * Build open position + add liquidity using CORE package
 * Opens position and adds liquidity in ONE transaction (works with legacy pools!)
 *
 * NOTE: Both are NOT entry functions - returns Position NFT that must be transferred
 */
export function buildOpenPositionWithLiquidityCoreTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    tickLower: number;
    tickUpper: number;
    coinAAmount: bigint;
    coinBAmount: bigint;
    fixAmountA: boolean;
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, tickLower, tickUpper, coinAAmount, coinBAmount, fixAmountA } = params;

  console.log("🏗️ buildOpenPositionWithLiquidityCoreTx (CORE package) params:", {
    poolId,
    coinA,
    coinB,
    tickLower,
    tickUpper,
    coinAAmount: coinAAmount.toString(),
    coinBAmount: coinBAmount.toString(),
    fixAmountA,
  });

  // Step 1: Open position (returns Position NFT)
  const position = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::open_position`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.pure.u32(tickLower),
      tx.pure.u32(tickUpper),
    ],
    typeArguments: [coinA, coinB],
  });

  // Step 2: Prepare coins
  let coinAObj, coinBObj;

  if (coinAAmount > 0n && isSuiCoin(coinA)) {
    [coinAObj] = tx.splitCoins(tx.gas, [tx.pure.u64(coinAAmount)]);
  } else if (coinAAmount > 0n) {
    // For non-SUI coins, they should be provided separately
    // For now, create zero coin
    coinAObj = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [coinA],
    });
  } else {
    coinAObj = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [coinA],
    });
  }

  if (coinBAmount > 0n && isSuiCoin(coinB)) {
    [coinBObj] = tx.splitCoins(tx.gas, [tx.pure.u64(coinBAmount)]);
  } else if (coinBAmount > 0n) {
    coinBObj = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [coinB],
    });
  } else {
    coinBObj = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [coinB],
    });
  }

  // Step 3: Add liquidity to the position we just opened
  const [leftoverA, leftoverB] = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::add_liquidity`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      position,  // Use the position we just created!
      coinAObj,
      coinBObj,
      tx.pure.u64(coinAAmount),
      tx.pure.u64(coinBAmount),
      tx.pure.bool(fixAmountA),
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  // Step 4: Transfer everything back
  tx.transferObjects([position, leftoverA, leftoverB], tx.pure.address(accountAddress));

  return tx;
}

/**
 * Build open position + add liquidity (single coin A)
 * Uses pool_script::open_position_with_liquidity_only_a
 */
export function buildOpenPositionWithLiquidityATx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    tickLower: number;
    tickUpper: number;
    coinAObjectId: string;
    amountA: bigint;
  },
  accountAddress: string
): Transaction {
  const {
    poolId,
    coinA,
    coinB,
    tickLower,
    tickUpper,
    coinAObjectId,
    amountA,
  } = params;

  // Convert signed ticks to u32 (two's complement for negative values)
  const position = tx.moveCall({
    target: `${CETUS_INTEGRATE_PACKAGE}::pool_script::open_position_with_liquidity_only_a`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.pure.u32(tickToU32(tickLower)),
      tx.pure.u32(tickToU32(tickUpper)),
      tx.makeMoveVec({ elements: [tx.object(coinAObjectId)] }), // coins_a vector
      tx.pure.u64(amountA), // amount_a
      tx.pure.bool(true), // fix_amount_a
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  // Transfer position NFT to user
  tx.transferObjects([position], tx.pure.address(accountAddress));

  return tx;
}

/**
 * Build open position + add liquidity (single coin B - usually SUI)
 * Uses pool_script_v2::open_position_with_liquidity_by_fix_coin (from successful tx)
 * 
 * NOTE: This is an ENTRY function - it handles transfer internally!
 * No need to capture result or pass ctx.
 */
export function buildOpenPositionWithLiquidityBTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    tickLower: number;
    tickUpper: number;
    amountB: bigint; // Amount of coin B (SUI)
  },
  _accountAddress: string // Not needed for entry function
): Transaction {
  const { poolId, coinA, coinB, tickLower, tickUpper, amountB } = params;

  // Split SUI from gas for coin B
  const [coinBObj] = tx.splitCoins(tx.gas, [tx.pure.u64(amountB)]);

  // Create empty coin A (zero)
  const coinAZero = tx.moveCall({
    target: "0x2::coin::zero",
    typeArguments: [coinA],
  });

  // Entry function - no return value, handles transfer internally
  // Convert signed ticks to u32 (two's complement for negative values)
  tx.moveCall({
    target: `${CETUS_INTEGRATE_PACKAGE}::pool_script_v2::open_position_with_liquidity_by_fix_coin`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.pure.u32(tickToU32(tickLower)),
      tx.pure.u32(tickToU32(tickUpper)),
      coinAZero,           // coin_a (empty/zero)
      coinBObj,            // coin_b (SUI)
      tx.pure.u64(0),      // amount_a (0 since we're fixing B)
      tx.pure.u64(amountB),// amount_b
      tx.pure.bool(false), // fix_amount_a (false = fix B)
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });


  return tx;
}

/**
 * Build Zap transaction (Single-Sided Liquidity)
 * 1. Swap ~50% of Input Token -> Other Token
 * 2. Add Liquidity (Open Position) with both tokens
 */
export function buildZapTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    tickLower: number; // calculated externally or passed
    tickUpper: number; // calculated externally or passed
    inputToken: string;
    amountIn: bigint;
    slippage: number;
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, tickLower, tickUpper, inputToken, amountIn, slippage: _slippage } = params;

  // Detect direction
  const isInputA = inputToken === coinA;
  const isInputB = inputToken === coinB;

  if (!isInputA && !isInputB) {
    throw new Error("Input token must be one of the pool tokens");
  }

  // 1. Calculate Swap Amount (approx 50%)
  // Ideally this should be calculated based on price range, but 50% is a safe default for full range or symmetric range
  const swapAmount = amountIn / 2n;
  // Reduce liquidity amount by 2% to account for swap fees and slippage on the other side
  // This ensures we don't demand more of the swapped token than we received.
  const liquidityAmount = (amountIn - swapAmount) * 98n / 100n;

  console.log("⚡ buildZapTx params:", {
    poolId,
    inputToken: inputToken.split("::").pop(),
    amountIn: amountIn.toString(),
    swapAmount: swapAmount.toString(),
    liquidityAmount: liquidityAmount.toString(),
    isInputA,
  });

  // 2. Prepare Swap Input (Split coin)
  // Initialize with a placeholder to satisfy TS, though we throw if not set for now
  let swapCoinInput: any = tx.gas; // Default to gas (will be overwritten if SUI)

  if (isSuiCoin(inputToken)) {
    [swapCoinInput] = tx.splitCoins(tx.gas, [tx.pure.u64(swapAmount)]);
  } else {
    // For now assuming inputToken is already available as object/coin in caller buffer
    // BUT since we start from "wallet balance", we need to assume caller will provide it or we split from gas if SUI
    // For non-SUI tokens, we'll need to adopt a different strategy (merge all coins -> split).
    // For this implementation, we assume buildZapTx is called properly with a split coin or we handle SUI specifically.
    // If input is non-SUI, we might need the caller to provide the object ID or handle splitting differently.
    // To simplify: We'll implement SUI-Zap first (Zap SUI -> SUI/USDC)
    if (!isSuiCoin(inputToken)) {
      throw new Error("Zap currently supports SUI as input only for simplicity. Please implement coin selection.");
    }
  }

  // 3. Swap: Input (50%) -> Other Token
  // We can reuse buildSwapTx logic but implemented inline to chain the output
  const aToB = isInputA; // If input is A, we swap A->B
  const coinOutType = isInputA ? coinB : coinA;

  // Create empty output coin placeholder
  const swapCoinOut = tx.moveCall({
    target: "0x2::coin::zero",
    typeArguments: [coinOutType],
  });

  const MAX_SQRT_PRICE = "79226673515401279992447579055";
  const MIN_SQRT_PRICE = "4295048016";
  const sqrtPriceLimit = aToB ? MIN_SQRT_PRICE : MAX_SQRT_PRICE;

  const [swappedA, swappedB] = tx.moveCall({
    target: `${CETUS_INTEGRATE_PACKAGE}::router::swap`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      aToB ? swapCoinInput : swapCoinOut, // coin_a
      aToB ? swapCoinOut : swapCoinInput, // coin_b
      tx.pure.bool(aToB),
      tx.pure.bool(true), // by_amount_in
      tx.pure.u64(swapAmount),
      tx.pure.u128(BigInt(sqrtPriceLimit)),
      tx.pure.bool(false),
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  // 4. Prepare Liquidity Inputs
  // We have:
  // - liquidityAmount of Input Token (remaining half)
  // - swapped result (Other Token)

  let coinAObj, coinBObj;

  if (isInputA) {
    // Input was A. We swapped A->B.
    // We have leftover A (liquidityAmount) + Result B (swappedB)

    // Split remaining A from gas (assuming SUI input)
    // If not SUI, we'd need to handle coin merging/splitting earlier
    [coinAObj] = tx.splitCoins(tx.gas, [tx.pure.u64(liquidityAmount)]);
    coinBObj = swappedB;
  } else {
    // Input was B (e.g. SUI). We swapped B->A.
    // We have leftover B (liquidityAmount) + Result A (swappedA)

    // Split remaining B from gas (assuming SUI input)
    [coinBObj] = tx.splitCoins(tx.gas, [tx.pure.u64(liquidityAmount)]);
    coinAObj = swappedA;
  }

  // 5. Open Liquidity Position with ALL available coins
  // We use `pool_script_v2::open_position_with_liquidity_by_fix_coin`
  //
  // STRATEGY: Fix the INPUT side (which we KNOW exactly), not the swapped side.
  // - If input = A: fix_amount_a = TRUE, pass liquidityAmount as amount_a
  // - If input = B: fix_amount_a = FALSE, pass liquidityAmount as amount_b
  //
  // The pool will:
  // 1. Use our known input amount to calculate required liquidity
  // 2. Take the needed amount from the swapped coin
  // 3. Return any excess as leftover (which we transfer back)
  //
  // Pass swapAmount as rough hint for the other side (pool ignores if actual coin has less)

  tx.moveCall({
    target: `${CETUS_INTEGRATE_PACKAGE}::pool_script_v2::open_position_with_liquidity_by_fix_coin`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.pure.u32(tickToU32(tickLower)),
      tx.pure.u32(tickToU32(tickUpper)),
      coinAObj,
      coinBObj,
      tx.pure.u64(isInputA ? liquidityAmount : swapAmount), // amount_a hint
      tx.pure.u64(isInputB ? liquidityAmount : swapAmount), // amount_b hint
      tx.pure.bool(isInputA), // fix_amount_a = fix the INPUT side (which we know exactly)
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  // Transfer any dust (from swap result) back to user
  // router::swap returns (Coin<A>, Coin<B>)
  // If we swapped A->B: swappedA contains change (should be 0), swappedB was used for liquidity
  // The open_position function consumes the coins but may leave dust
  if (isInputA) {
    tx.transferObjects([swappedA], tx.pure.address(accountAddress)); // Dust A from swap
  } else {
    tx.transferObjects([swappedB], tx.pure.address(accountAddress)); // Dust B from swap
  }

  return tx;
}
/**
 * Build open position + add liquidity with SUI (auto-detect if SUI is coinA or coinB)
 * This is a smarter version that handles both cases
 */
export function buildOpenPositionWithSuiLiquidity(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    tickLower: number;
    tickUpper: number;
    amountSui: bigint;
  }
): Transaction {
  const { poolId, coinA, coinB, tickLower, tickUpper, amountSui } = params;

  const suiIsCoinA = isSuiCoin(coinA);
  const suiIsCoinB = isSuiCoin(coinB);

  console.log("🏗️ buildOpenPositionWithSuiLiquidity PARAMS:", {
    package: CETUS_INTEGRATE_PACKAGE,
    poolId,
    coinA: coinA.split("::").pop(),
    coinB: coinB.split("::").pop(),
    tickLower,
    tickUpper,
    tickRange: tickUpper - tickLower,
    amountSui: amountSui.toString(),
    suiIsCoinA,
    suiIsCoinB,
  });

  console.log("🔍 SUI position detection:", { coinA, coinB, suiIsCoinA, suiIsCoinB });

  if (!suiIsCoinA && !suiIsCoinB) {
    throw new Error("This pool doesn't contain SUI. Cannot add SUI liquidity.");
  }

  // Split SUI from gas
  const [suiCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountSui)]);

  if (suiIsCoinA) {
    // SUI is coinA - use fix_amount_a = true
    console.log("📍 SUI is CoinA - using fix_amount_a=true");

    // Create zero coin for coinB
    const coinBZero = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [coinB],
    });

    tx.moveCall({
      target: `${CETUS_INTEGRATE_PACKAGE}::pool_script_v2::open_position_with_liquidity_by_fix_coin`,
      arguments: [
        tx.object(CETUS_GLOBAL_CONFIG),
        tx.object(poolId),
        tx.pure.u32(tickToU32(tickLower)),
        tx.pure.u32(tickToU32(tickUpper)),
        suiCoin,             // coin_a (SUI)
        coinBZero,           // coin_b (zero)
        tx.pure.u64(amountSui), // amount_a
        tx.pure.u64(0),      // amount_b (0 since we're fixing A)
        tx.pure.bool(true),  // fix_amount_a (true = fix A which is SUI)
        tx.object(SUI_CLOCK),
      ],
      typeArguments: [coinA, coinB],
    });
  } else {
    // SUI is coinB - use fix_amount_a = false
    console.log("📍 SUI is CoinB - using fix_amount_a=false");

    // Create zero coin for coinA
    const coinAZero = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [coinA],
    });

    tx.moveCall({
      target: `${CETUS_INTEGRATE_PACKAGE}::pool_script_v2::open_position_with_liquidity_by_fix_coin`,
      arguments: [
        tx.object(CETUS_GLOBAL_CONFIG),
        tx.object(poolId),
        tx.pure.u32(tickToU32(tickLower)),
        tx.pure.u32(tickToU32(tickUpper)),
        coinAZero,           // coin_a (zero)
        suiCoin,             // coin_b (SUI)
        tx.pure.u64(0),      // amount_a (0 since we're fixing B)
        tx.pure.u64(amountSui), // amount_b
        tx.pure.bool(false), // fix_amount_a (false = fix B which is SUI)
        tx.object(SUI_CLOCK),
      ],
      typeArguments: [coinA, coinB],
    });
  }

  return tx;
}

/**
 * Build add liquidity to existing position (only coin A)
 * Uses pool_script::add_liquidity_only_a
 */
export function buildAddLiquidityOnlyATx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    positionId: string;
    coinAObjectId: string;
    amountA: bigint;
  }
): Transaction {
  const { poolId, coinA, coinB, positionId, coinAObjectId, amountA } = params;

  tx.moveCall({
    target: `${CETUS_INTEGRATE_PACKAGE}::pool_script::add_liquidity_only_a`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.object(positionId),
      tx.makeMoveVec({ elements: [tx.object(coinAObjectId)] }),
      tx.pure.u64(amountA),
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  return tx;
}

/**
 * Build add liquidity to existing position (only coin B - SUI)
 * Uses pool_script::add_liquidity_only_b
 * 
 * NOTE: Entry function - no return value
 */
export function buildAddLiquidityOnlyBTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    positionId: string;
    amountB: bigint;
    deltaLiquidity?: bigint;
  }
): Transaction {
  const { poolId, coinA, coinB, positionId, amountB, deltaLiquidity = 0n } = params;

  // Split SUI from gas
  const [coinBObj] = tx.splitCoins(tx.gas, [tx.pure.u64(amountB)]);

  // Entry function - no return value
  tx.moveCall({
    target: `${CETUS_INTEGRATE_PACKAGE}::pool_script::add_liquidity_only_b`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.object(positionId),
      tx.makeMoveVec({ elements: [coinBObj] }),
      tx.pure.u64(amountB),
      tx.pure.u128(deltaLiquidity),
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  return tx;
}

/**
 * Build close position transaction
 * Uses pool_script::close_position
 * 
 * NOTE: Entry function - no return value
 */
export function buildClosePositionTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    positionId: string;
  }
): Transaction {
  const { poolId, coinA, coinB, positionId } = params;

  // Entry function - no return value
  tx.moveCall({
    target: `${CETUS_INTEGRATE_PACKAGE}::pool_script::close_position`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.object(positionId),
    ],
    typeArguments: [coinA, coinB],
  });

  return tx;
}

/**
 * Build add liquidity using CORE package (works with ALL pools!)
 * Uses core package pool::add_liquidity - returns leftover coins
 *
 * NOTE: This is NOT an entry function - returns leftover coins that must be transferred
 */
export function buildAddLiquidityCoreTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    positionId: string;
    amountA: bigint;  // Amount of coinA to add
    amountB: bigint;  // Amount of coinB to add (can be 0)
    fixAmountA: boolean; // true = fix coinA, false = fix coinB
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, positionId, amountA, amountB, fixAmountA } = params;

  console.log("🏗️ buildAddLiquidityCoreTx (CORE package) params:", {
    poolId,
    coinA,
    coinB,
    positionId,
    amountA: amountA.toString(),
    amountB: amountB.toString(),
    fixAmountA,
  });

  // Prepare coin inputs
  let coinAObj, coinBObj;

  if (amountA > 0n) {
    // Check if coinA is SUI
    if (isSuiCoin(coinA)) {
      [coinAObj] = tx.splitCoins(tx.gas, [tx.pure.u64(amountA)]);
    } else {
      // For non-SUI coins (like USDC), we need the user to provide the coin object
      // For now, we'll throw an error and require the coin object ID
      throw new Error("For non-SUI coins, please use buildAddLiquidityCoreWithCoinTx");
    }
  } else {
    coinAObj = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [coinA],
    });
  }

  if (amountB > 0n) {
    if (isSuiCoin(coinB)) {
      [coinBObj] = tx.splitCoins(tx.gas, [tx.pure.u64(amountB)]);
    } else {
      throw new Error("For non-SUI coins, please use buildAddLiquidityCoreWithCoinTx");
    }
  } else {
    coinBObj = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [coinB],
    });
  }

  // Call pool::add_liquidity from CORE package
  // Returns [Coin<CoinA>, Coin<CoinB>] (leftover coins)
  const [leftoverA, leftoverB] = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::add_liquidity`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.object(positionId),
      coinAObj,
      coinBObj,
      tx.pure.u64(amountA),
      tx.pure.u64(amountB),
      tx.pure.bool(fixAmountA),
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  // Transfer leftover coins back to user
  tx.transferObjects([leftoverA, leftoverB], tx.pure.address(accountAddress));

  return tx;
}

/**
 * Build add liquidity using CORE package with explicit coin objects
 * For adding non-SUI coins like USDC
 */
export function buildAddLiquidityCoreWithCoinTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    positionId: string;
    coinAObjectIds?: string[];  // Coin objects for coinA (if adding coinA)
    coinBObjectIds?: string[];  // Coin objects for coinB (if adding coinB)
    amountA: bigint;
    amountB: bigint;
    fixAmountA: boolean;
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, positionId, coinAObjectIds, coinBObjectIds, amountA, amountB, fixAmountA } = params;

  console.log("🏗️ buildAddLiquidityCoreWithCoinTx (CORE package) params:", {
    poolId,
    positionId,
    amountA: amountA.toString(),
    amountB: amountB.toString(),
    fixAmountA,
  });

  // Prepare coin inputs
  let coinAObj, coinBObj;

  // Handle CoinA
  if (amountA > 0n && coinAObjectIds && coinAObjectIds.length > 0) {
    if (coinAObjectIds.length === 1) {
      coinAObj = tx.object(coinAObjectIds[0]);
    } else {
      // Merge multiple coins
      const primaryCoin = tx.object(coinAObjectIds[0]);
      const coinsToMerge = coinAObjectIds.slice(1).map(id => tx.object(id));
      tx.mergeCoins(primaryCoin, coinsToMerge);
      coinAObj = primaryCoin;
    }
  } else if (amountA > 0n && isSuiCoin(coinA)) {
    [coinAObj] = tx.splitCoins(tx.gas, [tx.pure.u64(amountA)]);
  } else {
    coinAObj = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [coinA],
    });
  }

  // Handle CoinB
  if (amountB > 0n && coinBObjectIds && coinBObjectIds.length > 0) {
    if (coinBObjectIds.length === 1) {
      coinBObj = tx.object(coinBObjectIds[0]);
    } else {
      const primaryCoin = tx.object(coinBObjectIds[0]);
      const coinsToMerge = coinBObjectIds.slice(1).map(id => tx.object(id));
      tx.mergeCoins(primaryCoin, coinsToMerge);
      coinBObj = primaryCoin;
    }
  } else if (amountB > 0n && isSuiCoin(coinB)) {
    [coinBObj] = tx.splitCoins(tx.gas, [tx.pure.u64(amountB)]);
  } else {
    coinBObj = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [coinB],
    });
  }

  // Call pool::add_liquidity from CORE package
  const [leftoverA, leftoverB] = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::add_liquidity`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.object(positionId),
      coinAObj,
      coinBObj,
      tx.pure.u64(amountA),
      tx.pure.u64(amountB),
      tx.pure.bool(fixAmountA),
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  // Transfer leftover coins back to user
  tx.transferObjects([leftoverA, leftoverB], tx.pure.address(accountAddress));

  return tx;
}

/**
 * Build collect fee transaction
 * Uses pool_script_v3::collect_fee
 */
export function buildCollectFeeTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    positionId: string;
    coinAObjectId: string; // Empty coin object to receive fees
    coinBObjectId: string; // Empty coin object to receive fees
  },
  _accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, positionId, coinAObjectId, coinBObjectId } =
    params;

  tx.moveCall({
    target: `${CETUS_INTEGRATE_PACKAGE}::pool_script_v3::collect_fee`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.object(positionId),
      tx.object(coinAObjectId),
      tx.object(coinBObjectId),
    ],
    typeArguments: [coinA, coinB],
  });

  return tx;
}
