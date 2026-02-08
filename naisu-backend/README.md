# Uniswap V4 Backend API

Production-ready REST API for **Uniswap V4** on-chain data queries, built with **Hono**, **Viem**, and **Bun**.

## 🏗️ Architecture

```
naisu-backend/
├── src/
│   ├── abis/            # Contract ABIs (Uniswap V4)
│   ├── config/          # Environment & constants
│   ├── cron/            # Background jobs
│   ├── lib/             # External lib initializations (EVM client, logger, DB)
│   ├── middleware/      # Custom middleware (error handling, rate limit)
│   ├── models/          # Zod validation models
│   ├── routes/          # API routes
│   │   ├── health.ts    # Health check
│   │   ├── uniswap-v4.ts # Uniswap V4 endpoints
│   │   └── index.ts     # Router composition
│   ├── services/        # Business logic (Uniswap V4)
│   └── utils/           # Utility functions
├── drizzle/             # Database migrations (optional)
└── tests/               # Test suite
```

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0

### Installation

```bash
# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env if needed (defaults work for testnet)

# Start development server
bun run dev
```

## 📚 Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run start` | Start production server |
| `bun run build` | Build for production |
| `bun run typecheck` | Run TypeScript type checking |
| `bun test` | Run tests |

## 🔌 API Endpoints

### Health
- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/detail` - Detailed health check

### Uniswap V4

#### Pool State
- `GET /api/v1/uniswap-v4/pool/price?token0=0x...&token1=0x...` - Get pool price
- `GET /api/v1/uniswap-v4/pool/state?token0=0x...&token1=0x...` - Get comprehensive pool state
- `GET /api/v1/uniswap-v4/pool/liquidity?token0=0x...&token1=0x...` - Get pool liquidity
- `GET /api/v1/uniswap-v4/pool/slot0?poolId=0x...` - Get raw slot0 data
- `POST /api/v1/uniswap-v4/pools/batch` - Get multiple pools state

#### Positions
- `GET /api/v1/uniswap-v4/position?owner=0x...&token0=0x...&token1=0x...&tickLower=...&tickUpper=...` - Get user position

#### Swap
- `GET /api/v1/uniswap-v4/swap/quote?tokenIn=0x...&tokenOut=0x...&amountIn=...` - Quote a swap
- `POST /api/v1/uniswap-v4/swap/build` - Build unsigned swap transaction(s) for user to sign

#### Solver Management
- `GET /api/v1/uniswap-v4/solver/check?address=0x...` - Check if address is authorized solver
- `GET /api/v1/uniswap-v4/contract/owner` - Get contract owner

#### Utilities
- `GET /api/v1/uniswap-v4/addresses` - Get deployed contract addresses
- `GET /api/v1/uniswap-v4/health` - Health check for Uniswap V4 integration

## 🔗 Uniswap V4 Integration

### Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| NaisuUniswapV4Swap | `0xfaBD3bdeecf7f858d6cef1c137694e19Ac7187f6` |
| NaisuUniswapV4Rewards | `0xD24463BBde91Df1937F4CFC4F627fFc76728b8A6` |
| PoolManager | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` |

### Example Requests

#### Get Pool Price
```bash
curl "http://localhost:3000/api/v1/uniswap-v4/pool/price?token0=0x...&token1=0x..."
```

Response:
```json
{
  "success": true,
  "data": {
    "sqrtPriceX96": "79228162514264337593543950336",
    "tick": 0,
    "price": "1.000000000000000000"
  }
}
```

#### Get Pool State
```bash
curl "http://localhost:3000/api/v1/uniswap-v4/pool/state?token0=0x036CbD53842c5426634e7929541eC2318f3dCF7e&token1=0x4200000000000000000000000000000000000006"
```

Response:
```json
{
  "success": true,
  "data": {
    "poolId": "0x...",
    "sqrtPriceX96": "79228162514264337593543950336",
    "tick": 0,
    "price": "1.000000000000000000",
    "liquidity": "1000000000000000000",
    "fee": 3000,
    "tickSpacing": 60
  }
}
```

