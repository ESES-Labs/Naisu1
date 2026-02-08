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

#### Swap Quotes
- `GET /api/v1/uniswap-v4/swap/quote?tokenIn=0x...&tokenOut=0x...&amountIn=...` - Quote a swap

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
| NaisuUniswapV4Swap | `0xe98c6a81ef37b14e9123b803baf08ff99098b088` |
| NaisuUniswapV4Rewards | `0x2c5c7eb00608f910d171c7d7a841338298076a96` |
| PoolManager | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` |

### Example Requests

#### Get Pool Price
```bash
curl "http://localhost:8080/api/v1/uniswap-v4/pool/price?token0=0x...&token1=0x..."
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
curl "http://localhost:8080/api/v1/uniswap-v4/pool/state?token0=0x...&token1=0x..."
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
curl -X POST "http://localhost:8080/api/v1/uniswap-v4/pools/batch" \
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
curl "http://localhost:8080/api/v1/uniswap-v4/swap/quote?tokenIn=0x...&tokenOut=0x...&amountIn=1000000000000000000"
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

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `8080` |
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
