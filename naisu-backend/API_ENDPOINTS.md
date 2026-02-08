# Naisu Backend API Endpoints

Complete reference for all available API endpoints in the Naisu Backend.

**Base URL:** `http://localhost:3000/api/v1` (or your deployed URL)

---

## 📑 Table of Contents

- [Health](#health)
- [Uniswap V4](#uniswap-v4)
- [Cetus CLMM (Sui)](#cetus-clmm-sui)
- [API Documentation](#api-documentation)

---

## Health

Health check endpoints for monitoring service status.

### GET `/api/v1/health`
Basic health check.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0",
    "environment": "production"
  }
}
```

---

### GET `/api/v1/health/detail`
Detailed health check including database and EVM connectivity.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0",
    "environment": "production",
    "checks": {
      "database": {
        "status": "healthy",
        "responseTime": 12
      },
      "evm": {
        "status": "healthy",
        "responseTime": 45
      }
    }
  }
}
```

---

## Uniswap V4

Endpoints for interacting with Uniswap V4 contracts on Base network.

### Health

#### GET `/api/v1/uniswap-v4/health`
Uniswap V4 integration health check.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "contractOwner": "0x..."
  }
}
```

### Contract Info

#### GET `/api/v1/uniswap-v4/addresses`
Get all contract addresses for the current network.

**Response:**
```json
{
  "success": true,
  "data": {
    "swap": "0xfaBD3bdeecf7f858d6cef1c137694e19Ac7187f6",
    "rewards": "0xD24463BBde91Df1937F4CFC4F627fFc76728b8A6",
    "poolManager": "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408"
  }
}
```

---

#### GET `/api/v1/uniswap-v4/contract/owner`
Get the contract owner address.

**Response:**
```json
{
  "success": true,
  "data": {
    "owner": "0x..."
  }
}
```

### Pool Queries

#### GET `/api/v1/uniswap-v4/pool/price`
Get pool price and tick.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token0` | string | Yes | Token 0 address (0x...) |
| `token1` | string | Yes | Token 1 address (0x...) |
| `fee` | number | No | Fee tier (default: 3000) |

**Example:** `/api/v1/uniswap-v4/pool/price?token0=0x036CbD53842c5426634e7929541eC2318f3dCF7e&token1=0x4200000000000000000000000000000000000006&fee=3000`

**Response:**
```json
{
  "success": true,
  "data": {
    "sqrtPriceX96": "5978200713243818416577388530114572037",
    "tick": 362799,
    "price": "5693532664343112.000000000000000000"
  }
}
```

---

#### GET `/api/v1/uniswap-v4/pool/state`
Get comprehensive pool state including liquidity, fees, and sqrtPrice.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token0` | string | Yes | Token 0 address (0x...) |
| `token1` | string | Yes | Token 1 address (0x...) |
| `fee` | number | No | Fee tier (default: 3000) |

**Response:**
```json
{
  "success": true,
  "data": {
    "poolId": "0x...",
    "sqrtPriceX96": "5978200713243818416577388530114572037",
    "tick": 362799,
    "price": "5693532664343112.000000000000000000",
    "liquidity": "1234567890",
    "fee": 3000,
    "tickSpacing": 60
  }
}
```

---

#### GET `/api/v1/uniswap-v4/pool/liquidity`
Get pool liquidity.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token0` | string | Yes | Token 0 address (0x...) |
| `token1` | string | Yes | Token 1 address (0x...) |
| `fee` | number | No | Fee tier (default: 3000) |

**Response:**
```json
{
  "success": true,
  "data": {
    "poolId": "0x...",
    "liquidity": "1234567890"
  }
}
```

---

