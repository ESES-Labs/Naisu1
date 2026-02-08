/**
 * Error Handler Middleware
 */
import type { ErrorHandler } from 'hono'
import { ZodError } from 'zod'
import { logger } from '@lib/logger'
import { AppError } from '@utils/validation'

export const errorHandler: ErrorHandler = (err, c) => {
  // Log error
  logger.error(
    {
      error: err.message,
      stack: err.stack,
      path: c.req.path,
      method: c.req.method,
    },
    'Request error'
  )

  // Zod validation errors
  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }))

    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          issues,
        },
      },
      400
    )
  }

  // Application errors
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      },
      err.status as 400 | 401 | 403 | 404 | 409 | 500
    )
  }

  // Database errors
  if (err instanceof Error && err.message?.includes('unique constraint')) {
    return c.json(
      {
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'Resource already exists',
        },
      },
      409
    )
  }

  // Generic error response
  const isDev = process.env.NODE_ENV === 'development'

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: isDev ? err.message : 'Internal server error',
        ...(isDev && { stack: err.stack }),
      },
    },
    500
  )
}
