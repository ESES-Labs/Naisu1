
import { useState, useMemo, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCreateSuiIntent } from '../hooks/sui/useCreateSuiIntent'
import { useCreateEvmIntent } from '../hooks/evm/useCreateEvmIntent'
import { useAuctionQuote } from '../hooks/useAuctionQuote'
import { useCurrentAccount as useSuiAccount } from '@mysten/dapp-kit'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowDown,
    Settings,
    Wallet,
    Loader2,
    ChevronDown,
    Info,
    History,
    ExternalLink,
    CheckCircle2,
    XCircle
} from 'lucide-react'
import { parseUnits, formatUnits } from 'viem'
import { useIntentHistory } from '../hooks/useIntentHistory'

// Mock Oracle Prices (In real app, fetch from checking API)
const PRICES: Record<string, number> = {
    SUI: 1.85,  // $1.85
    ETH: 2850,  // $2850
    USDC: 1.00, // $1.00
}

// Contract Addresses
const BRIDGE_ADDRESS = '0xc7ECA6bb572aB9BFBa36F503D7c6c64b9fcFf2B4' // EVM_INTENT_VAULT
const USDC_ADDRESS = '0xF06055B3e8874b1361Dd41d92836Ab7f18f8Bc90'   // MOCK_USDC

type Direction = 'evm_to_sui' | 'sui_to_evm'