#### Batch Pool Queries
```bash
curl -X POST "http://localhost:3000/api/v1/uniswap-v4/pools/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "pools": [
      { "token0": "0x...", "token1": "0x..." },
      { "token0": "0x...", "token1": "0x..." }
    ]
  }'
```

#### Quote Swap
```bash
curl "http://localhost:3000/api/v1/uniswap-v4/swap/quote?tokenIn=0x036CbD53842c5426634e7929541eC2318f3dCF7e&tokenOut=0x4200000000000000000000000000000000000006&amountIn=1000000000000000000"
```

Response:
```json
{
  "success": true,
  "data": {
    "expectedOutput": "0.997000000000000000",
    "priceImpact": "0.00",
    "fee": 3000
  }
}
```

#### Build Swap Transaction
```bash
curl -X POST "http://localhost:3000/api/v1/uniswap-v4/swap/build" \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "0xYourWalletAddress...",
    "tokenIn": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "tokenOut": "0x4200000000000000000000000000000000000006",
    "amountIn": "1000000",
    "minAmountOut": "0",
    "deadlineSeconds": 3600
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "to": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        "data": "0x095ea7b3...",
        "value": "0",
        "chainId": 84532,
        "description": "Approve NaisuSwap contract to spend 0x036..."
      },
      {
        "to": "0xfaBD3bdeecf7f858d6cef1c137694e19Ac7187f6",
        "data": "0x1a461cb2...",
        "value": "0",
        "chainId": 84532,
        "description": "Swap 1000000 of 0x036... for 0x420..."
      }
    ],
    "summary": {
      "tokenIn": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "tokenOut": "0x4200000000000000000000000000000000000006",
      "amountIn": "1000000",
      "minAmountOut": "0",
      "deadline": "1738972800",
      "swapContract": "0xfaBD3bdeecf7f858d6cef1c137694e19Ac7187f6",
      "needsApproval": true
    }
  }
}
```

#### Executing the build response (user signs & sends)

The API returns **unsigned** transactions. The client must sign and send each one in order.

**Option A – React (wagmi)**  
Use the frontend hook so the user signs with their connected wallet:

```ts
import { useExecuteSwapBuild } from '@/features/uniswap_v4';

// After you have the build response (e.g. from fetch or from buildAndExecute):
const { execute, buildAndExecute, isExecuting } = useExecuteSwapBuild();

// 1) You already have the build JSON:
const hashes = await execute(buildResponse);

// 2) Or build and execute in one step (build API + sign/send):
const hashes = await buildAndExecute({
  sender: address!,
  tokenIn: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  tokenOut: '0x4200000000000000000000000000000000000006',
  amountIn: '1000000',
  minAmountOut: '0',
});
```

**Option B – Node / script (viem)**  
Send each `data.transactions[]` item with your wallet client:

```ts
for (const tx of data.transactions) {
  const hash = await walletClient.sendTransaction({
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: BigInt(tx.value),
    chainId: tx.chainId,
  });
  await publicClient.waitForTransactionReceipt({ hash });
}
```

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string (optional) | - |
| `CORS_ORIGIN` | Allowed CORS origins | `*` |
| `LOG_LEVEL` | Logging level | `info` |
| `BASE_SEPOLIA_RPC` | Base Sepolia RPC URL | `https://sepolia.base.org` |
| `BASE_MAINNET_RPC` | Base Mainnet RPC URL | `https://mainnet.base.org` |
| `EVM_ADMIN_PRIVATE_KEY` | Admin private key for EVM (optional) | - |
| `EVM_FALLBACK_RPC_URL` | Fallback RPC URL (optional) | - |
| `ENABLE_UNISWAP_V4` | Enable Uniswap V4 routes | `true` |

## 🧪 Testing

```bash
# Run all tests
bun test

# Run with coverage
bun run test:coverage

# Run in watch mode
bun run test:watch
```

## 📖 Tech Stack

- **Hono** - Fast, lightweight web framework
- **Viem** - Modern Ethereum/EVM interaction library
- **Zod** - TypeScript-first schema validation
- **Bun** - Fast JavaScript runtime

## 📝 License

MIT
