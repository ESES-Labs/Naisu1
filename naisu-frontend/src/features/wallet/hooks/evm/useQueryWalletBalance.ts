/**
 * useQueryWalletBalance Hook (EVM)
 * 
 * Query hook for fetching ETH/native token balance
 */

import { useAccount, useBalance } from 'wagmi';

export interface WalletBalance {
  value: bigint;
  formatted: string;
  symbol: string;
  decimals: number;
}

export function useQueryWalletBalance() {
  const { address } = useAccount();
  const { data, isLoading, error } = useBalance({
    address,
  });

  return {
    data: data ? {
      value: data.value,
      formatted: data.formatted,
      symbol: data.symbol,
      decimals: data.decimals,
    } : undefined,
    isLoading,
    error,
  };
}
