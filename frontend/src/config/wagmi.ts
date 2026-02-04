import { createConfig, http } from 'wagmi'
import { base, baseSepolia, mainnet, sepolia, arbitrum } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base, sepolia, mainnet, arbitrum],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
  },
})

// Supported source chains for Naisu
export const supportedChains = [
  { id: baseSepolia.id, name: 'Base Sepolia', testnet: true },
  { id: base.id, name: 'Base', testnet: false },
  { id: sepolia.id, name: 'Sepolia', testnet: true },
  { id: arbitrum.id, name: 'Arbitrum', testnet: false },
]
