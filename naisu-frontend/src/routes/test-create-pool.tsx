import { useState, useCallback, useEffect } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useSuiClient } from "@mysten/dapp-kit";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import toast from "react-hot-toast";
import { createFileRoute } from "@tanstack/react-router";

// Route config
export const Route = createFileRoute("/test-create-pool")({
    component: TestCreatePool,
});

// Constants
const CETUS_INTEGRATE_PACKAGE = "0xab2d58dd28ff0dc19b18ab2c634397b785a38c342a8f5065ade5f53f9dbffa1c";
const CETUS_GLOBAL_CONFIG = "0xc6273f844b4bc258952c4e477697aa12c918c8e08106fac6b934811298c9820a";
const CETUS_POOLS_FACTORY = "0x20a086e6fa0741b3ca77d033a65faf0871349b986ddbdde6fa1d85d78a5f4222";
const SUI_CLOCK = "0x6";

// Fee tiers with tick spacing
const FEE_TIERS = [
    { label: "0.01%", tickSpacing: 2, fee: 0.0001 },
    { label: "0.05%", tickSpacing: 10, fee: 0.0005 },
    { label: "0.25%", tickSpacing: 60, fee: 0.0025 },
    { label: "1%", tickSpacing: 200, fee: 0.01 },
];

interface TokenBalance {
    coinType: string;
    symbol: string;
    balance: bigint;
    decimals: number;
    formattedBalance: string;
}

