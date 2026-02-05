import { createConfig, http } from 'wagmi'
import { base, baseSepolia, mainnet, sepolia, arbitrum } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base, sepolia, mainnet, arbitrum],
  multiInjectedProviderDiscovery: true, // Enable EIP-6963 for multiple wallets
  connectors: [
    // Generic injected - will detect all browser wallets via EIP-6963
    // This will auto-detect MetaMask, Rabby, Coinbase Wallet extension, etc.
    injected(),
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
