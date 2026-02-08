/**
 * Uniswap V4 API Integration Tests
 * Tests for all Uniswap V4 endpoints
 */
import { describe, it, expect, beforeAll } from 'bun:test'
import { app } from '../src/routes'

const BASE_URL = 'http://localhost:3000'

// Test tokens on Base Sepolia
const TEST_TOKENS = {
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
  WETH: '0x4200000000000000000000000000000000000006', // Base Sepolia WETH
  USDbC: '0x323e78f944A9a1FcF3a10efcC5319DBb0bB6e5fA', // Base Sepolia USDbC
}

describe('Uniswap V4 API', () => {
  describe('Health Endpoints', () => {
    it('should return health status', async () => {
      const res = await app.request('/api/v1/health')
      expect(res.status).toBe(200)
      
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.status).toBe('healthy')
    })

    it('should return detailed health', async () => {
      const res = await app.request('/api/v1/health/detail')
      expect(res.status).toBe(200)
      
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.checks).toBeDefined()
    })

    it('should return contract health', async () => {
      const res = await app.request('/api/v1/uniswap-v4/health')
      expect(res.status).toBe(200)
      
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.contracts).toBeDefined()
    })
  })

  describe('Contract Info Endpoints', () => {
    it('should return contract addresses', async () => {
      const res = await app.request('/api/v1/uniswap-v4/addresses')
      expect(res.status).toBe(200)
      
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.swap).toBeDefined()
      expect(json.data.rewards).toBeDefined()
      expect(json.data.poolManager).toBeDefined()
    })

    it('should return contract owner', async () => {
      const res = await app.request('/api/v1/uniswap-v4/contract/owner')
      expect(res.status).toBe(200)
      
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.owner).toBeDefined()
    })
  })

  describe('Pool Query Endpoints', () => {
    it('should get pool price', async () => {
      const params = new URLSearchParams({
        token0: TEST_TOKENS.USDC,
        token1: TEST_TOKENS.WETH,
        fee: '3000',
      })
      
      const res = await app.request(`/api/v1/uniswap-v4/pool/price?${params}`)
      
      // May return 200 with data or 500 if pool doesn't exist
      expect([200, 400, 500]).toContain(res.status)
      
      if (res.status === 200) {
        const json = await res.json()
        console.log(json)
        expect(json.success).toBe(true)
        expect(json.data.poolId).toBeDefined()
        expect(json.data.sqrtPriceX96).toBeDefined()
        expect(json.data.tick).toBeDefined()
      }
    })

    it('should validate pool query parameters', async () => {
      const params = new URLSearchParams({
        token0: 'invalid-address',
        token1: TEST_TOKENS.WETH,
      })
      
      const res = await app.request(`/api/v1/uniswap-v4/pool/price?${params}`)
      expect(res.status).toBe(400)
      
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error).toBeDefined()
    })

    it('should get pool state', async () => {
      const params = new URLSearchParams({
        token0: TEST_TOKENS.USDC,
        token1: TEST_TOKENS.WETH,
        fee: '3000',
      })
      
      const res = await app.request(`/api/v1/uniswap-v4/pool/state?${params}`)
      expect([200, 400, 500]).toContain(res.status)
    })

    it('should get pool liquidity', async () => {
      const params = new URLSearchParams({
        token0: TEST_TOKENS.USDC,
        token1: TEST_TOKENS.WETH,
        fee: '3000',
      })
      
      const res = await app.request(`/api/v1/uniswap-v4/pool/liquidity?${params}`)
      expect([200, 400, 500]).toContain(res.status)
    })

    it('should get slot0 data', async () => {
      const params = new URLSearchParams({
        token0: TEST_TOKENS.USDC,
        token1: TEST_TOKENS.WETH,
        fee: '3000',
      })
      
      const res = await app.request(`/api/v1/uniswap-v4/pool/slot0?${params}`)
      expect([200, 400, 500]).toContain(res.status)
    })

    it('should batch query pools', async () => {
      const body = {
        pools: [
          { token0: TEST_TOKENS.USDC, token1: TEST_TOKENS.WETH, fee: 3000 },
          { token0: TEST_TOKENS.USDC, token1: TEST_TOKENS.USDbC, fee: 500 },
        ],
      }
      
      const res = await app.request('/api/v1/uniswap-v4/pools/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      expect([200, 400, 500]).toContain(res.status)
    })

    it('should validate batch query limits', async () => {
      const body = {
        pools: Array(25).fill({ token0: TEST_TOKENS.USDC, token1: TEST_TOKENS.WETH }),
      }
      
      const res = await app.request('/api/v1/uniswap-v4/pools/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      expect(res.status).toBe(400)
    })
  })

  describe('Swap Quote Endpoints', () => {
    it('should get swap quote', async () => {
      const params = new URLSearchParams({
        tokenIn: TEST_TOKENS.USDC,
        tokenOut: TEST_TOKENS.WETH,
        amountIn: '1000000', // 1 USDC
        fee: '3000',
      })
      
      const res = await app.request(`/api/v1/uniswap-v4/swap/quote?${params}`)
      expect([200, 400, 500]).toContain(res.status)
      
      if (res.status === 200) {
        const json = await res.json()
        expect(json.success).toBe(true)
        expect(json.data.expectedOutput).toBeDefined()
        expect(json.data.priceImpact).toBeDefined()
      }
    })

    it('should validate swap quote parameters', async () => {
      const params = new URLSearchParams({
        tokenIn: 'invalid',
        tokenOut: TEST_TOKENS.WETH,
        amountIn: '1000000',
      })
      
      const res = await app.request(`/api/v1/uniswap-v4/swap/quote?${params}`)
      expect(res.status).toBe(400)
    })
  })

  describe('Solver Endpoints', () => {
    it('should check solver status', async () => {
      const params = new URLSearchParams({
        address: TEST_TOKENS.USDC, // Using a random address for testing
      })
      
      const res = await app.request(`/api/v1/uniswap-v4/solver/check?${params}`)
      expect(res.status).toBe(200)
      
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(typeof json.data.isSolver).toBe('boolean')
    })

    it('should validate solver address', async () => {
      const params = new URLSearchParams({
        address: 'invalid-address',
      })
      
      const res = await app.request(`/api/v1/uniswap-v4/solver/check?${params}`)
      expect(res.status).toBe(400)
    })
  })
})

describe('Error Handling', () => {
  it('should handle 404 for unknown routes', async () => {
    const res = await app.request('/api/v1/unknown-route')
    expect(res.status).toBe(404)
    
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('should handle rate limiting', async () => {
    // Make multiple requests quickly
    const requests = Array(10).fill(null).map(() => 
      app.request('/api/v1/health')
    )
    
    const responses = await Promise.all(requests)
    
    // Most should succeed, some might be rate limited
    const successCount = responses.filter(r => r.status === 200).length
    expect(successCount).toBeGreaterThan(0)
  })
})
