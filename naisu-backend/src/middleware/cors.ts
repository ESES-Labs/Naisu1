/**
 * CORS Configuration
 * Cross-Origin Resource Sharing settings
 */
import { cors } from 'hono/cors'
import { config } from '../config/env'

export const corsMiddleware = cors({
  origin: config.cors.origin === '*' ? '*' : config.cors.origin.split(','),
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400, // 24 hours
})
