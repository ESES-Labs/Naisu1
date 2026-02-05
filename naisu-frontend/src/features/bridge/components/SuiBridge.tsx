import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useMutateBridge } from '@/features/bridge'
import { useCurrentAccount as useSuiAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { useAccount, useWriteContract } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { keccak256, toHex } from 'viem'
import { ArrowRight, Loader2, Check, ExternalLink, AlertCircle, Coins, Wallet } from 'lucide-react'
import { Transaction } from '@mysten/sui/transactions'

type BridgeStep = 'input' | 'signing' | 'bridging' | 'claiming' | 'complete'

// ═══════════════════════════════════════════════════════════════════════════════
// CCTP Contract addresses (from Circle's testnet deployment)
// Source: https://github.com/circlefin/sui-cctp (testnet branch)
// ═══════════════════════════════════════════════════════════════════════════════

// Package IDs
const TOKEN_MESSENGER_MINTER_PACKAGE = '0x31cc14d80c175ae39777c0238f20594c6d4869cfab199f40b69f3319956b8beb'

// USDC on Sui Testnet (from Circle)
const USDC_COIN_TYPE = '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC'

// Shared Object IDs (from Circle's official docs: https://developers.circle.com/cctp/v1/sui-packages)
// Sui Testnet CCTP Shared Objects
const CCTP_STATE_OBJECT = '0x5252abd1137094ed1db3e0d75bc36abcd287aee4bc310f8e047727ef5682e7c2'
const MESSAGE_TRANSMITTER_STATE = '0x98234bd0fa9ac12cc0a20a144a22e36d6a32f7e0a97baaeaf9c76cdc6d122d2e'
const USDC_TREASURY = '0x7170137d4a6431bf83351ac025baf462909bffe2877d87716374fb42b9629ebe'

// Domain IDs
const CCTP_DOMAIN_BASE = 5 // Base domain

// EVM MessageTransmitter on Base Sepolia
const MESSAGE_TRANSMITTER_BASE_SEPOLIA = '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD'

export function SuiBridge() {
    const suiAccount = useSuiAccount()
    const suiClient = useSuiClient()
    const { address: evmAddress } = useAccount()
    const initBridge = useMutateBridge()
    const { mutateAsync: signAndExecute, isPending: isSigning } = useSignAndExecuteTransaction()
    const { writeContractAsync } = useWriteContract()

    const [step, setStep] = useState<BridgeStep>('input')
    const [amount, setAmount] = useState('')
    const [nonce, setNonce] = useState<string | null>(null)
    const [txDigest, setTxDigest] = useState<string | null>(null)
    const [claimTxHash, setClaimTxHash] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // USDC Balance State
    const [usdcBalance, setUsdcBalance] = useState<string>('0')
    const [usdcCoins, setUsdcCoins] = useState<Array<{ objectId: string; balance: string }>>([])
    const [isLoadingBalance, setIsLoadingBalance] = useState(false)

    // const attestation = usePollAttestation(nonce) // Using client-side polling instead
    const isConnected = !!(suiAccount && evmAddress)
    const [attestationSignature, setAttestationSignature] = useState<string | null>(null)


    // ─── Poll Circle API (Client Side) ──────────────────────────────────────
    useEffect(() => {
        let isMounted = true
        let timeoutId: NodeJS.Timeout

        const poll = async () => {
            if (!nonce) return
            try {
                const { message_hash } = JSON.parse(nonce)


                console.log('Polling Circle API for hash:', message_hash)
                const res = await fetch(`https://iris-api-sandbox.circle.com/v1/attestations/${message_hash}`)

                if (res.ok) {
                    const data = await res.json()
                    if (data.status === 'complete' && data.attestation) {
                        console.log('Attestation received:', data.attestation)
                        setAttestationSignature(data.attestation)
                        setStep('claiming')
                        // setIsPolling(false) (already removed)
                        return // Stop polling
                    }
                }
            } catch (e) {
                console.warn('Polling check failed:', e)
            }

            if (isMounted) {
                timeoutId = setTimeout(poll, 5000)
            }
        }

        if (nonce && step === 'bridging') {
            poll()
        }

        return () => {
            isMounted = false
            clearTimeout(timeoutId)
        }
    }, [nonce, step])

    // ─── Fetch USDC Balance ─────────────────────────────────────────────────

    useEffect(() => {
        const fetchUsdcBalance = async () => {
            if (!suiAccount?.address) {
                console.log('No Sui account connected')
                setIsLoadingBalance(false)
                return
            }
            if (!suiClient) {
                console.log('Sui client not initialized')
                setIsLoadingBalance(false)
                return
            }

            setIsLoadingBalance(true)
            console.log('Fetching USDC balance for:', suiAccount.address)
            console.log('Using USDC type:', USDC_COIN_TYPE)
            console.log('Sui Client:', suiClient)

            try {
                console.log('Calling getCoins...')
                const startTime = Date.now()

                // Add timeout to prevent hanging
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout after 10s')), 10000)
                )

                // Get all USDC coins owned by the user
                const coins = await Promise.race([
                    suiClient.getCoins({
                        owner: suiAccount.address,
                        coinType: USDC_COIN_TYPE,
                    }),
                    timeoutPromise
                ]) as any

                const elapsed = Date.now() - startTime
                console.log(`✅ USDC coins fetched in ${elapsed}ms:`, coins.data.length, 'coins')
                console.log('Full response:', coins)

                // Calculate total balance
                const total = coins.data.reduce((acc: bigint, coin: { balance: string }) => {
                    return acc + BigInt(coin.balance)
                }, BigInt(0))

                // Format balance (USDC has 6 decimals)
                const formatted = (Number(total) / 1_000_000).toFixed(2)
                setUsdcBalance(formatted)
                console.log('💰 Balance set to:', formatted, 'USDC')

                // Store coin objects for PTB
                setUsdcCoins(coins.data.map((c: { coinObjectId: string; balance: string }) => ({
                    objectId: c.coinObjectId,
                    balance: c.balance,
                })))

            } catch (err) {
                console.error('❌ Failed to fetch USDC balance:', err)
                // Show error to user
                setError(`Failed to fetch balance: ${err instanceof Error ? err.message : 'Unknown error'}`)
                setUsdcBalance('0')
            } finally {
                console.log('🏁 Fetch complete, loading state:', false)
                setIsLoadingBalance(false)
            }
        }

        fetchUsdcBalance()
    }, [suiAccount?.address, suiClient])

    // ─── Build Real PTB for deposit_for_burn ────────────────────────────────

    const buildDepositForBurnTx = (amountRaw: bigint): Transaction => {
        const tx = new Transaction()

        // Pad EVM address to 32 bytes (Sui address format)
        const paddedMintRecipient = `0x000000000000000000000000${evmAddress!.slice(2)}`

        // Find coins to use (merge if needed)
        if (usdcCoins.length === 0) {
            throw new Error('No USDC coins found in wallet')
        }

        // If we have multiple coins, merge them first
        let coinToUse: ReturnType<typeof tx.object>

        if (usdcCoins.length === 1) {
            coinToUse = tx.object(usdcCoins[0].objectId)
        } else {
            // Merge all coins into the first one
            const [primary, ...rest] = usdcCoins
            coinToUse = tx.object(primary.objectId)
            if (rest.length > 0) {
                tx.mergeCoins(coinToUse, rest.map(c => tx.object(c.objectId)))
            }
        }

        // Split the exact amount we need
        const [coinToSend] = tx.splitCoins(coinToUse, [tx.pure.u64(amountRaw)])

        // Call deposit_for_burn
        // entry fun deposit_for_burn<T: drop>(
        //   coins: Coin<T>, 
        //   destination_domain: u32, 
        //   mint_recipient: address, 
        //   state: &State,
        //   message_transmitter_state: &mut MessageTransmitterState,
        //   deny_list: &DenyList,
        //   treasury: &mut Treasury<T>,
        //   ctx: &TxContext
        // )
        tx.moveCall({
            target: `${TOKEN_MESSENGER_MINTER_PACKAGE}::deposit_for_burn::deposit_for_burn`,
            typeArguments: [USDC_COIN_TYPE],
            arguments: [
                coinToSend,
                tx.pure.u32(CCTP_DOMAIN_BASE),
                tx.pure.address(paddedMintRecipient),
                tx.object(CCTP_STATE_OBJECT),
                tx.object(MESSAGE_TRANSMITTER_STATE),
                tx.object('0x403'), // DenyList system object
                tx.object(USDC_TREASURY),
            ],
        })

        return tx
    }

    // ─── Handlers ────────────────────────────────────────────────────────────

    const handleInitBridge = async () => {
        if (!amount || !suiAccount || !evmAddress) return
        setError(null)

        const amountNum = parseFloat(amount)
        if (isNaN(amountNum) || amountNum <= 0) {
            setError('Please enter a valid amount')
            return
        }

        if (amountNum > parseFloat(usdcBalance)) {
            setError('Insufficient USDC balance')
            return
        }

        try {
            // Get tx_params from backend (for logging/validation)
            const response = await initBridge.mutateAsync({
                sender: suiAccount.address,
                amount,
                evm_destination: evmAddress,
            })
            console.log('Bridge Init Response:', response)

            setStep('signing')

            // Build the real PTB
            const amountRaw = BigInt(Math.floor(amountNum * 1_000_000)) // 6 decimals
            const tx = buildDepositForBurnTx(amountRaw)

            console.log('PTB built, signing...')
            console.log('Package:', TOKEN_MESSENGER_MINTER_PACKAGE)
            console.log('USDC Type:', USDC_COIN_TYPE)
            console.log('Destination Domain:', CCTP_DOMAIN_BASE)

            // Sign and execute - serialize to bypass version mismatch
            const result = await signAndExecute({
                transaction: tx.serialize(),
            } as any)

            console.log('Sui TX Result:', result)
            setTxDigest(result.digest)

            // Wait for transaction to be indexed and fetch events reliably
            console.log('Fetching transaction details...')
            const txDetails = await suiClient.waitForTransaction({
                digest: result.digest,
                options: {
                    showEvents: true,
                }
            })

            console.log('Full TX Details:', txDetails)

            // Parse message from transaction events
            // We need the 'MessageSent' event to get the raw message bytes
            const messageEvent = txDetails.events?.find((e: any) => e.type.includes('MessageSent'))

            if (messageEvent && messageEvent.parsedJson) {
                const messageBytes = (messageEvent.parsedJson as any).message as number[]

                // Convert number[] to Uint8Array for hashing
                const messageUint8 = new Uint8Array(messageBytes)
                const messageHex = toHex(messageUint8)
                const messageHash = keccak256(messageUint8)

                console.log('Found CCTP Message:', { messageHex, messageHash })

                // Store both for polling
                setNonce(JSON.stringify({ message_hash: messageHash, message_bytes: messageHex }))
                setStep('bridging')
            } else {
                console.warn('MessageSent event not found in completed transaction')
                setError('Failed to retrieve CCTP Message from transaction.')
            }

        } catch (e: unknown) {
            const err = e as Error
            console.error('Bridge error:', err)
            setError(err.message || 'Failed to bridge USDC')
            // Don't reset to input immediately so user can see error
        }
    }

    const handleClaim = async () => {
        if (!nonce || !attestationSignature) return
        setError(null)

        try {
            const { message_bytes } = JSON.parse(nonce)

            console.log('Claiming with:', { message_bytes, attestationSignature })

            const hash = await writeContractAsync({
                address: MESSAGE_TRANSMITTER_BASE_SEPOLIA as `0x${string}`,
                abi: [{
                    "inputs": [
                        { "internalType": "bytes", "name": "message", "type": "bytes" },
                        { "internalType": "bytes", "name": "signature", "type": "bytes" }
                    ],
                    "name": "receiveMessage",
                    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }],
                functionName: 'receiveMessage',
                args: [
                    message_bytes as `0x${string}`,
                    attestationSignature as `0x${string}`
                ],
            })

            console.log('Claim TX Hash:', hash)
            setClaimTxHash(hash)
            setStep('complete')

        } catch (e: unknown) {
            const err = e as Error
            console.error('Claim error:', err)
            setError(err.message || 'Failed to claim USDC')
        }
    }

    const handleSetMax = () => {
        setAmount(usdcBalance)
    }



    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <Card padding="lg" className="w-full max-w-lg">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                    <Coins className="h-6 w-6 text-cyan-400" />
                    <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        Sui → Base Bridge
                    </span>
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Connection Check */}
                {!isConnected && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>Connect both Sui and EVM wallets to continue</span>
                    </div>
                )}

                {/* USDC Balance Display */}
                {suiAccount && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                        <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-cyan-400" />
                            <span className="text-sm text-white/60">Your USDC Balance</span>
                        </div>
                        <div className="text-right flex items-center gap-2">
                            {isLoadingBalance ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                                    <button
                                        onClick={() => setIsLoadingBalance(false)}
                                        className="text-xs text-white/40 hover:text-white/60"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <span className="font-mono font-semibold text-white">
                                    {usdcBalance} <span className="text-cyan-400">USDC</span>
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Step Progress */}
                <div className="flex items-center justify-between text-xs text-white/40">
                    <StepIndicator step={1} current={step} label="Amount" activeSteps={['input']} />
                    <div className="flex-1 h-px bg-white/10 mx-2" />
                    <StepIndicator step={2} current={step} label="Sign" activeSteps={['signing']} />
                    <div className="flex-1 h-px bg-white/10 mx-2" />
                    <StepIndicator step={3} current={step} label="Bridge" activeSteps={['bridging']} />
                    <div className="flex-1 h-px bg-white/10 mx-2" />
                    <StepIndicator step={4} current={step} label="Claim" activeSteps={['claiming', 'complete']} />
                </div>

                {/* Step Content */}
                <AnimatePresence mode="wait">
                    {step === 'input' && (
                        <motion.div
                            key="input"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-sm text-white/60 mb-2">USDC Amount</label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="text-lg pr-16"
                                    />
                                    <button
                                        onClick={handleSetMax}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                                    >
                                        MAX
                                    </button>
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                                <Row label="From" value="Sui Testnet" />
                                <Row label="To" value="Base Sepolia" />
                                <Row label="Token" value="USDC (Native)" />
                                <Row label="Destination" value={evmAddress ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` : '-'} />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-sm">
                                    <AlertCircle className="h-4 w-4" />
                                    {error}
                                </div>
                            )}

                            <Button
                                fullWidth
                                disabled={!isConnected || !amount || parseFloat(amount) <= 0 || initBridge.isPending || isSigning}
                                onClick={handleInitBridge}
                            >
                                {initBridge.isPending || isSigning ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</>
                                ) : (
                                    <>Bridge {amount || '0'} USDC <ArrowRight className="h-4 w-4 ml-2" /></>
                                )}
                            </Button>
                        </motion.div>
                    )}

                    {step === 'signing' && (
                        <motion.div
                            key="signing"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-center py-8"
                        >
                            <Loader2 className="h-10 w-10 animate-spin text-indigo-400 mx-auto mb-4" />
                            <p className="text-white/60">Sign the transaction in your Sui wallet...</p>
                            <p className="text-xs text-white/30 mt-2">Burning {amount} USDC on Sui via CCTP</p>
                        </motion.div>
                    )}

                    {step === 'bridging' && (
                        <motion.div
                            key="bridging"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-center py-8"
                        >
                            <div className="relative mx-auto w-16 h-16 mb-4">
                                <Loader2 className="h-16 w-16 animate-spin text-cyan-400" />
                                <Coins className="h-6 w-6 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                            <p className="text-white/60 mb-2">Bridging {amount} USDC...</p>
                            <p className="text-xs text-white/30">Waiting for Circle attestation (~2-5 min)</p>

                            {txDigest && (
                                <a
                                    href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-indigo-400 mt-4"
                                >
                                    View on Suiscan <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </motion.div>
                    )}

                    {step === 'claiming' && (
                        <motion.div
                            key="claiming"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            <div className="text-center py-4">
                                <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                                    <Check className="h-6 w-6 text-emerald-400" />
                                </div>
                                <p className="text-white">Attestation Ready!</p>
                                <p className="text-sm text-white/40">Claim your USDC on Base Sepolia</p>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-sm justify-center">
                                    <AlertCircle className="h-4 w-4" />
                                    {error}
                                </div>
                            )}

                            <Button fullWidth onClick={handleClaim}>
                                Claim on Base <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        </motion.div>
                    )}

                    {step === 'complete' && (
                        <motion.div
                            key="complete"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-8"
                        >
                            <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                <Check className="h-8 w-8 text-emerald-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-1">Bridge Complete!</h3>
                            <p className="text-sm text-white/40 mb-4">
                                {amount} USDC delivered to Base Sepolia
                            </p>

                            {claimTxHash && (
                                <a
                                    href={`https://sepolia.basescan.org/tx/${claimTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-indigo-400 mb-4"
                                >
                                    View on Basescan <ExternalLink className="h-3 w-3" />
                                </a>
                            )}

                            <Button variant="outline" onClick={() => {
                                setStep('input')
                                setAmount('')
                                setNonce(null)
                                setTxDigest(null)
                                setClaimTxHash(null)
                                setError(null)
                            }}>
                                Bridge More
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    )
}

// ─── Helper Components ────────────────────────────────────────────────────────

function StepIndicator({ step, current, label, activeSteps }: {
    step: number
    current: BridgeStep
    label: string
    activeSteps: BridgeStep[]
}) {
    const isActive = activeSteps.includes(current)
    const isPast = ['signing', 'bridging', 'claiming', 'complete'].indexOf(current) >= step - 1

    return (
        <div className={`flex flex-col items-center ${isActive ? 'text-indigo-400' : isPast ? 'text-emerald-400' : 'text-white/30'}`}>
            <div className={`
                h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium
                ${isActive ? 'bg-indigo-500/20 border border-indigo-500' :
                    isPast ? 'bg-emerald-500/20 border border-emerald-500' :
                        'bg-white/5 border border-white/10'}
            `}>
                {isPast && !isActive ? <Check className="h-3 w-3" /> : step}
            </div>
            <span className="mt-1">{label}</span>
        </div>
    )
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-white/40">{label}</span>
            <span className="text-white/80">{value}</span>
        </div>
    )
}
