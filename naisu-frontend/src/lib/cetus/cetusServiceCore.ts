/**
 * Cetus CORE CLMM Service
 * Uses ONLY the CORE package (0x6bbdf09f...) — works with ALL pools including legacy.
 *
 * Key difference from cetusService.ts:
 * - CORE functions are `public` (not `entry`) — they return Balance<T> instead of Coin<T>
 * - Must use coin::from_balance / coin::into_balance for conversions
 * - Flash swap pattern: flash_swap → repay_flash_swap (receipt is non-droppable)
 * - Add liquidity receipt pattern: add_liquidity_fix_coin → add_liquidity_pay_amount → repay_add_liquidity
 *
 * IMPORTANT: CORE pool::add_liquidity has 5 args (config, pool, position, delta_liquidity, clock)
 * NOT the 9-arg version from the integration package. Always use the receipt pattern instead.
 */

import { Transaction } from "@mysten/sui/transactions";

// Re-export shared constants and helpers from cetusService
export {
  CETUS_CORE_PACKAGE,
  CETUS_GLOBAL_CONFIG,
  CETUS_FACTORY,
  SUI_CLOCK,
  CETUS_POOLS,
  COIN_SUI,
  COIN_USDC_CIRCLE,
  COIN_USDC_CETUS,
  coinSymbol,
  MIN_TICK,
  MAX_TICK,
  tickToU32,
  isSuiCoin,
  getFullRangeTicks,
  calculateTickRange,
  fetchPoolInfo,
  // Only re-export the open_position builder (it works — no add_liquidity involved)
  buildOpenPositionCoreTx,
} from "./cetusService";

import {
  CETUS_CORE_PACKAGE,
  CETUS_GLOBAL_CONFIG,
  CETUS_FACTORY,
  SUI_CLOCK,
  isSuiCoin,
  tickToU32,
} from "./cetusService";

// Sui framework package
const SUI_FRAMEWORK = "0x2";

// Price limits for swap direction
const MAX_SQRT_PRICE = "79226673515401279992447579055";
const MIN_SQRT_PRICE = "4295048016";

// ============================================================
// HELPER: Add liquidity via receipt pattern (used by multiple builders)
// ============================================================

/**
 * Internal helper: add liquidity to a position using the CORE receipt pattern.
 *
 * Flow:
 * 1. add_liquidity_fix_coin(config, pool, position, amount, fix_amount_a, clock) → receipt
 * 2. add_liquidity_pay_amount(&receipt) → (needA, needB)
 * 3. Split exact needA / needB from coin sources → into_balance
 * 4. repay_add_liquidity(config, pool, balA, balB, receipt)
 *
 * The key insight: PTB can chain MoveCall results as arguments to splitCoins,
 * so we use the (u64, u64) return from add_liquidity_pay_amount as exact split amounts.
 *
 * @param position - TransactionArgument (Position NFT, can be from open_position result)
 * @param coinASource - TransactionArgument for non-SUI coinA (pre-merged coin, or null to use gas)
 * @param coinBSource - TransactionArgument for non-SUI coinB (pre-merged coin, or null to use gas)
 */
