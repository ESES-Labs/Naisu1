import { createFileRoute } from "@tanstack/react-router";
import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Loader2,
  CheckCircle2,
  ArrowDown,
  Wallet,
  Coins,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useNetworkConfig } from "@/hooks/useNetworkConfig";

// Hooks
import {
  useQueryCetusPositions,
  queryKeyCetusPositions,
} from "@/hooks/sui/useQueryCetusPositions";
import { useQuerySuiTokenBalance } from "@/hooks/sui/useQuerySuiTokenBalance";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export const Route = createFileRoute("/test-cetus")({
  component: CetusTestPage,
});

// Addresses
// User Request: 0xab2d... (Router) matches Package 0x5372... (Pool/Config)
const CETUS_PACKAGE =
  "0x5372d555ac734e272659136c2a0cd3227f9b92de67c80dc11250307268af2db8";
const CETUS_GLOBAL_CONFIG =
  "0x9774e359588ead122af1c7e7f64e14ade261cfeecdb5d0eb4a5b3b4c8ab8bd3e"; // Correct testnet GlobalConfig
const CETUS_INTEGRATE =
  "0x2918cf39850de6d5d94d8196dc878c8c722cd79db659318e00bff57fbb4e2ede"; // Testnet integrate package

// Coin Types
const COIN_SUI = "0x2::sui::SUI";

// USDC Variants
const USDC_VARIANTS = {
  LEGACY: {
    type: "0x14a71d857b34677a7d57e0feb303df1adb515a37780645ab763d42ce8d1a5e48::usdc::USDC",
    name: "Legacy USDC (Faucet)",
    defaultPool: "0x2603c08065a848b719f5f465e40dbef485ec4fd9c967ebe83a7565269a74a2b2"
  },
  NATIVE: {
    type: "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
    name: "Native USDC (No Pool)",
    defaultPool: ""
  },
  USDT: {
    type: "0x26b3bc67befc214058ca78ea9a2690298d731a2d4309485ec3d40198063c4abc::usdt::USDT",
    name: "USDT (Different Package?)",
    defaultPool: "0x375128f60d6dabb8c624a6f055d8417b15625e3ec77f0620fed136c5e28d1665"
  }
};

// Helper: Parse amount with comma support
const parseAmount = (val: string) => {
  if (!val) return 0;
  const normalized = val.replace(',', '.');
  return parseFloat(normalized);
};

