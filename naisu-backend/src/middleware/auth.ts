/**
 * Authentication Middleware
 * Minimal auth for Uniswap V4 backend (read-only)
 */
import type { MiddlewareHandler } from 'hono'
import { config } from '@config/env'

/**
 * Admin authentication middleware
 * For admin-only endpoints
 */
export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const apiKey = c.req.header(config.security.apiKeyHeader)

  // In development, allow all
  if (config.server.isDev) {
    await next()
    return
  }

  if (!apiKey) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing API key',
        },
      },
      401
    )
  }

  // TODO: Implement proper API key validation

  await next()
}