function _addLiquidityReceipt(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    position: any; // TransactionArgument
    amount: bigint;
    fixAmountA: boolean;
    coinASource?: any; // Pre-merged coin for non-SUI coinA (optional)
    coinBSource?: any; // Pre-merged coin for non-SUI coinB (optional)
  },
  accountAddress: string
) {
  const { poolId, coinA, coinB, position, amount, fixAmountA, coinASource, coinBSource } = params;

  // Step 1: add_liquidity_fix_coin → receipt
  const receipt = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::add_liquidity_fix_coin`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      position, // &mut Position
      tx.pure.u64(amount),
      tx.pure.bool(fixAmountA),
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  // Step 2: Get exact required amounts from receipt
  const [needA, needB] = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::add_liquidity_pay_amount`,
    arguments: [receipt],
    typeArguments: [coinA, coinB],
  });

  // Step 3: Prepare exact payment balances
  // Priority: explicit coinSource FIRST → fallback to gas for SUI → zero
  let balA: any;
  if (coinASource) {
    const [coinASplit] = tx.splitCoins(coinASource, [needA]);
    balA = tx.moveCall({
      target: `${SUI_FRAMEWORK}::coin::into_balance`,
      arguments: [coinASplit],
      typeArguments: [coinA],
    });
  } else if (isSuiCoin(coinA)) {
    const [coinASplit] = tx.splitCoins(tx.gas, [needA]);
    balA = tx.moveCall({
      target: `${SUI_FRAMEWORK}::coin::into_balance`,
      arguments: [coinASplit],
      typeArguments: [coinA],
    });
  } else {
    // No source provided — provide zero balance (will fail if needA > 0)
    balA = tx.moveCall({
      target: `${SUI_FRAMEWORK}::balance::zero`,
      typeArguments: [coinA],
    });
  }

  let balB: any;
  if (coinBSource) {
    const [coinBSplit] = tx.splitCoins(coinBSource, [needB]);
    balB = tx.moveCall({
      target: `${SUI_FRAMEWORK}::coin::into_balance`,
      arguments: [coinBSplit],
      typeArguments: [coinB],
    });
  } else if (isSuiCoin(coinB)) {
    const [coinBSplit] = tx.splitCoins(tx.gas, [needB]);
    balB = tx.moveCall({
      target: `${SUI_FRAMEWORK}::coin::into_balance`,
      arguments: [coinBSplit],
      typeArguments: [coinB],
    });
  } else {
    balB = tx.moveCall({
      target: `${SUI_FRAMEWORK}::balance::zero`,
      typeArguments: [coinB],
    });
  }

  // Step 4: Repay (consumes receipt + exact balances)
  tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::repay_add_liquidity`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      balA,
      balB,
      receipt,
    ],
    typeArguments: [coinA, coinB],
  });

  // Transfer leftover coins back (they were split from, not consumed entirely)
  // Transfer ALL explicit sources — including SUI-type ones from e.g. flash_swap output
  if (coinASource) {
    tx.transferObjects([coinASource], tx.pure.address(accountAddress));
  }
  if (coinBSource) {
    tx.transferObjects([coinBSource], tx.pure.address(accountAddress));
  }
}

// ============================================================
// SWAP
// ============================================================

/**
 * Build swap transaction using CORE flash_swap pattern
 *
 * PTB flow:
 * 1. Split coin → coin::into_balance → create input balance
 * 2. pool::flash_swap → [balanceAOut, balanceBOut, receipt]
 * 3. Prepare repayment: input balance on paying side, zero on other
 * 4. pool::repay_flash_swap (MUST — receipt is non-droppable)
 * 5. coin::from_balance outputs → transferObjects to user
 */
export function buildSwapCoreTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    amountIn: bigint;
    aToB: boolean;
    byAmountIn: boolean;
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, amountIn, aToB, byAmountIn } = params;
  const sqrtPriceLimit = aToB ? MIN_SQRT_PRICE : MAX_SQRT_PRICE;
  const inputCoinType = aToB ? coinA : coinB;

  console.log("🏗️ buildSwapCoreTx (CORE flash_swap):", {
    poolId: poolId.slice(0, 10),
    aToB,
    amountIn: amountIn.toString(),
  });

  // Prepare input coin
  let inputCoin: any;
  if (isSuiCoin(inputCoinType)) {
    [inputCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountIn)]);
  } else {
    throw new Error("buildSwapCoreTx: non-SUI input — use buildSwapCoreWithCoinTx");
  }

  // Convert to balance
  const inputBalance = tx.moveCall({
    target: `${SUI_FRAMEWORK}::coin::into_balance`,
    arguments: [inputCoin],
    typeArguments: [inputCoinType],
  });

  // Flash swap
  const [balanceAOut, balanceBOut, receipt] = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::flash_swap`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.pure.bool(aToB),
      tx.pure.bool(byAmountIn),
      tx.pure.u64(amountIn),
      tx.pure.u128(BigInt(sqrtPriceLimit)),
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  // Repayment balances
  let payBalanceA: any;
  let payBalanceB: any;
  if (aToB) {
    payBalanceA = inputBalance;
    payBalanceB = tx.moveCall({
      target: `${SUI_FRAMEWORK}::balance::zero`,
      typeArguments: [coinB],
    });
  } else {
    payBalanceA = tx.moveCall({
      target: `${SUI_FRAMEWORK}::balance::zero`,
      typeArguments: [coinA],
    });
    payBalanceB = inputBalance;
  }

  // Repay flash swap
  tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::repay_flash_swap`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      payBalanceA,
      payBalanceB,
      receipt,
    ],
    typeArguments: [coinA, coinB],
  });

  // Convert outputs to coins and transfer
  const coinAOut = tx.moveCall({
    target: `${SUI_FRAMEWORK}::coin::from_balance`,
    arguments: [balanceAOut],
    typeArguments: [coinA],
  });
  const coinBOut = tx.moveCall({
    target: `${SUI_FRAMEWORK}::coin::from_balance`,
    arguments: [balanceBOut],
    typeArguments: [coinB],
  });

  tx.transferObjects([coinAOut, coinBOut], tx.pure.address(accountAddress));
  return tx;
}

/**
 * Build swap using CORE flash_swap with explicit coin object (non-SUI input)
 */
export function buildSwapCoreWithCoinTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    coinObjectId: string;
    amountIn: bigint;
    aToB: boolean;
    byAmountIn: boolean;
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, coinObjectId, amountIn, aToB, byAmountIn } = params;
  const sqrtPriceLimit = aToB ? MIN_SQRT_PRICE : MAX_SQRT_PRICE;
  const inputCoinType = aToB ? coinA : coinB;

  const [inputCoin] = tx.splitCoins(tx.object(coinObjectId), [tx.pure.u64(amountIn)]);
  const inputBalance = tx.moveCall({
    target: `${SUI_FRAMEWORK}::coin::into_balance`,
    arguments: [inputCoin],
    typeArguments: [inputCoinType],
  });

  const [balanceAOut, balanceBOut, receipt] = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::flash_swap`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.pure.bool(aToB),
      tx.pure.bool(byAmountIn),
      tx.pure.u64(amountIn),
      tx.pure.u128(BigInt(sqrtPriceLimit)),
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  let payBalanceA: any;
  let payBalanceB: any;
  if (aToB) {
    payBalanceA = inputBalance;
    payBalanceB = tx.moveCall({ target: `${SUI_FRAMEWORK}::balance::zero`, typeArguments: [coinB] });
  } else {
    payBalanceA = tx.moveCall({ target: `${SUI_FRAMEWORK}::balance::zero`, typeArguments: [coinA] });
    payBalanceB = inputBalance;
  }

  tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::repay_flash_swap`,
    arguments: [tx.object(CETUS_GLOBAL_CONFIG), tx.object(poolId), payBalanceA, payBalanceB, receipt],
    typeArguments: [coinA, coinB],
  });

  const coinAOut = tx.moveCall({ target: `${SUI_FRAMEWORK}::coin::from_balance`, arguments: [balanceAOut], typeArguments: [coinA] });
  const coinBOut = tx.moveCall({ target: `${SUI_FRAMEWORK}::coin::from_balance`, arguments: [balanceBOut], typeArguments: [coinB] });
  tx.transferObjects([coinAOut, coinBOut], tx.pure.address(accountAddress));
  return tx;
}

// ============================================================
// OPEN POSITION + ADD LIQUIDITY (CORE receipt pattern)
// ============================================================

/**
 * Open position + add liquidity using CORE receipt pattern.
 *
 * Uses: open_position → add_liquidity_fix_coin → add_liquidity_pay_amount → repay_add_liquidity
 *
 * @param amount - The amount for the fixed side (in raw units)
 * @param fixAmountA - true = fix coinA amount, false = fix coinB amount
 * @param coinASource - Pre-merged coin for non-SUI coinA (e.g. merged USDC coins)
 * @param coinBSource - Pre-merged coin for non-SUI coinB
 */
export function buildOpenPositionWithLiquidityCoreTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    tickLower: number;
    tickUpper: number;
    amount: bigint;
    fixAmountA: boolean;
    coinASource?: any;
    coinBSource?: any;
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, tickLower, tickUpper, amount, fixAmountA, coinASource, coinBSource } = params;

  console.log("🏗️ buildOpenPositionWithLiquidityCoreTx (CORE receipt):", {
    poolId: poolId.slice(0, 10),
    tickLower,
    tickUpper,
    amount: amount.toString(),
    fixAmountA,
  });

  // Step 1: Open position
  const position = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::open_position`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.pure.u32(tickToU32(tickLower)),
      tx.pure.u32(tickToU32(tickUpper)),
    ],
    typeArguments: [coinA, coinB],
  });

  // Step 2-4: Add liquidity via receipt pattern
  _addLiquidityReceipt(
    tx,
    { poolId, coinA, coinB, position, amount, fixAmountA, coinASource, coinBSource },
    accountAddress
  );

  // Step 5: Transfer position NFT
  tx.transferObjects([position], tx.pure.address(accountAddress));

  return tx;
}

