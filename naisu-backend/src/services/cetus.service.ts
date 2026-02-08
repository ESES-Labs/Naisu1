/**
 * Cetus CLMM Service for Backend
 * 
 * Direct port from naisu-frontend/src/lib/cetus/cetusServiceCore.ts
 * Uses ONLY the CORE package (0x6bbdf09f...) for all operations.
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

// ============================================================================
// Constants (from cetusService.ts)
// ============================================================================

export const CETUS_CORE_PACKAGE = "0x6bbdf09f9fa0baa1524080a5b8991042e95061c4e1206217279aec51ba08edf7";
export const CETUS_GLOBAL_CONFIG = "0xc6273f844b4bc258952c4e477697aa12c918c8e08106fac6b934811298c9820a";
export const CETUS_FACTORY = "0x20a086e6fa0741b3ca77d033a65faf0871349b986ddbdde6fa1d85d78a5f4222";
export const SUI_CLOCK = "0x6";
const SUI_FRAMEWORK = "0x2";

export const COIN_SUI = "0x2::sui::SUI";
export const COIN_USDC_CIRCLE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";
export const COIN_USDC_CETUS = "0x14a71d857b34677a7d57e0feb303df1adb515a37780645ab763d42ce8d1a5e48::usdc::USDC";

const MAX_SQRT_PRICE = "79226673515401279992447579055";
const MIN_SQRT_PRICE = "4295048016";

// Pools (from cetusService.ts CETUS_POOLS)
export const CETUS_POOLS = {
    SUI_USDC: {
        id: "0xce144501b2e09fd9438e22397b604116a3874e137c8ae0c31144b45b2bf84f10",
        coinA: COIN_USDC_CETUS,
        coinB: COIN_SUI,
        name: "SUI/USDC ✅",
    },
    USDC_CIRCLE_SUI_20: {
        id: "0x396d6233b42fb8a58004e937bd3e9b37bf2626e7074aab179fc0eb1d6487cfae",
        coinA: COIN_USDC_CIRCLE,
        coinB: COIN_SUI,
        name: "USDC(Circle)/SUI [1:20]",
    },
    USDC_CIRCLE_SUI_200: {
        id: "0x1e8ade872bd43978dc2d4b35a9ddaf3ba3adc83df9e12f8c60ec116052f51cca",
        coinA: COIN_USDC_CIRCLE,
        coinB: COIN_SUI,
        name: "USDC(Circle)/SUI [1:200]",
    },
};

// ============================================================================
// Client & Keypair
// ============================================================================

let suiClient: SuiClient | null = null;

function getClient(): SuiClient {
    if (!suiClient) {
        suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
    }
    return suiClient;
}

function getKeypair(): Ed25519Keypair {
    const privateKey = Bun.env.SUI_PRIVATE_KEY;
    if (!privateKey) throw new Error("SUI_PRIVATE_KEY not set");
    return Ed25519Keypair.fromSecretKey(privateKey);
}

// ============================================================================
// Helpers
// ============================================================================

export function isSuiCoin(coinType: string): boolean {
    return coinType === COIN_SUI || coinType.endsWith("::sui::SUI");
}

export function tickToU32(tick: number): number {
    return tick < 0 ? 4294967296 + tick : tick;
}

export function coinSymbol(coinType: string): string {
    if (coinType === COIN_USDC_CIRCLE) return "USDC(Circle)";
    if (coinType === COIN_USDC_CETUS) return "USDC(Cetus)";
    return coinType.split("::").pop() || "?";
}

// ============================================================================
// Pool Info
// ============================================================================

export async function getPoolInfo(poolId: string) {
    const client = getClient();
    const poolObj = await client.getObject({
        id: poolId,
        options: { showType: true, showContent: true },
    });

    if (!poolObj.data?.content || poolObj.data.content.dataType !== "moveObject") {
        throw new Error(`Pool ${poolId} not found`);
    }

    const rawType = poolObj.data.type;
    const typeMatch = rawType?.match(/Pool<([^,]+),\s*([^>]+)>/);
    const coinA = typeMatch?.[1]?.trim() || "";
    const coinB = typeMatch?.[2]?.trim() || "";

    const fields = poolObj.data.content.fields as Record<string, any>;
    const rawBits = (fields.current_tick_index as any)?.fields?.bits;
    const currentTick = rawBits !== undefined && rawBits >= 2 ** 31 ? rawBits - 2 ** 32 : rawBits;

    return {
        poolId,
        coinA,
        coinB,
        currentSqrtPrice: fields.current_sqrt_price,
        currentTick,
        liquidity: fields.liquidity,
        tickSpacing: Number(fields.tick_spacing),
    };
}

/**
 * Get swap quote (estimate output without execution)
 * Uses pool's currentSqrtPrice to calculate actual exchange rate
 * 
 * CLMM Price Math:
 * - sqrt_price is Q64.64 fixed point (price = (sqrt_price / 2^64)^2)
 * - price_raw = coinA_raw / coinB_raw (in raw units, no decimals)
 * - For USDC/SUI pool: price_raw represents raw_USDC per raw_SUI
 * - To convert to human units: price_human = price_raw / 10^(decimalsA - decimalsB)
 * - Example: price_raw = 0.1785, decimals: USDC=6, SUI=9
 *   price_human = 0.1785 / 10^(6-9) = 0.1785 / 0.001 = 178.5 — WRONG!
 *   Correct: invert for USDC/SUI = 1 / (0.1785 * 0.001) = 5602 USDC per SUI
 */
