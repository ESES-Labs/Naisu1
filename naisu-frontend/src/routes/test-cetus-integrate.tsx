import { createFileRoute } from "@tanstack/react-router";
import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  CheckCircle2,
  ArrowDown,
  Wallet,
  Coins,
  RefreshCw,
  AlertCircle,
  Info,
} from "lucide-react";
import { useQuerySuiTokenBalance } from "@/hooks/sui/useQuerySuiTokenBalance";
import toast from "react-hot-toast";

// Import Cetus Service
import {
  CETUS_POOLS,
  COIN_SUI,
  // CETUS_CORE_PACKAGE,
  CETUS_INTEGRATE_PACKAGE,
  CETUS_GLOBAL_CONFIG,
  SUI_CLOCK,
  buildSwapTx,
  buildOpenPositionTx,
  buildOpenPositionCoreTx,
  buildOpenPositionWithSuiLiquidity,
  buildAddLiquidityOnlyBTx,
  // buildAddLiquidityCoreWithCoinTx,
  buildClosePositionTx,
  fetchPoolInfo,
  isSuiCoin,
} from "@/lib/cetus/cetusService";

export const Route = createFileRoute("/test-cetus-integrate")({
  component: CetusIntegratePage,
});

function CetusIntegratePage() {
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  const [status, setStatus] = useState<"idle" | "executing" | "success" | "error">("idle");
  const [log, setLog] = useState<string[]>([]);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"swap" | "position">("swap");

  // Selected pool
  const [selectedPool, setSelectedPool] = useState<keyof typeof CETUS_POOLS>("MEME_SUI");
  const pool = CETUS_POOLS[selectedPool];
  const isLegacyPool = (pool as any).isLegacy === true;

  // Initial fetch on mount or pool change
  useEffect(() => {
    getPoolInfo(pool.id);
  }, [pool.id]);

  // Inputs
  const [swapAmount, setSwapAmount] = useState("0.1");
  const [positionAmount, setPositionAmount] = useState("0.1");
  const [usdcAmount, setUsdcAmount] = useState("1.0"); // USDC amount (6 decimals)
  const [positionId, setPositionId] = useState("");
  const [poolPrice, setPoolPrice] = useState<number>(0); // Store pool price for auto-calc

  // Auto-calculate USDC when SUI changes
  const handleSuiAmountChange = (value: string) => {
    console.log("👉 Input SUI:", value);
    setPositionAmount(value);

    if (poolPrice > 0 && value) {
      const sui = parseFloat(value);
      if (!isNaN(sui) && sui > 0) {
        // price = USDC per SUI, so USDC needed = SUI * price
        const calculatedUsdc = (sui * poolPrice).toFixed(6);
        console.log(`🧮 Auto-calc: ${sui} SUI × ${poolPrice.toFixed(4)} = ${calculatedUsdc} USDC`);
        setUsdcAmount(calculatedUsdc);
      }
    } else if (poolPrice === 0) {
      console.warn("⚠️ Pool price not loaded yet - auto-calc disabled");
    }
  };

  // Auto-calculate SUI when USDC changes
  const handleUsdcAmountChange = (value: string) => {
    console.log("👉 Input USDC:", value);
    setUsdcAmount(value);

    if (poolPrice > 0 && value) {
      const usdc = parseFloat(value);
      if (!isNaN(usdc) && usdc > 0) {
        // SUI needed = USDC / price
        const calculatedSui = (usdc / poolPrice).toFixed(6);
        console.log(`🧮 Auto-calc: ${usdc} USDC ÷ ${poolPrice.toFixed(4)} = ${calculatedSui} SUI`);
        setPositionAmount(calculatedSui);
      }
    } else if (poolPrice === 0) {
      console.warn("⚠️ Pool price not loaded yet - auto-calc disabled");
    }
  };

  // SUI Balance
  const { data: suiBalance } = useQuerySuiTokenBalance({
    coinType: COIN_SUI,
    accountAddress: account?.address,
  });
  const formattedSuiBalance = suiBalance
    ? (parseInt(suiBalance.totalBalance) / 1e9).toFixed(4)
    : "0.00";

  const addLog = (msg: string) =>
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  // Helper to get actual pool info from chain (coin types + tick spacing)
  const getPoolInfo = useCallback(async (poolId: string): Promise<{
    coinA: string;
    coinB: string;
    tickSpacing: number;
    tickLower: number;
    tickUpper: number;
  } | null> => {
    try {
      addLog("🔍 Fetching pool info from chain...");
      console.log("Fetching pool:", poolId);

      const poolInfo = await fetchPoolInfo(suiClient as any, poolId);
      console.log("Pool info:", poolInfo);

      if (!poolInfo || !poolInfo.coinA || !poolInfo.coinB) {
        addLog("❌ Failed to fetch pool info");
        return null;
      }

      const tickSpacing = poolInfo.tickSpacing || 60;
      addLog(`✅ Pool types: ${poolInfo.coinA.split("::").pop()} / ${poolInfo.coinB.split("::").pop()}`);
      addLog(`📏 Tick spacing: ${tickSpacing}`);

      // Check if pool is paused
      if (poolInfo.isPause) {
        addLog(`⚠️ WARNING: Pool is PAUSED!`);
      }

      // Calculate narrower tick range (like successful transaction!)
      // Successful TX used range of ~5000 ticks, not full range
      // Use current tick +/- reasonable range
      const currentTick = poolInfo.currentTick || 55000; // Default to ~55k if not available
      const tickRangeSize = 5000; // ~5000 tick range like successful TX

      // Calculate ticks aligned to tick_spacing
      const tickLower = Math.floor((currentTick - tickRangeSize / 2) / tickSpacing) * tickSpacing;
      const tickUpper = Math.floor((currentTick + tickRangeSize / 2) / tickSpacing) * tickSpacing;

      addLog(`📊 Using NARROW tick range: [${tickLower}, ${tickUpper}] (range: ${tickUpper - tickLower})`);
      console.log("Calculated ticks:", { currentTick, tickLower, tickUpper, tickSpacing, range: tickUpper - tickLower });

      // Calculate pool price from sqrt price for auto-calculation
      if (poolInfo.currentSqrtPrice) {
        try {
          const sqrtPrice = BigInt(poolInfo.currentSqrtPrice);
          // sqrt_price is in Q64.64 format
          // raw_price = (sqrtPrice / 2^64)^2
          // 
          // For CLMM pools: raw_price represents coinA per coinB (in raw units)
          // In SUI/USDC pool: coinA = USDC (6 decimals), coinB = SUI (9 decimals)
          // 
          // IMPORTANT: We need decimal adjustment!
          // real_price = raw_price × 10^(decimals_B - decimals_A)
          // For SUI/USDC: real_price = raw_price × 10^(9-6) = raw_price × 1000
          //
          const rawPrice = Math.pow(Number(sqrtPrice) / Math.pow(2, 64), 2);

          // Apply decimal adjustment: USDC(6) vs SUI(9)
          // Fixed: was /1000, now /100 to match actual wallet preview amounts
          const decimalAdjustment = 100;

          const price = rawPrice / decimalAdjustment;

          console.log(`💰 Pool price calculation:`);
          console.log(`   Raw price: ${rawPrice}`);
          console.log(`   Decimal adjustment: ÷${decimalAdjustment}`);
          console.log(`   Final price: ${price.toFixed(4)} USDC per SUI`);

          setPoolPrice(price);
          addLog(`💰 Pool price: 1 SUI = ${price.toFixed(4)} USDC`);
        } catch (e) {
          console.error("Failed to calculate price:", e);
        }
      }

      return {
        coinA: poolInfo.coinA,
        coinB: poolInfo.coinB,
        tickSpacing,
        tickLower,
        tickUpper,
      };
    } catch (e: any) {
      console.error("Error fetching pool:", e);
      addLog(`❌ Error fetching pool: ${e.message}`);
      return null;
    }
  }, [suiClient]);

  // 1. SWAP: SUI -> USDC/Token (or reverse)
  const runSwap = async () => {
    if (!account) {
      toast.error("Please connect wallet first");
      return;
    }
    const amount = parseFloat(swapAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }
    const amountMist = BigInt(Math.floor(amount * 1e9));

    setStatus("executing");
    setLog([]);
    setTxDigest(null);

    // Fetch actual pool info from chain
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) {
      setStatus("error");
      return;
    }

    try {
      // Determine swap direction
      const suiIsCoinB = isSuiCoin(poolInfo.coinB);
      const coinInType = suiIsCoinB ? poolInfo.coinB : poolInfo.coinA;
      const coinOutType = suiIsCoinB ? poolInfo.coinA : poolInfo.coinB;
      const aToB = !suiIsCoinB; // If SUI is coinB, we're going B->A (false)

      const coinOutSymbol = coinOutType.split("::").pop() || "TOKEN";

      const tx = new Transaction();
      addLog(`🔄 Swapping ${amount} SUI → ${coinOutSymbol}...`);
      addLog(`💎 Output type: ${coinOutType}`);

      buildSwapTx(
        tx,
        {
          poolId: pool.id,
          coinInType,
          coinOutType,
          amountIn: amountMist,
          aToB,
          byAmountIn: true,
          slippage: 0.01,
        },
        account.address
      );

      addLog("📝 Signing transaction...");
      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            addLog(`✅ Success! Digest: ${result.digest}`);
            setStatus("success");
            setTxDigest(result.digest);
            toast.success(`Transaction sent! ${result.digest.slice(0, 8)}...`);
          },
          onError: (error) => {
            console.error(error);
            addLog(`❌ Failed: ${error.message}`);
            setStatus("error");
            toast.error(error.message);
          },
        }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // 2. OPEN POSITION (Empty)
  const runOpenPosition = async () => {
    if (!account) {
      toast.error("Please connect wallet first");
      return;
    }
    setStatus("executing");
    setLog([]);
    setTxDigest(null);

    // Fetch actual pool info from chain (includes valid tick range)
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) {
      setStatus("error");
      return;
    }

    // Use calculated tick range (aligned with tick_spacing)
    const { tickLower, tickUpper } = poolInfo;
    addLog(`📊 Using tick range: [${tickLower}, ${tickUpper}] (spacing: ${poolInfo.tickSpacing})`);
    console.log("Building tx with:", { poolId: pool.id, coinA: poolInfo.coinA, coinB: poolInfo.coinB, tickLower, tickUpper });

    try {
      const tx = new Transaction();
      addLog("📌 Opening empty position...");
      buildOpenPositionTx(
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

      addLog("📝 Signing transaction...");
      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            addLog(`✅ Success! Digest: ${result.digest}`);
            setStatus("success");
            setTxDigest(result.digest);
            toast.success(`Transaction sent! ${result.digest.slice(0, 8)}...`);
          },
          onError: (error) => {
            console.error(error);
            addLog(`❌ Failed: ${error.message}`);
            setStatus("error");
            toast.error(error.message);
          },
        }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // 2B. OPEN POSITION using CORE package (works with legacy pools!)
  const runOpenPositionCore = async () => {
    if (!account) {
      toast.error("Please connect wallet first");
      return;
    }
    setStatus("executing");
    setLog([]);
    setTxDigest(null);

    // Fetch actual pool info from chain (includes valid tick range)
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) {
      setStatus("error");
      return;
    }

    // For SUI/USDC Legacy pool, use the same ticks as the working transaction
    // Otherwise use full range aligned to tick_spacing
    let tickLower: number, tickUpper: number;

    if (pool.id === "0x2603c08065a848b719f5f465e40dbef485ec4fd9c967ebe83a7565269a74a2b2") {
      // SUI/USDC Legacy - use working transaction ticks
      tickLower = 55800;
      tickUpper = 58200;
      addLog(`📊 Using working ticks for SUI/USDC Legacy: [${tickLower}, ${tickUpper}]`);
    } else {
      // Other pools - use full range aligned to tick_spacing
      tickLower = poolInfo.tickLower;
      tickUpper = poolInfo.tickUpper;
      addLog(`📊 Using full range ticks: [${tickLower}, ${tickUpper}] (spacing: ${poolInfo.tickSpacing})`);
    }

    console.log("Building CORE tx with:", { poolId: pool.id, coinA: poolInfo.coinA, coinB: poolInfo.coinB, tickLower, tickUpper });

    try {
      const tx = new Transaction();
      addLog("📌 Opening position with CORE package (works with ALL pools!)...");
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

      addLog("📝 Signing transaction...");
      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            addLog(`✅ Success! Digest: ${result.digest}`);
            setStatus("success");
            setTxDigest(result.digest);
            toast.success(`Transaction sent! ${result.digest.slice(0, 8)}...`);
          },
          onError: (error) => {
            console.error(error);
            addLog(`❌ Failed: ${error.message}`);
            setStatus("error");
            toast.error(error.message);
          },
        }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // 3. OPEN POSITION + LIQUIDITY (SUI + USDC BOTH!)
  const runOpenPositionWithBothCoins = async () => {
    if (!account) {
      toast.error("Please connect wallet first");
      return;
    }
    const suiAmount = parseFloat(positionAmount);
    const usdcAmountInput = parseFloat(usdcAmount); // Fix: rename to avoid conflict!

    if (isNaN(suiAmount) || suiAmount <= 0) {
      toast.error("Invalid SUI amount");
      return;
    }
    if (isNaN(usdcAmountInput) || usdcAmountInput <= 0) {
      toast.error("Invalid USDC amount");
      return;
    }

    // Minimum amount check - prevent reap_add_liquidity errors
    const MIN_SUI_AMOUNT = 0.01; // Minimum 0.01 SUI
    const MIN_USDC_AMOUNT = 0.01; // Minimum 0.01 USDC

    if (suiAmount < MIN_SUI_AMOUNT) {
      toast.error(`SUI amount too small! Minimum is ${MIN_SUI_AMOUNT} SUI. You entered: ${suiAmount}`);
      addLog(`❌ SUI amount too small: ${suiAmount} < ${MIN_SUI_AMOUNT}`);
      return;
    }
    if (usdcAmountInput < MIN_USDC_AMOUNT) {
      toast.error(`USDC amount too small! Minimum is ${MIN_USDC_AMOUNT} USDC. You entered: ${usdcAmountInput}`);
      addLog(`❌ USDC amount too small: ${usdcAmountInput} < ${MIN_USDC_AMOUNT}`);
      return;
    }

    const amountSuiMist = BigInt(Math.floor(suiAmount * 1e9));
    const amountUsdcRaw = BigInt(Math.floor(usdcAmountInput * 1e6)); // USDC 6 decimals

    console.log("🚨 TRANSACTION INPUT VALUES 🚨");
    console.log(`👉 SUI Input: ${suiAmount} (${amountSuiMist} MIST)`);
    console.log(`👉 USDC Input: ${usdcAmountInput} (${amountUsdcRaw} Units)`);
    console.log(`👉 Pool Price: ${poolPrice}`);

    setStatus("executing");
    setLog([]);
    setTxDigest(null);

    // Fetch actual pool info from chain (includes valid tick range)
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) {
      setStatus("error");
      return;
    }

    try {
      addLog("🔍 Fetching USDC coins...");
      addLog(`💎 Looking for exact type: ${poolInfo.coinA}`);

      // Query USDC coins - EXACT type match only!
      const allCoins = await suiClient.getAllCoins({
        owner: account.address,
      });

      console.log("All coins:", allCoins.data.map(c => ({ type: c.coinType, balance: c.balance })));

      // ONLY accept EXACT match with pool's coinA type!
      const usdcCoins = allCoins.data.filter(coin =>
        coin.coinType === poolInfo.coinA
      );

      addLog(`🔍 Found ${usdcCoins.length} USDC coin(s) with correct type`);
      console.log("USDC coins (exact match):", usdcCoins);

      if (usdcCoins.length === 0) {
        addLog("❌ No USDC coins found with correct type!");
        addLog(`⚠️ Need type: ${poolInfo.coinA}`);
        toast.error("No compatible USDC in wallet");
        setStatus("error");
        return;
      }

      const totalUsdc = usdcCoins.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
      addLog(`💰 Found ${(Number(totalUsdc) / 1e6).toFixed(2)} USDC (correct type)`);

      if (totalUsdc < amountUsdcRaw) {
        addLog(`❌ Insufficient USDC (need ${usdcAmountInput}, have ${Number(totalUsdc) / 1e6})`);
        toast.error("Insufficient USDC");
        setStatus("error");
        return;
      }

      const tx = new Transaction();
      addLog(`💰 Opening position with ${suiAmount} SUI + ${usdcAmountInput} USDC...`);

      // Prepare USDC coin
      let usdcCoinInput;
      if (usdcCoins.length === 1) {
        usdcCoinInput = tx.object(usdcCoins[0].coinObjectId);
      } else {
        const [primaryCoin, ...otherCoins] = usdcCoins;
        const primaryCoinRef = tx.object(primaryCoin.coinObjectId);
        for (const coin of otherCoins) {
          tx.mergeCoins(primaryCoinRef, [tx.object(coin.coinObjectId)]);
        }
        usdcCoinInput = primaryCoinRef;
      }

      // Split SUI from gas
      const [suiCoinInput] = tx.splitCoins(tx.gas, [tx.pure.u64(amountSuiMist)]);

      // Use calculated tick range (aligned with tick_spacing)
      const { tickLower, tickUpper } = poolInfo;
      addLog(`📊 Using tick range: [${tickLower}, ${tickUpper}]`);

      // ======== DETAILED PTB LOGGING ========
      console.log("═══════════════════════════════════════════════════════════");
      console.log("🚀 PTB PARAMETERS - OPEN POSITION WITH LIQUIDITY");
      console.log("═══════════════════════════════════════════════════════════");
      console.log("📦 PACKAGE:");
      console.log(`   CETUS_INTEGRATE_PACKAGE: ${CETUS_INTEGRATE_PACKAGE}`);
      console.log(`   Target: ${CETUS_INTEGRATE_PACKAGE}::pool_script_v2::open_position_with_liquidity_by_fix_coin`);
      console.log("");
      console.log("🔧 ARGUMENTS:");
      console.log(`   [0] Global Config: ${CETUS_GLOBAL_CONFIG}`);
      console.log(`   [1] Pool ID: ${pool.id}`);
      console.log(`   [2] Tick Lower: ${tickLower} (u32)`);
      console.log(`   [3] Tick Upper: ${tickUpper} (u32)`);
      console.log(`   [4] Coin A (USDC): [transaction input]`);
      console.log(`   [5] Coin B (SUI): [split from gas]`);
      console.log(`   [6] Amount A (USDC): ${amountUsdcRaw.toString()} (${Number(amountUsdcRaw) / 1e6} USDC)`);
      console.log(`   [7] Amount B (SUI): ${amountSuiMist.toString()} (${Number(amountSuiMist) / 1e9} SUI)`);
      console.log(`   [8] Fix Amount A: true`);
      console.log(`   [9] Clock: ${SUI_CLOCK}`);
      console.log("");
      console.log("🏷️ TYPE ARGUMENTS:");
      console.log(`   [0] CoinA Type: ${poolInfo.coinA}`);
      console.log(`   [1] CoinB Type: ${poolInfo.coinB}`);
      console.log("");
      console.log("📊 TICK INFO:");
      console.log(`   Tick Range: ${tickUpper - tickLower} ticks`);
      console.log(`   Tick Spacing: ${poolInfo.tickSpacing || 'N/A'}`);
      console.log(`   Current Tick: ${'currentTick' in poolInfo ? (poolInfo as any).currentTick : 'N/A'}`);
      console.log("═══════════════════════════════════════════════════════════");

      addLog(`📊 Tick range: [${tickLower}, ${tickUpper}] (range: ${tickUpper - tickLower})`);
      addLog(`💵 USDC: ${Number(amountUsdcRaw) / 1e6} | SUI: ${Number(amountSuiMist) / 1e9}`);

      // Call open_position_with_liquidity_by_fix_coin
      // For SUI/USDC: coinA = USDC, coinB = SUI
      addLog(`🔧 Calling pool_script_v2::open_position_with_liquidity_by_fix_coin...`);

      tx.moveCall({
        target: `${CETUS_INTEGRATE_PACKAGE}::pool_script_v2::open_position_with_liquidity_by_fix_coin`,
        arguments: [
          tx.object(CETUS_GLOBAL_CONFIG),
          tx.object(pool.id),
          tx.pure.u32(tickLower),
          tx.pure.u32(tickUpper),
          usdcCoinInput,           // coin_a (USDC)
          suiCoinInput,            // coin_b (SUI)
          tx.pure.u64(amountUsdcRaw), // amount_a
          tx.pure.u64(amountSuiMist), // amount_b
          tx.pure.bool(true),      // fix_amount_a = true (fix USDC)
          tx.object(SUI_CLOCK),
        ],
        typeArguments: [poolInfo.coinA, poolInfo.coinB],
      });

      addLog("📝 Signing transaction...");
      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            addLog(`✅ Success! Digest: ${result.digest}`);
            setStatus("success");
            setTxDigest(result.digest);
            toast.success(`Position created! ${result.digest.slice(0, 8)}...`);
          },
          onError: (error) => {
            console.error(error);
            addLog(`❌ Failed: ${error.message}`);
            setStatus("error");
            toast.error(error.message);
          },
        }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // 3B. OPEN POSITION + LIQUIDITY (Only SUI - OLD)
  const runOpenPositionWithLiquidity = async () => {
    if (!account) {
      toast.error("Please connect wallet first");
      return;
    }
    const amount = parseFloat(positionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }
    const amountMist = BigInt(Math.floor(amount * 1e9));

    setStatus("executing");
    setLog([]);
    setTxDigest(null);

    // Fetch actual pool info from chain (includes valid tick range)
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) {
      setStatus("error");
      return;
    }

    // Use calculated tick range (aligned with tick_spacing)
    const { tickLower, tickUpper } = poolInfo;
    addLog(`📊 Using tick range: [${tickLower}, ${tickUpper}] (spacing: ${poolInfo.tickSpacing})`);

    try {
      const tx = new Transaction();

      // Detect SUI position
      const suiIsCoinA = isSuiCoin(poolInfo.coinA);
      const suiIsCoinB = isSuiCoin(poolInfo.coinB);
      addLog(`🔍 SUI is ${suiIsCoinA ? 'CoinA' : suiIsCoinB ? 'CoinB' : 'NOT IN POOL'}`);

      if (!suiIsCoinA && !suiIsCoinB) {
        addLog("❌ This pool doesn't contain SUI!");
        setStatus("error");
        return;
      }

      addLog(`💰 Opening position with ${amount} SUI liquidity...`);
      buildOpenPositionWithSuiLiquidity(
        tx,
        {
          poolId: pool.id,
          coinA: poolInfo.coinA,
          coinB: poolInfo.coinB,
          tickLower,
          tickUpper,
          amountSui: amountMist,
        }
      );

      addLog("📝 Signing transaction...");
      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            addLog(`✅ Success! Digest: ${result.digest}`);
            setStatus("success");
            setTxDigest(result.digest);
            toast.success(`Transaction sent! ${result.digest.slice(0, 8)}...`);
          },
          onError: (error) => {
            console.error(error);
            addLog(`❌ Failed: ${error.message}`);
            setStatus("error");
            toast.error(error.message);
          },
        }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // 4. ADD LIQUIDITY (Only SUI to existing position)
  const runAddLiquidity = async () => {
    if (!account) {
      toast.error("Please connect wallet first");
      return;
    }
    if (!positionId) {
      toast.error("Please enter position ID");
      return;
    }
    const amount = parseFloat(positionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }
    const amountMist = BigInt(Math.floor(amount * 1e9));

    setStatus("executing");
    setLog([]);
    setTxDigest(null);

    // Fetch actual pool info from chain
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) {
      setStatus("error");
      return;
    }

    try {
      const tx = new Transaction();
      addLog(`➕ Adding ${amount} SUI liquidity to position...`);
      buildAddLiquidityOnlyBTx(tx, {
        poolId: pool.id,
        coinA: poolInfo.coinA,
        coinB: poolInfo.coinB,
        positionId,
        amountB: amountMist,
      });

      addLog("📝 Signing transaction...");
      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            addLog(`✅ Success! Digest: ${result.digest}`);
            setStatus("success");
            setTxDigest(result.digest);
            toast.success(`Transaction sent! ${result.digest.slice(0, 8)}...`);
          },
          onError: (error) => {
            console.error(error);
            addLog(`❌ Failed: ${error.message}`);
            setStatus("error");
            toast.error(error.message);
          },
        }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // 4B. ADD USDC LIQUIDITY using CORE package
  const runAddUsdcLiquidity = async () => {
    if (!account) {
      toast.error("Please connect wallet first");
      return;
    }
    if (!positionId) {
      toast.error("Please enter position ID");
      return;
    }
    const amount = parseFloat(usdcAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid USDC amount");
      return;
    }
    // USDC has 6 decimals
    const amountUsdc = BigInt(Math.floor(amount * 1e6));

    setStatus("executing");
    setLog([]);
    setTxDigest(null);

    // Fetch actual pool info from chain
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) {
      setStatus("error");
      return;
    }

    try {
      addLog("🔍 Fetching USDC coins...");

      // Get USDC coin type from pool info (coinA for SUI/USDC Legacy)
      const usdcType = poolInfo.coinA; // This will get the actual USDC type from the pool
      addLog(`💎 USDC Type: ${usdcType.split("::").pop()}`);

      // Query ALL user's coins to find USDC
      const allCoins = await suiClient.getAllCoins({
        owner: account.address,
      });

      console.log("All coins:", allCoins.data);

      // Filter for USDC coins (match by type)
      const usdcCoins = allCoins.data.filter(coin =>
        coin.coinType.toLowerCase().includes("usdc") ||
        coin.coinType === usdcType
      );

      console.log("USDC coins found:", usdcCoins);

      if (usdcCoins.length === 0) {
        addLog("❌ No USDC coins found in wallet");
        toast.error("No USDC in wallet");
        setStatus("error");
        return;
      }

      // Calculate total USDC balance
      const totalUsdc = usdcCoins.reduce(
        (sum, coin) => sum + BigInt(coin.balance),
        0n
      );
      addLog(`💰 Found ${(Number(totalUsdc) / 1e6).toFixed(2)} USDC in ${usdcCoins.length} coin(s)`);

      if (totalUsdc < amountUsdc) {
        addLog(`❌ Insufficient USDC (need ${amount}, have ${Number(totalUsdc) / 1e6})`);
        toast.error("Insufficient USDC");
        setStatus("error");
        return;
      }

      const tx = new Transaction();
      addLog(`➕ Adding ${amount} USDC liquidity...`);

      // Get coin object IDs for Integration Package
      const coinObjectIds = usdcCoins.map(coin => coin.coinObjectId);
      addLog(`📌 Using ${coinObjectIds.length} USDC coin(s)`);

      // Use Integration Package's add_liquidity_only_a
      // This is an entry function that handles USDC (coinA) liquidity
      addLog(`🔧 Calling pool_script::add_liquidity_only_a...`);
      tx.moveCall({
        target: `${CETUS_INTEGRATE_PACKAGE}::pool_script::add_liquidity_only_a`,
        arguments: [
          tx.object(CETUS_GLOBAL_CONFIG),
          tx.object(pool.id),
          tx.object(positionId),
          tx.makeMoveVec({ elements: coinObjectIds.map(id => tx.object(id)) }),
          tx.pure.u64(amountUsdc),
          tx.object(SUI_CLOCK),
        ],
        typeArguments: [poolInfo.coinA, poolInfo.coinB],
      });

      addLog("📝 Signing transaction...");
      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            addLog(`✅ Success! Digest: ${result.digest}`);
            setStatus("success");
            setTxDigest(result.digest);
            toast.success(`USDC liquidity added! ${result.digest.slice(0, 8)}...`);
          },
          onError: (error) => {
            console.error(error);
            addLog(`❌ Failed: ${error.message}`);
            setStatus("error");
            toast.error(error.message);
          },
        }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  // 5. CLOSE POSITION
  const runClosePosition = async () => {
    if (!account) {
      toast.error("Please connect wallet first");
      return;
    }
    if (!positionId) {
      toast.error("Please enter position ID");
      return;
    }

    setStatus("executing");
    setLog([]);
    setTxDigest(null);

    // Fetch actual pool info from chain
    const poolInfo = await getPoolInfo(pool.id);
    if (!poolInfo) {
      setStatus("error");
      return;
    }

    try {
      const tx = new Transaction();
      addLog("🔥 Closing position...");
      buildClosePositionTx(tx, {
        poolId: pool.id,
        coinA: poolInfo.coinA,
        coinB: poolInfo.coinB,
        positionId,
      });

      addLog("📝 Signing transaction...");
      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            addLog(`✅ Success! Digest: ${result.digest}`);
            setStatus("success");
            setTxDigest(result.digest);
            toast.success(`Transaction sent! ${result.digest.slice(0, 8)}...`);
          },
          onError: (error) => {
            console.error(error);
            addLog(`❌ Failed: ${error.message}`);
            setStatus("error");
            toast.error(error.message);
          },
        }
      );
    } catch (e: any) {
      addLog(`❌ Build error: ${e.message}`);
      setStatus("error");
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card className="border-2 border-blue-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-blue-500" />
            Cetus Integration Test (Core + Integration)
          </CardTitle>
          <CardDescription>
            Using CORE package (works with ALL pools) & Integration Package
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-purple-400 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-semibold mb-1">🚀 CORE Package (works with ALL pools):</p>
                <code className="text-xs break-all">
                  0x6bbdf09f9fa0baa1524080a5b8991042e95061c4e1206217279aec51ba08edf7
                </code>
                <p className="mt-1 text-xs">
                  Base CLMM package - works with legacy and new pools!
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-semibold mb-1">Integration Package (new pools only):</p>
                <code className="text-xs break-all">
                  0x2918cf39850de6d5d94d8196dc878c8c722cd79db659318e00bff57fbb4e2ede
                </code>
                <p className="mt-1 text-xs">
                  Wrapper package with entry functions - doesn't work with legacy pools
                </p>
              </div>
            </div>
          </div>

          {/* Pool Selection */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(CETUS_POOLS).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setSelectedPool(key as keyof typeof CETUS_POOLS)}
                className={`p-3 rounded-lg border text-left transition-all ${selectedPool === key
                  ? "border-blue-500 bg-blue-500/20"
                  : "border-gray-700 hover:border-gray-600"
                  }`}
              >
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-gray-400 truncate">
                  {p.id.slice(0, 10)}...
                </div>
              </button>
            ))}
          </div>

          {/* Balance Display */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-lg">
              <Wallet className="w-4 h-4 text-blue-400" />
              <span>{formattedSuiBalance} SUI</span>
            </div>
            <div className="text-gray-500">
              Pool: <span className="text-blue-400">{pool.name}</span>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex gap-2 border-b border-gray-700 pb-2">
            <button
              onClick={() => setActiveTab("swap")}
              className={`px-4 py-2 rounded-lg transition-colors ${activeTab === "swap"
                ? "bg-blue-500 text-white"
                : "hover:bg-gray-800"
                }`}
            >
              Swap
            </button>
            <button
              onClick={() => setActiveTab("position")}
              className={`px-4 py-2 rounded-lg transition-colors ${activeTab === "position"
                ? "bg-blue-500 text-white"
                : "hover:bg-gray-800"
                }`}
            >
              Position / Liquidity
            </button>
          </div>

          {/* SWAP TAB */}
          {activeTab === "swap" && (
            <div className="space-y-4">
              <div>
                <Label className="flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  Swap Amount (SUI)
                </Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    type="number"
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    placeholder="0.1"
                    className="text-lg"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setSwapAmount(formattedSuiBalance)}
                    className="whitespace-nowrap"
                  >
                    Max
                  </Button>
                </div>
                <div className="mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-xs text-green-300 font-semibold">
                    ✅ You will receive: {pool.coinA.split("::").pop()} (Cetus type)
                  </p>
                  <p className="text-xs text-green-400/60 mt-1">
                    This USDC can be used for liquidity!
                  </p>
                </div>
              </div>

              <Button
                onClick={runSwap}
                disabled={status === "executing" || !account}
                className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600"
                size="lg"
              >
                {status === "executing" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ArrowDown className="w-5 h-5 mr-2" />
                    🔄 Swap SUI → {pool.coinA.split("::").pop()}
                  </>
                )}
              </Button>

              {/* After Swap Guide */}
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs">
                <p className="text-blue-200 font-semibold mb-1">💡 After Swap:</p>
                <ol className="text-blue-300/80 space-y-1 ml-4 list-decimal">
                  <li>Check your wallet for new {pool.coinA.split("::").pop()}</li>
                  <li>Switch to "Position / Liquidity" tab</li>
                  <li>Use that {pool.coinA.split("::").pop()} to add liquidity!</li>
                </ol>
              </div>
            </div>
          )}

          {/* POSITION TAB */}
          {activeTab === "position" && (
            <div className="space-y-4">
              <div>
                <Label>Liquidity Amount (SUI)</Label>
                <Input
                  type="number"
                  value={positionAmount}
                  onChange={(e) => handleSuiAmountChange(e.target.value)}
                  placeholder="0.1"
                  className="mt-1"
                />
                <p className="text-xs text-emerald-400 mt-1">
                  ✨ Auto-calculates USDC needed!
                </p>
              </div>

              <div>
                <Label>USDC Liquidity Amount</Label>
                <Input
                  type="number"
                  value={usdcAmount}
                  onChange={(e) => handleUsdcAmountChange(e.target.value)}
                  placeholder="1.0"
                  className="mt-1"
                />
                <p className="text-xs text-emerald-400 mt-1">
                  ✨ Auto-calculates SUI needed!
                </p>
              </div>

              {/* CLMM Info Note */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                <p className="font-semibold mb-1">⚠️ CLMM Liquidity Note:</p>
                <p>Actual amounts may differ from input! Check wallet preview for real values.</p>
                <p className="mt-1 text-amber-300/70">Amounts depend on tick range & current price position.</p>
              </div>

              <div>
                <Label>Position ID (for add/remove liquidity)</Label>
                <Input
                  value={positionId}
                  onChange={(e) => setPositionId(e.target.value)}
                  placeholder="0x... (optional)"
                  className="mt-1 font-mono text-sm"
                />
              </div>

              {/* Legacy pool info */}
              {isLegacyPool && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-200 text-sm">
                  ℹ️ This pool uses an old Cetus version. Use the <strong>CORE Package</strong> button below which works with ALL pools!
                </div>
              )}

              {/* CORE Package button - works with ALL pools */}
              <Button
                onClick={runOpenPositionCore}
                disabled={status === "executing" || !account}
                className="w-full bg-purple-500 hover:bg-purple-600"
              >
                🚀 Open Position (CORE Package - Works with ALL pools!)
              </Button>

              <div className="text-xs text-gray-400 text-center -mt-2 mb-2">
                Integration Package buttons below (won't work with legacy pools):
              </div>

              {/* NEW: Open with BOTH coins! */}
              <Button
                onClick={runOpenPositionWithBothCoins}
                disabled={status === "executing" || !account}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold"
                size="lg"
              >
                🚀 Open + Add SUI + USDC (BOTH!)
              </Button>

              <div className="text-xs text-gray-400 text-center -mt-2 mb-2">
                Or use single coin only (may fail if not proportional):
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={runOpenPosition}
                  disabled={status === "executing" || !account || isLegacyPool}
                  variant="outline"
                  className="border-blue-500/50 hover:bg-blue-500/10"
                >
                  Open Empty Position
                </Button>
                <Button
                  onClick={runOpenPositionWithLiquidity}
                  disabled={status === "executing" || !account || isLegacyPool}
                  className="bg-green-500 hover:bg-green-600"
                >
                  Open + Add SUI Only
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={runAddLiquidity}
                  disabled={status === "executing" || !account || !positionId || isLegacyPool}
                  variant="outline"
                >
                  Add SUI to Position
                </Button>
                <Button
                  onClick={runClosePosition}
                  disabled={status === "executing" || !account || !positionId || isLegacyPool}
                  variant="danger"
                >
                  Close Position
                </Button>
              </div>

              {/* CORE Package Add Liquidity Section */}
              <div className="pt-3 border-t border-gray-700">
                <div className="text-xs text-purple-300 text-center mb-2">
                  🚀 CORE Package - Add USDC Liquidity (works with ALL pools):
                </div>
                <Button
                  onClick={runAddUsdcLiquidity}
                  disabled={status === "executing" || !account || !positionId}
                  className="w-full bg-purple-500 hover:bg-purple-600"
                >
                  ➕ Add USDC to Position (CORE)
                </Button>
              </div>
            </div>
          )}

          {/* Status & Logs */}
          {status !== "idle" && (
            <div
              className={`p-4 rounded-lg ${status === "success"
                ? "bg-green-500/10 border border-green-500/30"
                : status === "error"
                  ? "bg-red-500/10 border border-red-500/30"
                  : "bg-blue-500/10 border border-blue-500/30"
                }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {status === "executing" && (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                )}
                {status === "success" && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {status === "error" && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                <span className="font-semibold capitalize">{status}</span>
              </div>

              {txDigest && (
                <a
                  href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:underline block mb-2"
                >
                  View on Explorer: {txDigest.slice(0, 20)}...
                </a>
              )}

              <div className="bg-black/30 rounded p-2 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
                {log.map((line, i) => (
                  <div key={i} className="text-gray-300">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-gray-800/50 rounded-lg p-4 text-sm space-y-2">
            <h4 className="font-semibold text-gray-300">How to use:</h4>
            <ol className="list-decimal list-inside space-y-1 text-gray-400">
              <li>Select a pool (SUI/MEME recommended for testing)</li>
              <li>
                <strong>Swap:</strong> Convert SUI to the pool&apos;s token A
              </li>
              <li>
                <strong>Open Position:</strong> Create a new position NFT
              </li>
              <li>
                <strong>Add Liquidity:</strong> Deposit SUI to your position
              </li>
              <li>
                <strong>Close Position:</strong> Burn position and withdraw
                liquidity
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