// ============================================================
// ADD LIQUIDITY to existing position (CORE receipt pattern)
// ============================================================

/**
 * Add liquidity to existing position using CORE receipt pattern.
 *
 * @param amount - The amount for the fixed side (in raw units)
 * @param fixAmountA - true = fix coinA, false = fix coinB
 * @param coinASource - Pre-merged coin for non-SUI coinA
 * @param coinBSource - Pre-merged coin for non-SUI coinB
 */
export function buildAddLiquidityCoreTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    positionId: string;
    amount: bigint;
    fixAmountA: boolean;
    coinASource?: any;
    coinBSource?: any;
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, positionId, amount, fixAmountA, coinASource, coinBSource } = params;

  console.log("🏗️ buildAddLiquidityCoreTx (CORE receipt):", {
    poolId: poolId.slice(0, 10),
    positionId: positionId.slice(0, 10),
    amount: amount.toString(),
    fixAmountA,
  });

  _addLiquidityReceipt(
    tx,
    {
      poolId,
      coinA,
      coinB,
      position: tx.object(positionId),
      amount,
      fixAmountA,
      coinASource,
      coinBSource,
    },
    accountAddress
  );

  return tx;
}

// ============================================================
// REMOVE LIQUIDITY
// ============================================================

/**
 * Remove liquidity using CORE package.
 * pool::remove_liquidity(config, pool, position, delta_liquidity, clock) → (Balance<A>, Balance<B>)
 */
export function buildRemoveLiquidityCoreTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    positionId: string;
    deltaLiquidity: bigint;
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, positionId, deltaLiquidity } = params;

  const [balanceA, balanceB] = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::remove_liquidity`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.object(positionId),
      tx.pure.u128(deltaLiquidity),
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  const coinAOut = tx.moveCall({ target: `${SUI_FRAMEWORK}::coin::from_balance`, arguments: [balanceA], typeArguments: [coinA] });
  const coinBOut = tx.moveCall({ target: `${SUI_FRAMEWORK}::coin::from_balance`, arguments: [balanceB], typeArguments: [coinB] });
  tx.transferObjects([coinAOut, coinBOut], tx.pure.address(accountAddress));
  return tx;
}

// ============================================================
// COLLECT FEES
// ============================================================

/**
 * Collect fees using CORE package.
 * pool::collect_fee(config, pool, position, recalculate) → (Balance<A>, Balance<B>)
 */
export function buildCollectFeeCoreTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    positionId: string;
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, positionId } = params;

  const [feeBalA, feeBalB] = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::collect_fee`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.object(positionId),
      tx.pure.bool(true),
    ],
    typeArguments: [coinA, coinB],
  });

  const coinAOut = tx.moveCall({ target: `${SUI_FRAMEWORK}::coin::from_balance`, arguments: [feeBalA], typeArguments: [coinA] });
  const coinBOut = tx.moveCall({ target: `${SUI_FRAMEWORK}::coin::from_balance`, arguments: [feeBalB], typeArguments: [coinB] });
  tx.transferObjects([coinAOut, coinBOut], tx.pure.address(accountAddress));
  return tx;
}

// ============================================================
// CLOSE POSITION (remove liq + collect fees + destroy)
// ============================================================

/**
 * Close position using CORE package.
 * Removes all liquidity, collects fees, then destroys the Position NFT.
 */