export async function getQuote(params: {
    poolId: string;
    amountIn: string;
    aToB: boolean;
}) {
    const pool = await getPoolInfo(params.poolId);
    const amountInNum = parseFloat(params.amountIn);

    // Parse sqrt price (Q64.64 format)
    const sqrtPriceQ64 = BigInt(pool.currentSqrtPrice);
    const Q64 = BigInt(2) ** BigInt(64);

    // Calculate price_raw: (sqrt_price / 2^64)^2
    const sqrtPriceFloat = Number(sqrtPriceQ64) / Number(Q64);
    const priceRaw = sqrtPriceFloat ** 2; // Square the result, not divide by Q64^2!

    // Determine decimals
    const decimalsA = isSuiCoin(pool.coinA) ? 9 : 6;
    const decimalsB = isSuiCoin(pool.coinB) ? 9 : 6;

    // Convert to human units
    // Cetus sqrt_price formula gives sqrt(coinB / coinA) in raw units.
    // So, priceRaw = coinB_raw / coinA_raw.
    // We want priceHuman = coinA_human / coinB_human.

    // First, invert priceRaw to get coinA_raw / coinB_raw
    const priceRawAperB = 1 / priceRaw;

    // Now adjust for decimals: (coinA_raw / coinB_raw) * (10^decimalsB / 10^decimalsA)
    // This simplifies to: priceRawAperB * 10^(decimalsB - decimalsA)
    const decimalAdjustmentFactor = 10 ** (decimalsB - decimalsA);
    const priceHuman = priceRawAperB * decimalAdjustmentFactor; // This is coinA_human / coinB_human

    // Calculate output
    let estimatedOut: number;
    if (params.aToB) {
        // A → B swap (e.g., USDC → SUI): amountIn (human A) / priceHuman (human A / human B) = human B
        estimatedOut = amountInNum / priceHuman;
    } else {
        // B → A swap (e.g., SUI → USDC): amountIn (human B) * priceHuman (human A / human B) = human A
        estimatedOut = amountInNum * priceHuman;
    }

    // Apply fee (0.3% typical for Cetus)
    const outputAfterFee = estimatedOut * 0.997;

    const inputCoin = params.aToB ? pool.coinA : pool.coinB;
    const outputCoin = params.aToB ? pool.coinB : pool.coinA;

    return {
        poolId: params.poolId,
        amountIn: params.amountIn,
        estimatedAmountOut: outputAfterFee.toFixed(6),
        inputCoin: coinSymbol(inputCoin),
        outputCoin: coinSymbol(outputCoin),
        aToB: params.aToB,
        currentPrice: priceHuman.toFixed(2),
        priceDescription: `1 ${coinSymbol(pool.coinB)} = ${priceHuman.toFixed(2)} ${coinSymbol(pool.coinA)}`,
        priceImpact: "< 0.1%",
        fee: "0.3%",
    };
}

