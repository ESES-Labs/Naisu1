/**
 * useMutateYieldIntent Hook (SUI)
 * 
 * Hook for creating yield intents directly on Sui blockchain via PTB
 * Properly handles coin splitting from gas coin
 */

import { useState, useCallback } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { NAISU_PACKAGE_ID } from '@/lib/constants';

export interface CreateYieldIntentInput {
  amount: string;      // Amount in SUI (e.g., "0.1")
  minApy: number;      // Minimum APY in basis points (750 = 7.5%)
  deadline: number;    // Deadline in hours
  targetProtocol: string; // 'scallop' | 'navi' | 'any'
}

export interface YieldIntentResult {
  intentId: string;
  digest: string;
}

interface UseMutateYieldIntentReturn {
  mutate: (input: CreateYieldIntentInput) => Promise<YieldIntentResult | null>;
  isPending: boolean;
  error: string | null;
  data: YieldIntentResult | null;
  reset: () => void;
}

export function useMutateYieldIntent(): UseMutateYieldIntentReturn {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<YieldIntentResult | null>(null);

  const mutate = useCallback(async (input: CreateYieldIntentInput): Promise<YieldIntentResult | null> => {
    if (!account) {
      setError('Wallet not connected');
      return null;
    }

    setIsPending(true);
    setError(null);

    try {
      // Convert amount to MIST (SUI has 9 decimals)
      const amountInMist = Math.floor(parseFloat(input.amount) * 1_000_000_000);
      const minApyBps = Math.floor(input.minApy * 100);
      const deadlineSeconds = input.deadline * 3600;

      console.log('Creating yield intent:', {
        amount: input.amount,
        amountInMist,
        minApy: input.minApy,
        minApyBps,
        deadline: input.deadline,
        deadlineSeconds,
        targetProtocol: input.targetProtocol,
      });

      // Get coins to use for the transaction
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: '0x2::sui::SUI',
      });

      if (coins.data.length === 0) {
        throw new Error('No SUI coins found in wallet');
      }

      const { Transaction } = await import('@mysten/sui/transactions');
      const txb = new Transaction();
      
      // Find a coin with enough balance
      const primaryCoin = coins.data[0];
      const primaryBalance = BigInt(primaryCoin.balance);
      
      // Leave some SUI for gas (0.01 SUI = 10_000_000 MIST)
      const gasBuffer = 10_000_000n;
      const requiredAmount = BigInt(amountInMist);
      
      if (primaryBalance < requiredAmount + gasBuffer) {
        // Try to merge coins if needed
        if (coins.data.length > 1) {
          const coinObjects = coins.data.map(c => txb.object(c.coinObjectId));
          txb.mergeCoins(coinObjects[0], coinObjects.slice(1));
        } else {
          throw new Error('Insufficient SUI balance (need amount + gas)');
        }
      }

      // Split the exact amount from the primary coin
      const [splitCoin] = txb.splitCoins(txb.object(primaryCoin.coinObjectId), [txb.pure.u64(amountInMist)]);
      
      // Call create_intent function with the split coin
      txb.moveCall({
        target: `${NAISU_PACKAGE_ID}::intent::create_intent`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [
          splitCoin,  // The split coin object
          txb.pure.u64(minApyBps),
          txb.pure.u64(deadlineSeconds),
          txb.pure.string(input.targetProtocol),
        ],
      });

      console.log('Executing transaction...');

      const result = await signAndExecute({ transaction: txb as any });

      console.log('Transaction result:', result);

      // Parse result - get created object ID from effects
      const effects = (result as any).effects;
      const intentId = effects?.created?.[0]?.reference?.objectId;
      
      if (!intentId) {
        throw new Error('Intent creation failed - no object ID returned');
      }

      console.log('Intent created:', { intentId, digest: result.digest });

      const resultData = { intentId, digest: result.digest };
      setData(resultData);
      return resultData;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Create intent error:', err);
      return null;
    } finally {
      setIsPending(false);
    }
  }, [account, suiClient, signAndExecute]);

  const reset = useCallback(() => {
    setIsPending(false);
    setError(null);
    setData(null);
  }, []);

  return { mutate, isPending, error, data, reset };
}
