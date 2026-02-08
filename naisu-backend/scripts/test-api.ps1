#
# Uniswap V4 API Test Script (PowerShell)
# Quick commands to test all endpoints
#

param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Continue"

Write-Host "🧪 Testing Uniswap V4 API at $BaseUrl" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Test tokens (Base Sepolia)
$USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
$WETH = "0x4200000000000000000000000000000000000006"
$USDbC = "0x323e78f944A9a1FcF3a10efcC5319DBb0bB6e5fA"

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Description,
        [string]$Body = $null
    )
    
    Write-Host -NoNewline "Testing $Description... "
    
    try {
        $uri = "$BaseUrl$Endpoint"
        
        if ($Method -eq "GET") {
            $response = Invoke-RestMethod -Uri $uri -Method GET -TimeoutSec 10
            $statusCode = 200
        } else {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Body $Body -ContentType "application/json" -TimeoutSec 10
            $statusCode = 200
        }
        
        Write-Host "✓ ($statusCode)" -ForegroundColor Green
        $json = $response | ConvertTo-Json -Depth 3 -Compress
        Write-Host "  Response: $json" -ForegroundColor Gray
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 400 -or $statusCode -eq 404 -or $statusCode -eq 429) {
            Write-Host "⚠ ($statusCode)" -ForegroundColor Yellow
        } else {
            Write-Host "✗ ($statusCode)" -ForegroundColor Red
        }
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
    }
    Write-Host ""
}

# Health Endpoints
Write-Host "📊 Health Endpoints" -ForegroundColor Yellow
Write-Host "-------------------" -ForegroundColor Yellow
Test-Endpoint -Method "GET" -Endpoint "/api/v1/health" -Description "Health Check"
Test-Endpoint -Method "GET" -Endpoint "/api/v1/health/detail" -Description "Detailed Health"
Test-Endpoint -Method "GET" -Endpoint "/api/v1/uniswap-v4/health" -Description "Contract Health"

# Contract Info
Write-Host ""
Write-Host "📋 Contract Info" -ForegroundColor Yellow
Write-Host "----------------" -ForegroundColor Yellow
Test-Endpoint -Method "GET" -Endpoint "/api/v1/uniswap-v4/addresses" -Description "Contract Addresses"
Test-Endpoint -Method "GET" -Endpoint "/api/v1/uniswap-v4/contract/owner" -Description "Contract Owner"

# Pool Queries
Write-Host ""
Write-Host "🏊 Pool Queries" -ForegroundColor Yellow
Write-Host "---------------" -ForegroundColor Yellow
Test-Endpoint -Method "GET" -Endpoint "/api/v1/uniswap-v4/pool/price?token0=$USDC&token1=$WETH&fee=3000" -Description "Pool Price"
Test-Endpoint -Method "GET" -Endpoint "/api/v1/uniswap-v4/pool/state?token0=$USDC&token1=$WETH&fee=3000" -Description "Pool State"
Test-Endpoint -Method "GET" -Endpoint "/api/v1/uniswap-v4/pool/liquidity?token0=$USDC&token1=$WETH&fee=3000" -Description "Pool Liquidity"
Test-Endpoint -Method "GET" -Endpoint "/api/v1/uniswap-v4/pool/slot0?token0=$USDC&token1=$WETH&fee=3000" -Description "Pool Slot0"

# Validation test
Test-Endpoint -Method "GET" -Endpoint "/api/v1/uniswap-v4/pool/price?token0=invalid&token1=$WETH" -Description "Invalid Address (Validation)"

# Batch Query
Write-Host ""
Write-Host "📦 Batch Queries" -ForegroundColor Yellow
Write-Host "----------------" -ForegroundColor Yellow
$batchBody = @{
    pools = @(
        @{ token0 = $USDC; token1 = $WETH; fee = 3000 },
        @{ token0 = $USDC; token1 = $USDbC; fee = 500 }
    )
} | ConvertTo-Json -Compress

Test-Endpoint -Method "POST" -Endpoint "/api/v1/uniswap-v4/pools/batch" -Description "Batch Pool Query" -Body $batchBody

# Swap Quote
Write-Host ""
Write-Host "💱 Swap Quotes" -ForegroundColor Yellow
Write-Host "--------------" -ForegroundColor Yellow
Test-Endpoint -Method "GET" -Endpoint "/api/v1/uniswap-v4/swap/quote?tokenIn=$USDC&tokenOut=$WETH&amountIn=1000000&fee=3000" -Description "Swap Quote (1 USDC)"
Test-Endpoint -Method "GET" -Endpoint "/api/v1/uniswap-v4/swap/quote?tokenIn=$WETH&tokenOut=$USDC&amountIn=1000000000000000&fee=3000" -Description "Swap Quote (0.001 WETH)"

# Solver
Write-Host ""
Write-Host "🔍 Solver" -ForegroundColor Yellow
Write-Host "---------" -ForegroundColor Yellow
Test-Endpoint -Method "GET" -Endpoint "/api/v1/uniswap-v4/solver/check?address=$USDC" -Description "Check Solver Status"

# Swagger Docs
Write-Host ""
Write-Host "📖 Documentation" -ForegroundColor Yellow
Write-Host "----------------" -ForegroundColor Yellow
Test-Endpoint -Method "GET" -Endpoint "/docs/openapi.json" -Description "OpenAPI Spec"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Test Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "View interactive docs at: $BaseUrl/docs" -ForegroundColor Cyan
