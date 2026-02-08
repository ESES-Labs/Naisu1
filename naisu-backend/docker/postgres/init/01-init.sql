-- =============================================================================
-- Naisu Backend - PostgreSQL Initialization Script
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Notes:
-- This file runs automatically when PostgreSQL container starts for the first time.
-- Drizzle ORM will handle actual table creation through migrations.
-- This script just ensures the database is properly configured.
-- =============================================================================