// ============================================================================
// Build Swap TX (from cetusServiceCore.ts buildSwapCoreTx)
// ============================================================================

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

    // Prepare input coin (SUI only for now)
    let inputCoin: ReturnType<typeof tx.splitCoins>[0];
    if (isSuiCoin(inputCoinType)) {
        [inputCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountIn)]);
    } else {
        throw new Error("buildSwapCoreTx: non-SUI input not supported in backend");
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
    let payBalanceA: ReturnType<typeof tx.moveCall>;
    let payBalanceB: ReturnType<typeof tx.moveCall>;
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

// ============================================================================
// Execute Functions (for AI agent)
// ============================================================================

export async function executeSwap(params: {
    poolId: string;
    amountIn: string;
    aToB: boolean;
}) {
    const keypair = getKeypair();
    const sender = keypair.toSuiAddress();
    const client = getClient();

    const pool = await getPoolInfo(params.poolId);
    // If aToB (swapping coinA → coinB), input is coinA
    // For SUI/USDC pool where coinB=SUI, aToB=false means SUI→USDC
    const inputIsA = params.aToB;
    const inputCoinType = inputIsA ? pool.coinA : pool.coinB;
    const decimals = isSuiCoin(inputCoinType) ? 9 : 6;
    const amountInRaw = BigInt(Math.floor(parseFloat(params.amountIn) * 10 ** decimals));

    const tx = new Transaction();
    buildSwapCoreTx(
        tx,
        {
            poolId: params.poolId,
            coinA: pool.coinA,
            coinB: pool.coinB,
            amountIn: amountInRaw,
            aToB: params.aToB,
            byAmountIn: true,
        },
        sender
    );

    const result = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showEffects: true },
    });

    return {
        success: result.effects?.status?.status === "success",
        digest: result.digest,
        explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
    };
}

export async function getPositions(owner: string) {
    const client = getClient();
    const positionType = "0x5372d555ac734e272659136c2a0cd3227f9b92de67c80dc11250307268af2db8::position::Position";

    const objects = await client.getOwnedObjects({
        owner,
        filter: { StructType: positionType },
        options: { showContent: true },
    });

    return objects.data.map((obj) => {
        const fields = (obj.data?.content as any)?.fields;
        return {
            id: obj.data?.objectId,
            poolId: fields?.pool,
            liquidity: fields?.liquidity,
            tickLower: fields?.tick_lower_index?.fields?.bits,
            tickUpper: fields?.tick_upper_index?.fields?.bits,
        };
    });
}

export async function getBalance(owner: string, coinType: string = COIN_SUI) {
    const client = getClient();
    const balance = await client.getBalance({ owner, coinType });
    const decimals = isSuiCoin(coinType) ? 9 : 6;
    return {
        coinType,
        symbol: coinSymbol(coinType),
        balance: balance.totalBalance,
        formatted: (Number(balance.totalBalance) / 10 ** decimals).toFixed(4),
    };
}

export function listPools() {
    return Object.entries(CETUS_POOLS).map(([name, pool]) => ({
        name,
        ...pool,
    }));
}

// ============================================================================
// ZAP (Critical for Intent Bridge → Yield flow)
// ============================================================================

/**
 * Zap: Single-sided deposit into Cetus pool
 * User sends USDC (from bridge) → Backend swaps 50% to SUI → Opens LP position
 *
 * @param poolId - Target pool ID
 * @param amountIn - USDC amount (human readable, e.g. "100")
 * @param minLiquidity - Minimum liquidity to receive (slippage protection)
 */
