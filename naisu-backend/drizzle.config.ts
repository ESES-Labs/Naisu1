import type { Config } from 'drizzle-kit'
import { config } from './src/config/env'

export default {
  schema: './src/models/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.database.url,
  },
  // Enable strict mode for type safety
  strict: true,
  // Generate verbose output
  verbose: true,
} satisfies Config