export function buildClosePositionCoreTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    positionId: string;
    deltaLiquidity: bigint;
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, positionId, deltaLiquidity } = params;

  // Step 1: Remove all liquidity
  if (deltaLiquidity > 0n) {
    const [balA, balB] = tx.moveCall({
      target: `${CETUS_CORE_PACKAGE}::pool::remove_liquidity`,
      arguments: [
        tx.object(CETUS_GLOBAL_CONFIG),
        tx.object(poolId),
        tx.object(positionId),
        tx.pure.u128(deltaLiquidity),
        tx.object(SUI_CLOCK),
      ],
      typeArguments: [coinA, coinB],
    });
    const coinALiq = tx.moveCall({ target: `${SUI_FRAMEWORK}::coin::from_balance`, arguments: [balA], typeArguments: [coinA] });
    const coinBLiq = tx.moveCall({ target: `${SUI_FRAMEWORK}::coin::from_balance`, arguments: [balB], typeArguments: [coinB] });
    tx.transferObjects([coinALiq, coinBLiq], tx.pure.address(accountAddress));
  }

  // Step 2: Collect fees
  const [feeBalA, feeBalB] = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::collect_fee`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.object(positionId),
      tx.pure.bool(true),
    ],
    typeArguments: [coinA, coinB],
  });
  const coinAFee = tx.moveCall({ target: `${SUI_FRAMEWORK}::coin::from_balance`, arguments: [feeBalA], typeArguments: [coinA] });
  const coinBFee = tx.moveCall({ target: `${SUI_FRAMEWORK}::coin::from_balance`, arguments: [feeBalB], typeArguments: [coinB] });
  tx.transferObjects([coinAFee, coinBFee], tx.pure.address(accountAddress));

  // Step 3: Destroy position NFT
  tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::close_position`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.object(positionId),
    ],
    typeArguments: [coinA, coinB],
  });

  return tx;
}

// ============================================================
// CREATE POOL (CORE pool_creator)
// ============================================================

/**
 * Create pool using CORE pool_creator::create_pool_v3.
 * NOTE: v3 does NOT require CoinMetadata objects (unlike v2).
 * Returns (Position, Coin<A>, Coin<B>).
 */
