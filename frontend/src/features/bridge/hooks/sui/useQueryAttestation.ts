/**
 * useQueryAttestation Hook (SUI)
 * 
 * Query hook for polling Circle attestation
 */

import { useQuery } from '@tanstack/react-query';

const API = '/api/v1';

export interface AttestationResponse {
  ready: boolean;
  attestation?: {
    message: string;
    signature: string;
  };
  claim_params?: {
    contract: string;
    message: string;
    attestation: string;
    chain: string;
  };
}

export function useQueryAttestation(nonce: string | null) {
  return useQuery<AttestationResponse>({
    queryKey: ['attestation', nonce],
    queryFn: async () => {
      let body: any = { nonce };
      try {
        if (nonce) {
          body = JSON.parse(nonce);
        }
      } catch (e) {
        // Not a JSON string, fallback to legacy { nonce }
      }
      const res = await fetch(`${API}/bridge/poll-attestation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to poll attestation');
      return res.json();
    },
    enabled: !!nonce,
    refetchInterval: nonce ? 5000 : false,
  });
}
