/**
 * useQueryIntentStatus Hook (SUI)
 * 
 * Query hook for fetching intent status from API
 */

import { useQuery } from '@tanstack/react-query';

const API = '/api/v1';

export interface IntentStatusResponse {
  id: string;
  status: string;
  swap_tx_hash: string | null;
  bridge_tx_hash: string | null;
  bridge_nonce: string | null;
  dest_tx_hash: string | null;
  error_message: string | null;
}

export function useQueryIntentStatus(intentId: string | null) {
  return useQuery<IntentStatusResponse>({
    queryKey: ['intent-status', intentId],
    queryFn: async () => {
      const res = await fetch(`${API}/intents/${intentId}/status`);
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
    enabled: !!intentId,
    refetchInterval: intentId ? 3000 : false,
  });
}
