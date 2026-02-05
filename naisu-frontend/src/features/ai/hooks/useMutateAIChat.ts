/**
 * useMutateAIChat Hook
 * 
 * Mutation hook for AI chat
 */

import { useMutation } from '@tanstack/react-query';

const API = '/api/v1';

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  reply: string;
  intent?: {
    action: string;
    dest_chain: string;
    protocol: string;
    sui_dest: string;
    strategy_id: number;
  };
}

export function useMutateAIChat() {
  return useMutation({
    mutationFn: async (payload: ChatRequest): Promise<ChatResponse> => {
      const res = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Failed to get AI response');
      }
      return res.json();
    },
  });
}
