/**
 * OpenAPI / Swagger Configuration
 * API documentation for Uniswap V4 endpoints
 */
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  poolQuerySchema,
  positionQuerySchema,
  swapQuoteSchema,
  solverCheckSchema,
  batchPoolQuerySchema,
  poolPriceResponseSchema,
  poolStateResponseSchema,
  swapQuoteResponseSchema,
  solverCheckResponseSchema,
  contractAddressesResponseSchema,
  healthResponseSchema,
  errorResponseSchema,
} from '@models/uniswap-v4.model'

// Create OpenAPI-enabled Hono app
export const openapiApp = new OpenAPIHono()

// Health check endpoint
const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Health check',
  description: 'Check if the API is running and healthy',
  responses: {
    200: {
      description: 'Service is healthy',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: z.object({
              status: z.string().openapi({ example: 'healthy' }),
              timestamp: z.string().datetime(),
            }),
          }),
        },
      },
    },
  },
})

// Health detail endpoint
const healthDetailRoute = createRoute({
  method: 'get',
  path: '/health/detail',
  tags: ['Health'],
  summary: 'Detailed health check',
  description: 'Get detailed health status including database connectivity',
  responses: {
    200: {
      description: 'Detailed health status',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: z.object({
              status: z.string().openapi({ example: 'healthy' }),
              checks: z.object({
                database: z.object({
                  status: z.string().openapi({ example: 'healthy' }),
                  responseTime: z.number().openapi({ example: 12 }),
                }),
              }),
            }),
          }),
        },
      },
    },
  },
})

// GET /api/v1/uniswap-v4/pool/price
const poolPriceRoute = createRoute({
  method: 'get',
  path: '/api/v1/uniswap-v4/pool/price',
  tags: ['Uniswap V4 - Pool'],
  summary: 'Get pool price',
  description: 'Get the current price and tick for a Uniswap V4 pool',
  request: {
    query: poolQuerySchema,
  },
  responses: {
    200: {
      description: 'Pool price data',
      content: {
        'application/json': {
          schema: poolPriceResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request parameters',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

// GET /api/v1/uniswap-v4/pool/state
const poolStateRoute = createRoute({
  method: 'get',
  path: '/api/v1/uniswap-v4/pool/state',
  tags: ['Uniswap V4 - Pool'],
  summary: 'Get pool state',
  description: 'Get comprehensive pool state including liquidity, fees, and sqrtPrice',
  request: {
    query: poolQuerySchema,
  },
  responses: {
    200: {
      description: 'Pool state data',
      content: {
        'application/json': {
          schema: poolStateResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request parameters',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

// GET /api/v1/uniswap-v4/swap/quote
const swapQuoteRoute = createRoute({
  method: 'get',
  path: '/api/v1/uniswap-v4/swap/quote',
  tags: ['Uniswap V4 - Swap'],
  summary: 'Get swap quote',
  description: 'Calculate expected output amount for a swap',
  request: {
    query: swapQuoteSchema,
  },
  responses: {
    200: {
      description: 'Swap quote data',
      content: {
        'application/json': {
          schema: swapQuoteResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request parameters',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

// GET /api/v1/uniswap-v4/solver/check
const solverCheckRoute = createRoute({
  method: 'get',
  path: '/api/v1/uniswap-v4/solver/check',
  tags: ['Uniswap V4 - Solver'],
  summary: 'Check solver status',
  description: 'Check if an address is an authorized solver',
  request: {
    query: solverCheckSchema,
  },
  responses: {
    200: {
      description: 'Solver status',
      content: {
        'application/json': {
          schema: solverCheckResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request parameters',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

// GET /api/v1/uniswap-v4/addresses
const contractAddressesRoute = createRoute({
  method: 'get',
  path: '/api/v1/uniswap-v4/addresses',
  tags: ['Uniswap V4 - Contract'],
  summary: 'Get contract addresses',
  description: 'Get all Uniswap V4 contract addresses for the current network',
  responses: {
    200: {
      description: 'Contract addresses',
      content: {
        'application/json': {
          schema: contractAddressesResponseSchema,
        },
      },
    },
  },
})

// Generate OpenAPI document metadata
export const openapiConfig = {
  openapi: '3.0.0',
  info: {
    title: 'Naisu Uniswap V4 API',
    description: 'REST API for querying Uniswap V4 contracts on Base Sepolia/Mainnet',
    version: '1.0.0',
    contact: {
      name: 'Naisu Team',
      url: 'https://github.com/eseslabs',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
    {
      url: 'https://api.naisu.one',
      description: 'Production server',
    },
  ],
}

// Export routes for registration
export const routes = {
  health: healthRoute,
  healthDetail: healthDetailRoute,
  poolPrice: poolPriceRoute,
  poolState: poolStateRoute,
  swapQuote: swapQuoteRoute,
  solverCheck: solverCheckRoute,
  contractAddresses: contractAddressesRoute,
}
