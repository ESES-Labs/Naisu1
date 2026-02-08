/**
 * Database Connection (Optional)
 * Drizzle ORM with PostgreSQL - only used if DATABASE_URL is provided
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { config } from '@config/env'
import { logger } from './logger'
import * as schema from '@models/schema'

// ============================================================================
// Connection Pool (Lazy initialization)
// ============================================================================

let pool: Pool | null = null
let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!config.database.url) {
    return null
  }

  if (!db) {
    pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    pool.on('error', (err) => {
      logger.error({ error: err }, 'Unexpected database pool error')
    })

    db = drizzle(pool, {
      schema,
      logger: config.server.isDev
        ? {
            logQuery: (query, params) => {
              logger.debug({ query, params }, 'Database query')
            },
          }
        : undefined,
    })

    logger.info('Database connection initialized')
  }

  return db
}

// ============================================================================
// Connection Test
// ============================================================================

export async function testConnection(): Promise<boolean> {
  if (!config.database.url) {
    logger.info('No DATABASE_URL configured, running without database')
    return true
  }

  try {
    const database = getDb()
    if (!database) return false

    // Simple test query
    await database.select().from(schema.metadata).limit(1)
    logger.info('Database connection successful')
    return true
  } catch (error) {
    logger.error({ error }, 'Database connection failed')
    return false
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

export async function closeConnection(): Promise<void> {
  if (pool) {
    logger.info('Closing database connection pool...')
    await pool.end()
    logger.info('Database connection pool closed')
  }
}
