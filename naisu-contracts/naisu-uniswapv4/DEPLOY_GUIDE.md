# Naisu Uniswap v4 Deployment Guide (Base Sepolia, Arbitrum Sepolia, Arc Testnet)

This guide covers deploying `NaisuUniswapV4Swap` and `NaisuUniswapV4Rewards` on:
- Base Sepolia (real Uniswap v4 PoolManager)
- Arbitrum Sepolia (real v4 if deployed)
- Arc Testnet (no v4; use `MockPoolManager`)

## How It Works (Current Architecture)

Swap flow:
1. User calls `executeSwap(...)` on `NaisuUniswapV4Swap`.
2. Contract transfers `tokenIn` from the user.
3. Contract calls `PoolManager.unlock(...)`.
4. PoolManager calls back `unlockCallback(...)`.
5. Contract executes `swap(...)` and settles deltas via `sync/settle/take`.
6. Contract transfers `tokenOut` to the user.

Liquidity + fees flow:
1. User calls `addLiquidity(...)` on `NaisuUniswapV4Rewards`.
2. Contract transfers tokens from user.
3. Contract calls `PoolManager.unlock(...)`.
4. PoolManager calls back `unlockCallback(...)`.
5. Contract executes `modifyLiquidity(...)` and settles deltas.
6. Position is tracked in `userPositions`.
7. `collectFees(...)` and `removeLiquidity(...)` use the same unlock pattern.

Arc note:
- Arc has no Uniswap v4 deployment yet. You deploy `MockPoolManager` to simulate v4 flows for demo/testing.

## Prerequisites

- Foundry installed (`forge`, `cast`)
- RPC endpoints in `.env`
- A funded deployer key

Example `.env` variables:
```bash
PRIVATE_KEY=0x...
BASE_SEPOLIA_RPC=https://...
ARB_SEPOLIA_RPC=https://...
ARC_RPC=https://rpc.testnet.arc.network
```

## Base Sepolia (Real Uniswap v4)

### 1) PoolManager address
Base Sepolia PoolManager is published by Verified Pools:
```
PoolManager: 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408
```

### 2) Deploy Naisu contracts
```bash
forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast --verify
```

### 3) Initialize a pool (if needed)
`NaisuUniswapV4Swap` and `NaisuUniswapV4Rewards` assume:
- `fee = 1000` (0.1%)
- `tickSpacing = 60`
- `hooks = address(0)`

```bash
export POOL_MANAGER=0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408
export TOKEN_0=0x...
export TOKEN_1=0x...
export POOL_FEE=1000
export TICK_SPACING=60
export SQRT_PRICE_X96=79228162514264337593543950336

forge script script/CreatePool.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast
```

## Arbitrum Sepolia (Real Uniswap v4 if deployed)

There is no official Arbitrum Sepolia PoolManager listed in the Verified Pools deployment list above.  
If you have a PoolManager address from Uniswap or your own deployment, set it before deploying.

### 1) Deploy Naisu contracts
```bash
forge script script/Deploy.s.sol --rpc-url $ARB_SEPOLIA_RPC --broadcast --verify
```

### 2) Initialize a pool
Use the same `CreatePool.s.sol` script with your Arbitrum Sepolia PoolManager.

## Arc Testnet (Mock Uniswap v4)

Arc Testnet network details:
```
RPC: https://rpc.testnet.arc.network
Chain ID: 5042002
Explorer: https://testnet.arcscan.app
Faucet: https://faucet.circle.com
```

Arc uses **USDC** as the native gas token. Testnet base fee minimum is ~160 Gwei, and gas is denominated in USDC (18 decimals).  
USDC ERC-20 interface on Arc Testnet is:
```
USDC: 0x3600000000000000000000000000000000000000
```

### 1) Deploy MockPoolManager
```bash
forge create src/mocks/MockPoolManager.sol:MockPoolManager \
  --rpc-url $ARC_RPC \
  --private-key $PRIVATE_KEY
```

### 2) Deploy Naisu contracts pointing to the mock
```bash
**forge** create src/NaisuUniswapV4Swap.sol:NaisuUniswapV4Swap \
  --rpc-url $ARC_RPC \
  --private-key $PRIVATE_KEY \
  --constructor-args <MOCK_POOL_MANAGER> <OWNER>

forge create src/NaisuUniswapV4Rewards.sol:NaisuUniswapV4Rewards \
  --rpc-url $ARC_RPC \
  --private-key $PRIVATE_KEY \
  --constructor-args <MOCK_POOL_MANAGER> <OWNER>
```

### 3) Initialize a pool on Arc (mock)
```bash
export POOL_MANAGER=<MOCK_POOL_MANAGER>
export TOKEN_0=0x...
export TOKEN_1=0x...
export POOL_FEE=3000
export TICK_SPACING=60
export SQRT_PRICE_X96=79228162514264337593543950336

forge script script/CreatePool.s.sol --rpc-url $ARC_RPC --broadcast
```

## Optional: Arc Cross-Chain (CCTP / Gateway)

Arc publishes CCTP and Gateway contracts for cross-chain transfers. These are useful if you want your Arc hub to bridge liquidity to Base/Arb:
```
TokenMessengerV2: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
MessageTransmitterV2: 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275
TokenMinterV2: 0xb43db544E2c27092c107639Ad201b3dEfAbcF192
MessageV2: 0xbaC0179bB358A8936169a63408C8481D582390C4
GatewayWallet: 0x0077777d7EBA4688BDeF3E311b846F25870A19B9
GatewayMinter: 0x0022222ABE238Cc2C7Bb1f21003F0a260052475B
```

## Notes

- `MockPoolManager` is demo-only. It mimics v4 flow but does not implement real AMM math.
- For production/testnet v4 flows, use real PoolManager deployments (Base Sepolia, Arbitrum Sepolia if available).