export default function TestCreatePool() {
    const suiClient = useSuiClient();
    const account = useCurrentAccount();
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

    // State
    const [walletTokens, setWalletTokens] = useState<TokenBalance[]>([]);
    const [selectedTokenA, setSelectedTokenA] = useState<string>("");
    const [selectedTokenB, setSelectedTokenB] = useState<string>("");
    const [selectedFeeTier, setSelectedFeeTier] = useState(60);
    const [initialPrice, setInitialPrice] = useState("1");
    const [amountA, setAmountA] = useState("");
    const [amountB, setAmountB] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingTokens, setIsFetchingTokens] = useState(false);
    const [txResult, setTxResult] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
        console.log(msg);
    };

    // Fetch all tokens from wallet
    const fetchWalletTokens = useCallback(async () => {
        if (!account) return;

        setIsFetchingTokens(true);
        addLog("🔍 Fetching tokens from wallet...");

        try {
            const allCoins = await suiClient.getAllBalances({
                owner: account.address,
            });

            const tokens: TokenBalance[] = [];

            for (const coin of allCoins) {
                const balance = BigInt(coin.totalBalance);
                if (balance > 0) {
                    // Extract symbol from coin type
                    const parts = coin.coinType.split("::");
                    const symbol = parts[parts.length - 1] || "UNKNOWN";

                    // Assume decimals (SUI = 9, most others = 6)
                    const decimals = coin.coinType === "0x2::sui::SUI" ? 9 : 6;
                    const formattedBalance = (Number(balance) / Math.pow(10, decimals)).toFixed(4);

                    tokens.push({
                        coinType: coin.coinType,
                        symbol,
                        balance,
                        decimals,
                        formattedBalance,
                    });
                }
            }

            setWalletTokens(tokens);
            addLog(`✅ Found ${tokens.length} tokens in wallet`);
        } catch (e: any) {
            addLog(`❌ Error: ${e.message}`);
        } finally {
            setIsFetchingTokens(false);
        }
    }, [suiClient, account]);

    // Auto-fetch on mount
    useEffect(() => {
        if (account) {
            fetchWalletTokens();
        }
    }, [account, fetchWalletTokens]);

    // Calculate sqrt price from price
    const priceToSqrtPriceX64 = (price: number): bigint => {
        const sqrtPrice = Math.sqrt(price);
        return BigInt(Math.floor(sqrtPrice * Math.pow(2, 64)));
    };

    // Calculate tick from price
    // const priceToTick = (price: number): number => {
    //     return Math.floor(Math.log(price) / Math.log(1.0001));
    // };

    // Get max balance for selected token
    const getMaxBalance = (tokenType: string): string => {
        const token = walletTokens.find(t => t.coinType === tokenType);
        return token?.formattedBalance || "0";
    };

    // Create pool with liquidity
    const createPoolWithLiquidity = async () => {
        if (!account) {
            toast.error("Connect wallet first!");
            return;
        }

        if (!selectedTokenA || !selectedTokenB) {
            toast.error("Select both tokens!");
            return;
        }

        if (selectedTokenA === selectedTokenB) {
            toast.error("Tokens must be different!");
            return;
        }

        const price = parseFloat(initialPrice);
        const amtA = parseFloat(amountA);
        const amtB = parseFloat(amountB);

        if (isNaN(price) || price <= 0) {
            toast.error("Invalid price!");
            return;
        }

        if (isNaN(amtA) || amtA <= 0 || isNaN(amtB) || amtB <= 0) {
            toast.error("Invalid amounts!");
            return;
        }

        setIsLoading(true);
        setLogs([]);
        setTxResult(null);

        try {
            let tokenA = walletTokens.find(t => t.coinType === selectedTokenA)!;
            let tokenB = walletTokens.find(t => t.coinType === selectedTokenB)!;
            let actualAmtA = amtA;
            let actualAmtB = amtB;
            let actualPrice = price;

            // Auto-sort tokens by address (Cetus requires consistent ordering)
            // If tokenA address > tokenB address, swap them and invert price
            if (selectedTokenA.toLowerCase() > selectedTokenB.toLowerCase()) {
                addLog("🔄 Auto-sorting tokens (swapping A ↔ B for correct order)");
                // Swap tokens
                const tempToken = tokenA;
                tokenA = tokenB;
                tokenB = tempToken;
                // Swap amounts
                const tempAmt = actualAmtA;
                actualAmtA = actualAmtB;
                actualAmtB = tempAmt;
                // Invert price (if price was B per A, now it's A per B)
                actualPrice = 1 / price;
                addLog(`📊 Adjusted price: ${actualPrice} ${tokenB.symbol} per ${tokenA.symbol}`);
            }

            const tx = new Transaction();

            // Calculate sqrt_price_x64 with adjusted price
            const sqrtPriceX64 = priceToSqrtPriceX64(actualPrice);
            addLog(`📊 Initial price: ${actualPrice} ${tokenB.symbol} per ${tokenA.symbol}`);
            addLog(`📊 sqrt_price_x64: ${sqrtPriceX64}`);

            // Use wide tick range like in working transactions
            // Working TX used: tick_lower = -443580 (as u32: 4294523716), tick_upper = 443580
            const tickSpacing = selectedFeeTier;
            const MIN_TICK = -443580;
            const MAX_TICK = 443580;
            // Align to tick spacing
            const tickLower = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;
            const tickUpper = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
            addLog(`📊 Tick range: [${tickLower}, ${tickUpper}]`);

            const amountARaw = BigInt(Math.floor(actualAmtA * Math.pow(10, tokenA.decimals)));
            const amountBRaw = BigInt(Math.floor(actualAmtB * Math.pow(10, tokenB.decimals)));

            addLog(`💰 Amount A: ${actualAmtA} ${tokenA.symbol}`);
            addLog(`💰 Amount B: ${actualAmtB} ${tokenB.symbol}`);

            // Get coins for both types (using sorted token types)
            const [coinsA, coinsB] = await Promise.all([
                suiClient.getCoins({ owner: account.address, coinType: tokenA.coinType }),
                suiClient.getCoins({ owner: account.address, coinType: tokenB.coinType }),
            ]);

            // Prepare coin A
            let coinAInput;
            if (tokenA.coinType === "0x2::sui::SUI") {
                [coinAInput] = tx.splitCoins(tx.gas, [tx.pure.u64(amountARaw)]);
            } else {
                if (coinsA.data.length === 1) {
                    const [split] = tx.splitCoins(tx.object(coinsA.data[0].coinObjectId), [tx.pure.u64(amountARaw)]);
                    coinAInput = split;
                } else {
                    const [primary, ...others] = coinsA.data;
                    const primaryRef = tx.object(primary.coinObjectId);
                    for (const c of others) {
                        tx.mergeCoins(primaryRef, [tx.object(c.coinObjectId)]);
                    }
                    const [split] = tx.splitCoins(primaryRef, [tx.pure.u64(amountARaw)]);
                    coinAInput = split;
                }
            }

            // Prepare coin B
            let coinBInput;
            if (tokenB.coinType === "0x2::sui::SUI") {
                [coinBInput] = tx.splitCoins(tx.gas, [tx.pure.u64(amountBRaw)]);
            } else {
                if (coinsB.data.length === 1) {
                    const [split] = tx.splitCoins(tx.object(coinsB.data[0].coinObjectId), [tx.pure.u64(amountBRaw)]);
                    coinBInput = split;
                } else {
                    const [primary, ...others] = coinsB.data;
                    const primaryRef = tx.object(primary.coinObjectId);
                    for (const c of others) {
                        tx.mergeCoins(primaryRef, [tx.object(c.coinObjectId)]);
                    }
                    const [split] = tx.splitCoins(primaryRef, [tx.pure.u64(amountBRaw)]);
                    coinBInput = split;
                }
            }

            addLog("🔧 Calling pool_creator_v3::create_pool_v3...");

            // Convert signed ticks to u32 (two's complement for negative values)
            const tickLowerU32 = tickLower < 0 ? (0xFFFFFFFF + tickLower + 1) : tickLower;
            const tickUpperU32 = tickUpper < 0 ? (0xFFFFFFFF + tickUpper + 1) : tickUpper;

            // Call pool_creator_v3::create_pool_v3 (11 args)
            // Entry function - no return value! Position is transferred internally to sender
            // Matching working transaction: 96Fg1QX1bMQ38kzHvd7Nze5QZ2hsLm9SAuFhvUrBK78P
            console.log("Creating pool with params:", {
                tickSpacing,
                sqrtPriceX64: sqrtPriceX64.toString(),
                tickLower,
                tickUpper,
                tickLowerU32,
                tickUpperU32,
                amountARaw: amountARaw.toString(),
                amountBRaw: amountBRaw.toString(),
            });

            tx.moveCall({
                target: `${CETUS_INTEGRATE_PACKAGE}::pool_creator_v3::create_pool_v3`,
                arguments: [
                    tx.object(CETUS_GLOBAL_CONFIG),   // arg0: GlobalConfig
                    tx.object(CETUS_POOLS_FACTORY),   // arg1: Pools factory
                    tx.pure.u32(tickSpacing),          // arg2: tick_spacing
                    tx.pure.u128(sqrtPriceX64),        // arg3: initialize_sqrt_price
                    tx.pure.string(""),                // arg4: uri
                    tx.pure.u32(tickLowerU32),         // arg5: tick_lower (as u32)
                    tx.pure.u32(tickUpperU32),         // arg6: tick_upper (as u32)
                    coinAInput,                        // arg7: Coin<T0>
                    coinBInput,                        // arg8: Coin<T1>
                    tx.pure.bool(true),                // arg9: fix_amount_a
                    tx.object(SUI_CLOCK),              // arg10: Clock
                ],
                typeArguments: [tokenA.coinType, tokenB.coinType],
            });

            // Transfer remaining coins back to user - matching working TX pattern
            tx.transferObjects([coinAInput, coinBInput], account.address);

            addLog("📝 Signing transaction...");

            signAndExecuteTransaction(
                { transaction: tx as any },
                {
                    onSuccess: (result) => {
                        addLog(`✅ Pool created with liquidity! Digest: ${result.digest}`);
                        setTxResult(result.digest);
                        toast.success("Pool created successfully!");
                        setIsLoading(false);
                        fetchWalletTokens(); // Refresh balances
                    },
                    onError: (error) => {
                        addLog(`❌ Failed: ${error.message}`);
                        toast.error(error.message);
                        setIsLoading(false);
                    },
                }
            );
        } catch (e: any) {
            addLog(`❌ Error: ${e.message}`);
            toast.error(e.message);
            setIsLoading(false);
        }
    };

    const tokenAInfo = walletTokens.find(t => t.coinType === selectedTokenA);
    const tokenBInfo = walletTokens.find(t => t.coinType === selectedTokenB);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-cyan-900/20 to-gray-900 p-8">
            <div className="max-w-xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">🏭 Create Pool</h1>
                    <p className="text-cyan-300">Create Custom CLMM Pool with Initial Liquidity</p>
                </div>

                {/* Main Card */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20">
                    {/* Warning */}
                    <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <p className="text-amber-300 text-sm">
                            ⚠️ Creating pool requires both tokens. Will fail if pool already exists.
                        </p>
                    </div>

                    {/* Refresh Tokens Button */}
                    <button
                        onClick={fetchWalletTokens}
                        disabled={isFetchingTokens}
                        className="w-full mb-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition"
                    >
                        {isFetchingTokens ? "⏳ Loading..." : "🔄 Refresh Wallet Tokens"}
                    </button>

                    {/* Token A Selection */}
                    <div className="mb-4">
                        <label className="block text-cyan-300 text-sm mb-2">Token A</label>
                        <select
                            value={selectedTokenA}
                            onChange={(e) => setSelectedTokenA(e.target.value)}
                            className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="">-- Select Token A --</option>
                            {walletTokens.map((t) => (
                                <option key={t.coinType} value={t.coinType}>
                                    {t.symbol} - {t.formattedBalance} available
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Token B Selection */}
                    <div className="mb-4">
                        <label className="block text-cyan-300 text-sm mb-2">Token B (Pair)</label>
                        <select
                            value={selectedTokenB}
                            onChange={(e) => setSelectedTokenB(e.target.value)}
                            className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="">-- Select Token B --</option>
                            {walletTokens
                                .filter((t) => t.coinType !== selectedTokenA)
                                .map((t) => (
                                    <option key={t.coinType} value={t.coinType}>
                                        {t.symbol} - {t.formattedBalance} available
                                    </option>
                                ))}
                        </select>
                    </div>

                    {/* Fee Tier Selection */}
                    <div className="mb-4">
                        <label className="block text-cyan-300 text-sm mb-2">Fee Tier</label>
                        <div className="grid grid-cols-4 gap-2">
                            {FEE_TIERS.map((tier) => (
                                <button
                                    key={tier.tickSpacing}
                                    onClick={() => setSelectedFeeTier(tier.tickSpacing)}
                                    className={`p-2 rounded-xl text-sm font-semibold transition ${selectedFeeTier === tier.tickSpacing
                                        ? "bg-cyan-500/30 border-2 border-cyan-500 text-white"
                                        : "bg-gray-700/50 border border-gray-600 text-gray-300 hover:border-cyan-400"
                                        }`}
                                >
                                    {tier.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Initial Price */}
                    <div className="mb-4">
                        <label className="block text-cyan-300 text-sm mb-2">
                            Initial Price ({tokenBInfo?.symbol || "B"} per {tokenAInfo?.symbol || "A"})
                        </label>
                        <input
                            type="number"
                            value={initialPrice}
                            onChange={(e) => setInitialPrice(e.target.value)}
                            className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            placeholder="1.0"
                        />
                    </div>

                    {/* Initial Supply */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-cyan-300 text-sm">Amount {tokenAInfo?.symbol || "A"}</label>
                                <button
                                    onClick={() => setAmountA(getMaxBalance(selectedTokenA))}
                                    className="text-xs text-cyan-400 hover:underline"
                                >
                                    MAX
                                </button>
                            </div>
                            <input
                                type="number"
                                value={amountA}
                                onChange={(e) => setAmountA(e.target.value)}
                                className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                placeholder="0.0"
                            />
                            {selectedTokenA && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Available: {getMaxBalance(selectedTokenA)}
                                </p>
                            )}
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-cyan-300 text-sm">Amount {tokenBInfo?.symbol || "B"}</label>
                                <button
                                    onClick={() => setAmountB(getMaxBalance(selectedTokenB))}
                                    className="text-xs text-cyan-400 hover:underline"
                                >
                                    MAX
                                </button>
                            </div>
                            <input
                                type="number"
                                value={amountB}
                                onChange={(e) => setAmountB(e.target.value)}
                                className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                placeholder="0.0"
                            />
                            {selectedTokenB && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Available: {getMaxBalance(selectedTokenB)}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Create Button */}
                    <button
                        onClick={createPoolWithLiquidity}
                        disabled={isLoading || !account || !selectedTokenA || !selectedTokenB || !amountA || !amountB}
                        className="w-full py-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 disabled:opacity-50 text-white rounded-xl font-bold text-lg transition"
                    >
                        {isLoading ? "⏳ Creating..." : "🏭 Create Pool with Liquidity"}
                    </button>

                    {!account && (
                        <p className="text-center text-amber-400 mt-4">⚠️ Connect wallet first</p>
                    )}

                    {walletTokens.length === 0 && account && !isFetchingTokens && (
                        <p className="text-center text-gray-400 mt-4">No tokens found. Click refresh to load.</p>
                    )}

                    {/* TX Result */}
                    {txResult && (
                        <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                            <p className="text-emerald-400 font-semibold">✅ Pool Created!</p>
                            <a
                                href={`https://suiscan.xyz/testnet/tx/${txResult}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-400 hover:underline break-all"
                            >
                                {txResult}
                            </a>
                        </div>
                    )}
                </div>

                {/* Logs */}
                {logs.length > 0 && (
                    <div className="mt-6 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                        <h3 className="text-white font-semibold mb-2">📋 Logs</h3>
                        <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
                            {logs.map((log, i) => (
                                <p key={i} className="text-gray-300">{log}</p>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