#### GET `/api/v1/uniswap-v4/pool/slot0`
Get pool slot0 data directly from PoolManager.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolId` | string | Yes | Pool ID (32 bytes hex) |

**Response:**
```json
{
  "success": true,
  "data": {
    "sqrtPriceX96": "5978200713243818416577388530114572037",
    "tick": 362799,
    "protocolFee": 0,
    "swapFee": 3000
  }
}
```

---

#### POST `/api/v1/uniswap-v4/pools/batch`
Get multiple pools state in a single request.

**Request Body:**
```json
{
  "pools": [
    { "token0": "0x036CbD53842c5426634e7929541eC2318f3dCF7e", "token1": "0x4200000000000000000000000000000000000006", "fee": 3000 },
    { "token0": "0x036CbD53842c5426634e7929541eC2318f3dCF7e", "token1": "0x...", "fee": 500 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "token0": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "token1": "0x4200000000000000000000000000000000000006",
      "poolId": "0x...",
      "sqrtPriceX96": "5978200713243818416577388530114572037",
      "tick": 362799,
      "price": "5693532664343112.000000000000000000",
      "liquidity": "1234567890"
    }
  ],
  "meta": {
    "requested": 2,
    "returned": 1
  }
}
```

### Swap Quotes

#### GET `/api/v1/uniswap-v4/swap/quote`
Get swap quote (expected output amount).

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenIn` | string | Yes | Input token address (0x...) |
| `tokenOut` | string | Yes | Output token address (0x...) |
| `amountIn` | string | Yes | Input amount (in wei) |
| `fee` | number | No | Fee tier (default: 3000) |

**Example:** `/api/v1/uniswap-v4/swap/quote?tokenIn=0x036CbD53842c5426634e7929541eC2318f3dCF7e&tokenOut=0x4200000000000000000000000000000000000006&amountIn=1000000`

**Response:**
```json
{
  "success": true,
  "data": {
    "poolId": "0x...",
    "poolManager": "0x...",
    "sqrtPriceX96": "5978200713243818416577388530114572037",
    "tick": 362799,
    "tickSpacing": 60,
    "amountIn": "1000000",
    "amountInAfterFee": "997000",
    "expectedOutput": "1750000000000",
    "priceX18": "1754385964912280701",
    "priceImpact": "0.00",
    "fee": 3000,
    "quoteMethod": "contract"
  }
}
```

---

#### POST `/api/v1/uniswap-v4/swap/build`
Build unsigned swap transaction for user to sign.

**Request Body:**
```json
{
  "sender": "0x...",
  "tokenIn": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "tokenOut": "0x4200000000000000000000000000000000000006",
  "amountIn": "1000000",
  "minAmountOut": "1700000000000",
  "fee": 3000,
  "deadlineSeconds": 3600
}
```

**Response:**
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
        "description": "Approve 1000000 wei for NaisuSwap"
      },
      {
        "to": "0xfaBD3bdeecf7f858d6cef1c137694e19Ac7187f6",
        "data": "0x...",
        "value": "0",
        "chainId": 84532,
        "description": "Swap 1000000 of 0x... for 0x... (min output: 1700000000000)"
      }
    ],
    "summary": {
      "tokenIn": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "tokenOut": "0x4200000000000000000000000000000000000006",
      "amountIn": "1000000",
      "minAmountOut": "1700000000000",
      "deadline": "1704067200",
      "swapContract": "0xfaBD3bdeecf7f858d6cef1c137694e19Ac7187f6",
      "needsApproval": true
    }
  }
}
```

### Solver

#### GET `/api/v1/uniswap-v4/solver/check`
Check if address is an authorized solver.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Address to check (0x...) |

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "isAuthorized": false
  }
}
```

### Position

#### GET `/api/v1/uniswap-v4/position`
Get user position in a pool.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `owner` | string | Yes | Owner address (0x...) |
| `token0` | string | Yes | Token 0 address (0x...) |
| `token1` | string | Yes | Token 1 address (0x...) |
| `tickLower` | number | Yes | Lower tick |
| `tickUpper` | number | Yes | Upper tick |

**Response:**
```json
{
  "success": true,
  "data": {
    "liquidity": "1234567890",
    "feeGrowthInside0LastX128": "0",
    "feeGrowthInside1LastX128": "0"
  }
}
```

---

## Cetus CLMM (Sui)

Endpoints for interacting with Cetus CLMM on Sui network.

### Pool Information

#### GET `/api/v1/cetus/pools`
List available Cetus pools.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "0x...",
      "tokenA": "0x...",
      "tokenB": "0x...",
      "feeRate": 0.003
    }
  ]
}
```

---

#### GET `/api/v1/cetus/pool/:id`
Get detailed pool information.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Pool ID (0x...) |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "0x...",
    "tokenA": "0x...",
    "tokenB": "0x...",
    "sqrtPrice": "1234567890",
    "liquidity": "9876543210",
    "tickIndex": -100,
    "feeRate": 0.003
  }
}
```

### Swaps

#### POST `/api/v1/cetus/quote`
Get swap quote (no execution).

