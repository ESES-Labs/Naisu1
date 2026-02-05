/**
 * useQuerySuiTokenBalance Hook
 * 
 * Universal hook to fetch token balance for a specific coin type on Sui.
 */

import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';

export const queryKeySuiTokenBalance = (address?: string, coinType?: string) =>
  ['sui-token-balance', address, coinType];

export interface UseQuerySuiTokenBalanceProps {
  coinType?: string; // Optional, enabled only when provided
  accountAddress?: string; // Optional, defaults to current account
}

export function useQuerySuiTokenBalance({ coinType, accountAddress }: UseQuerySuiTokenBalanceProps) {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  const owner = accountAddress || currentAccount?.address;

  return useQuery({
    queryKey: queryKeySuiTokenBalance(owner, coinType),
    queryFn: async () => {
      if (!owner || !coinType) return null;

      const res = await suiClient.getBalance({
        owner,
        coinType,
      });

      return res;
    },
    enabled: !!owner && !!coinType,
    staleTime: 10 * 1000, // 10 seconds
    refetchOnMount: true,
  });
}
