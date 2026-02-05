// Contract addresses and ABIs

export const CONTRACTS = {
  // Base Sepolia
  84532: {
    hook: '0x006a8462e9068b4012db67f19076912e0a4740c0', // Deployed on Base Sepolia
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    weth: '0x4200000000000000000000000000000000000006',
  },
  // Base Mainnet
  8453: {
    hook: '0x0000000000000000000000000000000000000000',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    weth: '0x4200000000000000000000000000000000000006',
  },
} as const

// Token metadata
export const TOKENS = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logo: '/tokens/eth.svg',
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    decimals: 18,
    logo: '/tokens/weth.svg',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logo: '/tokens/usdc.svg',
  },
} as const

// Yield strategies
export const STRATEGIES = [
  {
    id: 1,
    name: 'Scallop USDC',
    protocol: 'Scallop',
    asset: 'USDC',
    apy: 8.5,
    description: 'Lend USDC on Scallop for stable yields',
  },
  {
    id: 2,
    name: 'Scallop SUI',
    protocol: 'Scallop',
    asset: 'SUI',
    apy: 12.0,
    description: 'Lend SUI on Scallop for higher yields',
  },
  {
    id: 3,
    name: 'Navi USDC',
    protocol: 'Navi',
    asset: 'USDC',
    apy: 7.8,
    description: 'Lend USDC on Navi Protocol',
  },
  {
    id: 4,
    name: 'Navi SUI',
    protocol: 'Navi',
    asset: 'SUI',
    apy: 11.5,
    description: 'Lend SUI on Navi Protocol',
  },
] as const

// Hook ABI
export const HOOK_ABI = [
  {
    type: 'function',
    name: 'setIntentData',
    inputs: [
      { name: 'suiDestination', type: 'bytes32' },
      { name: 'strategyId', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'clearIntentData',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getIntent',
    inputs: [{ name: 'intentId', type: 'bytes32' }],
    outputs: [
      { name: 'user', type: 'address' },
      { name: 'suiDestination', type: 'bytes32' },
      { name: 'inputToken', type: 'address' },
      { name: 'inputAmount', type: 'uint256' },
      { name: 'usdcAmount', type: 'uint256' },
      { name: 'strategyId', type: 'uint8' },
      { name: 'status', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUserIntents',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: 'intents', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'IntentCreated',
    inputs: [
      { name: 'intentId', type: 'bytes32', indexed: true },
      { name: 'user', type: 'address', indexed: true },
      { name: 'suiDestination', type: 'bytes32', indexed: false },
      { name: 'inputToken', type: 'address', indexed: false },
      { name: 'inputAmount', type: 'uint256', indexed: false },
      { name: 'usdcAmount', type: 'uint256', indexed: false },
      { name: 'strategyId', type: 'uint8', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const
