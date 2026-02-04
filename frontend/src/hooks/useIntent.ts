import { useState, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useCurrentAccount as useSuiAccount } from '@mysten/dapp-kit'
import { CONTRACTS, HOOK_ABI } from '@/config/contracts'
import { parseEther } from 'viem'

export type IntentStatus = 'idle' | 'setting_intent' | 'swapping' | 'bridging' | 'depositing' | 'completed' | 'failed'

export interface IntentState {
  status: IntentStatus
  txHash?: `0x${string}`
  error?: string
  intentId?: string
}

export function useIntent() {
  const { address, chainId } = useAccount()
  const suiAccount = useSuiAccount()
  const [intentState, setIntentState] = useState<IntentState>({ status: 'idle' })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { writeContract, data: hash, error: writeError } = useWriteContract() as any
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const setIntent = useCallback(async (
    amount: string,
    strategyId: number
  ) => {
    if (!address || !chainId || !suiAccount) {
      setIntentState({ status: 'failed', error: 'Please connect both EVM and Sui wallets' })
      return
    }

    const contracts = CONTRACTS[chainId as keyof typeof CONTRACTS]
    if (!contracts) {
      setIntentState({ status: 'failed', error: 'Unsupported chain' })
      return
    }

    try {
      setIntentState({ status: 'setting_intent' })

      // Convert Sui address to bytes32 (pad with zeros)
      const suiAddressHex = suiAccount.address.startsWith('0x')
        ? suiAccount.address
        : `0x${suiAccount.address}`
      const suiDestination = `0x${suiAddressHex.slice(2).padStart(64, '0')}` as `0x${string}`

      // Call setIntentData on the hook contract
      writeContract({
        address: contracts.hook as `0x${string}`,
        abi: HOOK_ABI,
        functionName: 'setIntentData',
        args: [suiDestination, strategyId],
        value: parseEther(amount),
      })

      setIntentState({ status: 'swapping', txHash: hash })
    } catch (err) {
      setIntentState({
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }, [address, chainId, suiAccount, writeContract, hash])

  const reset = useCallback(() => {
    setIntentState({ status: 'idle' })
  }, [])

  return {
    intentState,
    setIntent,
    reset,
    isConfirming,
    isConfirmed,
    writeError,
  }
}
