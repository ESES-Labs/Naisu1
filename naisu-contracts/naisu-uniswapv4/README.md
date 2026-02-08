# Naisu Uniswap V4 Integration

Swap and liquidity provision contracts for Uniswap V4 on EVM chains.

## Overview

This package implements:
- **Swap Contract** (`NaisuUniswapV4Swap.sol`): Facilitate token swaps through Uniswap V4 pools
- **Rewards Contract** (`NaisuUniswapV4Rewards.sol`): Enable liquidity provision and fee collection

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User (Wallet)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NaisuUniswapV4Swap.sol                        │
│  ┌──────────────┐  ┌──────────────────────┐                   │
│  │ Swap Execute │  │ Batch Operations     │                   │
│  └──────────────┘  └──────────────────────┘                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Uniswap V4 PoolManager                        │
│                    (Core Protocol)                              │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### Swap Features
- ✅ Exact input/output swaps
- ✅ Slippage protection
- ✅ Batch swap operations
- ✅ Deadline enforcement
- ✅ Optional solver allowlist

### Liquidity Features
- ✅ Single-sided liquidity provision
- ✅ Full range and concentrated positions
- ✅ Fee collection
- ✅ Position tracking

## Installation

```bash
# Install dependencies
forge install

# Install OpenZeppelin
forge install OpenZeppelin/openzeppelin-contracts

# Install Uniswap V4
forge install Uniswap/v4-core
forge install Uniswap/v4-periphery
```

## Build

```bash
forge build
```

## Test

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test test_ExecuteSwap -vvv

# Run with gas reporting
forge test --gas-report
```

## Deployment

### 1. Set Environment Variables

```bash
cp .env.example .env
# Edit .env with your private key and RPC URLs
```

### 2. Deploy to Base Sepolia

```bash
forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast --verify
```

### 3. Deploy to Ethereum Sepolia

```bash
forge script script/Deploy.s.sol --rpc-url $ETH_SEPOLIA_RPC --broadcast --verify
```

## Contract Addresses

### Base Sepolia (Testnet)
| Contract | Address |
|----------|---------|
| PoolManager | `0x05E73354cFDd6745D3CB3c27105716091b76C00C` |
| NaisuUniswapV4Swap | `TBD` |
| NaisuUniswapV4Rewards | `TBD` |

### Ethereum Sepolia (Testnet)
| Contract | Address |
|----------|---------|
| PoolManager | `0xE8E4db7F7FdAC71179Cf2860D0F1bEfAf2b3c6d5` |
| NaisuUniswapV4Swap | `TBD` |
| NaisuUniswapV4Rewards | `TBD` |

## Usage

### Swap Tokens

```solidity
// Approve tokens first
IERC20(tokenIn).approve(address(swapContract), amountIn);

// Execute swap
uint256 amountOut = swapContract.executeSwap(
    tokenIn,           // Input token
    tokenOut,          // Output token
    amountIn,          // Input amount
    minAmountOut,      // Minimum output (slippage protection)
    deadline           // Transaction deadline
);
```

### Add Liquidity

```solidity
// Approve both tokens
IERC20(token0).approve(address(rewardsContract), amount0);
IERC20(token1).approve(address(rewardsContract), amount1);

// Add liquidity
uint128 liquidity = rewardsContract.addLiquidity(
    token0,            // First token
    token1,            // Second token
    amount0,           // Amount of token0
    amount1,           // Amount of token1
    tickLower,         // Lower tick boundary
    tickUpper,         // Upper tick boundary
    minLiquidity       // Minimum liquidity (slippage)
);
```

### Remove Liquidity

```solidity
// Remove liquidity
(uint256 amount0, uint256 amount1) = rewardsContract.removeLiquidity(
    poolId,            // Pool identifier
    liquidity,         // Amount to remove
    amount0Min,        // Minimum token0 (slippage)
    amount1Min         // Minimum token1 (slippage)
);
```

### Collect Fees

```solidity
// Collect accrued fees
(uint256 amount0, uint256 amount1) = rewardsContract.collectFees(
    poolId             // Pool identifier
);
```

## Security

- **ReentrancyGuard**: All external functions protected
- **Access Control**: Only authorized solvers can execute
- **Slippage Protection**: Enforced on all swaps
- **Deadline Checks**: Prevent stale transactions

## Gas Optimization

- Batch operations for multiple swaps
- Efficient storage packing
- Optimized view functions for quotes

## License

MIT License - see LICENSE for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `forge test`
4. Submit a pull request

## Resources

- [Uniswap V4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [Foundry Documentation](https://book.getfoundry.sh/)
- [Naisu Documentation](../../AGENTS.md)
