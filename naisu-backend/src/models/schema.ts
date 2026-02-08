/**
 * Drizzle ORM Schema Definitions
 * Minimal schema for Uniswap V4 backend
 */
import { pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core'

// Simple health check / metadata table
export const metadata = pgTable('metadata', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: varchar('value', { length: 500 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Metadata = typeof metadata.$inferSelect
export type NewMetadata = typeof metadata.$inferInsert
