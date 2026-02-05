/**
 * useMutateBridge Hook (SUI)
 * 
 * Mutation hook for initializing bridge from Sui to EVM
 */

import { useMutation } from '@tanstack/react-query';

const API = '/api/v1';

export interface BridgeInitRequest {
  sender: string;
  amount: string;
  evm_destination: string;
}

export interface BridgeInitResponse {
  tx_params: {
    target: string;
    amount_raw: number;
    dest_domain: number;
    mint_recipient: string;
  };
  summary: string;
}

export function useMutateBridge() {
  return useMutation({
    mutationFn: async (payload: BridgeInitRequest): Promise<BridgeInitResponse> => {
      const res = await fetch(`${API}/bridge/sui-to-evm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Failed to init bridge');
      }
      return res.json();
    },
  });
}
