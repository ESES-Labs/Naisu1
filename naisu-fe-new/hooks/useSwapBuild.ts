/**
 * Build swap tx on backend, then user signs and sends.
 * Uses POST /api/v1/uniswap-v4/swap/build and walletClient.sendTransaction (avoids connector.getChainId).
 */
import { useCallback, useState } from 'react';
import { useWalletClient, useConfig } from 'wagmi';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface BuildTxItem {
  to: string;
  data: string;
  value: string;
  chainId: number;
  description: string;
}

export interface SwapBuildResponse {
  success: true;
  data: {
    transactions: BuildTxItem[];
    summary: {
      tokenIn: string;
      tokenOut: string;
      amountIn: string;
      minAmountOut: string;
      deadline: string;
      swapContract: string;
      needsApproval: boolean;
    };
  };
}

export interface BuildParams {
  sender: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut?: string;
  deadlineSeconds?: number;
}

export function useSwapBuild() {
  const config = useConfig();
  const { data: walletClient } = useWalletClient();
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<string[]>([]);

  const executeBuild = useCallback(
    async (buildResponse: SwapBuildResponse): Promise<string[]> => {
      const txs = buildResponse.data.transactions;
      if (!txs.length) throw new Error('No transactions to sign');
      if (!walletClient) throw new Error('Wallet not connected');

      setIsSigning(true);
      setError(null);
      const hashes: string[] = [];

      try {
        for (let i = 0; i < txs.length; i++) {
          const tx = txs[i];
          const hash = await walletClient.sendTransaction({
            to: tx.to as `0x${string}`,
            data: tx.data as `0x${string}`,
            value: BigInt(tx.value),
            chainId: tx.chainId,
          });
          hashes.push(hash);
          setTxHashes((prev) => [...prev, hash]);
          try {
            const { getPublicClient } = await import('@wagmi/core');
            const publicClient = config ? getPublicClient(config) : null;
            if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
          } catch {
            // continue without waiting
          }
        }
        return hashes;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Transaction failed';
        setError(msg);
        throw e;
      } finally {
        setIsSigning(false);
      }
    },
    [config, walletClient]
  );

  const buildAndSign = useCallback(
    async (params: BuildParams): Promise<string[]> => {
      setIsBuilding(true);
      setError(null);
      setTxHashes([]);
      try {
        const res = await fetch(`${API_BASE}/uniswap-v4/swap/build`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: params.sender,
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: params.amountIn,
            minAmountOut: params.minAmountOut ?? '0',
            deadlineSeconds: params.deadlineSeconds ?? 3600,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? `Build failed: ${res.status}`);
        }
        const json: SwapBuildResponse = await res.json();
        if (!json.success || !json.data?.transactions?.length) {
          throw new Error('Invalid build response');
        }
        return executeBuild(json);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Build failed';
        setError(msg);
        throw e;
      } finally {
        setIsBuilding(false);
      }
    },
    [executeBuild]
  );

  return {
    buildAndSign,
    executeBuild,
    isBuilding,
    isSigning,
    isBusy: isBuilding || isSigning,
    error,
    txHashes,
    clearError: () => setError(null),
  };
}