**Request Body:**
```json
{
  "poolId": "0x...",
  "amountIn": "1000000",
  "aToB": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "amountOut": "950000",
    "feeAmount": "3000",
    "priceImpact": "0.01"
  }
}
```

---

#### POST `/api/v1/cetus/swap`
Execute swap transaction.

**Request Body:**
```json
{
  "poolId": "0x...",
  "amountIn": "1000000",
  "aToB": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "0x...",
    "amountOut": "950000"
  }
}
```

### Zap (Single-sided Deposit)

#### POST `/api/v1/cetus/zap/quote`
Get quote for zap (preview before executing).

**Request Body:**
```json
{
  "poolId": "0x...",
  "amountIn": "1000000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "liquidity": "500000",
    "swapAmount": "500000",
    "priceImpact": "0.02"
  }
}
```

---

#### POST `/api/v1/cetus/zap/build`
Build unsigned zap transaction.

**Request Body:**
```json
{
  "poolId": "0x...",
  "coinObjectIds": ["0x...", "0x..."],
  "amountIn": "1000000",
  "userAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txBytes": "base64_encoded_transaction",
    "gasEstimate": "1000000"
  }
}
```

---

#### POST `/api/v1/cetus/zap`
Execute zap transaction.

**Request Body:**
```json
{
  "poolId": "0x...",
  "amountIn": "1000000",
  "minLiquidity": "400000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "0x...",
    "liquidity": "500000",
    "positionId": "0x..."
  }
}
```

### Position Management

#### POST `/api/v1/cetus/positions`
Get positions for an owner.

**Request Body:**
```json
{
  "owner": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "positionId": "0x...",
      "poolId": "0x...",
      "liquidity": "1234567890",
      "tickLower": -100,
      "tickUpper": 100
    }
  ]
}
```

---

#### POST `/api/v1/cetus/harvest/build`
Build unsigned harvest transaction.

**Request Body:**
```json
{
  "positionId": "0x...",
  "userAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txBytes": "base64_encoded_transaction",
    "gasEstimate": "1000000"
  }
}
```

---

#### POST `/api/v1/cetus/harvest`
Collect fees from position.

**Request Body:**
```json
{
  "positionId": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "0x...",
    "feeAmountA": "1000",
    "feeAmountB": "2000"
  }
}
```

---

#### POST `/api/v1/cetus/remove-liquidity/build`
Build unsigned remove liquidity transaction.

**Request Body:**
```json
{
  "positionId": "0x...",
  "liquidityDelta": "1000000",
  "userAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txBytes": "base64_encoded_transaction",
    "gasEstimate": "1000000"
  }
}
```

### Wallet & Balance

#### POST `/api/v1/cetus/balance`
Get balance for an owner.

**Request Body:**
```json
{
  "owner": "0x...",
  "coinType": "0x...::coin::COIN"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": "1234567890",
    "coinType": "0x...::coin::COIN"
  }
}
```

---

#### POST `/api/v1/cetus/coins`
Get coin object IDs for owner (for building transactions).

**Request Body:**
```json
{
  "owner": "0x...",
  "coinType": "0x...::coin::COIN"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "coinObjectId": "0x...",
      "balance": "500000"
    },
    {
      "coinObjectId": "0x...",
      "balance": "500000"
    }
  ]
}
```

---

## API Documentation

Interactive API documentation endpoints.

### GET `/docs`
Swagger UI - Interactive API documentation interface.

Open in browser: `http://localhost:3000/docs`

---

### GET `/docs/openapi.json`
OpenAPI JSON specification.

**Response:** Raw OpenAPI 3.0 JSON specification.

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Description of the error"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `INTERNAL_ERROR` | 500 | Server internal error |
| `RATE_LIMITED` | 429 | Too many requests |

---

## Rate Limits

- **Global:** 1000 requests per minute
- **Uniswap V4 endpoints:** 100 requests per minute
- **Cetus endpoints:** 100 requests per minute

---

## Networks Supported

| Network | Chain ID | Default RPC |
|---------|----------|-------------|
| Base Sepolia | 84532 | https://sepolia.base.org |
| Base Mainnet | 8453 | https://mainnet.base.org |
| Sui Testnet | - | https://fullnode.testnet.sui.io |

---

## Authentication

Some endpoints may require API key authentication via header:
```
x-api-key: your-api-key-here
```