export async function executeZap(params: {
    poolId: string;
    amountIn: string;
    minLiquidity?: string;
}) {
    const keypair = getKeypair();
    const sender = keypair.toSuiAddress();
    const client = getClient();

    const pool = await getPoolInfo(params.poolId);

    // Assume input is USDC (coinA), need to swap to get SUI (coinB)
    const inputCoinType = pool.coinA; // USDC
    const decimals = 6; // USDC decimals
    const amountInRaw = BigInt(Math.floor(parseFloat(params.amountIn) * 10 ** decimals));

    // Get all USDC coins and merge them
    const coins = await client.getCoins({ owner: sender, coinType: inputCoinType });
    if (coins.data.length === 0) {
        throw new Error(`No ${coinSymbol(inputCoinType)} coins found for zap`);
    }

    const tx = new Transaction();

    // Merge all USDC coins into first one
    const primaryCoin = tx.object(coins.data[0].coinObjectId);
    if (coins.data.length > 1) {
        tx.mergeCoins(primaryCoin, coins.data.slice(1).map(c => tx.object(c.coinObjectId)));
    }

    // Calculate amounts
    const swapAmount = amountInRaw / 2n; // 50% to swap
    const liquidityAmount = (amountInRaw - swapAmount) * 98n / 100n; // 98% for liquidity (2% buffer)

    // 1. Split swap portion from merged coin
    const [swapCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(swapAmount)]);

    // 2. Convert to balance for flash swap
    const swapBalance = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::into_balance`,
        arguments: [swapCoin],
        typeArguments: [inputCoinType],
    });

    // 3. Flash swap USDC → SUI (aToB = true)
    const sqrtPriceLimit = MIN_SQRT_PRICE;
    const [balAOut, balBOut, receipt] = tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::flash_swap`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(params.poolId),
            tx.pure.bool(true), // aToB (USDC → SUI)
            tx.pure.bool(true), // byAmountIn
            tx.pure.u64(swapAmount),
            tx.pure.u128(BigInt(sqrtPriceLimit)),
            tx.object(SUI_CLOCK),
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    // 4. Repay flash swap
    tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::repay_flash_swap`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(params.poolId),
            swapBalance,
            tx.moveCall({ target: `${SUI_FRAMEWORK}::balance::zero`, typeArguments: [pool.coinB] }),
            receipt,
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    // 5. Convert swap outputs to coins
    const swappedUSDC = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::from_balance`,
        arguments: [balAOut],
        typeArguments: [pool.coinA],
    });
    const swappedSUI = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::from_balance`,
        arguments: [balBOut],
        typeArguments: [pool.coinB],
    });

    // 6. Open position (use pool's current tick ± range)
    const tickLower = Math.floor((pool.currentTick - 5000) / 60) * 60; // aligned to tick_spacing
    const tickUpper = Math.floor((pool.currentTick + 5000) / 60) * 60;

    const position = tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::open_position`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(params.poolId),
            tx.pure.u32(tickToU32(tickLower)),
            tx.pure.u32(tickToU32(tickUpper)),
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    // 7. Add liquidity using receipt pattern
    // Fix USDC side (we know exact amount), SUI from swap output
    const addLiqReceipt = tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::add_liquidity_fix_coin`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(params.poolId),
            position,
            tx.pure.u64(liquidityAmount),
            tx.pure.bool(true), // fixAmountA (USDC)
            tx.object(SUI_CLOCK),
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    const [needA, needB] = tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::add_liquidity_pay_amount`,
        arguments: [addLiqReceipt],
        typeArguments: [pool.coinA, pool.coinB],
    });

    // Split exact amounts from sources
    const [coinASplit] = tx.splitCoins(primaryCoin, [needA]); // remaining USDC
    const balA = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::into_balance`,
        arguments: [coinASplit],
        typeArguments: [pool.coinA],
    });

    const [coinBSplit] = tx.splitCoins(swappedSUI, [needB]); // SUI from swap
    const balB = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::into_balance`,
        arguments: [coinBSplit],
        typeArguments: [pool.coinB],
    });

    // Repay add liquidity
    tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::repay_add_liquidity`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(params.poolId),
            balA,
            balB,
            addLiqReceipt,
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    // 8. Transfer position NFT + leftover coins back
    tx.transferObjects([position], tx.pure.address(sender));
    tx.transferObjects([primaryCoin, swappedUSDC, swappedSUI], tx.pure.address(sender));

    // Execute transaction
    const result = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showEffects: true, showObjectChanges: true },
    });

    // Find created position ID
    let positionId = null;
    for (const change of result.objectChanges || []) {
        if (change.type === 'created' && change.objectType.includes('::position::Position')) {
            positionId = change.objectId;
            break;
        }
    }

    return {
        success: result.effects?.status?.status === "success",
        digest: result.digest,
        positionId,
        explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
    };
}

// ============================================================================
// HARVEST (Collect yield from position)
// ============================================================================

/**
 * Harvest: Collect trading fees from LP position
 */
export async function executeHarvest(params: {
    positionId: string;
}) {
    const keypair = getKeypair();
    const sender = keypair.toSuiAddress();
    const client = getClient();

    // Get position info to find its pool
    const posObj = await client.getObject({
        id: params.positionId,
        options: { showContent: true },
    });

    if (!posObj.data?.content || posObj.data.content.dataType !== "moveObject") {
        throw new Error(`Position ${params.positionId} not found`);
    }

    const fields = (posObj.data.content as any).fields;
    const poolId = fields.pool;

    const pool = await getPoolInfo(poolId);

    const tx = new Transaction();

    // Collect fees
    const [feeBalA, feeBalB] = tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::collect_fee`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(poolId),
            tx.object(params.positionId),
            tx.pure.bool(true), // recalculate
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    // Convert to coins and transfer
    const coinAFee = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::from_balance`,
        arguments: [feeBalA],
        typeArguments: [pool.coinA],
    });
    const coinBFee = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::from_balance`,
        arguments: [feeBalB],
        typeArguments: [pool.coinB],
    });

    tx.transferObjects([coinAFee, coinBFee], tx.pure.address(sender));

    // Execute
    const result = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showEffects: true, showEvents: true },
    });

    // Parse fee amounts from events
    let feeA = "0", feeB = "0";
    for (const event of result.events || []) {
        if (event.type.includes("::pool::CollectFeeEvent")) {
            const parsed = event.parsedJson as any;
            feeA = parsed.amount_a || "0";
            feeB = parsed.amount_b || "0";
        }
    }

    return {
        success: result.effects?.status?.status === "success",
        digest: result.digest,
        feesCollected: {
            [coinSymbol(pool.coinA)]: (Number(feeA) / 1e6).toFixed(6),
            [coinSymbol(pool.coinB)]: (Number(feeB) / 1e9).toFixed(9),
        },
        explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
    };
}

