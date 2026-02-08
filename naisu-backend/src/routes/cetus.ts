/**
 * Cetus CLMM API Routes
 * 
 * REST API endpoints for AI agent to interact with Cetus on Sui.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { logger } from '@lib/logger'
import * as cetusService from '@services/cetus.service'

export const cetusRouter = new Hono()

// ============================================================================
// Schemas
// ============================================================================

const SwapSchema = z.object({
    poolId: z.string().startsWith('0x'),
    amountIn: z.string(),
    aToB: z.boolean(),
})

const QuoteSchema = z.object({
    poolId: z.string().startsWith('0x'),
    amountIn: z.string(),
    aToB: z.boolean(),
})

const PositionsSchema = z.object({
    owner: z.string().startsWith('0x'),
})

const BalanceSchema = z.object({
    owner: z.string().startsWith('0x'),
    coinType: z.string().optional(),
})

const GetCoinsSchema = z.object({
    owner: z.string().startsWith('0x'),
    coinType: z.string(),
})

const ZapSchema = z.object({
    poolId: z.string().startsWith('0x'),
    amountIn: z.string(),
    minLiquidity: z.string().optional(),
})

const ZapBuildSchema = z.object({
    poolId: z.string().startsWith('0x'),
    coinObjectIds: z.array(z.string().startsWith('0x')),
    amountIn: z.string(),
    userAddress: z.string().startsWith('0x'),
})

const ZapQuoteSchema = z.object({
    poolId: z.string().startsWith('0x'),
    amountIn: z.string(),
})

const RemoveLiquidityBuildSchema = z.object({
    positionId: z.string().startsWith('0x'),
    liquidityDelta: z.string(),
    userAddress: z.string().startsWith('0x'),
})

const HarvestSchema = z.object({
    positionId: z.string().startsWith('0x'),
})

const HarvestBuildSchema = z.object({
    positionId: z.string().startsWith('0x'),
    userAddress: z.string().startsWith('0x'),
})

// ============================================================================
// GET /pools - List available pools
// ============================================================================

cetusRouter.get('/pools', async (c) => {
    try {
        const pools = cetusService.listPools()
        return c.json({
            success: true,
            data: pools,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to list pools')
        return c.json({ success: false, error: String(error) }, 500)
    }
})

// ============================================================================
// GET /pool/:id - Get pool info
// ============================================================================

cetusRouter.get('/pool/:id', async (c) => {
    try {
        const poolId = c.req.param('id')
        const pool = await cetusService.getPoolInfo(poolId)
        return c.json({
            success: true,
            data: pool,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to get pool info')
        return c.json({ success: false, error: String(error) }, 500)
    }
})

// ============================================================================
// POST /quote - Get swap quote (no execution)
// ============================================================================

cetusRouter.post('/quote', zValidator('json', QuoteSchema), async (c) => {
    try {
        const body = c.req.valid('json')
        const quote = await cetusService.getQuote(body)
        return c.json({
            success: true,
            data: quote,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to get quote')
        return c.json({ success: false, error: String(error) }, 500)
    }
})

// ============================================================================
// POST /swap - Execute swap transaction
// ============================================================================

cetusRouter.post('/swap', zValidator('json', SwapSchema), async (c) => {
    try {
        const body = c.req.valid('json')
        logger.info({ body }, 'Executing swap')

        const result = await cetusService.executeSwap(body)

        return c.json({
            success: result.success,
            data: result,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to execute swap')
        return c.json({ success: false, error: String(error) }, 500)
    }
})

// ============================================================================
// POST /positions - Get positions for owner
// ============================================================================

cetusRouter.post('/positions', zValidator('json', PositionsSchema), async (c) => {
    try {
        const { owner } = c.req.valid('json')
        const positions = await cetusService.getPositions(owner)
        return c.json({
            success: true,
            data: positions,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to get positions')
        return c.json({ success: false, error: String(error) }, 500)
    }
})

// ============================================================================
// POST /balance - Get balance for owner
// ============================================================================

cetusRouter.post('/balance', zValidator('json', BalanceSchema), async (c) => {
    try {
        const { owner, coinType } = c.req.valid('json')
        const balance = await cetusService.getBalance(owner, coinType)
        return c.json({
            success: true,
            data: balance,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to get balance')
        return c.json({ success: false, error: String(error) }, 500)
    }
})

// ============================================================================
// POST /coins - Get coin object IDs for owner (for building TX)
// ============================================================================

cetusRouter.post('/coins', zValidator('json', GetCoinsSchema), async (c) => {
    try {
        const { owner, coinType } = c.req.valid('json')
        const coins = await cetusService.getCoinObjects(owner, coinType)
        return c.json({
            success: true,
            data: coins,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to get coins')
        return c.json({ success: false, error: String(error) }, 500)
    }
})

// ============================================================================
// POST /zap - Execute zap (single-sided deposit)
// CRITICAL for Intent Bridge → Yield flow
// ============================================================================

cetusRouter.post('/zap', zValidator('json', ZapSchema), async (c) => {
    try {
        const body = c.req.valid('json')
        logger.info({ body }, 'Executing zap')

        const result = await cetusService.executeZap(body)

        return c.json({
            success: result.success,
            data: result,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to execute zap')
        return c.json({ success: false, error: String(error) }, 500)
    }
})

// ============================================================================
// POST /harvest - Collect fees from position
// ============================================================================

cetusRouter.post('/harvest', zValidator('json', HarvestSchema), async (c) => {
    try {
        const body = c.req.valid('json')
        logger.info({ body }, 'Harvesting fees')

        const result = await cetusService.executeHarvest(body)

        return c.json({
            success: result.success,
            data: result,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to harvest fees')
        return c.json({ success: false, error: String(error) }, 500)
    }
})

// ============================================================================
// POST /zap/build - Build unsigned zap transaction (for AI Agent)
// Agent calls this, gets TX bytes, passes to user to sign
// ============================================================================

cetusRouter.post('/zap/build', zValidator('json', ZapBuildSchema), async (c) => {
    try {
        const body = c.req.valid('json')
        logger.info({ body }, 'Building zap transaction')

        const result = await cetusService.buildZapTx(body)

        return c.json({
            success: true,
            data: result,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to build zap transaction')
        return c.json({ success: false, error: String(error) }, 500)
    }
})

// ============================================================================
// POST /harvest/build - Build unsigned harvest transaction (for AI Agent)
// Agent calls this, gets TX bytes, passes to user to sign
// ============================================================================

cetusRouter.post('/harvest/build', zValidator('json', HarvestBuildSchema), async (c) => {
    try {
        const body = c.req.valid('json')
        logger.info({ body }, 'Building harvest transaction')

        const result = await cetusService.buildHarvestTx(body)

        return c.json({
            success: true,
            data: result,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to build harvest transaction')
        return c.json({ success: false, error: String(error) }, 500)
    }
})

// ============================================================================
// POST /zap/quote - Get quote for zap (preview before executing)
// Shows expected liquidity, swap amounts, price impact
// ============================================================================

cetusRouter.post('/zap/quote', zValidator('json', ZapQuoteSchema), async (c) => {
    try {
        const body = c.req.valid('json')
        logger.info({ body }, 'Getting zap quote')

        const result = await cetusService.getZapQuote(body)

        return c.json({
            success: true,
            data: result,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to get zap quote')
        return c.json({ success: false, error: String(error) }, 500)
    }
})

// ============================================================================
// POST /remove-liquidity/build - Build unsigned remove liquidity transaction
// Returns unsigned TX for removing liquidity from position
// ============================================================================

cetusRouter.post('/remove-liquidity/build', zValidator('json', RemoveLiquidityBuildSchema), async (c) => {
    try {
        const body = c.req.valid('json')
        logger.info({ body }, 'Building remove liquidity transaction')

        const result = await cetusService.buildRemoveLiquidityTx(body)

        return c.json({
            success: true,
            data: result,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to build remove liquidity transaction')
        return c.json({ success: false, error: String(error) }, 500)
    }
})
