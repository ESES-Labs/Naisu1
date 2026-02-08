# Naisu - Intent-Based Yield Marketplace

> **"One Intent. Best Yield. Solver Competition."**

Naisu is the first **intent-based yield marketplace** on Sui. Users declare yield goals ("I want 8% APY on my USDC"), multiple solvers compete to fulfill, and the best offer wins—all executed atomically via Sui PTB.

Inspired by ERC-7683 (cross-chain intents) and optimized for Sui's parallel execution.

---

## 🎯 Hackathon Focus

**ETHGlobal 2026 - Sui Track**

| Feature | Status | Innovation |
|---------|--------|------------|
| Intent Standard (Move) | ✅ Done | YieldIntent Shared Object deployed |
| Solver Competition | ✅ Done | Scallop + Navi solvers with bid logic |
| Sui PTB Integration | ✅ Done | Atomic mint→fulfill transaction flow |
| Protocol Integration | ✅ Done | Scallop testnet integration (sSUI) |
| Intent Bridge (X-Chain) | ✅ Done | Bidirectional Sui ↔ EVM Intent Bridge |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAISU FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  USER (Sui Wallet)                                              │
│  "I want 8% APY on my USDC"                                     │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Intent Contract (Move)                                 │    │
│  │  • YieldIntent Shared Object                            │    │
│  │  • Lock USDC, set min_apy                               │    │
│  │  • Discoverable by all solvers                          │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│       ┌────────────────────┼────────────────────┐               │
│       ▼                    ▼                    ▼               │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐        │
│  │  Scallop   │      │  Aggregator│      │    Navi    │        │
│  │   Solver   │      │   Solver   │      │   Solver   │        │
│  │            │      │            │      │            │        │
│  │ "8.2% APY" │      │ "8.1% APY" │      │ "8.0% APY" │        │
│  │  (Bid)     │      │  (Bid)     │      │  (Bid)     │        │
│  └─────┬──────┘      └─────┬──────┘      └─────┬──────┘        │
│        │                   │                   │               │
│        └───────────────────┼───────────────────┘               │
│                            ▼                                   │
│                   Winner: Scallop (8.2%)                       │
│                   Best user outcome!                           │
│                            │                                   │
│                            ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Sui PTB Execution (Atomic)                             │   │
│  │  • Winner deposits USDC to Scallop                      │   │
│  │  • Scallop mints sUSDC to user                          │   │
│  │  • Solver fee (spread) to winner                        │   │
│  │  • Delete intent object                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The Magic: Competitive Solvers

**Traditional (Monopoly):**
```
User → Single Solver → Execute
            ↓
      "Trust me, this is best rate"
```

**Naisu (Marketplace):**
```
User → Intent → Solver A: "I give 8.2%!"
         ↓      Solver B: "I give 8.0%!"
         ↓      Solver C: "I give 8.1%!"
         ↓
      Winner: A (Best for user)
```

**Why this wins:**
- ✅ **Transparency** - Users see all bids
- ✅ **Best rates** - Competition drives surplus to users
- ✅ **No monopoly** - Any solver can participate

---

## 🔄 Supported Flows

### MVP (Primary Focus)
| Route | Direction | Bridge | Protocols | Status |
|-------|-----------|--------|-----------|--------|
| **Sui Native** | SUI → Staked SUI | N/A | **Native Staking** | ✅ Verified (Testnet) |
| **Sui Native** | SUI → USDC/LP | N/A | Cetus | ⚠️ Implemented (Untested) |
| **Sui Native** | SUI → sSUI | N/A | Scallop | � Planned (Mainnet/Untested) |
| **Cross-Chain** | Sui → EVM | Wormhole | **Intent Bridge** | ✅ Verified (Testnet) |
| **Cross-Chain** | EVM → Sui | Wormhole | **Intent Bridge** | ✅ Verified (Testnet) |

### Intent Flow (Implemented)
```
User → Create Intent (YieldIntent Shared Object)
           ↓
    ┌──────┴──────┐
    ▼             ▼
Scallop Solver  Navi Solver
"Bid: 8.2%"     "Bid: 8.0%"
    └──────┬──────┘
           ↓
    Winner: Scallop (8.2%)
           ↓
    PTB Execution:
    1. Solver deposits SUI → Scallop
    2. Scallop mints sSUI → User
    3. Intent fulfilled atomically
```

### How Solvers Make Money

**The Spread Model:**
```
Market APY: Scallop 8.5%
User Intent: "Minimum 7.5% APY acceptable"

Solver Action:
  - Deposit to Scallop (get 8.5%)
  - Give user 7.5%
  - Keep 1.0% spread as profit

Everyone wins:
  - User: Gets guaranteed 7.5% (no effort)
  - Solver: Earns 1% for service
```

---

## 🌉 Intent Bridge (Sui ↔ EVM)

Naisu's Intent Bridge is a bidirectional, solver-based cross-chain solution powered by **Wormhole**. Unlike traditional lock-and-mint bridges, it uses a **Dutch Auction** to attract competitive solvers, ensuring users get the best execution and speed.