export function IntentBridge() {
    const { address: evmAddress } = useAccount()
    const suiAccount = useSuiAccount()

    // Custom Hooks
    const createSuiIntent = useCreateSuiIntent()
    const createEvmIntent = useCreateEvmIntent(BRIDGE_ADDRESS, USDC_ADDRESS)
    const { addIntent, intents } = useIntentHistory()

    // ─── State ─────────────────────────────────────────────────────────────────

    const [direction, setDirection] = useState<Direction>('sui_to_evm')
    const [amount, setAmount] = useState('')
    const [recipient, setRecipient] = useState('')

    // Pending Intent Data (to save to history on success)
    const pendingIntentRef = useRef<{ amount: string, recipient: string, sourceToken: string, destToken: string } | null>(null);

    // Effect to save EVM intent when orderId is confirmed
    useEffect(() => {
        if (createEvmIntent.orderId && pendingIntentRef.current) {
            addIntent({
                id: createEvmIntent.orderId,
                type: 'EVM_TO_SUI',
                amountIn: pendingIntentRef.current.amount,
                tokenIn: 'USDC',
                tokenOut: 'SUI',
                recipient: pendingIntentRef.current.recipient,
                txHash: createEvmIntent.txHash || '',
            });
            pendingIntentRef.current = null; // Reset
        }
    }, [createEvmIntent.orderId, addIntent, createEvmIntent.txHash]);

    // Settings State
    const [durationIdx, setDurationIdx] = useState(1) // 0: 10m, 1: 30m, 2: 1h
    const [slippageIdx, setSlippageIdx] = useState(1) // 0: 0.5%, 1: 1.0%, 2: Auto
    const [maxPremium, setMaxPremium] = useState('2') // %
    const [useWalletAddress, setUseWalletAddress] = useState(true)

    const isConnected = !!(evmAddress && suiAccount)

    // Determine if we need approval (only for EVM -> Sui)
    const needsApproval = useMemo(() => {
        // If any required data is missing, we can't determine needed approval, so assume false or better yet handle loading state.
        // But for the logic bug: strict check against undefined.
        if (direction !== 'evm_to_sui' || !amount || createEvmIntent.allowance === undefined) return false;

        const amountBigInt = parseUnits(amount, 6); // USDC
        // If allowance is 0, this returns true (0 < 100).
        return createEvmIntent.allowance < amountBigInt;
    }, [direction, amount, createEvmIntent.allowance]);

    const isPending = createSuiIntent.isPending || createEvmIntent.isConfirming || createEvmIntent.isApproving;

    const DURATIONS = [10 * 60, 30 * 60, 60 * 60] // seconds
    const DUATION_LABELS = ['10m', '30m', '1h']
    const SLIPPAGES = [0.5, 1.0, 0.5] // Auto defaults to 0.5 for now

    // ─── Computed ──────────────────────────────────────────────────────────────

    const sourceToken = direction === 'sui_to_evm' ? 'SUI' : 'USDC'
    const destToken = direction === 'sui_to_evm' ? 'ETH' : 'SUI'

    // Determine slippage value
    const activeSlippage = slippageIdx === 2 ? 0.5 : SLIPPAGES[slippageIdx];

    // Smart Quote Hook
    const {
        marketOutput,
        startAmount,
        minAmount,
        isLoading: isQuoteLoading
    } = useAuctionQuote({
        amount,
        sourceToken,
        destToken,
        premiumPct: parseFloat(maxPremium) || 0,
        slippagePct: activeSlippage
    });

    // Recipient Logic
    useEffect(() => {
        if (useWalletAddress) {
            if (direction === 'sui_to_evm' && evmAddress) setRecipient(evmAddress)
            else if (direction === 'evm_to_sui' && suiAccount?.address) setRecipient(suiAccount.address)
        }
    }, [useWalletAddress, direction, evmAddress, suiAccount])


    // ─── Handlers ──────────────────────────────────────────────────────────────

    const toggleDirection = () => {
        setDirection(prev => prev === 'sui_to_evm' ? 'evm_to_sui' : 'sui_to_evm')
        setAmount('') // simple reset
    }

    const handleMax = () => {
        // Logic to set max balance would go here
        setAmount('10') // Dummy max
    }

    const handleApprove = async () => {
        if (!amount) return;
        await createEvmIntent.approve(amount);
    }

    const handleSubmit = async () => {
        if (!amount || !marketOutput || !recipient) return

        try {
            const durationSec = DURATIONS[durationIdx]

            console.log('Submitting Order:', {
                amount,
                startAmount,
                minAmount,
                durationSec,
                recipient
            })

            // Store pending details
            pendingIntentRef.current = {
                amount,
                recipient,
                sourceToken,
                destToken
            };

            if (direction === 'sui_to_evm') {
                // SUI -> ETH
                const res = await createSuiIntent.mutateAsync({
                    amountFn: parseFloat(amount),
                    recipientEvm: recipient,
                    startOutputAmountWei: parseUnits(startAmount, 18).toString(),
                    minOutputAmountWei: parseUnits(minAmount, 18).toString(),
                    durationSeconds: durationSec,
                })

                // Save to history immediately for Sui
                if (res.intentId) {
                    addIntent({
                        id: res.intentId,
                        type: 'SUI_TO_EVM',
                        amountIn: amount,
                        tokenIn: 'SUI',
                        tokenOut: 'ETH',
                        recipient: recipient,
                        txHash: res.digest,
                    });
                    pendingIntentRef.current = null;
                }

            } else {
                // USDC -> SUI
                await createEvmIntent.createOrder(
                    amount,
                    startAmount, // Hook handles decimals now? useCreateEvmIntent expects string
                    minAmount,
                    durationSec,
                    recipient,
                )
            }
        } catch (e) {
            console.error("Bridge Error:", e)
        }
    }

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <Card className="w-full max-w-[480px] mx-auto border-white/5 bg-[#0d111c] shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden relative">
            <CardContent className="p-4 space-y-1">

                {/* Header */}
                <div className="flex items-center justify-between mb-2 px-2">
                    <div className="flex gap-4 text-sm font-medium text-white/50">
                        <button className="text-white hover:opacity-80 transition-opacity">Swap</button>
                        <button className="hover:text-white transition-colors">Limit</button>
                        <button className="hover:text-white transition-colors">Send</button>
                    </div>

                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5">
                                    <History className="h-5 w-5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[320px] bg-[#131a2a] border-white/10 text-white p-0 rounded-xl shadow-xl backdrop-blur-3xl overflow-hidden">
                                <div className="p-3 border-b border-white/10 text-sm font-semibold flex justify-between items-center bg-white/5">
                                    <span>Recent Activity</span>
                                    <span className="text-xs font-normal text-white/50">{intents.length} Transactions</span>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    {intents.length === 0 ? (
                                        <div className="p-8 text-center text-white/30 text-xs">
                                            No recent transactions found.
                                        </div>
                                    ) : (
                                        intents.map((intent, i) => (
                                            <div key={`${intent.id}-${i}`} className="p-3 border-b border-white/5 hover:bg-white/5 transition-colors group">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${intent.status === 'COMPLETED' ? 'bg-emerald-500' : intent.status === 'FAILED' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
                                                        <span className="text-xs font-medium text-white/90">
                                                            {intent.type === 'SUI_TO_EVM' ? 'SUI → ETH' : 'USDC → SUI'}
                                                        </span>
                                                    </div>
                                                    {/* Simple localized time */}
                                                    <span className="text-[10px] text-white/40 font-mono">
                                                        {new Date(intent.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center pl-4">
                                                    <span className="text-xs text-white/60">
                                                        {intent.amountIn} {intent.tokenIn}
                                                    </span>
                                                    <a
                                                        href={intent.type === 'SUI_TO_EVM' ? `https://suiscan.xyz/testnet/tx/${intent.txHash}` : `https://sepolia.basescan.org/tx/${intent.txHash}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-white/30 hover:text-white transition-colors"
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </div>
                                                <div className="pl-4 mt-1 text-[10px] text-white/30 font-mono flex gap-2">
                                                    ID: {intent.id.slice(0, 6)}...{intent.id.slice(-4)}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5">
                                    <Settings className="h-5 w-5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[300px] bg-[#131a2a] border-white/10 text-white p-4 rounded-xl shadow-xl backdrop-blur-3xl">
                                <DropdownMenuLabel className="px-0 pb-3 text-sm font-semibold">Transaction Settings</DropdownMenuLabel>

                                <div className="space-y-4">
                                    {/* Duration */}
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs text-white/50">Auction Duration</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {DUATION_LABELS.map((label, i) => (
                                                <Button
                                                    key={label}
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDurationIdx(i)}
                                                    className={`flex-1 h-8 rounded-full text-xs hover:bg-white/10 ${i === durationIdx ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-white/5 border border-transparent'}`}
                                                >
                                                    {label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Slippage */}
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs text-white/50">Max Slippage</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {['0.5%', '1.0%', 'Auto'].map((label, i) => (
                                                <Button
                                                    key={label}
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSlippageIdx(i)}
                                                    className={`flex-1 h-8 rounded-full text-xs hover:bg-white/10 ${i === slippageIdx ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-white/5 border border-transparent'}`}
                                                >
                                                    {label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Premium */}
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs text-white/50 flex items-center gap-1">
                                                Max Premium
                                                <Info className="h-3 w-3" />
                                            </span>
                                        </div>
                                        <div className="relative">
                                            <Input
                                                value={maxPremium}
                                                onChange={e => setMaxPremium(e.target.value)}
                                                className="h-9 bg-white/5 border-white/10 text-right pr-8 text-sm focus:border-indigo-500/50"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/50">%</span>
                                        </div>
                                    </div>

                                    <DropdownMenuSeparator className="bg-white/10 my-3" />

                                    {/* Recipient Toggle */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-white/60">Use Connected Wallet</span>
                                        <div
                                            onClick={() => setUseWalletAddress(!useWalletAddress)}
                                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${useWalletAddress ? 'bg-emerald-500/20' : 'bg-white/10'}`}
                                        >
                                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-current transition-all ${useWalletAddress ? 'left-6 text-emerald-400' : 'left-1 text-white/30'}`} />
                                        </div>
                                    </div>

                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* ─── You Pay ─────────────────────────────────────────────────── */}
                <div className="bg-[#131a2a] rounded-2xl p-4 hover:border-white/5 border border-transparent transition-colors">
                    <div className="flex justify-between mb-3 text-sm text-white/40 font-medium">
                        <span>You Pay</span>
                        <span>Balance: {sourceToken === 'USDC' ? '12,340.00' : '530.22'}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="number"
                            placeholder="0"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="w-full bg-transparent text-4xl font-medium text-white placeholder-white/20 outline-none"
                            style={{ appearance: 'none' }}
                        />

                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 shrink-0 ${sourceToken === 'SUI' ? 'bg-indigo-500/10' : 'bg-cyan-500/10'}`}>
                            <div className={`w-6 h-6 rounded-full ${sourceToken === 'SUI' ? 'bg-indigo-500' : 'bg-cyan-500'}`} />
                            <span className="text-lg font-semibold text-white">{sourceToken}</span>
                            <ChevronDown className="h-4 w-4 text-white/50" />
                        </div>
                    </div>

                    <div className="flex justify-between mt-2">
                        <span className="text-xs text-white/30">≈ ${((parseFloat(amount) || 0) * PRICES[sourceToken]).toFixed(2)}</span>
                    </div>
                </div>

                {/* ─── Separator ───────────────────────────────────────────────── */}
                <div className="relative h-2 z-10">
                    <div className="absolute left-1/2 -top-5 -translate-x-1/2">
                        <div className="bg-[#0d111c] p-1.5 rounded-xl">
                            <button
                                onClick={toggleDirection}
                                className="bg-[#242b3b] p-2 rounded-xl border-[3px] border-[#0d111c] hover:scale-105 active:scale-95 transition-all group"
                            >
                                <ArrowDown className="h-4 w-4 text-white/60 group-hover:text-white" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ─── You Receive ─────────────────────────────────────────────── */}
                <div className="bg-[#131a2a] rounded-2xl p-4 border border-transparent transition-colors">
                    <div className="flex justify-between mb-3 text-sm text-white/40 font-medium">
                        <span>You Receive</span>
                        <span>Balance: 0.00</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            readOnly
                            placeholder="0"
                            value={marketOutput}
                            className={`w-full bg-transparent text-4xl font-medium placeholder-white/20 outline-none cursor-default ${isQuoteLoading ? 'text-white/30 animate-pulse' : 'text-white/60'}`}
                        />

                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-default border border-transparent shrink-0 ${destToken === 'SUI' ? 'bg-indigo-500/10' : 'bg-white/5'}`}>
                            <div className={`w-6 h-6 rounded-full ${destToken === 'SUI' ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                            <span className="text-lg font-semibold text-white">{destToken}</span>
                        </div>
                    </div>
                    <div className="flex justify-between mt-2">
                        <span className="text-xs text-white/30">
                            {marketOutput ? `≈ $${((parseFloat(marketOutput) || 0) * PRICES[destToken]).toFixed(2)}` : '$0.00'}
                            <span className="ml-1 text-emerald-400">(-0.05%)</span>
                        </span>
                    </div>
                </div>

                {/* ─── Manual Address ──────────────────────────────────────────── */}
                <AnimatePresence>
                    {!useWalletAddress && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="bg-[#131a2a] rounded-xl p-3 mt-1 flex items-center gap-3 border border-amber-500/20">
                                <Wallet className="h-4 w-4 text-amber-500/50" />
                                <input
                                    value={recipient}
                                    onChange={e => setRecipient(e.target.value)}
                                    placeholder={`Enter ${destToken} recipient address...`}
                                    className="bg-transparent text-sm w-full outline-none text-amber-100 placeholder-amber-500/30"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ─── CTA ─────────────────────────────────────────────────────── */}

                <div className="pt-2">
                    {!isConnected ? (
                        <Button
                            fullWidth
                            size="lg"
                            className="bg-[#2a3040] text-indigo-300 font-semibold h-14 rounded-2xl hover:bg-[#343b4f]"
                        >
                            Connect Wallet
                        </Button>
                    ) : needsApproval ? (
                        <Button
                            fullWidth
                            size="lg"
                            onClick={handleApprove}
                            disabled={isPending}
                            className="bg-amber-500/10 text-amber-500 border border-amber-500/50 font-bold text-lg h-14 rounded-2xl hover:bg-amber-500/20 transition-all"
                        >
                            {createEvmIntent.isApproving ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Approving USDC...
                                </div>
                            ) : (
                                'Approve USDC'
                            )}
                        </Button>
                    ) : (
                        <Button
                            fullWidth
                            size="lg"
                            onClick={handleSubmit}
                            disabled={isPending || !amount || !marketOutput}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 font-bold text-lg h-14 rounded-2xl hover:opacity-90 shadow-lg shadow-indigo-500/20 transition-all"
                        >
                            {isPending ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Sign Transaction
                                </div>
                            ) : (
                                `Review Order`
                            )}
                        </Button>
                    )}
                </div>

                {/* Quote Info */}
                {marketOutput && (
                    <div className="mt-4 px-2 space-y-1">
                        <div className="flex justify-between text-xs font-medium text-white/30">
                            <span>Rate</span>
                            <span>1 {sourceToken} = {(PRICES[sourceToken] / PRICES[destToken]).toFixed(4)} {destToken}</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium text-white/30">
                            <span>Estimated Gas</span>
                            <span className="text-emerald-400">~$0.42</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium text-white/30">
                            <span>Start Bid (Premium)</span>
                            <span className="text-indigo-400">{startAmount} {destToken}</span>
                        </div>
                    </div>
                )}

            </CardContent>
        </Card>
    )
}
