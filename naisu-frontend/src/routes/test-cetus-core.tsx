/**
 * Cetus CORE CLMM Debug/Test Page
 *
 * Tests every CORE package operation via PTB:
 * - Swap (flash_swap pattern)
 * - Open Position, Close Position
 * - Add Liquidity, Remove Liquidity
 * - Collect Fees
 * - Zap (single-sided)
 * - Create Pool
 *
 * Uses ONLY CETUS_CORE_PACKAGE (0x6bbdf09f...) — works with ALL pools.
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";

import {
  CETUS_POOLS,
  CETUS_CORE_PACKAGE,
  CETUS_GLOBAL_CONFIG,
  CETUS_FACTORY,
  COIN_SUI,
  COIN_USDC_CIRCLE,
  COIN_USDC_CETUS,
  coinSymbol,
  isSuiCoin,
  fetchPoolInfo,
  buildOpenPositionCoreTx,
  buildOpenPositionWithLiquidityCoreTx,
  buildAddLiquidityCoreTx,
  buildSwapCoreTx,
  buildSwapCoreWithCoinTx,
  buildRemoveLiquidityCoreTx,
  buildCollectFeeCoreTx,
  buildClosePositionCoreTx,
  buildZapCoreTx,
  buildCreatePoolCoreTx,
} from "@/lib/cetus/cetusServiceCore";
import { useQuerySuiTokenBalance } from "@/hooks/sui/useQuerySuiTokenBalance";

const CETUS_POSITION_TYPE = "0x5372d555ac734e272659136c2a0cd3227f9b92de67c80dc11250307268af2db8::position::Position";
const CETUS_POOLS_LIST = "0x51f8de2366af49a51ee81184eb28ca24739d3d48c8158d063dab6700c0b65413";

interface PositionInfo {
  id: string;
  poolId: string;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
}

interface DiscoveredPool {
  id: string;
  coinA: string;
  coinB: string;
  name: string;
  tickSpacing?: number;
}

export const Route = createFileRoute("/test-cetus-core")({
  component: CetusCorePage,
});

type TabType = "swap" | "position" | "liquidity" | "pool";

function CetusCorePage() {
  const { mutate: signAndExecuteTransaction } =
    useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  // State
  const [status, setStatus] = useState<
    "idle" | "executing" | "success" | "error"
  >("idle");
  const [log, setLog] = useState<string[]>([]);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("swap");

  // Discovered pools from factory
  const [discoveredPools, setDiscoveredPools] = useState<DiscoveredPool[]>([]);
  const [fetchingPools, setFetchingPools] = useState(false);

  // Pool selection — supports both hardcoded and discovered pools
  const [activePoolId, setActivePoolId] = useState(CETUS_POOLS.SUI_USDC.id);
  const allPools = [
    ...Object.values(CETUS_POOLS).map((p) => ({ ...p, source: "hardcoded" as const })),
    ...discoveredPools
      .filter((dp) => !Object.values(CETUS_POOLS).some((hp) => hp.id === dp.id))
      .map((p) => ({ ...p, source: "factory" as const })),
  ];
  const pool = allPools.find((p) => p.id === activePoolId) || allPools[0];

  // Pool info cache
  const [poolInfoCache, setPoolInfoCache] = useState<any>(null);

  // Inputs
  const [swapAmount, setSwapAmount] = useState("0.01");
  const [swapAtoB, setSwapAtoB] = useState(true);
  const [positionId, setPositionId] = useState("");
  const [posAmountA, setPosAmountA] = useState("0.01");
  const [posAmountB, setPosAmountB] = useState("0.01");
  const [deltaLiquidity, setDeltaLiquidity] = useState("1000");
  const [zapAmount, setZapAmount] = useState("0.02");
  const [zapInputSide, setZapInputSide] = useState<"A" | "B">("B"); // which pool coin to zap with

  // Fix side: 'A' = fix coin A amount, 'B' = fix coin B amount
  const [fixSide, setFixSide] = useState<"A" | "B">("B");

  // Custom tick range
  const [useCustomTicks, setUseCustomTicks] = useState(false);
  const [customTickLower, setCustomTickLower] = useState("");
  const [customTickUpper, setCustomTickUpper] = useState("");

  // Wallet token balances for current pool
  const [tokenBalances, setTokenBalances] = useState<{
    coinA: { balance: string; decimals: number; objectIds: string[] };
    coinB: { balance: string; decimals: number; objectIds: string[] };
  } | null>(null);

  // Positions
  const [positions, setPositions] = useState<PositionInfo[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);

  // Create pool inputs
  const [newCoinA, setNewCoinA] = useState("");
  const [newCoinB, setNewCoinB] = useState("");
  const [newTickSpacing, setNewTickSpacing] = useState("60");
  const [newInitPrice, setNewInitPrice] = useState("1");
  const [newAmountA, setNewAmountA] = useState("1");
  const [newAmountB, setNewAmountB] = useState("1");

  // SUI balance
  const { data: suiBalance } = useQuerySuiTokenBalance({
    coinType: COIN_SUI,
    accountAddress: account?.address,
  });
  const formattedSuiBalance = suiBalance
    ? (parseInt(suiBalance.totalBalance) / 1e9).toFixed(4)
    : "0.00";

  const addLog = (msg: string) =>
    setLog((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);

  const resetState = () => {
    setStatus("executing");
    setLog([]);
    setTxDigest(null);
  };

  const onTxSuccess = (result: { digest: string }) => {
    addLog(`✅ Success! Digest: ${result.digest}`);
    setStatus("success");
    setTxDigest(result.digest);
    toast.success(`TX sent! ${result.digest.slice(0, 8)}...`);
  };

  const onTxError = (error: Error) => {
    console.error(error);
    addLog(`❌ Failed: ${error.message}`);
    setStatus("error");
    toast.error(error.message);
  };

  // Fetch pool info from chain
  const getPoolInfo = useCallback(
    async (poolId: string) => {
      try {
        addLog("🔍 Fetching pool info from chain...");
        const info = await fetchPoolInfo(suiClient as any, poolId);
        if (!info || !info.coinA || !info.coinB) {
          addLog("❌ Failed to fetch pool info");
          return null;
        }

        const tickSpacing = info.tickSpacing || 60;
        addLog(
          `✅ Pool: ${info.coinA.split("::").pop()} / ${info.coinB.split("::").pop()}`
        );
        addLog(`📏 Tick spacing: ${tickSpacing}`);

        // Calculate tick range
        const currentTick = info.currentTick || 55000;
        const range = 5000;
        const tickLower =
          Math.floor((currentTick - range / 2) / tickSpacing) * tickSpacing;
        const tickUpper =
          Math.floor((currentTick + range / 2) / tickSpacing) * tickSpacing;
        addLog(`📊 Tick range: [${tickLower}, ${tickUpper}]`);

        const result = { ...info, tickLower, tickUpper, tickSpacing };
        setPoolInfoCache(result);
        return result;
      } catch (e: any) {
        addLog(`❌ Error: ${e.message}`);
        return null;
      }
    },
    [suiClient]
  );

  // Fetch pool info on mount / pool change
  useEffect(() => {
    getPoolInfo(pool.id);
    // Reset custom ticks when pool changes
    setCustomTickLower("");
    setCustomTickUpper("");
  }, [pool.id]);

  // Fetch user's Cetus positions
  const fetchPositions = useCallback(async () => {
    if (!account) return toast.error("Connect wallet first");
    setLoadingPositions(true);
    addLog("🔍 Fetching your Cetus positions...");

    try {
      const objects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: CETUS_POSITION_TYPE },
        options: { showContent: true },
      });

      const list: PositionInfo[] = [];
      for (const obj of objects.data) {
        if (obj.data?.content?.dataType === "moveObject") {
          const fields = (obj.data.content as any).fields;
          list.push({
            id: obj.data.objectId,
            poolId: fields.pool || "unknown",
            liquidity: fields.liquidity || "0",
            tickLower: parseInt(fields.tick_lower_index?.fields?.bits || "0"),
            tickUpper: parseInt(fields.tick_upper_index?.fields?.bits || "0"),
          });
        }
      }

      setPositions(list);
      addLog(`✅ Found ${list.length} position(s)`);
      if (list.length === 0) addLog("ℹ️ No positions — open one first!");
    } catch (e: any) {
      addLog(`❌ Error fetching positions: ${e.message}`);
    } finally {
      setLoadingPositions(false);
    }
  }, [suiClient, account]);

  // Fetch all pools from Cetus factory
  const fetchFactoryPools = useCallback(async () => {
    setFetchingPools(true);
    addLog("🏊 Fetching pools from Cetus factory...");
    try {
      let cursor: string | null | undefined = undefined;
      const allFields: any[] = [];
      // Paginate dynamic fields
      while (true) {
        const page: any = await suiClient.getDynamicFields({
          parentId: CETUS_POOLS_LIST,
          limit: 50,
          cursor,
        });
        allFields.push(...page.data);
        if (!page.hasNextPage) break;
        cursor = page.nextPageCursor;
      }
      addLog(`📦 Found ${allFields.length} pool entries, fetching details...`);

      const pools: DiscoveredPool[] = [];
      for (const field of allFields) {
        try {
          const fieldObj = await suiClient.getDynamicFieldObject({
            parentId: CETUS_POOLS_LIST,
            name: field.name,
          });
          const fields = (fieldObj.data?.content as any)?.fields;
          const poolId = fields?.value?.fields?.value?.fields?.pool_id;
          if (!poolId || typeof poolId !== "string") continue;

          const info = await fetchPoolInfo(suiClient as any, poolId);
          if (!info?.coinA || !info?.coinB) continue;

          const symA = coinSymbol(info.coinA);
          const symB = coinSymbol(info.coinB);
          pools.push({
            id: poolId,
            coinA: info.coinA,
            coinB: info.coinB,
            name: `${symA}/${symB}`,
            tickSpacing: info.tickSpacing,
          });
        } catch {}
        // Small delay to avoid 429
        await new Promise((r) => setTimeout(r, 150));
      }

      setDiscoveredPools(pools);
      addLog(`✅ Loaded ${pools.length} pools from factory`);
    } catch (e: any) {
      addLog(`❌ Error fetching factory pools: ${e.message}`);
    } finally {
      setFetchingPools(false);
    }
  }, [suiClient]);

  // Fetch wallet balances for both pool coins
  const fetchTokenBalances = useCallback(async () => {
    if (!account || !poolInfoCache) return;
    try {
      const fetchCoin = async (coinType: string) => {
        const bal = await suiClient.getBalance({ owner: account.address, coinType });
        const coins = await suiClient.getCoins({ owner: account.address, coinType });
        let decimals = 9;
        try {
          const meta = await suiClient.getCoinMetadata({ coinType });
          if (meta?.decimals) decimals = meta.decimals;
        } catch {}
        return {
          balance: bal.totalBalance,
          decimals,
          objectIds: coins.data.map((c) => c.coinObjectId),
        };
      };
      const [a, b] = await Promise.all([
        fetchCoin(poolInfoCache.coinA),
        fetchCoin(poolInfoCache.coinB),
      ]);
      setTokenBalances({ coinA: a, coinB: b });
    } catch {}
  }, [suiClient, account, poolInfoCache]);

  useEffect(() => {
    fetchTokenBalances();
  }, [fetchTokenBalances]);

  // Helpers for swap UI
  const inputSide = swapAtoB ? "coinA" : "coinB";
  const outputSide = swapAtoB ? "coinB" : "coinA";
  const inputBal = tokenBalances?.[inputSide];
  const outputBal = tokenBalances?.[outputSide];
  const inputSymbol = poolInfoCache
    ? (swapAtoB ? poolInfoCache.coinA : poolInfoCache.coinB).split("::").pop()
    : "";
  const outputSymbol = poolInfoCache
    ? (swapAtoB ? poolInfoCache.coinB : poolInfoCache.coinA).split("::").pop()
    : "";
  const inputHuman = inputBal
    ? (Number(inputBal.balance) / Math.pow(10, inputBal.decimals)).toFixed(4)
    : "0";
  const outputHuman = outputBal
    ? (Number(outputBal.balance) / Math.pow(10, outputBal.decimals)).toFixed(4)
    : "0";

  // Effective tick range (custom or auto from pool info)
  const getEffectiveTicks = (poolInfo: any) => {
    if (useCustomTicks && customTickLower && customTickUpper) {
      return {
        tickLower: parseInt(customTickLower),
        tickUpper: parseInt(customTickUpper),
      };
    }
    return { tickLower: poolInfo.tickLower, tickUpper: poolInfo.tickUpper };
  };

  // Coin symbols for pool
  const coinASymbol = poolInfoCache ? coinSymbol(poolInfoCache.coinA) : "CoinA";
  const coinBSymbol = poolInfoCache ? coinSymbol(poolInfoCache.coinB) : "CoinB";

  // Resolve pool name from allPools list
  const getPoolName = (poolId: string) => {
    const found = allPools.find((p) => p.id === poolId);
    return found ? found.name : null;
  };

  // === SWAP ===
  const runSwap = async () => {
    if (!account) return toast.error("Connect wallet first");
    const amount = parseFloat(swapAmount);
    if (isNaN(amount) || amount <= 0) return toast.error("Invalid amount");

    resetState();
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) return setStatus("error");

    try {
      const tx = new Transaction();
      const inputCoinType = swapAtoB ? poolInfo.coinA : poolInfo.coinB;
      const decimals = inputBal?.decimals ?? (isSuiCoin(inputCoinType) ? 9 : 6);
      const amountRaw = BigInt(Math.floor(amount * 10 ** decimals));

      addLog(
        `🔄 Flash swap: ${amount} ${inputCoinType.split("::").pop()} (${swapAtoB ? "A→B" : "B→A"})...`
      );

      if (isSuiCoin(inputCoinType)) {
        // SUI input — use gas splitting version
        buildSwapCoreTx(
          tx,
          {
            poolId: pool.id,
            coinA: poolInfo.coinA,
            coinB: poolInfo.coinB,
            amountIn: amountRaw,
            aToB: swapAtoB,
            byAmountIn: true,
          },
          account.address
        );
      } else {
        // Non-SUI input — need to merge coins and pass object ID
        const coins = await suiClient.getCoins({
          owner: account.address,
          coinType: inputCoinType,
        });
        if (coins.data.length === 0) {
          addLog(`❌ No ${inputCoinType.split("::").pop()} coins in wallet`);
          setStatus("error");
          return;
        }
        // Merge all coins into the first one
        const primaryId = coins.data[0].coinObjectId;
        if (coins.data.length > 1) {
          const primary = tx.object(primaryId);
          tx.mergeCoins(
            primary,
            coins.data.slice(1).map((c) => tx.object(c.coinObjectId))
          );
        }

        buildSwapCoreWithCoinTx(
          tx,
          {
            poolId: pool.id,
            coinA: poolInfo.coinA,
            coinB: poolInfo.coinB,
            coinObjectId: primaryId,
            amountIn: amountRaw,
            aToB: swapAtoB,
            byAmountIn: true,
          },
          account.address
        );
      }

      addLog("📝 Signing transaction...");
      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result: { digest: string }) => {
            onTxSuccess(result);
            fetchTokenBalances(); // refresh balances
          },
          onError: onTxError,
        }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // === OPEN POSITION (empty) ===
  const runOpenPosition = async () => {
    if (!account) return toast.error("Connect wallet first");
    resetState();
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) return setStatus("error");

    const { tickLower, tickUpper } = getEffectiveTicks(poolInfo);

    try {
      const tx = new Transaction();
      addLog(`📌 Opening empty position (CORE) ticks [${tickLower}, ${tickUpper}]...`);

      buildOpenPositionCoreTx(
        tx,
        {
          poolId: pool.id,
          coinA: poolInfo.coinA,
          coinB: poolInfo.coinB,
          tickLower,
          tickUpper,
        },
        account.address
      );

      signAndExecuteTransaction(
        { transaction: tx as any },
        { onSuccess: onTxSuccess, onError: onTxError }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // Helper: merge all coins of a type into one object in the PTB, return the primary ref
  const mergeCoinsInTx = async (
    tx: Transaction,
    coinType: string,
    owner: string
  ): Promise<any> => {
    const coins = await suiClient.getCoins({ owner, coinType });
    if (coins.data.length === 0) return null;
    const primary = tx.object(coins.data[0].coinObjectId);
    if (coins.data.length > 1) {
      tx.mergeCoins(
        primary,
        coins.data.slice(1).map((c) => tx.object(c.coinObjectId))
      );
    }
    return primary;
  };

  // === OPEN POSITION + LIQUIDITY ===
  const runOpenWithLiquidity = async () => {
    if (!account) return toast.error("Connect wallet first");

    // Use whichever side the user is fixing
    const fixAmountA = fixSide === "A";
    const fixedAmount = fixAmountA ? posAmountA : posAmountB;
    const amt = parseFloat(fixedAmount);
    if (isNaN(amt) || amt <= 0)
      return toast.error(`Invalid ${fixAmountA ? coinASymbol : coinBSymbol} amount`);

    resetState();
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) return setStatus("error");

    const { tickLower, tickUpper } = getEffectiveTicks(poolInfo);

    // Determine decimals for the fixed side
    const fixedCoinType = fixAmountA ? poolInfo.coinA : poolInfo.coinB;
    let decimals = 9;
    if (tokenBalances) {
      decimals = fixAmountA ? tokenBalances.coinA.decimals : tokenBalances.coinB.decimals;
    } else if (!isSuiCoin(fixedCoinType)) {
      decimals = 6; // default for stablecoins
    }
    const amount = BigInt(Math.floor(amt * 10 ** decimals));

    try {
      const tx = new Transaction();

      // Fetch non-SUI coins for BOTH sides so the receipt pattern can split the needed amount
      let coinASource: any = undefined;
      let coinBSource: any = undefined;
      if (!isSuiCoin(poolInfo.coinA)) {
        addLog(`🔍 Fetching ${coinSymbol(poolInfo.coinA)} coins...`);
        coinASource = await mergeCoinsInTx(tx, poolInfo.coinA, account.address);
        if (!coinASource) {
          addLog(`⚠️ No ${coinSymbol(poolInfo.coinA)} coins — pool may need some for the other side`);
        }
      }
      if (!isSuiCoin(poolInfo.coinB)) {
        addLog(`🔍 Fetching ${coinSymbol(poolInfo.coinB)} coins...`);
        coinBSource = await mergeCoinsInTx(tx, poolInfo.coinB, account.address);
        if (!coinBSource) {
          addLog(`⚠️ No ${coinSymbol(poolInfo.coinB)} coins — pool may need some for the other side`);
        }
      }

      addLog(
        `📌 Opening position + fixing ${amt} ${fixAmountA ? coinASymbol : coinBSymbol} (fixAmountA=${fixAmountA}, ticks [${tickLower}, ${tickUpper}])...`
      );

      buildOpenPositionWithLiquidityCoreTx(
        tx,
        {
          poolId: pool.id,
          coinA: poolInfo.coinA,
          coinB: poolInfo.coinB,
          tickLower,
          tickUpper,
          amount,
          fixAmountA,
          coinASource,
          coinBSource,
        },
        account.address
      );

      signAndExecuteTransaction(
        { transaction: tx as any },
        { onSuccess: onTxSuccess, onError: onTxError }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // === ADD LIQUIDITY ===
  const runAddLiquidity = async () => {
    if (!account) return toast.error("Connect wallet first");
    if (!positionId) return toast.error("Enter position ID");

    const fixAmountA = fixSide === "A";
    const fixedAmount = fixAmountA ? posAmountA : posAmountB;
    const amt = parseFloat(fixedAmount);
    if (isNaN(amt) || amt <= 0) return toast.error("Invalid amount");

    resetState();
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) return setStatus("error");

    // Determine decimals for the fixed side
    let decimals = 9;
    if (tokenBalances) {
      decimals = fixAmountA ? tokenBalances.coinA.decimals : tokenBalances.coinB.decimals;
    } else if (!isSuiCoin(fixAmountA ? poolInfo.coinA : poolInfo.coinB)) {
      decimals = 6;
    }

    try {
      const tx = new Transaction();

      // Fetch non-SUI coins for BOTH sides
      let coinASource: any = undefined;
      let coinBSource: any = undefined;
      if (!isSuiCoin(poolInfo.coinA)) {
        coinASource = await mergeCoinsInTx(tx, poolInfo.coinA, account.address);
      }
      if (!isSuiCoin(poolInfo.coinB)) {
        coinBSource = await mergeCoinsInTx(tx, poolInfo.coinB, account.address);
      }

      addLog(
        `➕ Adding ${amt} ${fixAmountA ? coinSymbol(poolInfo.coinA) : coinSymbol(poolInfo.coinB)} (fixAmountA=${fixAmountA}) to position...`
      );

      buildAddLiquidityCoreTx(
        tx,
        {
          poolId: pool.id,
          coinA: poolInfo.coinA,
          coinB: poolInfo.coinB,
          positionId,
          amount: BigInt(Math.floor(amt * 10 ** decimals)),
          fixAmountA,
          coinASource,
          coinBSource,
        },
        account.address
      );

      signAndExecuteTransaction(
        { transaction: tx as any },
        { onSuccess: onTxSuccess, onError: onTxError }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // === REMOVE LIQUIDITY ===
  const runRemoveLiquidity = async () => {
    if (!account) return toast.error("Connect wallet first");
    if (!positionId) return toast.error("Enter position ID");
    const delta = BigInt(deltaLiquidity || "0");
    if (delta <= 0n) return toast.error("Invalid delta liquidity");

    resetState();

    try {
      const { posPoolId, posPoolInfo } = await getPositionPoolInfo(positionId);
      const tx = new Transaction();
      addLog(`➖ Removing ${delta.toString()} liquidity...`);

      buildRemoveLiquidityCoreTx(
        tx,
        {
          poolId: posPoolId,
          coinA: posPoolInfo.coinA,
          coinB: posPoolInfo.coinB,
          positionId,
          deltaLiquidity: delta,
        },
        account.address
      );

      signAndExecuteTransaction(
        { transaction: tx as any },
        { onSuccess: onTxSuccess, onError: onTxError }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // === COLLECT FEES ===
  const runCollectFees = async () => {
    if (!account) return toast.error("Connect wallet first");
    if (!positionId) return toast.error("Enter position ID");

    resetState();

    try {
      const { posPoolId, posPoolInfo } = await getPositionPoolInfo(positionId);
      const tx = new Transaction();
      addLog("💰 Collecting fees (CORE)...");

      buildCollectFeeCoreTx(
        tx,
        {
          poolId: posPoolId,
          coinA: posPoolInfo.coinA,
          coinB: posPoolInfo.coinB,
          positionId,
        },
        account.address
      );

      signAndExecuteTransaction(
        { transaction: tx as any },
        { onSuccess: onTxSuccess, onError: onTxError }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // Helper: fetch position's actual pool info from chain
  const getPositionPoolInfo = async (posId: string) => {
    addLog("🔍 Fetching position info...");
    const posObj = await suiClient.getObject({
      id: posId,
      options: { showContent: true },
    });
    const fields = (posObj.data?.content as any)?.fields;
    const posPoolId = fields?.pool;
    const liquidity = fields?.liquidity ? BigInt(fields.liquidity) : 0n;

    if (!posPoolId) throw new Error("Could not read position's pool ID");

    // Warn if position's pool differs from selected pool
    if (posPoolId !== pool.id) {
      addLog(`⚠️ Position belongs to pool ${posPoolId.slice(0, 16)}... (not the selected pool)`);
      addLog(`   Using position's actual pool instead.`);
    }

    addLog(`📊 Position liquidity: ${liquidity.toString()}`);
    const posPoolInfo = await fetchPoolInfo(suiClient as any, posPoolId);
    if (!posPoolInfo?.coinA || !posPoolInfo?.coinB) {
      throw new Error("Failed to fetch position's pool info");
    }
    addLog(`✅ Pool: ${coinSymbol(posPoolInfo.coinA)}/${coinSymbol(posPoolInfo.coinB)}`);
    return { posPoolId, posPoolInfo, liquidity };
  };

  // === CLOSE POSITION ===
  const runClosePosition = async () => {
    if (!account) return toast.error("Connect wallet first");
    if (!positionId) return toast.error("Enter position ID");

    resetState();

    try {
      const { posPoolId, posPoolInfo, liquidity } = await getPositionPoolInfo(positionId);

      const tx = new Transaction();
      addLog(
        `🔥 Closing position (remove liq: ${liquidity}, collect fees, destroy)...`
      );

      buildClosePositionCoreTx(
        tx,
        {
          poolId: posPoolId,
          coinA: posPoolInfo.coinA,
          coinB: posPoolInfo.coinB,
          positionId,
          deltaLiquidity: liquidity,
        },
        account.address
      );

      signAndExecuteTransaction(
        { transaction: tx as any },
        { onSuccess: onTxSuccess, onError: onTxError }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // === ZAP ===
  const runZap = async () => {
    if (!account) return toast.error("Connect wallet first");
    const amount = parseFloat(zapAmount);
    if (isNaN(amount) || amount <= 0) return toast.error("Invalid amount");

    resetState();
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) return setStatus("error");

    const inputIsA = zapInputSide === "A";
    const inputCoinType = inputIsA ? poolInfo.coinA : poolInfo.coinB;
    const inputIsSui = isSuiCoin(inputCoinType);

    // Determine decimals for input coin
    let decimals = 9;
    if (tokenBalances) {
      decimals = inputIsA ? tokenBalances.coinA.decimals : tokenBalances.coinB.decimals;
    } else if (!inputIsSui) {
      decimals = 6;
    }
    const amountRaw = BigInt(Math.floor(amount * 10 ** decimals));
    const { tickLower, tickUpper } = getEffectiveTicks(poolInfo);
    const inputSym = coinSymbol(inputCoinType);

    try {
      const tx = new Transaction();

      // Prepare coin source for non-SUI input
      let coinSource: any = undefined;
      if (!inputIsSui) {
        addLog(`🔍 Fetching ${inputSym} coins for zap...`);
        coinSource = await mergeCoinsInTx(tx, inputCoinType, account.address);
        if (!coinSource) {
          addLog(`❌ No ${inputSym} coins in wallet`);
          setStatus("error");
          return;
        }
      }

      addLog(
        `⚡ Zapping ${amount} ${inputSym} (flash_swap + open + add liq, ticks [${tickLower}, ${tickUpper}])...`
      );

      buildZapCoreTx(
        tx,
        {
          poolId: pool.id,
          coinA: poolInfo.coinA,
          coinB: poolInfo.coinB,
          tickLower,
          tickUpper,
          amountIn: amountRaw,
          inputIsA,
          coinSource,
        },
        account.address
      );

      signAndExecuteTransaction(
        { transaction: tx as any },
        { onSuccess: onTxSuccess, onError: onTxError }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // === CREATE POOL ===
  const runCreatePool = async () => {
    if (!account) return toast.error("Connect wallet first");
    if (!newCoinA || !newCoinB)
      return toast.error("Enter both coin types");
    if (newCoinA === newCoinB) return toast.error("Coins must differ");

    const price = parseFloat(newInitPrice);
    const amtA = parseFloat(newAmountA);
    const amtB = parseFloat(newAmountB);
    if (isNaN(price) || price <= 0) return toast.error("Invalid price");
    if (isNaN(amtA) || amtA <= 0 || isNaN(amtB) || amtB <= 0)
      return toast.error("Invalid amounts");

    resetState();

    try {
      const tx = new Transaction();
      const tickSpacing = parseInt(newTickSpacing) || 60;

      // sqrt_price_x64 from price
      const sqrtPrice = Math.sqrt(price);
      const initSqrtPrice = BigInt(
        Math.floor(sqrtPrice * Math.pow(2, 64))
      );

      // Full range ticks
      const MIN_T = -443520;
      const MAX_T = 443520;
      const tickLower =
        Math.ceil(MIN_T / tickSpacing) * tickSpacing;
      const tickUpper =
        Math.floor(MAX_T / tickSpacing) * tickSpacing;

      addLog(
        `🏭 Creating pool: ${newCoinA.split("::").pop()}/${newCoinB.split("::").pop()}`
      );
      addLog(`📊 Price: ${price}, Ticks: [${tickLower}, ${tickUpper}]`);

      // Determine decimals
      const decA = isSuiCoin(newCoinA) ? 9 : 6;
      const decB = isSuiCoin(newCoinB) ? 9 : 6;
      const rawA = BigInt(Math.floor(amtA * 10 ** decA));
      const rawB = BigInt(Math.floor(amtB * 10 ** decB));

      // Prepare coins
      let coinAInput: any;
      let coinBInput: any;

      if (isSuiCoin(newCoinA)) {
        [coinAInput] = tx.splitCoins(tx.gas, [tx.pure.u64(rawA)]);
      } else {
        const coins = await suiClient.getCoins({
          owner: account.address,
          coinType: newCoinA,
        });
        if (coins.data.length === 0) {
          addLog("❌ No coins of type A found");
          setStatus("error");
          return;
        }
        if (coins.data.length === 1) {
          [coinAInput] = tx.splitCoins(
            tx.object(coins.data[0].coinObjectId),
            [tx.pure.u64(rawA)]
          );
        } else {
          const primary = tx.object(coins.data[0].coinObjectId);
          for (const c of coins.data.slice(1)) {
            tx.mergeCoins(primary, [tx.object(c.coinObjectId)]);
          }
          [coinAInput] = tx.splitCoins(primary, [tx.pure.u64(rawA)]);
        }
      }

      if (isSuiCoin(newCoinB)) {
        [coinBInput] = tx.splitCoins(tx.gas, [tx.pure.u64(rawB)]);
      } else {
        const coins = await suiClient.getCoins({
          owner: account.address,
          coinType: newCoinB,
        });
        if (coins.data.length === 0) {
          addLog("❌ No coins of type B found");
          setStatus("error");
          return;
        }
        if (coins.data.length === 1) {
          [coinBInput] = tx.splitCoins(
            tx.object(coins.data[0].coinObjectId),
            [tx.pure.u64(rawB)]
          );
        } else {
          const primary = tx.object(coins.data[0].coinObjectId);
          for (const c of coins.data.slice(1)) {
            tx.mergeCoins(primary, [tx.object(c.coinObjectId)]);
          }
          [coinBInput] = tx.splitCoins(primary, [tx.pure.u64(rawB)]);
        }
      }

      buildCreatePoolCoreTx(
        tx,
        {
          coinA: newCoinA,
          coinB: newCoinB,
          tickSpacing,
          initSqrtPrice,
          tickLower,
          tickUpper,
          coinAInput,
          coinBInput,
          fixAmountA: true,
        },
        account.address
      );

      addLog("📝 Signing transaction...");
      signAndExecuteTransaction(
        { transaction: tx as any },
        { onSuccess: onTxSuccess, onError: onTxError }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // === TABS ===
  const tabs: { key: TabType; label: string }[] = [
    { key: "swap", label: "Swap" },
    { key: "position", label: "Position" },
    { key: "liquidity", label: "Liquidity" },
    { key: "pool", label: "Pool" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-white">
          CLMM Core Debug
        </h1>
        <p className="text-sm text-white/40">
          CORE package only — works with ALL pools including legacy
        </p>
        <code className="text-[10px] text-indigo-400/60 break-all block">
          {CETUS_CORE_PACKAGE}
        </code>
      </div>

      {/* Info */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-xs text-indigo-200/70 space-y-1">
        <p>
          <strong>flash_swap</strong> pattern: pool gives output first →
          must repay via receipt (non-droppable)
        </p>
        <p>
          <strong>Balance vs Coin</strong>: CORE returns Balance&lt;T&gt;
          — uses coin::from_balance / coin::into_balance for conversion
        </p>
      </div>

      {/* Pool Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">
            {allPools.length} pool{allPools.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={fetchFactoryPools}
            disabled={fetchingPools}
            className="px-3 py-1 text-xs bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white rounded-lg transition"
          >
            {fetchingPools ? "Fetching..." : "Fetch All Pools from Factory"}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
          {allPools.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePoolId(p.id)}
              className={`p-2 rounded-lg border text-left transition-all text-sm ${
                activePoolId === p.id
                  ? "border-indigo-500 bg-indigo-500/20 text-white"
                  : "border-white/10 hover:border-white/20 text-white/50"
              }`}
            >
              <div className="font-medium text-xs flex items-center gap-1">
                {p.name}
                {p.source === "factory" && (
                  <span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-1 rounded">factory</span>
                )}
              </div>
              <div className="text-[10px] opacity-40 truncate">
                {p.id.slice(0, 10)}...
              </div>
            </button>
          ))}
        </div>

        {/* Custom pool ID */}
        <div className="flex gap-2">
          <input
            placeholder="Or enter pool ID: 0x..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val.startsWith("0x")) setActivePoolId(val);
              }
            }}
          />
        </div>
      </div>

      {/* Balances */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
        <span className="bg-white/5 px-3 py-1 rounded-lg">
          {formattedSuiBalance} SUI
        </span>
        {tokenBalances && poolInfoCache && (
          <>
            <span className="bg-white/5 px-3 py-1 rounded-lg">
              {(Number(tokenBalances.coinA.balance) / Math.pow(10, tokenBalances.coinA.decimals)).toFixed(4)}{" "}
              <span className="text-indigo-400">{poolInfoCache.coinA.split("::").pop()}</span>
            </span>
            <span className="bg-white/5 px-3 py-1 rounded-lg">
              {(Number(tokenBalances.coinB.balance) / Math.pow(10, tokenBalances.coinB.decimals)).toFixed(4)}{" "}
              <span className="text-indigo-400">{poolInfoCache.coinB.split("::").pop()}</span>
            </span>
          </>
        )}
        <span>
          Pool:{" "}
          <span className="text-indigo-400">{pool.name}</span>
        </span>
        {poolInfoCache && (
          <span className="text-[10px] text-white/30">
            tick_spacing: {poolInfoCache.tickSpacing}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-indigo-500/20 text-indigo-400 border-b-2 border-indigo-500"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Swap */}
      {activeTab === "swap" && (
        <div className="bg-white/5 rounded-xl p-5 space-y-4 border border-white/10">
          <h3 className="text-sm font-semibold text-white/80">
            Flash Swap (CORE)
          </h3>

          {/* Direction toggle */}
          <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
            <div className="text-center flex-1">
              <div className="text-xs text-white/40 mb-0.5">From</div>
              <div className="text-sm font-semibold text-white">{inputSymbol || "?"}</div>
              <div className="text-[10px] text-white/30">bal: {inputHuman}</div>
            </div>
            <button
              onClick={() => setSwapAtoB(!swapAtoB)}
              className="mx-3 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition text-sm font-bold"
            >
              ⇄
            </button>
            <div className="text-center flex-1">
              <div className="text-xs text-white/40 mb-0.5">To</div>
              <div className="text-sm font-semibold text-white">{outputSymbol || "?"}</div>
              <div className="text-[10px] text-white/30">bal: {outputHuman}</div>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-white/50">
                Amount ({inputSymbol})
              </label>
              {inputBal && (
                <button
                  onClick={() =>
                    setSwapAmount(
                      (Number(inputBal.balance) / Math.pow(10, inputBal.decimals)).toString()
                    )
                  }
                  className="text-[10px] text-indigo-400 hover:text-indigo-300"
                >
                  MAX: {inputHuman}
                </button>
              )}
            </div>
            <input
              type="number"
              value={swapAmount}
              onChange={(e) => setSwapAmount(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="0.01"
            />
          </div>

          <button
            onClick={runSwap}
            disabled={status === "executing" || !account}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition"
          >
            {status === "executing"
              ? "Executing..."
              : `Swap ${inputSymbol} → ${outputSymbol}`}
          </button>
        </div>
      )}

      {/* TAB: Position */}
      {activeTab === "position" && (
        <div className="bg-white/5 rounded-xl p-5 space-y-4 border border-white/10">
          <h3 className="text-sm font-semibold text-white/80">
            Position Operations (CORE)
          </h3>

          {/* Fix Side Toggle */}
          <div className="space-y-2">
            <label className="text-xs text-white/40">Fix which side? (the side you specify the exact amount for)</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFixSide("A")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition border ${
                  fixSide === "A"
                    ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                    : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                }`}
              >
                Fix {coinASymbol}
              </button>
              <button
                onClick={() => setFixSide("B")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition border ${
                  fixSide === "B"
                    ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                    : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                }`}
              >
                Fix {coinBSymbol}
              </button>
            </div>
            <p className="text-[10px] text-white/30">
              {fixSide === "A"
                ? `You specify exact ${coinASymbol} amount. Pool determines how much ${coinBSymbol} is needed.`
                : `You specify exact ${coinBSymbol} amount. Pool determines how much ${coinASymbol} is needed.`}
            </p>
          </div>

          {/* Amount inputs with coin symbols */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-white/50">
                  Amount {coinASymbol} {fixSide === "A" && <span className="text-indigo-400">(fixed)</span>}
                </label>
                {tokenBalances && (
                  <button
                    onClick={() => setPosAmountA(
                      (Number(tokenBalances.coinA.balance) / Math.pow(10, tokenBalances.coinA.decimals)).toString()
                    )}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    MAX: {(Number(tokenBalances.coinA.balance) / Math.pow(10, tokenBalances.coinA.decimals)).toFixed(4)}
                  </button>
                )}
              </div>
              <input
                type="number"
                value={posAmountA}
                onChange={(e) => setPosAmountA(e.target.value)}
                className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none ${
                  fixSide === "A" ? "border-indigo-500/50 focus:border-indigo-400" : "border-white/10 focus:border-indigo-500"
                }`}
                placeholder="0.01"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-white/50">
                  Amount {coinBSymbol} {fixSide === "B" && <span className="text-indigo-400">(fixed)</span>}
                </label>
                {tokenBalances && (
                  <button
                    onClick={() => setPosAmountB(
                      (Number(tokenBalances.coinB.balance) / Math.pow(10, tokenBalances.coinB.decimals)).toString()
                    )}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    MAX: {(Number(tokenBalances.coinB.balance) / Math.pow(10, tokenBalances.coinB.decimals)).toFixed(4)}
                  </button>
                )}
              </div>
              <input
                type="number"
                value={posAmountB}
                onChange={(e) => setPosAmountB(e.target.value)}
                className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none ${
                  fixSide === "B" ? "border-indigo-500/50 focus:border-indigo-400" : "border-white/10 focus:border-indigo-500"
                }`}
                placeholder="0.01"
              />
            </div>
          </div>

          {/* Custom Tick Range */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomTicks}
                  onChange={(e) => setUseCustomTicks(e.target.checked)}
                  className="rounded border-white/20"
                />
                <span className="text-xs text-white/50">Custom tick range</span>
              </label>
              {poolInfoCache && (
                <span className="text-[10px] text-white/25">
                  current tick: {poolInfoCache.currentTick || "?"} | auto: [{poolInfoCache.tickLower}, {poolInfoCache.tickUpper}]
                </span>
              )}
            </div>
            {useCustomTicks && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 block mb-1">Tick Lower</label>
                  <input
                    type="number"
                    value={customTickLower}
                    onChange={(e) => setCustomTickLower(e.target.value)}
                    placeholder={poolInfoCache?.tickLower?.toString() || "120000"}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">Tick Upper</label>
                  <input
                    type="number"
                    value={customTickUpper}
                    onChange={(e) => setCustomTickUpper(e.target.value)}
                    placeholder={poolInfoCache?.tickUpper?.toString() || "125000"}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={runOpenPosition}
              disabled={status === "executing" || !account}
              className="py-2.5 bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition"
            >
              Open Empty Position
            </button>
            <button
              onClick={runOpenWithLiquidity}
              disabled={status === "executing" || !account}
              className="py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition"
            >
              Open + Add Liq (fix {fixSide === "A" ? coinASymbol : coinBSymbol})
            </button>
          </div>

          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-red-300">Close Position</h4>
              <button
                onClick={fetchPositions}
                disabled={loadingPositions || !account}
                className="px-3 py-1 text-xs bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white rounded-lg transition"
              >
                {loadingPositions ? "Loading..." : "Fetch My Positions"}
              </button>
            </div>

            {positions.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {positions.map((pos) => {
                  const pName = getPoolName(pos.poolId);
                  const tl = pos.tickLower >= 2 ** 31 ? pos.tickLower - 2 ** 32 : pos.tickLower;
                  const tu = pos.tickUpper >= 2 ** 31 ? pos.tickUpper - 2 ** 32 : pos.tickUpper;
                  return (
                    <div
                      key={pos.id}
                      onClick={() => {
                        setPositionId(pos.id);
                        setDeltaLiquidity(pos.liquidity);
                      }}
                      className={`p-2 rounded-lg cursor-pointer transition text-xs ${
                        positionId === pos.id
                          ? "bg-indigo-500/20 border border-indigo-500"
                          : "bg-white/5 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono">
                            {pos.id.slice(0, 8)}...{pos.id.slice(-6)}
                          </span>
                          {pName && (
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                              {pName}
                            </span>
                          )}
                        </div>
                        {positionId === pos.id && (
                          <span className="text-indigo-400 text-[10px]">selected</span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-1 text-white/40">
                        <span>liq: {pos.liquidity}</span>
                        <span>ticks: [{tl}, {tu}]</span>
                      </div>
                      {!pName && (
                        <div className="text-white/25 mt-0.5 truncate">
                          pool: {pos.poolId.slice(0, 16)}...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <label className="text-xs text-white/50 block mb-1">
                Position ID
              </label>
              <input
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
                placeholder="0x... (or select above)"
              />
            </div>

            <button
              onClick={runClosePosition}
              disabled={
                status === "executing" || !account || !positionId
              }
              className="w-full py-2.5 bg-red-600/80 hover:bg-red-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition"
            >
              Close Position (remove liq + collect fees + destroy)
            </button>
          </div>
        </div>
      )}

      {/* TAB: Liquidity */}
      {activeTab === "liquidity" && (
        <div className="bg-white/5 rounded-xl p-5 space-y-4 border border-white/10">
          <h3 className="text-sm font-semibold text-white/80">
            Liquidity Operations (CORE)
          </h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/50">Position</label>
              <button
                onClick={fetchPositions}
                disabled={loadingPositions || !account}
                className="px-3 py-1 text-xs bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white rounded-lg transition"
              >
                {loadingPositions ? "Loading..." : "Fetch Positions"}
              </button>
            </div>

            {positions.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {positions.map((pos) => {
                  const pName = getPoolName(pos.poolId);
                  const tl = pos.tickLower >= 2 ** 31 ? pos.tickLower - 2 ** 32 : pos.tickLower;
                  const tu = pos.tickUpper >= 2 ** 31 ? pos.tickUpper - 2 ** 32 : pos.tickUpper;
                  return (
                    <div
                      key={pos.id}
                      onClick={() => {
                        setPositionId(pos.id);
                        setDeltaLiquidity(pos.liquidity);
                      }}
                      className={`p-2 rounded-lg cursor-pointer transition text-xs ${
                        positionId === pos.id
                          ? "bg-indigo-500/20 border border-indigo-500"
                          : "bg-white/5 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono">
                            {pos.id.slice(0, 8)}...{pos.id.slice(-6)}
                          </span>
                          {pName && (
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                              {pName}
                            </span>
                          )}
                        </div>
                        {positionId === pos.id && (
                          <span className="text-indigo-400 text-[10px]">selected</span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-1 text-white/40">
                        <span>liq: {pos.liquidity}</span>
                        <span>ticks: [{tl}, {tu}]</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <input
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
              placeholder="0x... (or select above)"
            />
          </div>

          {/* Fix Side Toggle for Add Liquidity */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">Fix side for Add Liquidity:</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFixSide("A")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition border ${
                  fixSide === "A"
                    ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                    : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                }`}
              >
                Fix {coinASymbol}
              </button>
              <button
                onClick={() => setFixSide("B")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition border ${
                  fixSide === "B"
                    ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                    : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                }`}
              >
                Fix {coinBSymbol}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-white/50">
                  Amount {coinASymbol} {fixSide === "A" && <span className="text-indigo-400">(fixed)</span>}
                </label>
                {tokenBalances && (
                  <button
                    onClick={() => setPosAmountA(
                      (Number(tokenBalances.coinA.balance) / Math.pow(10, tokenBalances.coinA.decimals)).toString()
                    )}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    MAX
                  </button>
                )}
              </div>
              <input
                type="number"
                value={posAmountA}
                onChange={(e) => setPosAmountA(e.target.value)}
                className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none ${
                  fixSide === "A" ? "border-indigo-500/50 focus:border-indigo-400" : "border-white/10 focus:border-indigo-500"
                }`}
                placeholder="0.01"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-white/50">
                  Amount {coinBSymbol} {fixSide === "B" && <span className="text-indigo-400">(fixed)</span>}
                </label>
                {tokenBalances && (
                  <button
                    onClick={() => setPosAmountB(
                      (Number(tokenBalances.coinB.balance) / Math.pow(10, tokenBalances.coinB.decimals)).toString()
                    )}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    MAX
                  </button>
                )}
              </div>
              <input
                type="number"
                value={posAmountB}
                onChange={(e) => setPosAmountB(e.target.value)}
                className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none ${
                  fixSide === "B" ? "border-indigo-500/50 focus:border-indigo-400" : "border-white/10 focus:border-indigo-500"
                }`}
                placeholder="0.01"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 block mb-1">
              Delta Liquidity (for remove)
            </label>
            <input
              type="text"
              value={deltaLiquidity}
              onChange={(e) => setDeltaLiquidity(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              placeholder="1000"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={runAddLiquidity}
              disabled={
                status === "executing" || !account || !positionId
              }
              className="py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition"
            >
              Add Liq (fix {fixSide === "A" ? coinASymbol : coinBSymbol})
            </button>
            <button
              onClick={runRemoveLiquidity}
              disabled={
                status === "executing" || !account || !positionId
              }
              className="py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition"
            >
              Remove Liquidity
            </button>
          </div>

          <button
            onClick={runCollectFees}
            disabled={
              status === "executing" || !account || !positionId
            }
            className="w-full py-2.5 bg-yellow-600/80 hover:bg-yellow-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition"
          >
            Collect Fees
          </button>

          <div className="border-t border-white/10 pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-purple-300">
              Zap (Single-Sided Liquidity)
            </h4>

            {/* Zap input coin selector */}
            <div className="space-y-1">
              <label className="text-xs text-white/40">Zap with:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setZapInputSide("A")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition border ${
                    zapInputSide === "A"
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                  }`}
                >
                  {coinASymbol}
                  {tokenBalances && (
                    <span className="text-[10px] opacity-60 ml-1">
                      ({(Number(tokenBalances.coinA.balance) / Math.pow(10, tokenBalances.coinA.decimals)).toFixed(2)})
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setZapInputSide("B")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition border ${
                    zapInputSide === "B"
                      ? "bg-purple-500/20 border-purple-500 text-purple-300"
                      : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                  }`}
                >
                  {coinBSymbol}
                  {tokenBalances && (
                    <span className="text-[10px] opacity-60 ml-1">
                      ({(Number(tokenBalances.coinB.balance) / Math.pow(10, tokenBalances.coinB.decimals)).toFixed(2)})
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-white/50">
                  Zap Amount ({zapInputSide === "A" ? coinASymbol : coinBSymbol})
                </label>
                {tokenBalances && (
                  <button
                    onClick={() => {
                      const bal = zapInputSide === "A" ? tokenBalances.coinA : tokenBalances.coinB;
                      setZapAmount((Number(bal.balance) / Math.pow(10, bal.decimals)).toString());
                    }}
                    className="text-[10px] text-purple-400 hover:text-purple-300"
                  >
                    MAX: {(() => {
                      const bal = zapInputSide === "A" ? tokenBalances.coinA : tokenBalances.coinB;
                      return (Number(bal.balance) / Math.pow(10, bal.decimals)).toFixed(4);
                    })()}
                  </button>
                )}
              </div>
              <input
                type="number"
                value={zapAmount}
                onChange={(e) => setZapAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                placeholder="0.02"
              />
            </div>
            <button
              onClick={runZap}
              disabled={status === "executing" || !account}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition"
            >
              Zap {zapInputSide === "A" ? coinASymbol : coinBSymbol} (flash_swap + open + add liq)
            </button>
          </div>
        </div>
      )}

      {/* TAB: Pool */}
      {activeTab === "pool" && (
        <div className="bg-white/5 rounded-xl p-5 space-y-4 border border-white/10">
          <h3 className="text-sm font-semibold text-white/80">
            Create Pool (CORE pool_creator)
          </h3>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-200/70">
            Uses pool_creator::create_pool_v3 from CORE package.
            Will fail if pool with same pair + tick_spacing already exists.
          </div>

          {/* Quick fill presets */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/40">Quick fill:</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "USDC (Circle)", type: COIN_USDC_CIRCLE },
                { label: "USDC (Cetus test)", type: COIN_USDC_CETUS },
                { label: "SUI", type: COIN_SUI },
              ].map((c) => (
                <button
                  key={c.type}
                  onClick={() => {
                    if (!newCoinA) setNewCoinA(c.type);
                    else if (!newCoinB) setNewCoinB(c.type);
                  }}
                  className="px-2 py-1 text-[10px] bg-white/10 hover:bg-white/15 text-white/70 rounded-md transition"
                >
                  {c.label}
                </button>
              ))}
              <button
                onClick={() => { setNewCoinA(""); setNewCoinB(""); }}
                className="px-2 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white/30 rounded-md transition"
              >
                Clear
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 block mb-1">
              Coin A Type
            </label>
            <input
              value={newCoinA}
              onChange={(e) => setNewCoinA(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
              placeholder="0x...::module::COIN"
            />
            {newCoinA === COIN_USDC_CIRCLE && (
              <span className="text-[10px] text-cyan-400/60 mt-0.5 block">Circle USDC (testnet)</span>
            )}
            {newCoinA === COIN_USDC_CETUS && (
              <span className="text-[10px] text-amber-400/60 mt-0.5 block">Cetus test USDC (not Circle)</span>
            )}
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">
              Coin B Type
            </label>
            <input
              value={newCoinB}
              onChange={(e) => setNewCoinB(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
              placeholder="0x2::sui::SUI"
            />
            {newCoinB === COIN_USDC_CIRCLE && (
              <span className="text-[10px] text-cyan-400/60 mt-0.5 block">Circle USDC (testnet)</span>
            )}
            {newCoinB === COIN_USDC_CETUS && (
              <span className="text-[10px] text-amber-400/60 mt-0.5 block">Cetus test USDC (not Circle)</span>
            )}
          </div>

          {/* Warning: pool already exists */}
          {newCoinA && newCoinB && (() => {
            const existingPools = allPools.filter(
              (p) =>
                (p.coinA === newCoinA && p.coinB === newCoinB) ||
                (p.coinA === newCoinB && p.coinB === newCoinA)
            );
            if (existingPools.length === 0) return null;
            const selectedTS = parseInt(newTickSpacing) || 60;
            const exactMatch = existingPools.find((p) => (p as any).tickSpacing === selectedTS);
            return (
              <div className={`${exactMatch ? "bg-red-500/10 border-red-500/30" : "bg-amber-500/10 border-amber-500/30"} border rounded-lg p-3 text-xs space-y-2`}>
                <p className={`${exactMatch ? "text-red-300" : "text-amber-300"} font-semibold`}>
                  {exactMatch
                    ? `Pool exists with SAME tick_spacing (${selectedTS})! Creation will fail.`
                    : `Pool(s) exist for this pair, but with different tick_spacing. You CAN create a new one with tick_spacing=${selectedTS}.`}
                </p>
                {existingPools.map((ep) => (
                  <p key={ep.id} className="text-white/40">
                    {ep.name} — tick_spacing: {(ep as any).tickSpacing || "?"} — {ep.id.slice(0, 16)}...
                  </p>
                ))}
                {exactMatch && (
                  <button
                    onClick={() => {
                      setActivePoolId(exactMatch.id);
                      setActiveTab("position");
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition"
                  >
                    Go to {exactMatch.name} &rarr; Open + Add Liquidity
                  </button>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">
                Tick Spacing
              </label>
              <select
                value={newTickSpacing}
                onChange={(e) => setNewTickSpacing(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="2">2 (0.01%)</option>
                <option value="4">4 (0.02%)</option>
                <option value="6">6 (0.03%)</option>
                <option value="8">8 (0.04%)</option>
                <option value="10">10 (0.05%)</option>
                <option value="20">20 (0.1%)</option>
                <option value="30">30 (0.15%)</option>
                <option value="40">40 (0.2%)</option>
                <option value="60">60 (0.25%)</option>
                <option value="80">80 (0.3%)</option>
                <option value="100">100 (0.4%)</option>
                <option value="120">120 (0.6%)</option>
                <option value="160">160 (0.8%)</option>
                <option value="200">200 (1%)</option>
                <option value="220">220 (2%)</option>
                <option value="260">260 (4%)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-white/50 block mb-1">
                Init Price (raw: coinA_amount / coinB_amount)
              </label>
              <input
                type="number"
                value={newInitPrice}
                onChange={(e) => setNewInitPrice(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                placeholder="0.001"
                step="any"
              />
              {/* Human-readable price guide */}
              {newCoinA && newCoinB && newInitPrice && (() => {
                const price = parseFloat(newInitPrice);
                if (isNaN(price) || price <= 0) return null;
                const decA = isSuiCoin(newCoinA) ? 9 : 6;
                const decB = isSuiCoin(newCoinB) ? 9 : 6;
                const humanPrice = price * Math.pow(10, decB - decA);
                const symA = coinSymbol(newCoinA);
                const symB = coinSymbol(newCoinB);
                return (
                  <p className="text-[10px] text-cyan-400/60 mt-1">
                    1 {symB} = {humanPrice.toFixed(4)} {symA}
                    {" | "}1 {symA} = {(1/humanPrice).toFixed(4)} {symB}
                  </p>
                );
              })()}
              {/* Quick price presets for USDC/SUI pairs */}
              {((newCoinA === COIN_USDC_CIRCLE || newCoinA === COIN_USDC_CETUS) && isSuiCoin(newCoinB)) && (
                <div className="flex gap-1.5 mt-1.5">
                  <span className="text-[10px] text-white/30">Presets:</span>
                  {[
                    { label: "1:1", price: "0.001", desc: "1 USDC = 1 SUI" },
                    { label: "1 SUI=$3", price: "0.003", desc: "1 SUI = 3 USDC" },
                    { label: "1 SUI=$5", price: "0.005", desc: "1 SUI = 5 USDC" },
                    { label: "1 SUI=$20", price: "0.02", desc: "1 SUI = 20 USDC" },
                    { label: "1 SUI=$200", price: "0.2", desc: "1 SUI = 200 USDC" },
                  ].map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setNewInitPrice(p.price)}
                      title={p.desc}
                      className="px-1.5 py-0.5 text-[10px] bg-white/10 hover:bg-white/15 text-white/60 rounded transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">
                Amount A
              </label>
              <input
                type="number"
                value={newAmountA}
                onChange={(e) => setNewAmountA(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">
                Amount B
              </label>
              <input
                type="number"
                value={newAmountB}
                onChange={(e) => setNewAmountB(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            onClick={runCreatePool}
            disabled={
              status === "executing" ||
              !account ||
              !newCoinA ||
              !newCoinB
            }
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition"
          >
            Create Pool (CORE)
          </button>
        </div>
      )}

      {/* Status & Logs */}
      {status !== "idle" && (
        <div
          className={`rounded-xl p-4 border ${
            status === "success"
              ? "bg-emerald-500/10 border-emerald-500/20"
              : status === "error"
                ? "bg-red-500/10 border-red-500/20"
                : "bg-indigo-500/10 border-indigo-500/20"
          }`}
        >
          <div className="flex items-center gap-2 mb-2 text-sm">
            {status === "executing" && (
              <span className="animate-spin text-indigo-400">
                &#9696;
              </span>
            )}
            <span
              className={`font-semibold capitalize ${
                status === "success"
                  ? "text-emerald-400"
                  : status === "error"
                    ? "text-red-400"
                    : "text-indigo-400"
              }`}
            >
              {status}
            </span>
          </div>

          {txDigest && (
            <a
              href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline block mb-2"
            >
              View on Suiscan: {txDigest.slice(0, 24)}...
            </a>
          )}

          <div className="bg-black/30 rounded-lg p-2 font-mono text-[11px] space-y-0.5 max-h-48 overflow-y-auto">
            {log.map((line, i) => (
              <div key={i} className="text-white/60">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Reference */}
      <div className="bg-white/[0.03] rounded-xl p-4 text-xs text-white/30 space-y-1">
        <p className="font-semibold text-white/50 mb-2">
          CORE Package Constants
        </p>
        <p>
          Package:{" "}
          <code className="text-indigo-400/50 break-all">
            {CETUS_CORE_PACKAGE}
          </code>
        </p>
        <p>
          GlobalConfig:{" "}
          <code className="text-indigo-400/50 break-all">
            {CETUS_GLOBAL_CONFIG}
          </code>
        </p>
        <p>
          Factory:{" "}
          <code className="text-indigo-400/50 break-all">
            {CETUS_FACTORY}
          </code>
        </p>
      </div>
    </div>
  );
}