function CetusTestPage() {
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const queryClient = useQueryClient();
  const { config } = useNetworkConfig();

  const [status, setStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("swap");

  // Config State
  const [usdcType, setUsdcType] = useState<keyof typeof USDC_VARIANTS>("LEGACY");
  const [customPoolId, setCustomPoolId] = useState("");

  // Derived Config
  const CURRENT_USDC_TYPE = USDC_VARIANTS[usdcType].type;
  const CURRENT_POOL_ID = customPoolId || USDC_VARIANTS[usdcType].defaultPool;

  // Inputs
  const [swapAmount, setSwapAmount] = useState("0.1");
  const [addLpMode, setAddLpMode] = useState<'mint' | 'dual'>('dual');
  const [addLpSuiAmount, setAddLpSuiAmount] = useState("0.1");
  const [addLpUsdcAmount, setAddLpUsdcAmount] = useState("0");
  const [positionId, setPositionId] = useState("");

  // Hook: Auto-fetch Positions
  const {
    data: userObjects,
    isLoading: isLoadingObjects,
    refetch: refetchObjects
  } = useQueryCetusPositions();

  // Hook: SUI Balance
  const { data: suiBalance } = useQuerySuiTokenBalance({
    coinType: COIN_SUI,
    accountAddress: account?.address
  });

  const formattedBalance = suiBalance
    ? (parseInt(suiBalance.totalBalance) / 1e9).toFixed(4)
    : "0.00";

  // Hook: USDC Balance (Dynamic)
  const { data: usdcBalance } = useQuerySuiTokenBalance({
    coinType: CURRENT_USDC_TYPE,
    accountAddress: account?.address
  });

  const formattedUsdcBalance = usdcBalance
    ? (parseInt(usdcBalance.totalBalance) / 1e6).toFixed(2)
    : "0.00";

  const addLog = (msg: string) => setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  // Auto-detect Native USDC logic could be added here, but manual toggle is safer for now.

  const executeTx = async (buildTx: (tx: Transaction) => Promise<void>) => {
    if (!account) return;
    setStatus('executing');
    setLog([]);
    setTxDigest(null);

    // Validate Configuration
    if (!CURRENT_POOL_ID) {
      addLog("❌ Error: Valid Pool ID is required for Native USDC.");
      setStatus('error');
      return;
    }

    try {
      const tx = new Transaction();
      await buildTx(tx);

      addLog("📝 Signing transaction...");
      signAndExecuteTransaction(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            addLog(`✅ Transaction Successful! Digest: ${result.digest}`);
            setStatus('success');
            setTxDigest(result.digest);
            toast.success(`Success! Digest: ${result.digest.slice(0, 8)}...`);

            // Reset Inputs
            setAddLpSuiAmount("");
            setAddLpUsdcAmount("");
            setSwapAmount("");

            addLog("♻️ Invalidating Query Keys...");
            queryClient.invalidateQueries({
              queryKey: queryKeyCetusPositions(account.address, config.network)
            });
            queryClient.invalidateQueries({ queryKey: ['sui-token-balance'] });
          },
          onError: (error) => {
            console.error(error);
            addLog(`❌ Transaction Failed: ${error.message}`);
            setStatus('error');
          },
        }
      );
    } catch (e: any) {
      addLog(`❌ Build Failed: ${e.message}`);
      setStatus('error');
    }
  };

  const runSwap = () => executeTx(async (tx) => {
    addLog(`🚀 Starting Swap Test (SUI -> ${USDC_VARIANTS[usdcType].name})...`);
    const amountVal = parseAmount(swapAmount);
    if (isNaN(amountVal) || amountVal <= 0) throw new Error("Invalid amount");

    const amountMist = BigInt(Math.floor(amountVal * 1e9));

    addLog(`💰 Swapping ${amountVal} SUI (${amountMist} MIST)`);

    // Validate pool first
    addLog(`🔍 Validating pool: ${CURRENT_POOL_ID.slice(0, 10)}...`);
    const poolObj = await client.getObject({
      id: CURRENT_POOL_ID,
      options: { showType: true, showContent: true }
    });

    if (!poolObj.data) {
      throw new Error("Pool not found! Check pool ID.");
    }

    const poolContent = poolObj.data.content as any;
    if (poolContent?.fields?.is_pause === true) {
      throw new Error("Pool is paused!");
    }

    addLog(`✅ Pool validated`);

    const [coinIn] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
    const coinOut = tx.moveCall({
      target: "0x2::coin::zero",
      typeArguments: [CURRENT_USDC_TYPE],
    });

    addLog(`🔄 calling router::swap using Pool: ${CURRENT_POOL_ID.slice(0, 10)}...`);
    addLog(`ℹ️ Direction: SUI (Coin B) -> USDC (Coin A)`);

    // Use proper sqrt_price_limit for B->A swap
    const MAX_SQRT_PRICE = "79226673515401279992447579055";

    const [resultCoinA, resultCoinB] = tx.moveCall({
      target: `${CETUS_INTEGRATE}::router::swap`,
      arguments: [
        tx.object(CETUS_GLOBAL_CONFIG),
        tx.object(CURRENT_POOL_ID),
        coinOut,             // Coin A (USDC) - Input (Empty / Zero)
        coinIn,              // Coin B (SUI)  - Input (Full)
        tx.pure.bool(false), // a_to_b: false (B->A, SUI->USDC)
        tx.pure.bool(true),  // by_amount_in
        tx.pure.u64(amountMist),
        tx.pure(bcs.u128().serialize(MAX_SQRT_PRICE).toBytes()), // sqrt_price_limit
        tx.pure.bool(false), // middle_step (false for direct swap)
        tx.object("0x6"),    // Clock
      ],
      typeArguments: [CURRENT_USDC_TYPE, COIN_SUI]
    });

    // Transfer results back to user
    tx.transferObjects([resultCoinA, resultCoinB], tx.pure.address(account!.address));
    addLog("🎁 Transferred swapped coins to user");
  });

  // MODE 1: Mint & Deposit (SUI Fixed - Auto-calc USDC)
  const runMintPosition = () => executeTx(async (tx) => {
    addLog(`🚀 Starting Add Liquidity (Fix SUI, Auto USDC) using pool_script_v2...`);

    const amountVal = parseAmount(addLpSuiAmount);
    if (isNaN(amountVal) || amountVal <= 0) throw new Error("Invalid amount");
    const amountMist = BigInt(Math.floor(amountVal * 1e9));

    // 1. Fetch pool info for current tick
    addLog("🔍 Fetching pool info...");
    const poolObj = await client.getObject({
      id: CURRENT_POOL_ID,
      options: { showContent: true }
    });

    const poolContent = poolObj.data?.content as any;
    if (!poolContent?.fields) {
      throw new Error("Invalid pool data");
    }

    const currentTick = poolContent.fields.current_tick_index?.fields?.bits || 0;
    const tickSpacing = poolContent.fields.tick_spacing || 60;
    addLog(`ℹ️ Current Tick: ${currentTick}, Spacing: ${tickSpacing}`);

    // 2. Calculate safe tick range (wider range = more tolerance)
    const tickRange = tickSpacing * 100; // 100 tick spaces each side
    const tickLowerIndex = Math.floor((currentTick - tickRange) / tickSpacing) * tickSpacing;
    const tickUpperIndex = Math.ceil((currentTick + tickRange) / tickSpacing) * tickSpacing;

    addLog(`📊 Tick Range: [${tickLowerIndex}, ${tickUpperIndex}]`);

    // 3. Fetch USDC Coins (Required for Pool)
    addLog("🔍 Fetching USDC coins for pairing...");
    const usdcCoins = await client.getCoins({
      owner: account!.address,
      coinType: CURRENT_USDC_TYPE,
    });

    if (usdcCoins.data.length === 0) {
      addLog(`❌ No ${USDC_VARIANTS[usdcType].name} found. Swap SUI to USDC first!`);
      throw new Error(`No ${USDC_VARIANTS[usdcType].name} tokens found`);
    }

    const usdcCoinObj = usdcCoins.data.find(c => BigInt(c.balance) > 0);
    if (!usdcCoinObj) throw new Error("Insufficient USDC balance");

    addLog(`💰 Found USDC: ${usdcCoinObj.coinObjectId.slice(0, 10)}...`);
    addLog(`💰 Allocating ${amountVal} SUI (Fixed) + Auto-calc USDC`);

    // 4. Split USDC coin for exact amount needed
    const usdcBalance = BigInt(usdcCoinObj.balance);
    const [_coinUsdcSplit] = tx.splitCoins(
      tx.object(usdcCoinObj.coinObjectId),
      [tx.pure.u64(usdcBalance)] // Use full balance available
    );

    // 5. Split SUI coin (Fixed Amount)
    const [_coinSuiFixed] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);

    // 6. Set amounts to FULL coin amounts (not 0!)
    // const amountA = usdcBalance; // FULL USDC available
    // const amountB = amountMist;   // Fixed SUI amount

    // 7. TRY SIMPLE: Just open position first (no liquidity) - TEST POOL COMPATIBILITY
    addLog("🧪 Testing: pool_script_v2::open_position (simple test)...");
    tx.moveCall({
      target: `${CETUS_INTEGRATE}::pool_script_v2::open_position`,
      arguments: [
        tx.object(CETUS_GLOBAL_CONFIG),  // config
        tx.object(CURRENT_POOL_ID),      // pool
        tx.pure.u32(tickLowerIndex),     // tick_lower
        tx.pure.u32(tickUpperIndex),     // tick_upper
      ],
      typeArguments: [CURRENT_USDC_TYPE, COIN_SUI]
    });

    addLog("✅ Position Created & Liquidity Added!");
  });

  // MODE 2: Add Liquidity (Both SUI + USDC)
  const runAddLiquidityDual = () => executeTx(async (tx) => {
    addLog(`🚀 Starting Add Liquidity (Both SUI + ${USDC_VARIANTS[usdcType].name}) using pool_script_v2...`);

    const amountSuiVal = parseAmount(addLpSuiAmount);
    if (isNaN(amountSuiVal) || amountSuiVal <= 0)
      throw new Error("Invalid SUI amount");
    const amountSuiMist = BigInt(Math.floor(amountSuiVal * 1e9));

    // 1. Fetch pool info for current tick
    addLog("🔍 Fetching pool info...");
    const poolObj = await client.getObject({
      id: CURRENT_POOL_ID,
      options: { showContent: true }
    });

    const poolContent = poolObj.data?.content as any;
    if (!poolContent?.fields) {
      throw new Error("Invalid pool data");
    }

    const currentTick = poolContent.fields.current_tick_index?.fields?.bits || 0;
    const tickSpacing = poolContent.fields.tick_spacing || 60;
    addLog(`ℹ️ Current Tick: ${currentTick}, Spacing: ${tickSpacing}`);

    // 2. Calculate safe tick range
    const tickRange = tickSpacing * 100;
    const tickLowerIndex = Math.floor((currentTick - tickRange) / tickSpacing) * tickSpacing;
    const tickUpperIndex = Math.ceil((currentTick + tickRange) / tickSpacing) * tickSpacing;

    addLog(`📊 Tick Range: [${tickLowerIndex}, ${tickUpperIndex}]`);

    // 3. Fetch USDC Coins
    addLog("🔍 Fetching USDC coins...");
    const usdcCoins = await client.getCoins({
      owner: account!.address,
      coinType: CURRENT_USDC_TYPE,
    });
    if (usdcCoins.data.length === 0)
      throw new Error(`No ${USDC_VARIANTS[usdcType].name} found! Swap SUI to USDC first.`);

    const usdcCoinObj = usdcCoins.data.find((c) => BigInt(c.balance) > 0);
    if (!usdcCoinObj) throw new Error("Insufficient USDC balance");
    addLog(`💰 Found USDC: ${usdcCoinObj.coinObjectId.slice(0, 10)}...`);

    addLog(`💰 Allocating ${amountSuiVal} SUI (Fixed) + Auto-calc USDC`);

    // 4. Split USDC coin for exact amount needed
    const usdcBalance = BigInt(usdcCoinObj.balance);
    const [_coinUsdcSplit] = tx.splitCoins(
      tx.object(usdcCoinObj.coinObjectId),
      [tx.pure.u64(usdcBalance)] // Use full balance available
    );

    // 5. Split SUI coin (Fixed Amount)
    const [_coinSuiFixed] = tx.splitCoins(tx.gas, [tx.pure.u64(amountSuiMist)]);

    // 6. Set amounts to FULL coin amounts (not 0!)
    // const amountA = usdcBalance; // FULL USDC available
    // const amountB = amountSuiMist;   // Fixed SUI amount

    // 7. TRY SIMPLE: Just open position first (no liquidity) - TEST POOL COMPATIBILITY
    addLog("🧪 Testing: pool_script_v2::open_position (simple test)...");
    tx.moveCall({
      target: `${CETUS_INTEGRATE}::pool_script_v2::open_position`,
      arguments: [
        tx.object(CETUS_GLOBAL_CONFIG),  // config
        tx.object(CURRENT_POOL_ID),      // pool
        tx.pure.u32(tickLowerIndex),     // tick_lower
        tx.pure.u32(tickUpperIndex),     // tick_upper
      ],
      typeArguments: [CURRENT_USDC_TYPE, COIN_SUI]
    });

    addLog("✅ Position Created & Liquidity Added!");
  });

  const runRemoveLiquidity = () => executeTx(async (tx) => {
    if (!positionId) throw new Error("Select a position first");
    addLog(`🔥 Removing Liquidity for Position ${positionId.slice(0, 8)}...`);

    addLog("🗑 calling pool::close_position...");

    tx.moveCall({
      target: `${CETUS_PACKAGE}::pool::close_position`,
      arguments: [
        tx.object(CETUS_GLOBAL_CONFIG),
        tx.object(CURRENT_POOL_ID),
        tx.object(positionId)
      ],
      typeArguments: [CURRENT_USDC_TYPE, COIN_SUI]
    });

    addLog("✅ Position closed (burned)");
    // Reset selection
    setPositionId("");
  });

  return (
    <div className="container mx-auto py-12 max-w-xl min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
            Swap Interface
          </h1>
          <p className="text-sm text-white/50">Cetus Protocol • Testnet</p>
        </div>
        <div className="flex gap-2">
          {/* USDC Settings Toggle */}
          <div className="bg-[#131b2c] p-1 rounded-lg flex items-center gap-2 px-2">
            <span className="text-[10px] text-white/40 uppercase font-bold">Config</span>
            <select
              value={usdcType}
              onChange={(e) => setUsdcType(e.target.value as 'LEGACY' | 'NATIVE')}
              className="bg-black/20 text-xs px-2 py-1 rounded border border-white/10 outline-none text-indigo-300"
            >
              <option value="LEGACY">Legacy USDC (Faucet)</option>
              <option value="NATIVE">Native USDC (Circle)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Config Warnings / Pool ID Input */}
      {usdcType === 'NATIVE' && (
        <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-orange-200">Native USDC Selected</h4>
              <p className="text-xs text-orange-200/60 mt-1">
                The default testnet pool (0x2603...) uses Legacy USDC.
                To use Native USDC, you must provide a valid <strong>SUI/NativeUSDC Pool ID</strong>.
              </p>
            </div>
          </div>
          <div>
            <Label className="text-xs text-orange-200/60 mb-1.5 block">Custom Pool ID</Label>
            <Input
              value={customPoolId}
              onChange={(e) => setCustomPoolId(e.target.value)}
              placeholder="Enter Pool Object ID (0x...)"
              className="bg-black/40 border-orange-500/30 text-xs font-mono h-9"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 bg-[#131b2c] p-1 rounded-lg mb-6 w-fit mx-auto">
        {['swap', 'add-liquidity', 'remove-liquidity'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === tab
              ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50'
              : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
          >
            {tab.replace('-', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {/* MAIN CARD */}
      <div className="p-1 rounded-2xl bg-gradient-to-b from-white/10 to-white/5">
        <div className="bg-[#0b0e14] rounded-xl p-4 sm:p-6 space-y-4">
          {/* SWAP UI */}
          {activeTab === "swap" && (
            <div className="space-y-2">
              {/* SELL CARD */}
              <div className="bg-[#131b2c] rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex justify-between mb-2">
                  <Label className="text-white/60 text-xs">Sell</Label>
                  <span className="text-white/40 text-xs font-mono text-indigo-300">
                    Balance: {formattedBalance} SUI
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="text"
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    className="bg-transparent border-none text-3xl font-medium p-0 h-auto focus-visible:ring-0 placeholder:text-white/20"
                    placeholder="0.0"
                  />
                  <div className="flex items-center gap-2 bg-black/40 py-1.5 px-3 rounded-full border border-white/10 shrink-0">
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold">
                      S
                    </div>
                    <span className="font-semibold text-sm">SUI</span>
                    <span className="text-white/40 text-[10px]">▼</span>
                  </div>
                </div>
                <div className="mt-2 text-right text-xs text-white/40">
                  ≈ $
                  {parseAmount(swapAmount)
                    ? (parseAmount(swapAmount) * 1.5).toFixed(2)
                    : "0.00"}
                </div>
              </div>

              {/* SWITCHER */}
              <div className="relative h-4 flex items-center justify-center -my-2 z-10">
                <div className="bg-[#0b0e14] p-1 rounded-full">
                  <div className="bg-[#1e293b] p-2 rounded-full hover:bg-[#2d3b55] cursor-pointer transition-colors border border-black">
                    <ArrowDown className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>
              </div>

              {/* BUY CARD */}
              <div className="bg-[#131b2c] rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex justify-between mb-2">
                  <Label className="text-white/60 text-xs">Buy</Label>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-3xl font-medium text-white/40">
                    {parseAmount(swapAmount)
                      ? (parseAmount(swapAmount) * 0.98).toFixed(4)
                      : "0"}
                  </div>
                  <div className="flex items-center gap-2 bg-black/40 py-1.5 px-3 rounded-full border border-white/10 shrink-0">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white font-bold">
                      $
                    </div>
                    <span className="font-semibold text-sm">USDC</span>
                    <span className="text-white/40 text-[10px]">▼</span>
                  </div>
                </div>
                <div className="mt-2 text-right text-xs text-white/40">
                  ≈ $
                  {parseAmount(swapAmount)
                    ? (parseAmount(swapAmount) * 1.5).toFixed(2)
                    : "0.00"}
                </div>
              </div>

              {/* ACTION BUTTON */}
              <Button
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl mt-4 shadow-lg shadow-indigo-500/20"
                onClick={runSwap}
                disabled={status === "executing" || !swapAmount}
              >
                {status === "executing" ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  "Get Started"
                )}
              </Button>
            </div>
          )}

          {/* ADD LP (Nested Tabs) */}
          {activeTab === "add-liquidity" && (
            <div className="space-y-4 py-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-400">
                  <Wallet className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold">Add Liquidity</h3>
                <p className="text-white/60 text-sm max-w-xs mx-auto">
                  Manage your liquidity in the SUI/USDC pool.
                </p>
              </div>

              {/* NESTED TABS */}
              <div className="flex bg-[#131b2c] p-1 rounded-lg mx-auto max-w-sm mb-6">
                <button
                  onClick={() => setAddLpMode("mint")}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${addLpMode === "mint"
                    ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                    }`}
                >
                  Mint Only (SUI)
                </button>
                <button
                  onClick={() => setAddLpMode("dual")}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${addLpMode === "dual"
                    ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                    }`}
                >
                  SUI + USDC
                </button>
              </div>

              {/* MODE 1: MINT ONLY */}
              {addLpMode === "mint" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-[#131b2c] rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex justify-between mb-2">
                      <Label className="text-white/60 text-xs">
                        Deposit Amount (SUI)
                      </Label>
                      <span className="text-white/40 text-xs font-mono text-indigo-300">
                        Balance: {formattedBalance} SUI
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="text"
                        value={addLpSuiAmount}
                        onChange={(e) => setAddLpSuiAmount(e.target.value)}
                        className="bg-transparent border-none text-3xl font-medium p-0 h-auto focus-visible:ring-0 placeholder:text-white/20"
                        placeholder="0.0"
                      />
                      <div className="flex items-center gap-2 bg-black/40 py-1.5 px-3 rounded-full border border-white/10 shrink-0">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold">
                          S
                        </div>
                        <span className="font-semibold text-sm">SUI</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-indigo-200/80">
                      Creates a Position and <strong>Deposits Liquidity</strong>
                      . Requires a small amount of USDC for pairing.
                    </span>
                  </div>

                  <Button
                    className="w-full h-12 text-base font-semibold bg-[#131b2c] hover:bg-[#1e293b] border border-white/10"
                    onClick={runMintPosition}
                    disabled={status === "executing" || !addLpSuiAmount}
                  >
                    {status === "executing" ? (
                      <Loader2 className="animate-spin mr-2" />
                    ) : (
                      "Mint & Deposit (SUI)"
                    )}
                  </Button>
                </div>
              )}

              {/* MODE 2: DUAL (SUI + USDC) */}
              {addLpMode === "dual" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* SUI Input */}
                  <div className="bg-[#131b2c] rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex justify-between mb-2">
                      <Label className="text-white/60 text-xs">
                        Deposit SUI
                      </Label>
                      <span className="text-white/40 text-xs font-mono text-indigo-300">
                        Balance: {formattedBalance}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="text"
                        value={addLpSuiAmount}
                        onChange={(e) => setAddLpSuiAmount(e.target.value)}
                        className="bg-transparent border-none text-3xl font-medium p-0 h-auto focus-visible:ring-0 placeholder:text-white/20"
                        placeholder="0.0"
                      />
                      <div className="flex items-center gap-2 bg-black/40 py-1.5 px-3 rounded-full border border-white/10 shrink-0">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold">
                          S
                        </div>
                        <span className="font-semibold text-sm">SUI</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative h-4 flex items-center justify-center -my-2 z-10">
                    <div className="bg-[#0b0e14] p-1 rounded-full">
                      <ArrowDown className="h-4 w-4 text-white/20" />
                    </div>
                  </div>

                  {/* USDC Input (Visual/Validation) */}
                  <div className="bg-[#131b2c] rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex justify-between mb-2">
                      <Label className="text-white/60 text-xs">
                        Deposit USDC
                      </Label>
                      <span className="text-white/40 text-xs font-mono text-indigo-300">
                        Balance: {formattedUsdcBalance}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="text"
                        value={addLpUsdcAmount}
                        onChange={(e) => setAddLpUsdcAmount(e.target.value)}
                        className="bg-transparent border-none text-3xl font-medium p-0 h-auto focus-visible:ring-0 placeholder:text-white/20"
                        placeholder="0.0 (Auto-calculated)"
                      />
                      <div className="flex items-center gap-2 bg-black/40 py-1.5 px-3 rounded-full border border-white/10 shrink-0">
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white font-bold">
                          $
                        </div>
                        <span className="font-semibold text-sm">USDC</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 mt-4">
                    <span className="text-xs text-indigo-200/80 block">
                      ℹ️ <strong>Auto-Balance:</strong> SUI amount is fixed. The
                      required USDC will be calculated by the pool. Ensure you
                      have enough USDC.
                    </span>
                  </div>

                  <Button
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl mt-4 shadow-lg shadow-indigo-500/20"
                    onClick={runAddLiquidityDual}
                    disabled={status === "executing" || !addLpSuiAmount}
                  >
                    {status === "executing" ? (
                      <Loader2 className="animate-spin mr-2" />
                    ) : (
                      "Add Liquidity (Dual)"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* REMOVE LP (Auto-fetch) */}
          {activeTab === "remove-liquidity" && (
            <div className="space-y-4">
              <div className="bg-[#131b2c] p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Coins className="h-4 w-4 text-indigo-400" />
                    Your Positions
                  </h3>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => refetchObjects()}
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isLoadingObjects ? "animate-spin" : ""}`}
                    />
                  </Button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {isLoadingObjects ? (
                    <div className="text-center py-4 text-white/40 text-xs">
                      Loading positions...
                    </div>
                  ) : userObjects?.length === 0 ? (
                    <div className="text-center py-4 text-white/40 text-xs">
                      No positions found. Try adding liquidity first.
                    </div>
                  ) : (
                    userObjects?.map((obj: any) => (
                      <div
                        key={obj.data?.objectId}
                        onClick={() => setPositionId(obj.data?.objectId || "")}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${positionId === obj.data?.objectId
                          ? "bg-indigo-500/20 border-indigo-500"
                          : "bg-black/20 border-white/5 hover:bg-white/5"
                          }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-mono text-white/80">
                            {obj.data?.objectId.slice(0, 6)}...
                            {obj.data?.objectId.slice(-4)}
                          </span>
                          <span className="text-[10px] text-white/40">
                            SUI/USDC Pool
                          </span>
                        </div>
                        {positionId === obj.data?.objectId && (
                          <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <Button
                className="w-full h-12 text-base font-semibold bg-red-900/50 hover:bg-red-900 border border-red-500/20 text-red-200"
                onClick={runRemoveLiquidity}
                disabled={status === "executing" || !positionId}
              >
                {status === "executing" ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  "Close Selected Position"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* LOGS */}
      {log.length > 0 && (
        <div className="mt-8 border-t border-white/10 pt-4">
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2 font-semibold">
            Activity Log
          </p>
          <div className="font-mono text-xs space-y-1.5 text-white/60">
            {log.map((entry, i) => (
              <div
                key={i}
                className={
                  entry.includes("✅")
                    ? "text-green-400"
                    : entry.includes("❌")
                      ? "text-red-400"
                      : ""
                }
              >
                {entry}
              </div>
            ))}
            {txDigest && (
              <a
                href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-indigo-400 hover:underline mt-1"
              >
                View on Suiscan <ArrowDown className="h-3 w-3 -rotate-90" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
