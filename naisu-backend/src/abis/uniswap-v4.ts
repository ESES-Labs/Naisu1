/**
 * Uniswap V4 Contract ABIs
 * ABI definitions for Naisu Uniswap V4 integration
 */

// ============================================================================
// NaisuUniswapV4Swap ABI
// ============================================================================

export const naisuUniswapV4SwapAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_poolManager', type: 'address', internalType: 'address' },
      { name: '_owner', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'receive',
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'DEFAULT_FEE',
    inputs: [],
    outputs: [{ name: '', type: 'uint24', internalType: 'uint24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DEFAULT_TICK_SPACING',
    inputs: [],
    outputs: [{ name: '', type: 'int24', internalType: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_DEADLINE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'addSolver',
    inputs: [{ name: 'solver', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'authorizedSolvers',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'executeBatchSwaps',
    inputs: [
      {
        name: 'swaps',
        type: 'tuple[]',
        internalType: 'struct INaisuSwap.SwapParams[]',
        components: [
          { name: 'tokenIn', type: 'address', internalType: 'address' },
          { name: 'tokenOut', type: 'address', internalType: 'address' },
          { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
          { name: 'minAmountOut', type: 'uint256', internalType: 'uint256' },
        ],
      },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'amountsOut', type: 'uint256[]', internalType: 'uint256[]' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'executeSwap',
    inputs: [
      { name: 'tokenIn', type: 'address', internalType: 'address' },
      { name: 'tokenOut', type: 'address', internalType: 'address' },
      { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
      { name: 'minAmountOut', type: 'uint256', internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getSwapQuote',
    inputs: [
      { name: 'tokenIn', type: 'address', internalType: 'address' },
      { name: 'tokenOut', type: 'address', internalType: 'address' },
      { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256', internalType: 'uint256' },
      { name: 'price', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract IPoolManager' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeSolver',
    inputs: [{ name: 'solver', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'previousOwner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'newOwner', type: 'address', indexed: true, internalType: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SolverAdded',
    inputs: [{ name: 'solver', type: 'address', indexed: true, internalType: 'address' }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SolverRemoved',
    inputs: [{ name: 'solver', type: 'address', indexed: true, internalType: 'address' }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SwapExecuted',
    inputs: [
      { name: 'solver', type: 'address', indexed: true, internalType: 'address' },
      { name: 'tokenIn', type: 'address', indexed: true, internalType: 'address' },
      { name: 'tokenOut', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amountIn', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'amountOut', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'InvalidSolver',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'SwapFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnauthorizedSolver',
    inputs: [],
  },
] as const

// ============================================================================
// NaisuUniswapV4Rewards ABI
// ============================================================================

export const naisuUniswapV4RewardsAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_poolManager', type: 'address', internalType: 'address' },
      { name: '_owner', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'receive',
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'DEFAULT_FEE',
    inputs: [],
    outputs: [{ name: '', type: 'uint24', internalType: 'uint24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DEFAULT_TICK_SPACING',
    inputs: [],
    outputs: [{ name: '', type: 'int24', internalType: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_TICK',
    inputs: [],
    outputs: [{ name: '', type: 'int24', internalType: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_TICK',
    inputs: [],
    outputs: [{ name: '', type: 'int24', internalType: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'addLiquidity',
    inputs: [
      { name: 'token0', type: 'address', internalType: 'address' },
      { name: 'token1', type: 'address', internalType: 'address' },
      { name: 'amount0', type: 'uint256', internalType: 'uint256' },
      { name: 'amount1', type: 'uint256', internalType: 'uint256' },
      { name: 'tickLower', type: 'int24', internalType: 'int24' },
      { name: 'tickUpper', type: 'int24', internalType: 'int24' },
      { name: 'minLiquidity', type: 'uint128', internalType: 'uint128' },
    ],
    outputs: [{ name: 'liquidity', type: 'uint128', internalType: 'uint128' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'addSolver',
    inputs: [{ name: 'solver', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'authorizedSolvers',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'collectFees',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      { name: 'amount0', type: 'uint256', internalType: 'uint256' },
      { name: 'amount1', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPoolInfo',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: 'info',
        type: 'tuple',
        internalType: 'struct INaisuRewards.PoolInfo',
        components: [
          { name: 'token0', type: 'address', internalType: 'address' },
          { name: 'token1', type: 'address', internalType: 'address' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUserPosition',
    inputs: [
      { name: 'user', type: 'address', internalType: 'address' },
      { name: 'poolId', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [
      {
        name: 'position',
        type: 'tuple',
        internalType: 'struct INaisuRewards.Position',
        components: [
          { name: 'poolId', type: 'bytes32', internalType: 'bytes32' },
          { name: 'liquidity', type: 'uint128', internalType: 'uint128' },
          { name: 'tickLower', type: 'int24', internalType: 'int24' },
          { name: 'tickUpper', type: 'int24', internalType: 'int24' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract IPoolManager' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'removeLiquidity',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'liquidity', type: 'uint128', internalType: 'uint128' },
      { name: 'amount0Min', type: 'uint256', internalType: 'uint256' },
      { name: 'amount1Min', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [
      { name: 'amount0', type: 'uint256', internalType: 'uint256' },
      { name: 'amount1', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeSolver',
    inputs: [{ name: 'solver', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'LiquidityAdded',
    inputs: [
      { name: 'provider', type: 'address', indexed: true, internalType: 'address' },
      { name: 'poolId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'tickLower', type: 'int24', indexed: false, internalType: 'int24' },
      { name: 'tickUpper', type: 'int24', indexed: false, internalType: 'int24' },
      { name: 'liquidity', type: 'uint128', indexed: false, internalType: 'uint128' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityRemoved',
    inputs: [
      { name: 'provider', type: 'address', indexed: true, internalType: 'address' },
      { name: 'poolId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'liquidity', type: 'uint128', indexed: false, internalType: 'uint128' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'previousOwner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'newOwner', type: 'address', indexed: true, internalType: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SolverAdded',
    inputs: [{ name: 'solver', type: 'address', indexed: true, internalType: 'address' }],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SolverRemoved',
    inputs: [{ name: 'solver', type: 'address', indexed: true, internalType: 'address' }],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'InvalidPoolManager',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSolver',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
  },
] as const

// ============================================================================
// Pool Manager ABI (for direct pool queries)
// ============================================================================

export const poolManagerAbi = [
  {
    type: 'function',
    name: 'extsload',
    inputs: [{ name: 'slot', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'extsload',
    inputs: [
      { name: 'startSlot', type: 'bytes32', internalType: 'bytes32' },
      { name: 'nSlots', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes32[]', internalType: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSlot0',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160', internalType: 'uint160' },
      { name: 'tick', type: 'int24', internalType: 'int24' },
      { name: 'protocolFee', type: 'uint24', internalType: 'uint24' },
      { name: 'swapFee', type: 'uint24', internalType: 'uint24' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLiquidity',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [{ name: 'liquidity', type: 'uint128', internalType: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLiquidity',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'tickLower', type: 'int24', internalType: 'int24' },
      { name: 'tickUpper', type: 'int24', internalType: 'int24' },
    ],
    outputs: [{ name: 'liquidity', type: 'uint128', internalType: 'uint128' }],
    stateMutability: 'view',
  },
] as const
