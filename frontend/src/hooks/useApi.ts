import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const API = '/api/v1'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Strategy {
  strategy: string
  name: string
  protocol: string
  asset: string
  apy: number
  tvl: string
  enabled: boolean
}

export interface CreateIntentPayload {
  direction: 'evm_to_sui' | 'sui_to_evm'
  source_address: string
  dest_address: string
  evm_chain: string
  input_token: string
  input_amount: string
  strategy?: string
}

export interface IntentResponse {
  id: string
  direction: string
  status: string
  source_address: string
  dest_address: string
  evm_chain: string
  input_token: string
  input_amount: string
  strategy: string | null
  bridge_nonce: string | null
  created_at: number
}

export interface IntentStatusResponse {
  id: string
  status: string
  swap_tx_hash: string | null
  bridge_tx_hash: string | null
  bridge_nonce: string | null
  dest_tx_hash: string | null
  error_message: string | null
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

const FALLBACK_STRATEGIES: Strategy[] = [
  { strategy: 'scallop_usdc', name: 'Scallop USDC Lending', protocol: 'Scallop', asset: 'USDC', apy: 8.5, tvl: '10M', enabled: true },
  { strategy: 'scallop_sui', name: 'Scallop SUI Lending', protocol: 'Scallop', asset: 'SUI', apy: 12.0, tvl: '5M', enabled: true },
  { strategy: 'navi_usdc', name: 'Navi USDC Lending', protocol: 'Navi', asset: 'USDC', apy: 7.8, tvl: '15M', enabled: true },
  { strategy: 'navi_sui', name: 'Navi SUI Lending', protocol: 'Navi', asset: 'SUI', apy: 11.5, tvl: '8M', enabled: true },
]

export function useStrategies() {
  return useQuery<Strategy[]>({
    queryKey: ['strategies'],
    queryFn: async () => {
      const res = await fetch(`${API}/strategies`)
      if (!res.ok) throw new Error('Failed to fetch strategies')
      return res.json()
    },
    placeholderData: FALLBACK_STRATEGIES,
  })
}

export function useCreateIntent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateIntentPayload): Promise<IntentResponse> => {
      const res = await fetch(`${API}/intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || 'Failed to create intent')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intents'] })
    },
  })
}

export function useIntentStatus(intentId: string | null) {
  return useQuery<IntentStatusResponse>({
    queryKey: ['intent-status', intentId],
    queryFn: async () => {
      const res = await fetch(`${API}/intents/${intentId}/status`)
      if (!res.ok) throw new Error('Failed to fetch status')
      return res.json()
    },
    enabled: !!intentId,
    refetchInterval: intentId ? 3000 : false,
  })
}
export interface ChatRequest {
  message: string
}

export interface ChatResponse {
  reply: string
  intent?: {
    action: string
    dest_chain: string
    protocol: string
    sui_dest: string
    strategy_id: number
  }
}

export function useAIChat() {
  return useMutation({
    mutationFn: async (payload: ChatRequest): Promise<ChatResponse> => {
      const res = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || 'Failed to get AI response')
      }
      return res.json()
    },
  })
}

// ─── Bridge Types ─────────────────────────────────────────────────────────────

export interface BridgeInitRequest {
  sender: string
  amount: string
  evm_destination: string
}

export interface BridgeInitResponse {
  tx_params: {
    target: string
    amount_raw: number
    dest_domain: number
    mint_recipient: string
  }
  summary: string
}

export interface PollAttestationRequest {
  nonce: string
}

export interface PollAttestationResponse {
  ready: boolean
  attestation?: {
    message: string
    signature: string
  }
  claim_params?: {
    contract: string
    message: string
    attestation: string
    chain: string
  }
}

// ─── Bridge Hooks ─────────────────────────────────────────────────────────────

export function useBridgeStatus() {
  return useQuery({
    queryKey: ['bridge-status'],
    queryFn: async () => {
      const res = await fetch(`${API}/bridge/status`)
      if (!res.ok) throw new Error('Failed to fetch bridge status')
      return res.json()
    },
  })
}

export function useInitBridge() {
  return useMutation({
    mutationFn: async (payload: BridgeInitRequest): Promise<BridgeInitResponse> => {
      const res = await fetch(`${API}/bridge/sui-to-evm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || 'Failed to init bridge')
      }
      return res.json()
    },
  })
}

export function usePollAttestation(nonce: string | null) {
  return useQuery<PollAttestationResponse>({
    queryKey: ['attestation', nonce],
    queryFn: async () => {
      let body: any = { nonce }
      try {
        if (nonce) {
          body = JSON.parse(nonce)
        }
      } catch (e) {
        // Not a JSON string, fallback to legacy { nonce }
      }
      const res = await fetch(`${API}/bridge/poll-attestation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to poll attestation')
      return res.json()
    },
    enabled: !!nonce,
    refetchInterval: nonce ? 5000 : false, // Poll every 5s when active
  })
}