### Direction A: EVM → Sui
1. **User Creates Order**: User locks USDC on Base Sepolia and specifies a SUI reward for the solver.
2. **Competitive Bidding**: Dutch Auction starts. The SUI reward for the solver increases over time.
3. **Solver Fulfillment**: A solver detects the order, pays the user on Sui (Native SUI), and emits a fulfillment message.
4. **VAA Verification**: Once the Wormhole Guardians sign the message (VAA), the solver uses it to unlock the USDC on Base.

### Direction B: Sui → EVM
1. **User Creates Intent**: User locks SUI on Sui and specifies an ETH/USDC output.
2. **Solver Action**: Solver fulfills the user's intent on EVM (Base Sepolia).
3. **Settlement**: Solver provides the signed VAA to the Sui contract to receive the locked SUI.

### Why Intent Bridge?
- **Speed**: Solvers fulfill natively on the target chain instantly, effectively "fast-bridging" for the user.
- **Capital Efficiency**: Solvers take the bridging risk/time in exchange for a spread.
- **Security**: All settlements are backed by Wormhole's decentralized guardian network.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React + Vite + TypeScript |
| **Sui Contracts** | Move (Shared Objects) |
| **Solvers** | Rust / TypeScript (bots) |
| **Bridge** | Wormhole (Base ↔ Sui) |
| **Backend** | Rust (Axum) - minimal |

---

## 📁 Project Structure

```
naisu1/
├── naisu-contracts/      # All Smart Contracts
│   ├── sui/              # Move project (Intent Engine)
│   └── evm/              # Solidity (Base Sepolia)
├── naisu-core/           # Shared types
├── naisu-api/            # Axum REST API (minimal)
├── scripts/              # Integration & Bot scripts
│   ├── solver/           # Intent Bridge Solvers
│   │   ├── solver_sui_to_evm.ts
│   │   └── solver_evm_to_sui.ts
│   ├── create-intent-sui-to-evm.ts
│   └── create-intent-evm-to-sui.ts
├── naisu-sui/            # Sui PTB builder
└── naisu-frontend/       # React dApp (Refactoring)
```

---

## 🚀 Quick Start

### Prerequisites
- Rust 1.70+
- Node.js 18+
- Sui CLI

### 1. Setup Environment

**Frontend:**
```bash
cd frontend
cp .env.example .env
# Required:
# VITE_SUI_NETWORK=testnet
# VITE_TESTNET_INTENT_PACKAGE=0x...
```

**Solver Agent:**
```bash
cd naisu-agent
cp .env.example .env
# Required for Verified Flow:
# SUI_NETWORK=testnet

# Optional (Untested/Experimental):
# TESTNET_INTENT_PACKAGE=0x...
# MAINNET_INTENT_PACKAGE=0x...
# SOLVER_PRIVATE_KEY=...
```

### 2. Run Solver Bots
```bash
# Terminal 1: Scallop Solver
cd naisu-solver && bun run scallop-solver.ts

# Terminal 2: Navi Solver
cd naisu-solver && bun run navi-solver.ts
```

### 3. Run Frontend
```bash
cd frontend
bun install
bun dev
```

---

## 🧪 Testing

### Create Intent
```bash
curl -X POST http://localhost:8080/api/v1/intents \
  -H "Content-Type: application/json" \
  -d '{
    "user": "0x...",
    "input_token": "USDC",
    "input_amount": "1000",
    "min_apy": 750,  // 7.5% in basis points
    "deadline": 3600
  }'
```

### Watch Solver Competition
```bash
# Frontend shows real-time bids:
# "Scallop Solver: 8.2%"
# "Navi Solver: 8.0%"
# "Winner: Scallop!"
```

---

## 🤖 Solver Implementation

### Scallop Solver (`naisu-agent/src/bots/scallop_solver.rs`)

The Scallop Solver competes to fulfill yield intents by depositing user funds into Scallop and returning sSUI (yield-bearing tokens).

```rust
// Solver evaluates intent and places bid
let bid = solver.evaluate(intent, market_apy).await;
// Returns: Bid { solver_name: "Scallop", apy: 820, profit_bps: 20 }

// If winner, solver fulfills via PTB
let tx_digest = solver.fulfill(intent).await;
```

**Bid Calculation:**
```
Market APY:     8.5% (850 bps)
User Minimum:   7.5% (750 bps)
Spread:         1.0% (100 bps)
Gas Cost:       0.1% (10 bps)
Solver Profit:  0.2% (20 bps)
────────────────────────────────
Bid APY:        8.3% (830 bps)  ← User gets this
```

**Key Files:**
- `naisu-agent/src/bots/scallop_solver.rs` - Scallop integration
- `naisu-agent/src/bots/navi_solver.rs` - Navi integration  
- `naisu-agent/src/solver.rs` - Solver trait and bidding logic
- `naisu-sui/src/ptb.rs` - PTB builder for transaction construction

