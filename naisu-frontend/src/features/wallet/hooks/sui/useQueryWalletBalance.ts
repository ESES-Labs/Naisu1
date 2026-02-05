/**
 * useQueryWalletBalance Hook (SUI)
 * 
 * Query hook for fetching SUI balance
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';

export interface WalletBalance {
  totalBalance: string;
  formatted: string;
}

export function useQueryWalletBalance() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  return useQuery<WalletBalance>({
    queryKey: ['wallet-balance', account?.address],
    queryFn: async () => {
      if (!account) throw new Error('Wallet not connected');
      
      const balance = await suiClient.getBalance({
        owner: account.address,
      });

      // Format from MIST to SUI (9 decimals)
      const total = BigInt(balance.totalBalance);
      const formatted = (Number(total) / 1_000_000_000).toFixed(4);

      return {
        totalBalance: balance.totalBalance,
        formatted,
      };
    },
    enabled: !!account,
    refetchInterval: 10000, // Refetch every 10s
  });
}
