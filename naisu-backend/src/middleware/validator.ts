/**
 * Additional Validation Middleware
 */
import type { MiddlewareHandler } from 'hono'

/**
 * Validate Sui address format
 */
export function validateSuiAddress(paramName: string = 'address'): MiddlewareHandler {
  return async (c, next) => {
    const address = c.req.param(paramName) || c.req.query(paramName)

    if (!address) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Missing ${paramName}`,
          },
        },
        400
      )
    }

    const suiAddressRegex = /^0x[a-fA-F0-9]{64}$/

    if (!suiAddressRegex.test(address)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid Sui address format for ${paramName}`,
          },
        },
        400
      )
    }

    await next()
  }
}

/**
 * Validate EVM address format
 */
export function validateEvmAddress(paramName: string = 'address'): MiddlewareHandler {
  return async (c, next) => {
    const address = c.req.param(paramName) || c.req.query(paramName)

    if (!address) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Missing ${paramName}`,
          },
        },
        400
      )
    }

    const evmAddressRegex = /^0x[a-fA-F0-9]{40}$/i

    if (!evmAddressRegex.test(address)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid EVM address format for ${paramName}`,
          },
        },
        400
      )
    }

    await next()
  }
}
