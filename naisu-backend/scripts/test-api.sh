#!/bin/bash
#
# Uniswap V4 API Test Script
# Quick curl commands to test all endpoints
#

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "🧪 Testing Uniswap V4 API at $BASE_URL"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test tokens (Base Sepolia)
USDC="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
WETH="0x4200000000000000000000000000000000000006"
USDbC="0x323e78f944A9a1FcF3a10efcC5319DBb0bB6e5fA"

# Helper function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    echo -n "Testing $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" 2>/dev/null || echo "000")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint" 2>/dev/null || echo "000")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC} ($http_code)"
        echo "  Response: $(echo "$body" | head -c 100)..."
    elif [ "$http_code" = "400" ] || [ "$http_code" = "404" ] || [ "$http_code" = "429" ]; then
        echo -e "${YELLOW}⚠${NC} ($http_code)"
        echo "  Response: $body"
    else
        echo -e "${RED}✗${NC} ($http_code)"
        echo "  Response: $body"
    fi
    echo ""
}

# Health Endpoints
echo "📊 Health Endpoints"
echo "-------------------"
test_endpoint "GET" "/api/v1/health" "Health Check"
test_endpoint "GET" "/api/v1/health/detail" "Detailed Health"
test_endpoint "GET" "/api/v1/uniswap-v4/health" "Contract Health"

# Contract Info
echo ""
echo "📋 Contract Info"
echo "----------------"
test_endpoint "GET" "/api/v1/uniswap-v4/addresses" "Contract Addresses"
test_endpoint "GET" "/api/v1/uniswap-v4/contract/owner" "Contract Owner"

# Pool Queries
echo ""
echo "🏊 Pool Queries"
echo "---------------"
test_endpoint "GET" "/api/v1/uniswap-v4/pool/price?token0=$USDC&token1=$WETH&fee=3000" "Pool Price"
test_endpoint "GET" "/api/v1/uniswap-v4/pool/state?token0=$USDC&token1=$WETH&fee=3000" "Pool State"
test_endpoint "GET" "/api/v1/uniswap-v4/pool/liquidity?token0=$USDC&token1=$WETH&fee=3000" "Pool Liquidity"
test_endpoint "GET" "/api/v1/uniswap-v4/pool/slot0?token0=$USDC&token1=$WETH&fee=3000" "Pool Slot0"

# Invalid pool (should return error or empty)
test_endpoint "GET" "/api/v1/uniswap-v4/pool/price?token0=invalid&token1=$WETH" "Invalid Address (Validation)"

# Batch Query
echo ""
echo "📦 Batch Queries"
echo "----------------"
test_endpoint "POST" "/api/v1/uniswap-v4/pools/batch" "Batch Pool Query" \
    "{\"pools\":[{\"token0\":\"$USDC\",\"token1\":\"$WETH\",\"fee\":3000},{\"token0\":\"$USDC\",\"token1\":\"$USDbC\",\"fee\":500}]}"

# Swap Quote
echo ""
echo "💱 Swap Quotes"
echo "--------------"
test_endpoint "GET" "/api/v1/uniswap-v4/swap/quote?tokenIn=$USDC&tokenOut=$WETH&amountIn=1000000&fee=3000" "Swap Quote (1 USDC)"
test_endpoint "GET" "/api/v1/uniswap-v4/swap/quote?tokenIn=$WETH&tokenOut=$USDC&amountIn=1000000000000000&fee=3000" "Swap Quote (0.001 WETH)"

# Solver
echo ""
echo "🔍 Solver"
echo "---------"
test_endpoint "GET" "/api/v1/uniswap-v4/solver/check?address=$USDC" "Check Solver Status"

# Swagger Docs
echo ""
echo "📖 Documentation"
echo "----------------"
test_endpoint "GET" "/docs/openapi.json" "OpenAPI Spec"

echo ""
echo "=========================================="
echo "✅ Test Complete!"
echo ""
echo "View interactive docs at: $BASE_URL/docs"
