# =============================================================================
# Naisu Backend - Production Docker Image
# Based on Bun runtime with Hono framework
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy dependency files first for better caching
COPY package.json bun.lock ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY . .

# Build the application
RUN bun build src/index.ts --outdir ./dist --target bun

# -----------------------------------------------------------------------------
# Stage 3: Production Runner
# -----------------------------------------------------------------------------
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 bunjs && \
    adduser --system --uid 1001 naisu

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy production dependencies
COPY --from=deps --chown=naisu:bunjs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=naisu:bunjs /app/dist ./dist

# Copy necessary source files for runtime (if needed)
COPY --from=builder --chown=naisu:bunjs /app/package.json ./

# Switch to non-root user
USER naisu

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:3000/api/v1/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run the application
CMD ["bun", "run", "dist/index.js"]