export function buildCreatePoolCoreTx(
  tx: Transaction,
  params: {
    coinA: string;
    coinB: string;
    tickSpacing: number;
    initSqrtPrice: bigint;
    tickLower: number;
    tickUpper: number;
    coinAInput: any;
    coinBInput: any;
    fixAmountA: boolean;
  },
  accountAddress: string
): Transaction {
  const { coinA, coinB, tickSpacing, initSqrtPrice, tickLower, tickUpper, coinAInput, coinBInput, fixAmountA } = params;

  const [position, leftoverA, leftoverB] = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool_creator::create_pool_v3`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(CETUS_FACTORY),
      tx.pure.u32(tickSpacing),
      tx.pure.u128(initSqrtPrice),
      tx.pure.string(""),
      tx.pure.u32(tickToU32(tickLower)),
      tx.pure.u32(tickToU32(tickUpper)),
      coinAInput,
      coinBInput,
      tx.pure.bool(fixAmountA),
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  tx.transferObjects([position, leftoverA, leftoverB], tx.pure.address(accountAddress));
  return tx;
}

// ============================================================
// ZAP (single-sided liquidity via flash_swap + open + add_liquidity_fix_coin)
// ============================================================

/**
 * Zap: flash_swap 50% → open position → add liquidity (receipt pattern).
 * Supports both SUI and non-SUI input.
 *
 * @param coinSource - Pre-merged coin for non-SUI input. Required when input coin is not SUI.
 *                     For SUI input, leave undefined (splits from gas).
 */
export function buildZapCoreTx(
  tx: Transaction,
  params: {
    poolId: string;
    coinA: string;
    coinB: string;
    tickLower: number;
    tickUpper: number;
    amountIn: bigint;
    inputIsA: boolean;
    coinSource?: any; // Pre-merged coin for non-SUI input
  },
  accountAddress: string
): Transaction {
  const { poolId, coinA, coinB, tickLower, tickUpper, amountIn, inputIsA, coinSource } = params;
  const swapAmount = amountIn / 2n;
  const liquidityAmount = (amountIn - swapAmount) * 98n / 100n;
  const inputCoinType = inputIsA ? coinA : coinB;
  const aToB = inputIsA;

  console.log("🏗️ buildZapCoreTx (CORE):", {
    amountIn: amountIn.toString(),
    swapAmount: swapAmount.toString(),
    liquidityAmount: liquidityAmount.toString(),
    inputIsA,
    hasExplicitCoinSource: !!coinSource,
  });

  // 1. Split swap portion — explicit source first, then gas for SUI
  let swapCoin: any;
  if (coinSource) {
    [swapCoin] = tx.splitCoins(coinSource, [tx.pure.u64(swapAmount)]);
  } else if (isSuiCoin(inputCoinType)) {
    [swapCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(swapAmount)]);
  } else {
    throw new Error("Non-SUI input requires coinSource parameter");
  }

  // 2. Convert to balance
  const swapBalance = tx.moveCall({
    target: `${SUI_FRAMEWORK}::coin::into_balance`,
    arguments: [swapCoin],
    typeArguments: [inputCoinType],
  });

  // 3. Flash swap
  const sqrtPriceLimit = aToB ? MIN_SQRT_PRICE : MAX_SQRT_PRICE;
  const [balAOut, balBOut, receipt] = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::flash_swap`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.pure.bool(aToB),
      tx.pure.bool(true),
      tx.pure.u64(swapAmount),
      tx.pure.u128(BigInt(sqrtPriceLimit)),
      tx.object(SUI_CLOCK),
    ],
    typeArguments: [coinA, coinB],
  });

  // 4. Repay flash swap
  let payBalA: any;
  let payBalB: any;
  if (aToB) {
    payBalA = swapBalance;
    payBalB = tx.moveCall({ target: `${SUI_FRAMEWORK}::balance::zero`, typeArguments: [coinB] });
  } else {
    payBalA = tx.moveCall({ target: `${SUI_FRAMEWORK}::balance::zero`, typeArguments: [coinA] });
    payBalB = swapBalance;
  }
  tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::repay_flash_swap`,
    arguments: [tx.object(CETUS_GLOBAL_CONFIG), tx.object(poolId), payBalA, payBalB, receipt],
    typeArguments: [coinA, coinB],
  });

  // 5. Convert swap outputs to coins
  const swappedCoinA = tx.moveCall({ target: `${SUI_FRAMEWORK}::coin::from_balance`, arguments: [balAOut], typeArguments: [coinA] });
  const swappedCoinB = tx.moveCall({ target: `${SUI_FRAMEWORK}::coin::from_balance`, arguments: [balBOut], typeArguments: [coinB] });

  // 6. Open position
  const position = tx.moveCall({
    target: `${CETUS_CORE_PACKAGE}::pool::open_position`,
    arguments: [
      tx.object(CETUS_GLOBAL_CONFIG),
      tx.object(poolId),
      tx.pure.u32(tickToU32(tickLower)),
      tx.pure.u32(tickToU32(tickUpper)),
    ],
    typeArguments: [coinA, coinB],
  });

  // 7. Add liquidity via receipt pattern
  // Fix the INPUT side, provide swapped coin + remaining input coin as sources
  // coinSource (if provided) still has (amountIn - swapAmount) of the input coin after step 1 split
  if (inputIsA) {
    // Input = A: fix A, swapped coin B for other side
    // coinASource = coinSource (remaining input, or undefined → gas for SUI)
    // coinBSource = swappedCoinB (output from flash swap)
    _addLiquidityReceipt(
      tx,
      { poolId, coinA, coinB, position, amount: liquidityAmount, fixAmountA: true,
        coinASource: coinSource, coinBSource: swappedCoinB },
      accountAddress
    );
    // Transfer dust from swap output on input side
    tx.transferObjects([swappedCoinA], tx.pure.address(accountAddress));
  } else {
    // Input = B: fix B, swapped coin A for other side
    // coinASource = swappedCoinA (output from flash swap)
    // coinBSource = coinSource (remaining input, or undefined → gas for SUI)
    _addLiquidityReceipt(
      tx,
      { poolId, coinA, coinB, position, amount: liquidityAmount, fixAmountA: false,
        coinASource: swappedCoinA, coinBSource: coinSource },
      accountAddress
    );
    // Transfer dust from swap output on input side
    tx.transferObjects([swappedCoinB], tx.pure.address(accountAddress));
  }

  // 8. Transfer position NFT to user
  tx.transferObjects([position], tx.pure.address(accountAddress));

  return tx;
}
