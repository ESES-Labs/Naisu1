/**
 * EVM Client Configuration
 * Provider connections for Uniswap V4
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { baseSepolia, base } from 'viem/chains'
import { config } from '@config/env'
import { logger } from './logger'

// ============================================================================
// Chain Configuration
// ============================================================================

export const supportedChains = {
  baseSepolia,
  base,
} as const

export type SupportedChain = keyof typeof supportedChains

function getConfiguredChain() {
  return config.evm.network === 'base' ? base : baseSepolia
}

// ============================================================================
// Public Client (Read-only)
// ============================================================================

let publicClient: PublicClient | null = null

export function getPublicClient(): PublicClient {
  if (publicClient) return publicClient

  const transports = [http(config.evm.rpcUrl)]

  // Add fallback RPC if available
  if (config.evm.fallbackRpcUrl) {
    transports.push(http(config.evm.fallbackRpcUrl))
  }

  const chain = getConfiguredChain()

  publicClient = createPublicClient({
    chain,
    transport: fallback(transports),
  }) as PublicClient

  logger.info(`EVM public client initialized (chain: ${chain.name})`)

  return publicClient
}

// ============================================================================
// Wallet Client (Write operations - admin only)
// ============================================================================

let walletClient: WalletClient | null = null

export function getWalletClient(): WalletClient | null {
  if (walletClient) return walletClient

  if (!config.evm.adminPrivateKey) {
    logger.warn('No admin private key configured, wallet client unavailable')
    return null
  }

  try {
    const chain = getConfiguredChain()

    walletClient = createWalletClient({
      chain,
      transport: http(config.evm.rpcUrl),
    }) as WalletClient

    logger.info('EVM wallet client initialized')
    return walletClient
  } catch (error) {
    logger.error({ error }, 'Failed to initialize wallet client')
    return null
  }
}

export function getContractAddresses() {
  return config.evm.contracts
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a transaction was successful
 */
export async function checkTransactionReceipt(hash: `0x${string}`) {
  const client = getPublicClient()

  try {
    const receipt = await client.getTransactionReceipt({ hash })
    return {
      success: receipt.status === 'success',
      receipt,
    }
  } catch (_error) {
    logger.error({ error: _error, hash }, 'Failed to get transaction receipt')
    return {
      success: false,
      receipt: null,
    }
  }
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  hash: `0x${string}`,
  confirmations: number = 1,
  timeoutMs: number = 60000
) {
  const client = getPublicClient()
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    try {
      const receipt = await client.getTransactionReceipt({ hash })
      if (receipt && receipt.blockNumber) {
        const currentBlock = await client.getBlockNumber()
        const confirmationsReceived = Number(currentBlock - receipt.blockNumber) + 1

        if (confirmationsReceived >= confirmations) {
          return {
            success: receipt.status === 'success',
            receipt,
            confirmations: confirmationsReceived,
          }
        }
      }
    } catch (_error) {
      // Transaction not mined yet, continue waiting
      void _error
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error(`Transaction confirmation timeout after ${timeoutMs}ms`)
}

/**
 * Get current block number
 */
export async function getCurrentBlockNumber(): Promise<bigint> {
  const client = getPublicClient()
  return client.getBlockNumber()
}

/**
 * Get current gas price
 */
export async function getGasPrice(): Promise<bigint> {
  const client = getPublicClient()
  return client.getGasPrice()
}