// ============================================================================
// Build Unsigned Transactions (for AI Agent Integration)
// ============================================================================


/**
 * Build unsigned harvest transaction
 * Returns TX bytes that user can sign with their wallet
 */
export async function buildHarvestTx(params: {
    positionId: string;
    userAddress: string;
}) {
    const client = getClient();

    // Get position to find its pool
    const posObj = await client.getObject({
        id: params.positionId,
        options: { showContent: true },
    });

    if (!posObj.data?.content || posObj.data.content.dataType !== "moveObject") {
        throw new Error("Position not found or invalid");
    }

    const fields = (posObj.data.content as any).fields;
    const poolId = fields.pool;
    const pool = await getPoolInfo(poolId);

    // Build transaction
    const tx = new Transaction();
    tx.setSender(params.userAddress);

    // Collect fees
    const [feeBalA, feeBalB] = tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::collect_fee`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(poolId),
            tx.object(params.positionId),
            tx.pure.bool(true),
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    // Convert to coins
    const coinAFee = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::from_balance`,
        arguments: [feeBalA],
        typeArguments: [pool.coinA],
    });
    const coinBFee = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::from_balance`,
        arguments: [feeBalB],
        typeArguments: [pool.coinB],
    });

    tx.transferObjects([coinAFee, coinBFee], tx.pure.address(params.userAddress));

    // Set gas budget
    tx.setGasBudget(50000000); // 0.05 SUI

    // Serialize transaction without dry-run
    const txBytes = await tx.build({
        client,
        onlyTransactionKind: true
    });

    return {
        txBytes: Buffer.from(txBytes).toString('base64'),
        summary: {
            action: "Harvest trading fees from position",
            positionId: params.positionId,
            pool: getPoolName(poolId),
        },
    };
}

/**
 * Build unsigned zap transaction
 * Takes coin object IDs as input and returns TX bytes for user to sign
 */
export async function buildZapTx(params: {
    poolId: string;
    coinObjectIds: string[];
    amountIn: string;
    userAddress: string;
}) {
    const client = getClient();
    const pool = await getPoolInfo(params.poolId);

    // Parse amount (USDC has 6 decimals)
    const amountInRaw = BigInt(Math.floor(parseFloat(params.amountIn) * 1e6));

    if (params.coinObjectIds.length === 0) {
        throw new Error("No coin object IDs provided");
    }

    // Build transaction
    const tx = new Transaction();
    tx.setSender(params.userAddress);

    // 1. Merge all USDC coins
    const primaryCoin = tx.object(params.coinObjectIds[0]);
    if (params.coinObjectIds.length > 1) {
        tx.mergeCoins(primaryCoin, params.coinObjectIds.slice(1).map(id => tx.object(id)));
    }

    // 2. Calculate amounts (50% swap, 50% liquidity)
    const swapAmount = amountInRaw / 2n;
    const liquidityAmount = (amountInRaw - swapAmount) * 98n / 100n; // 2% slippage

    // 3. Flash swap USDC → SUI
    const [swapCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(swapAmount)]);
    const swapBalance = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::into_balance`,
        arguments: [swapCoin],
        typeArguments: [pool.coinA],
    });

    const zeroBal = tx.moveCall({
        target: `${SUI_FRAMEWORK}::balance::zero`,
        typeArguments: [pool.coinB],
    });

    const [balAOut, balBOut, receipt] = tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::flash_swap`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(params.poolId),
            tx.pure.bool(true), // a2b
            tx.pure.bool(true), // by_amount_in
            tx.pure.u64(swapAmount),
            tx.pure.u128(MIN_SQRT_PRICE),
            tx.object(SUI_CLOCK),
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::repay_flash_swap`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(params.poolId),
            swapBalance,
            zeroBal,
            receipt,
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    const suiCoin = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::from_balance`,
        arguments: [balBOut],
        typeArguments: [pool.coinB],
    });

    // 4. Open position
    const tickLower = Math.floor((pool.currentTick - 5000) / 60) * 60;
    const tickUpper = Math.floor((pool.currentTick + 5000) / 60) * 60;

    const position = tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::open_position`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(params.poolId),
            tx.pure.u32(tickToU32(tickLower)),
            tx.pure.u32(tickToU32(tickUpper)),
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    // 5. Add liquidity
    const [liquidityCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(liquidityAmount)]);

    const addLiqReceipt = tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::add_liquidity_fix_coin`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(params.poolId),
            position,
            tx.pure.u64(liquidityAmount),
            tx.pure.bool(true), // fix_amount_a
            tx.object(SUI_CLOCK),
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    const [needA, needB] = tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::add_liquidity_pay_amount`,
        arguments: [addLiqReceipt],
    });

    const [coinAToAdd] = tx.splitCoins(liquidityCoin, [needA]);
    const [coinBToAdd] = tx.splitCoins(suiCoin, [needB]);

    const coinABal = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::into_balance`,
        arguments: [coinAToAdd],
        typeArguments: [pool.coinA],
    });
    const coinBBal = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::into_balance`,
        arguments: [coinBToAdd],
        typeArguments: [pool.coinB],
    });

    tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::repay_add_liquidity`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(params.poolId),
            coinABal,
            coinBBal,
            addLiqReceipt,
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    // 6. Transfer position NFT to user
    tx.transferObjects([position], tx.pure.address(params.userAddress));

    // Set gas budget
    tx.setGasBudget(100000000); // 0.1 SUI

    // Serialize transaction without dry-run
    const txBytes = await tx.build({
        client,
        onlyTransactionKind: true
    });

    return {
        txBytes: Buffer.from(txBytes).toString('base64'),
        summary: {
            action: `Zap ${params.amountIn} USDC to Cetus LP`,
            pool: getPoolName(params.poolId),
            tickRange: `${tickLower} to ${tickUpper}`,
            estimatedLiquidity: liquidityAmount.toString(),
        },
    };
}

/**
 * Get coin object IDs for building transactions
 */
export async function getCoinObjects(owner: string, coinType: string) {
    const client = getClient();
    const coins = await client.getCoins({ owner, coinType });

    return {
        coinType,
        coins: coins.data.map(c => ({
            objectId: c.coinObjectId,
            balance: c.balance,
            digest: c.digest,
        })),
        totalBalance: coins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n).toString(),
    };
}

/**
 * Get quote for zap (preview before executing)
 */
export async function getZapQuote(params: {
    poolId: string;
    amountIn: string;
}) {
    const pool = await getPoolInfo(params.poolId);

    // Parse amount (USDC has 6 decimals)
    const amountInRaw = BigInt(Math.floor(parseFloat(params.amountIn) * 1e6));

    // Calculate split: 50% for swap, 50% for liquidity
    const swapAmount = amountInRaw / 2n;
    const liquidityAmount = (amountInRaw - swapAmount) * 98n / 100n; // 2% slippage

    // Estimate SUI output from swap (simplified - in production use pool's price math)
    // For now, rough estimate based on pool ratio
    const estimatedSuiOut = (swapAmount * 20n) / 1000000n; // Rough 1:20 ratio

    // Estimated liquidity (simplified)
    const estimatedLiquidity = liquidityAmount * 16n; // Rough multiplier

    return {
        poolId: params.poolId,
        poolName: getPoolName(params.poolId),
        amountIn: params.amountIn,
        breakdown: {
            swapAmount: (Number(swapAmount) / 1e6).toFixed(6),
            liquidityAmount: (Number(liquidityAmount) / 1e6).toFixed(6),
            estimatedSuiFromSwap: (Number(estimatedSuiOut) / 1e9).toFixed(9),
        },
        estimatedLiquidity: estimatedLiquidity.toString(),
        priceImpact: "~0.1%",
        tickRange: {
            lower: Math.floor((pool.currentTick - 5000) / 60) * 60,
            upper: Math.floor((pool.currentTick + 5000) / 60) * 60,
        },
    };
}

/**
 * Build unsigned remove liquidity transaction
 */
export async function buildRemoveLiquidityTx(params: {
    positionId: string;
    liquidityDelta: string;
    userAddress: string;
}) {
    const client = getClient();

    // Get position to find its pool
    const posObj = await client.getObject({
        id: params.positionId,
        options: { showContent: true },
    });

    if (!posObj.data?.content || posObj.data.content.dataType !== "moveObject") {
        throw new Error("Position not found or invalid");
    }

    const fields = (posObj.data.content as any).fields;
    const poolId = fields.pool;
    const pool = await getPoolInfo(poolId);

    // Build transaction
    const tx = new Transaction();
    tx.setSender(params.userAddress);

    // Remove liquidity
    const [balA, balB] = tx.moveCall({
        target: `${CETUS_CORE_PACKAGE}::pool::remove_liquidity`,
        arguments: [
            tx.object(CETUS_GLOBAL_CONFIG),
            tx.object(poolId),
            tx.object(params.positionId),
            tx.pure.u128(params.liquidityDelta),
            tx.object(SUI_CLOCK),
        ],
        typeArguments: [pool.coinA, pool.coinB],
    });

    // Convert balances to coins
    const coinA = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::from_balance`,
        arguments: [balA],
        typeArguments: [pool.coinA],
    });

    const coinB = tx.moveCall({
        target: `${SUI_FRAMEWORK}::coin::from_balance`,
        arguments: [balB],
        typeArguments: [pool.coinB],
    });

    // Transfer coins to user
    tx.transferObjects([coinA, coinB], tx.pure.address(params.userAddress));

    // Set gas budget
    tx.setGasBudget(50000000); // 0.05 SUI

    // Serialize transaction without dry-run
    const txBytes = await tx.build({
        client,
        onlyTransactionKind: true
    });

    return {
        txBytes: Buffer.from(txBytes).toString('base64'),
        summary: {
            action: `Remove ${params.liquidityDelta} liquidity from position`,
            positionId: params.positionId,
            pool: getPoolName(poolId),
        },
    };
}

function getPoolName(poolId: string): string {
    const found = Object.values(CETUS_POOLS).find(p => p.id === poolId);
    return found ? found.name : poolId;
}
