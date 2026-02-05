# Naisu - Intent-Based Yield Marketplace

> **"One Intent. Best Yield. Solver Competition."**

Naisu is the first **intent-based yield marketplace** on Sui. Users declare yield goals ("I want 8% APY on my USDC"), multiple solvers compete to fulfill, and the best offer wins—all executed atomically via Sui PTB.

Inspired by ERC-7683 (cross-chain intents) and optimized for Sui's parallel execution.

---

## 🎯 Hackathon Focus

**ETHGlobal 2026 - Sui Track**

| Feature | Status | Innovation |
|---------|--------|------------|
| Intent Standard (Move) | 🚧 In Progress | First competitive solver network on Sui |
| Solver Competition | 🚧 In Progress | Multiple bots bidding for best yield |
| Sui PTB Integration | ✅ Done | Atomic execution |
| Cross-Chain Bridge | 🗓️ Bonus | Wormhole CCTP for EVM→Sui |

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
| **Sui Native** | USDC → Yield | N/A | Scallop, Navi | 🚧 In Progress |
| **EVM → Sui** | Base → Sui | Wormhole CCTP | Scallop, Navi | 🗓️ Bonus |

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

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React + Vite + TypeScript |
| **Sui Contracts** | Move (Shared Objects) |
| **Solvers** | Rust / TypeScript (bots) |
| **Bridge** | Wormhole CCTP (bonus) |
| **Backend** | Rust (Axum) - minimal |

---

## 📁 Project Structure

```
naisu1/
├── contracts/
│   └── sui/              # Move project
│       └── sources/
│           ├── intent.move      # YieldIntent Shared Object
│           ├── solver.move      # Fulfill logic
│           └── adapter.move     # Protocol adapters
├── naisu-core/           # Shared types
├── naisu-api/            # Axum REST API (minimal)
├── naisu-solver/         # Solver bots (NEW)
│   ├── scallop-solver.ts
│   ├── navi-solver.ts
│   └── aggregator-solver.ts
├── naisu-sui/            # Sui PTB builder
└── frontend/             # React dApp
```

---

## 🚀 Quick Start

### Prerequisites
- Rust 1.70+
- Node.js 18+
- Sui CLI

### 1. Setup Environment
```bash
cp .env.example .env
# Edit .env with your keys
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

## 🎯 Key Features

- ✅ **Intent-Based UX** - Declare outcome, not steps
- ✅ **Competitive Solvers** - Multiple bots bid for best rate
- ✅ **Transparent** - Users see all bids in real-time
- ✅ **Gasless** - Solvers pay gas (recovered from spread)
- ✅ **Atomic Execution** - Sui PTB: all-or-nothing
- ✅ **No Monopoly** - Open solver network

---

## 🏆 Tracks

- 🌊 **Sui** - Intent standard with Shared Objects
- 🏦 **DeFi** - Competitive yield marketplace
- 🔗 **Cross-chain** - Wormhole CCTP (bonus feature)

---

## 📚 Research & Insights

See [INSIGHT.md](./INSIGHT.md) for deep research:
- UMA/Across Protocol analysis
- ERC-7683 adaptation for Sui
- Solver economics and spread models
- Competitive dynamics

---

## 🔗 Deployed Contract (Testnet)

**Package ID:** `0xa3a26135f436323ea0fe00330fbdcd188f2c07bf33a5ee4c49aa736cea88a71f`

**Modules:**
- `intent` - YieldIntent Shared Object, create/fulfill intents
- `adapter` - Protocol adapter interface

**Network:** Sui Testnet  
**Deploy TX:** [FfPxwjJsHNcVj49rD5hHQYS3u7UuU1A5RrT5RV6TYop3](https://suiscan.xyz/testnet/tx/FfPxwjJsHNcVj49rD5hHQYS3u7UuU1A5RrT5RV6TYop3)

---

## 📝 License

MIT

---

Built for ETHGlobal Hackathon 2026
