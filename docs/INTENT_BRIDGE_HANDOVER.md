# Intent Bridge Handover & Integration Guide

This document summarizes the current state of the Intent Bridge within the `Naisu1` repository and provides guidance for future development, particularly frontend integration.

## 1. Project Structure

- **Contracts**:
  - Sui: [naisu-contracts/sui](file:///home/harkon666/Dev/experiment/Naisu1/naisu-contracts/sui) (`intent.move`, `solver_engine.move`)
  - EVM: [naisu-contracts/evm](file:///home/harkon666/Dev/experiment/Naisu1/naisu-contracts/evm) (`IntentBridge.sol`, `IntentVault.sol`)
- **Scripts & Solvers**:
  - Located in [scripts/](file:///home/harkon666/Dev/experiment/Naisu1/scripts)
  - **Solvers**: [scripts/solver/](file:///home/harkon666/Dev/experiment/Naisu1/scripts/solver) (logic for polling and fulfilling intents).
  - **Utilities**: `create-intent-sui-to-evm.ts`, `create-intent-evm-to-sui.ts`.

## 2. Core Concepts

The Intent Bridge uses a **Dutch Auction** mechanism for cross-chain swaps:
1. **User Creates Intent**: Locks funds on source chain (e.g., SUI) and specifies a decaying reward for the solver (e.g., ETH/USDC).
2. **Solver Polls Events**: Solvers watch for `IntentCreated` (Sui) or `OrderCreated` (EVM) events.
3. **Solver Fulfills**: When profitable, the solver pays the recipient on the target chain.
4. **Wormhole VAA**: A Wormhole message is emitted upon fulfillment. Once signed (VAA), it's used to unlock the original funds on the source chain for the solver.

## 3. Key Contract Interactions (for Frontend)

### Sui -> EVM
- **Create Intent (Sui)**: Call `intent::create_intent`.
  - Arguments: `coin`, `recipient_address` (bytes32), `start_amount`, `min_amount`, `duration`, `clock`.
- **Listen for**: `IntentCreated` event to show status to the user.

### EVM -> Sui
- **Approve USDC (EVM)**: User must approve the `IntentBridge` contract to spend their USDC.
- **Create Order (EVM)**: Call `IntentBridge::createOrder`.
  - Arguments: `inputAmount`, `startOutputAmount`, `minOutputAmount`, `duration`, `recipientSui` (bytes32).
- **Listen for**: `OrderCreated` event.

## 4. Environment Configuration

Ensure the [root .env](file:///home/harkon666/Dev/experiment/Naisu1/.env) is populated. Key variables:
- `SUI_PACKAGE_ID`, `EVM_INTENT_VAULT_ADDRESS` (Bridge contracts).
- `MOCK_USDC_ADDRESS` (For EVM testing).
- `SOLVER_STATE_ID`, `SOLVER_CONFIG_ID` (Sui state objects).

## 5. Frontend Integration Tips

- **Decimals**:
  - SUI uses **9 decimals**.
  - USDC (Mock) uses **6 decimals**.
  - Always handle calculations using BigInt to avoid precision loss.
- **Wallets**:
  - Use `@mysten/dapp-kit` for Sui wallet connection.
  - Use `wagmi` or `viem` for EVM wallet connection.
- **Address Conversion**:
  - Sui addresses are 32-byte hex strings.
  - EVM addresses are 20-byte hex strings. When passing EVM addresses to Sui, they must be padded to 32 bytes (left-padded with zeros).
- **Tracking Progress**:
  - Use a Wormhole explorer API or SDK to track VAA status if you want to show a progress bar for the cross-chain settlement.

## 6. How to Run Scripts (Local Proof of Work)

Navigate to `scripts/` and use `bun`:
```bash
# Direction Sui -> EVM
bun run create-intent:sui-to-evm # Create
bun run solver:sui-to-evm       # Solve (Watch logs for fulfillment)

# Direction EVM -> Sui
bun run create-intent:evm-to-sui # Create
bun run solver:evm-to-sui       # Solve
```

---
*Generated for the next AI Agent by Antigravity.*