## 🎯 Key Features

- ✅ **Intent-Based UX** - Declare outcome, not steps
- ✅ **Competitive Solvers** - Multiple bots bid for best rate
- ✅ **Open Network** - Anyone can run a solver ([Build Yours](./solver-sdk/))
- ✅ **Transparent** - Users see all bids in real-time
- ✅ **Gasless** - Solvers pay gas (recovered from spread)
- ✅ **Atomic Execution** - Sui PTB: all-or-nothing
- ✅ **No Monopoly** - Permissionless solver participation

---

## 🏆 Tracks

- 🌊 **Sui** - Intent standard with Shared Objects
- 🏦 **DeFi** - Competitive yield marketplace
- 🔗 **Cross-chain** - Bidirectional Intent Bridge via Wormhole

---

## 📚 Documentation

- **[SOLVER_SDK](./solver-sdk/)** - Build your own solver! (`cargo add naisu-solver-sdk`)
- **[SOLVER_ARCHITECTURE.md](./SOLVER_ARCHITECTURE.md)** - Open solver network design
- **[SOLVERS.md](./SOLVERS.md)** - Solver architecture & integration guide
- **[INSIGHT.md](./INSIGHT.md)** - Research: UMA/Across, ERC-7683, solver economics

### Quick Solver Example

```rust
use naisu_solver_sdk::{BaseSolver, ProtocolAdapter};

// Build solver for any protocol
let adapter = MyProtocolAdapter::new();
let solver = BaseSolver::new("MySolver", adapter);
solver.run().await?;
```

---

## 🔗 Deployed Contract (Testnet)

**Package ID:** `0xa3a26135f436323ea0fe00330fbdcd188f2c07bf33a5ee4c49aa736cea88a71f`

**Modules:**
- `intent` - YieldIntent Shared Object, create/fulfill intents
- `adapter` - Protocol adapter interface

**Network:** Sui Testnet  
**Deploy TX:** [FfPxwjJsHNcVj49rD5hHQYS3u7UuU1A5RrT5RV6TYop3](https://suiscan.xyz/testnet/tx/FfPxwjJsHNcVj49rD5hHQYS3u7UuU1A5RrT5RV6TYop3)

---

## 🔌 Protocol Integrations

## 🔌 Protocol Integrations

### Cetus (Experimental)

Cetus is a CLMM DEX on Sui. Solvers can fulfill intents by swapping tokens or providing liquidity to earn trading fees.

> **Note:** Implementation exists but has **NOT** been fully tested on Testnet yet.

**Testnet Addresses:**
```
Package:     0x5372d555ac734e272659136c2a0cd3227f9b92de67c80dc11250307268af2db8
Pool:        0x50eb61dd5928cec5ea04711a2e9b72e5237e79e9fbcd2ce3d5469dc8708e0ee2
```

### Scallop (Planned/Mainnet)

Scallop is a lending protocol on Sui that issues **sCoins**. Ideal for Mainnet yield strategies.

> **Note:** Scallop integration is currently **UNTESTED** and targeted for Mainnet deployment.

**Mainnet Addresses (Reference):**
```
Package:     0xd384ded6b9e7f4d2c4c9007b0291ef88fbfed8e709bce83d2da69de2d79d013d
Market:      0xa757975255146dc9686aa823b7838b507f315d704f428cbadad2f4ea061939d9
```

**Solver PTB Flow:**
```move
// Step 1: Deposit SUI, get sSUI (yield-bearing token)
let s_sui = scallop::mint::mint<SUI>(
    version, 
    market, 
    sui_coin, 
    clock, 
    ctx
);

// Step 2: Fulfill intent with sSUI
intent::fulfill_intent<SUI, sSUI>(
    intent, 
    s_sui, 
    b"Scallop", 
    apy_bps, 
    ctx
);
```

**Why Scallop Works Best:**
- ✅ **Token-based** - Returns sSUI that can be transferred directly
- ✅ **Simple PTB** - Single deposit call
- ✅ **Competitive APY** - ~8-12% on SUI deposits
- ✅ **Battle-tested** - Main protocol on Sui

### Navi (Alternative)

Navi uses an account-based model where deposits are tracked in protocol state rather than issuing tokens. Integration requires account management for solvers.

**Testnet Addresses:**
```
Core:  0xf8bb0e33b5419e36b7f6f9f2ed27fe5df8cfaa9f3d51a707e6c53b3389d4c2c9
Pool:  0xa68de6551f9654634e423b6f7a5662c8f56e5b3965a98f94f35a5c5c37dd5e6f
```

**Deposit Function:**
```move
incentive_v3::entry_deposit(
    clock,
    storage,
    pool_id,
    asset_id,  // SUI = 0
    coin,
    amount,
    incentive_v2,
    incentive_v3,
    ctx
);
```

---

## 📝 License

MIT

---

Built for ETHGlobal Hackathon 2026
