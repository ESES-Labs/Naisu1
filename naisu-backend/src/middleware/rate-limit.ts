/**
 * Rate Limit Middleware
 * Simple in-memory rate limiting
 */
import type { MiddlewareHandler } from 'hono'
import { logger } from '@lib/logger'

interface RateLimitStore {
  count: number
  resetTime: number
}

// In-memory store (use Redis in production)
const store = new Map<string, RateLimitStore>()

interface RateLimitOptions {
  windowMs?: number
  maxRequests?: number
  keyGenerator?: (c: { req: { header: (name: string) => string | undefined } }) => string
}

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of store.entries()) {
    if (value.resetTime < now) {
      store.delete(key)
    }
  }
}, 60000) // Clean up every minute

export function rateLimit(options: RateLimitOptions = {}): MiddlewareHandler {
  const {
    windowMs = 60000,
    maxRequests = 100,
    keyGenerator = (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
  } = options

  return async (c, next) => {
    const key = keyGenerator(c)
    const now = Date.now()

    let record = store.get(key)

    if (!record || record.resetTime < now) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      }
      store.set(key, record)
    }

    record.count++

    // Set rate limit headers
    c.header('X-RateLimit-Limit', maxRequests.toString())
    c.header('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count).toString())
    c.header('X-RateLimit-Reset', record.resetTime.toString())

    if (record.count > maxRequests) {
      logger.warn({ key, count: record.count }, 'Rate limit exceeded')

      return c.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests, please try again later',
            retryAfter: Math.ceil((record.resetTime - now) / 1000),
          },
        },
        429
      )
    }

    await next()
  }
}
