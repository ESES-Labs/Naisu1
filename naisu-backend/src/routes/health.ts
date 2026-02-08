/**
 * Health Check Routes
 */
import { Hono } from 'hono'
import { getDb } from '@lib/db'
import { sql } from 'drizzle-orm'
import { config } from '@config/env'
import { logger } from '@lib/logger'

export const healthRouter = new Hono()

/**
 * Basic health check
 * GET /health
 */
healthRouter.get('/', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.server.env,
    },
  })
})

/**
 * Detailed health check
 * GET /health/detail
 */
healthRouter.get('/detail', async (c) => {
  const checks: Record<string, { status: string; responseTime?: number; error?: string }> = {}

  // Database check (optional)
  if (config.database.url) {
    const dbStart = Date.now()
    try {
      const db = getDb()
      if (db) {
        await db.execute(sql`SELECT 1`)
        checks.database = {
          status: 'healthy',
          responseTime: Date.now() - dbStart,
        }
      } else {
        checks.database = {
          status: 'skipped',
          error: 'Database not initialized',
        }
      }
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        responseTime: Date.now() - dbStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  } else {
    checks.database = {
      status: 'disabled',
    }
  }

  // EVM connection check
  const evmStart = Date.now()
  try {
    const { getPublicClient } = await import('@lib/evm-client')
    const client = getPublicClient()
    await client.getBlockNumber()
    checks.evm = {
      status: 'healthy',
      responseTime: Date.now() - evmStart,
    }
  } catch (error) {
    logger.error({ error }, 'EVM health check failed')
    checks.evm = {
      status: 'unhealthy',
      responseTime: Date.now() - evmStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Determine overall status
  const allHealthy = Object.values(checks).every(
    (check) =>
      check.status === 'healthy' || check.status === 'disabled' || check.status === 'skipped'
  )

  const hasError = Object.values(checks).some((check) => check.status === 'unhealthy')

  return c.json(
    {
      success: !hasError,
      data: {
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: config.server.env,
        checks,
      },
    },
    hasError ? 503 : 200
  )
})
